// Package handler: `misc` wave — 15/238 non-admin routes.
// ----
// Covers the exact baseline split in .migration/spec_misc.json:
// /api/feedback, /api/analytics/*, /api/seo/indexnow-key, /api/webhooks/{bilibili,douyin}
// and 9 legacy MuAPI scoped-proxy routes.
// ----
// All handlers are real: request validation, error codes/messages, rate limiting, challenge
// handshakes, credential resolution, and upstream passthrough mirror the Supdance Pro sources.
// Persistent writes use d.Pool (4-schema PG); when it is nil the handler returns an explicit
// 503 DB_UNAVAILABLE instead of fabricating data.
package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
	"one/backend/internal/pkg/ids"
	"one/backend/internal/platform/coordination"
)

func init() {
	registerBatch(func(d *Dependencies, mount mountFunc) {
		mount("GET", "/api/feedback", wrapDomain(d, "authenticated_or_domain", miscFeedback))
		mount("POST", "/api/feedback", wrapDomain(d, "authenticated_or_domain", miscFeedback))
		mount("GET", "/api/feedback/[id]/attachments/[index]", wrapDomain(d, "authenticated_or_domain", feedbackOwnerAttachment))
		mount("POST", "/api/analytics/track", wrapDomain(d, "public", miscAnalyticsTrack))
		mount("POST", "/api/analytics/banner-event", wrapDomain(d, "public", miscBannerEvent))
		// Source webhook/IndexNow routes call no auth helper at all: they are public platform
		// callbacks / verification endpoints. The manifest conservatively marks them
		// authenticated_or_domain, but forcing a session here would break Bilibili/Douyin
		// handshakes and IndexNow key retrieval. Keep them public.
		mount("GET", "/api/seo/indexnow-key", wrapDomain(d, "public", miscIndexNowKey))
		mount("GET", "/api/webhooks/bilibili", wrapDomain(d, "public", miscWebhookBilibili))
		mount("POST", "/api/webhooks/bilibili", wrapDomain(d, "public", miscWebhookBilibili))
		mount("GET", "/api/webhooks/douyin", wrapDomain(d, "public", miscWebhookDouyin))
		mount("POST", "/api/webhooks/douyin", wrapDomain(d, "public", miscWebhookDouyin))

		for _, spec := range []struct {
			method string
			path   string
		}{
			{"GET", "/api/agents/[[...path]]"}, {"POST", "/api/agents/[[...path]]"},
			{"PUT", "/api/agents/[[...path]]"}, {"DELETE", "/api/agents/[[...path]]"},
			{"GET", "/api/app/[[...path]]"}, {"POST", "/api/app/[[...path]]"},
			{"PUT", "/api/app/[[...path]]"}, {"DELETE", "/api/app/[[...path]]"},
			{"GET", "/api/api/v1/[[...path]]"}, {"POST", "/api/api/v1/[[...path]]"},
			{"GET", "/api/v1/[[...path]]"}, {"POST", "/api/v1/[[...path]]"},
			{"GET", "/api/v1/creative-agent/[[...path]]"}, {"POST", "/api/v1/creative-agent/[[...path]]"},
			{"PATCH", "/api/v1/creative-agent/[[...path]]"}, {"DELETE", "/api/v1/creative-agent/[[...path]]"},
			{"GET", "/api/workflow/[[...path]]"}, {"POST", "/api/workflow/[[...path]]"},
			{"PUT", "/api/workflow/[[...path]]"}, {"DELETE", "/api/workflow/[[...path]]"},
		} {
			mount(spec.method, spec.path, wrapDomain(d, "legacyProxy", miscScopedProxy))
		}

		// Three distinct manifest routes with their own source files (not catch-all aliases).
		mount("GET", "/api/app/models/available", wrapDomain(d, "legacyProxy", miscAppModelsAvailable))
		mount("GET", "/api/v1/get_upload_url", wrapDomain(d, "legacyProxy", miscV1GetUploadURL))
		mount("POST", "/api/v1/upload-binary", wrapDomain(d, "legacyProxy", miscV1UploadBinary))
	})
}

// ---------------------------------------------------------------------------
// /api/feedback (GET/POST) — app/api/feedback/route.js + lib/services/feedback.js
// ---------------------------------------------------------------------------

func miscFeedback(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser) {
	if u == nil {
		if r.Method == http.MethodGet {
			envelope.DomainError(w, http.StatusUnauthorized, "请先登录", "UNAUTHORIZED")
		} else {
			envelope.DomainError(w, http.StatusUnauthorized, "请先登录后再提交", "UNAUTHORIZED")
		}
		return
	}
	if !coreExpectedOwner(w, r, envelope.FormatDirectDomainJSON, u.ID, "FEEDBACK_ACCOUNT_CHANGED") {
		return
	}
	if d.Pool == nil {
		dbUnavailable(w, r, envelope.FormatDirectDomainJSON)
		return
	}
	if r.Method == http.MethodGet {
		rows, err := d.Pool.Query(r.Context(), `
			SELECT id, kind, title, page_url, github_url, attachments, status, reward_coins,
			       review_note, reviewed_at, created_at
			FROM ops_bill.feedback_reports
			WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, u.ID)
		if err != nil {
			envelope.DomainError(w, http.StatusInternalServerError, "获取提交记录失败", "INTERNAL_ERROR")
			return
		}
		defer rows.Close()
		items := make([]map[string]any, 0)
		for rows.Next() {
			var id, kind, title, status string
			var pageURL, githubURL, reviewNote any
			var attachments []byte
			var reward float64
			var reviewedAt, createdAt any
			if err := rows.Scan(&id, &kind, &title, &pageURL, &githubURL, &attachments, &status, &reward, &reviewNote, &reviewedAt, &createdAt); err != nil {
				envelope.DomainError(w, http.StatusServiceUnavailable, "获取提交记录失败", "FEEDBACK_READ_FAILED")
				return
			}
			items = append(items, map[string]any{
				"id": id, "kind": kind, "title": title, "page_url": pageURL,
				"github_url": githubURL, "attachments": json.RawMessage(attachments),
				"status": status, "reward_coins": reward, "review_note": reviewNote,
				"reviewed_at": reviewedAt, "created_at": createdAt,
				"pageUrl": pageURL, "rewardCoins": reward, "reviewNote": reviewNote, "createdAt": createdAt,
			})
		}
		if rows.Err() != nil {
			envelope.DomainError(w, http.StatusServiceUnavailable, "获取提交记录失败", "FEEDBACK_READ_FAILED")
			return
		}
		for _, item := range items {
			list, err := feedbackAttachmentMetadata(item["id"].(string), item["attachments"], false)
			if err != nil {
				envelope.DomainError(w, http.StatusServiceUnavailable, "获取附件记录失败", "FEEDBACK_READ_FAILED")
				return
			}
			item["attachments"] = list
			item["attachmentCount"] = len(list)
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}

	// POST: rate limit 10/hour, JSON or multipart body, exact validation from sanitizeSubmit.
	res, err := miscConsumeRateLimit(r.Context(), d, "feedback_submit", u.ID, 10, time.Hour)
	if err != nil {
		envelope.DomainError(w, http.StatusServiceUnavailable, "暂时无法提交，请稍后重试", "FEEDBACK_SAVE_FAILED")
		return
	}
	if !res.Allowed {
		miscWriteRateLimited(w, res)
		return
	}

	var body struct {
		Kind      string `json:"kind"`
		Title     string `json:"title"`
		PageURL   string `json:"pageUrl"`
		GithubURL string `json:"githubUrl"`
		Detail    string `json:"detail"`
	}
	if strings.Contains(strings.ToLower(r.Header.Get("Content-Type")), "multipart/form-data") {
		r.Body = http.MaxBytesReader(w, r.Body, feedbackMaxBytes+(1<<20))
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			writeFeedbackError(w, feedbackMultipartError(err))
			return
		}
		defer r.MultipartForm.RemoveAll()
		body.Kind = r.FormValue("kind")
		body.Title = r.FormValue("title")
		body.PageURL = firstNonEmptyValues(r.FormValue("pageUrl"), r.FormValue("page_url"))
		body.GithubURL = firstNonEmptyValues(r.FormValue("githubUrl"), r.FormValue("github_url"))
		body.Detail = r.FormValue("detail")
	} else if !decodeJSONBody(w, r, 64*1024, &body) {
		return
	}

	kind := body.Kind
	if kind != "bug_report" && kind != "improvement" && kind != "security" {
		envelope.DomainError(w, http.StatusBadRequest, "提交类型无效，请重新选择", "FEEDBACK_INVALID")
		return
	}
	title := strings.TrimSpace(body.Title)
	if len([]rune(title)) > 200 {
		title = string([]rune(title)[:200])
	}
	detail := strings.TrimSpace(body.Detail)
	if len([]rune(detail)) > 4000 {
		detail = string([]rune(detail)[:4000])
	}
	if len([]rune(title)) < 5 {
		envelope.DomainError(w, http.StatusBadRequest, "请填写不少于 5 个字的标题，方便定位问题", "FEEDBACK_INVALID")
		return
	}
	if len([]rune(detail)) < 20 {
		envelope.DomainError(w, http.StatusBadRequest, "描述不少于 20 个字，请写清复现步骤或改进理由", "FEEDBACK_INVALID")
		return
	}
	pageURL := strings.TrimSpace(body.PageURL)
	if len([]rune(pageURL)) > 500 {
		pageURL = string([]rune(pageURL)[:500])
	}
	githubURL, ghErr := miscNormalizeGithubURL(body.GithubURL)
	if ghErr != "" {
		envelope.DomainError(w, http.StatusBadRequest, ghErr, "FEEDBACK_INVALID")
		return
	}

	id, err := ids.NewPrefixedID("fb")
	if err != nil {
		envelope.DomainError(w, http.StatusInternalServerError, "提交失败，请稍后重试", "INTERNAL_ERROR")
		return
	}
	var pageArg, githubArg any
	if pageURL != "" {
		pageArg = pageURL
	}
	if githubURL != "" {
		githubArg = githubURL
	}
	stored := []feedbackAttachment{}
	if r.MultipartForm != nil {
		var problem *feedbackError
		stored, problem = storeFeedbackAttachments(r.Context(), d.storageSvc(d.Pool), id, u.ID, r.MultipartForm.File["attachments"])
		if problem != nil {
			writeFeedbackError(w, problem)
			return
		}
	}
	attachmentJSON, _ := json.Marshal(stored)
	_, err = d.Pool.Exec(r.Context(), `
		INSERT INTO ops_bill.feedback_reports
		  (id, user_id, kind, title, page_url, github_url, detail, attachments, status, reward_coins, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'pending', 0, now(), now())`,
		id, u.ID, kind, title, pageArg, githubArg, detail, attachmentJSON)
	if err != nil {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 5*time.Second)
		defer cancel()
		var exists bool
		if checkErr := d.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM ops_bill.feedback_reports WHERE id=$1 AND user_id=$2)`, id, u.ID).Scan(&exists); checkErr != nil || !exists {
			if checkErr == nil {
				cleanupFeedbackAttachments(ctx, d.storageSvc(d.Pool), stored)
			}
			envelope.DomainError(w, http.StatusServiceUnavailable, "提交结果暂时无法确认，请查看提交记录后重试", "FEEDBACK_SAVE_FAILED")
			return
		}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"id": id, "message": "提交成功，审核通过后硬币会自动到账",
	})
}

var githubRepoPathRe = regexp.MustCompile(`^/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(/|$)`)

func miscNormalizeGithubURL(raw string) (string, string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", ""
	}
	if len([]rune(raw)) > 500 {
		return "", "GitHub 链接过长，请填写 500 字以内的地址"
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", "GitHub 链接格式不正确，请粘贴完整地址"
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "github.com" && host != "www.github.com" {
		return "", "请填写 github.com 上的仓库或 Issue 链接"
	}
	if !githubRepoPathRe.MatchString(parsed.Path) {
		return "", "请填写具体仓库、Issue 或 PR 的链接"
	}
	return parsed.String(), ""
}

// ---------------------------------------------------------------------------
// /api/analytics/* — app/api/analytics/{track,banner-event}/route.js
// ---------------------------------------------------------------------------

func miscAnalyticsTrack(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser) {
	subject := clientIP(r)
	if u != nil {
		subject = u.ID
	}
	res, err := miscConsumeRateLimit(r.Context(), d, "analytics.track", subject, 180, time.Minute)
	if err != nil || !res.Allowed {
		miscWriteRateLimited(w, res)
		return
	}
	var body struct {
		Action     string         `json:"action"`
		SessionID  string         `json:"sessionId"`
		Category   string         `json:"category"`
		TargetType string         `json:"targetType"`
		TargetID   string         `json:"targetId"`
		ModelName  string         `json:"modelName"`
		Metadata   map[string]any `json:"metadata"`
	}
	if !decodeJSONBody(w, r, 32*1024, &body) {
		return
	}
	action := strings.TrimSpace(body.Action)
	if action == "" {
		envelope.DomainError(w, http.StatusBadRequest, "缺少 action 参数", "VALIDATION_ERROR")
		return
	}
	if d.Pool == nil {
		dbUnavailable(w, r, envelope.FormatDirectDomainJSON)
		return
	}
	category := body.Category
	if category == "" {
		category = "client"
	}
	metadata := body.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	raw, _ := json.Marshal(metadata)
	id, _ := ids.NewPrefixedID("act")
	var userID, sessionID, targetType, targetID, modelName any
	if u != nil {
		userID = u.ID
	}
	if body.SessionID != "" {
		sessionID = body.SessionID
	}
	if body.TargetType != "" {
		targetType = body.TargetType
	}
	if body.TargetID != "" {
		targetID = body.TargetID
	}
	if body.ModelName != "" {
		modelName = body.ModelName
	}
	if _, err := d.Pool.Exec(r.Context(), `
		INSERT INTO sys_core.user_activity_logs
		  (id, user_id, session_id, event_category, event_action, target_type, target_id,
		   model_name, metadata_json, ip, user_agent, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,now())`,
		id, userID, sessionID, category, action, targetType, targetID, modelName,
		raw, clientIP(r), r.Header.Get("User-Agent")); err != nil {
		envelope.DomainJSON(w, http.StatusInternalServerError, map[string]any{"ok": false})
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func miscBannerEvent(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser) {
	res, err := miscConsumeRateLimit(r.Context(), d, "analytics.banner", clientIP(r), 120, time.Minute)
	if err != nil || !res.Allowed {
		miscWriteRateLimited(w, res)
		return
	}
	raw, err := readBodyLimit(r, 64*1024)
	if err != nil {
		envelope.DomainJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	var body map[string]any
	if json.Unmarshal(raw, &body) != nil {
		envelope.DomainJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid JSON"})
		return
	}
	if d.Pool == nil {
		dbUnavailable(w, r, envelope.FormatBinaryRedirectOrText)
		return
	}
	var userID any
	if u != nil {
		userID = u.ID // server session only; body.userId is deliberately ignored
	}
	bannerID := fmt.Sprint(body["bannerId"])
	if bannerID == "" || bannerID == "<nil>" {
		bannerID = "default"
	}
	eventType := fmt.Sprint(body["eventType"])
	locale := fmt.Sprint(body["locale"])
	if locale == "" || locale == "<nil>" {
		locale = "zh-CN"
	}
	_, err = d.Pool.Exec(r.Context(), `
		INSERT INTO ops_bill.banner_events
		  (banner_id, event_type, user_id, anonymous_id, target_url, page_path, locale, user_agent, ip, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
		bannerID, eventType, userID, body["anonymousId"], body["targetUrl"], body["pagePath"],
		locale, r.Header.Get("User-Agent"), clientIP(r))
	if err != nil {
		envelope.DomainJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func miscConsumeRateLimit(ctx context.Context, d *Dependencies, scope, subject string, limit int, window time.Duration) (coordination.RateLimitResult, error) {
	if d.Coord == nil {
		return coordination.RateLimitResult{Allowed: true, Limit: limit, Remaining: limit}, nil
	}
	return d.Coord.ConsumeRateLimit(ctx, coordination.RateLimitRequest{
		Scope: scope, Subject: subject, Limit: limit, Window: window,
	})
}

func miscWriteRateLimited(w http.ResponseWriter, res coordination.RateLimitResult) {
	retry := res.RetryAfterSeconds
	if retry < 1 {
		retry = 60
	}
	w.Header().Set("Retry-After", fmt.Sprint(retry))
	w.Header().Set("X-RateLimit-Limit", fmt.Sprint(res.Limit))
	w.Header().Set("X-RateLimit-Remaining", fmt.Sprint(res.Remaining))
	envelope.DomainError(w, http.StatusTooManyRequests, "请求过于频繁，请稍后再试", "RATE_LIMITED")
}

// ---------------------------------------------------------------------------
// /api/seo/indexnow-key — app/api/seo/indexnow-key/route.js
// ---------------------------------------------------------------------------

// miscDefaultIndexNowKey mirrors DEFAULT_SEARCH_PUSH_CONFIG.indexNow.key in
// lib/services/seoPush.js. It is a public IndexNow verification token, not a secret; the
// admin-managed ops_bill.system_settings value (or INDEXNOW_KEY) takes precedence.
const miscDefaultIndexNowKey = "3f82a45c81924619b068ad1d5d893f44"

func miscIndexNowKey(w http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser) {
	key := d.Config.IndexNowKey
	if key == "" && d.Pool != nil {
		var raw []byte
		if err := d.Pool.QueryRow(r.Context(), `SELECT value_json FROM ops_bill.system_settings WHERE key = 'search_push_config' LIMIT 1`).Scan(&raw); err == nil {
			var cfg struct {
				IndexNow struct {
					Key string `json:"key"`
				} `json:"indexNow"`
				IndexNowLower struct {
					Key string `json:"key"`
				} `json:"indexnow"`
			}
			if json.Unmarshal(raw, &cfg) == nil {
				key = firstNonEmptyValues(cfg.IndexNow.Key, cfg.IndexNowLower.Key)
			}
		}
	}
	if key == "" {
		key = miscDefaultIndexNowKey
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(key))
}

// ---------------------------------------------------------------------------
// /api/webhooks/{bilibili,douyin} — challenge handshakes + event acknowledgements
// ---------------------------------------------------------------------------

func miscParseWebhookBody(r *http.Request) map[string]any {
	raw, _ := readBodyLimit(r, 256*1024)
	if len(bytes.TrimSpace(raw)) == 0 {
		return map[string]any{}
	}
	var body map[string]any
	if json.Unmarshal(raw, &body) == nil {
		return body
	}
	values, _ := url.ParseQuery(string(raw))
	out := make(map[string]any, len(values))
	for k, v := range values {
		if len(v) > 0 {
			out[k] = v[0]
		}
	}
	return out
}

func miscWebhookBilibili(w http.ResponseWriter, r *http.Request, _ *Dependencies, _ *middleware.SessionUser) {
	if r.Method == http.MethodGet {
		challenge := firstNonEmptyValues(r.URL.Query().Get("challenge"), r.URL.Query().Get("echostr"))
		if challenge != "" {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			_, _ = w.Write([]byte(challenge))
			return
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true, "provider": "bilibili", "timestamp": time.Now().UnixMilli()})
		return
	}
	body := miscParseWebhookBody(r)
	if v, ok := body["challenge"]; ok {
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"challenge": v})
		return
	}
	if v, ok := body["echostr"]; ok {
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"challenge": v})
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"code": 0, "message": "success"})
}

func miscWebhookDouyin(w http.ResponseWriter, r *http.Request, _ *Dependencies, _ *middleware.SessionUser) {
	if r.Method == http.MethodGet {
		challenge := firstNonEmptyValues(r.URL.Query().Get("challenge"), r.URL.Query().Get("echostr"))
		if challenge != "" {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			_, _ = w.Write([]byte(challenge))
			return
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true, "provider": "douyin", "timestamp": time.Now().UnixMilli()})
		return
	}
	body := miscParseWebhookBody(r)
	content, _ := body["content"].(map[string]any)
	if fmt.Sprint(body["event"]) == "verify_webhook" {
		if v, ok := content["challenge"]; ok {
			envelope.DomainJSON(w, http.StatusOK, map[string]any{"challenge": v})
			return
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"challenge": body["challenge"]})
		return
	}
	if v, ok := content["challenge"]; ok {
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"challenge": v})
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"message": "success"})
}

func firstNonEmptyValues(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// ---------------------------------------------------------------------------
// Legacy scoped MuAPI proxies — lib/security/legacyProxyPolicy.js (default-deny)
// ---------------------------------------------------------------------------

const proxyAny = "*"

type proxyRule struct {
	method   string
	segments []string
}

var proxyAllowRules = map[string][]proxyRule{
	"agents": {
		{"GET", []string{}}, {"POST", []string{}}, {"GET", []string{"skills"}}, {"POST", []string{"suggest"}},
		{"GET", []string{"templates", "agents"}}, {"GET", []string{"user", "agents"}},
		{"GET", []string{"user", "conversations"}}, {"GET", []string{"featured", "agents"}},
		{"GET", []string{proxyAny, "profile"}}, {"GET", []string{"by-slug", proxyAny}},
		{"POST", []string{"by-slug", proxyAny, "chat"}}, {"POST", []string{"by-slug", proxyAny, "like"}},
		{"POST", []string{"by-slug", proxyAny, "preview-realign"}},
	},
	"app": {
		{"GET", []string{"get_file_upload_url"}}, {"GET", []string{"get_upload_file"}},
		{"GET", []string{"interests"}}, {"POST", []string{"interest"}}, {"POST", []string{"calculate_dynamic_cost"}},
	},
	"workflow": {
		{"GET", []string{"get-template-workflows"}}, {"GET", []string{"get-workflow-defs"}},
		{"GET", []string{"get-published-workflows"}}, {"GET", []string{proxyAny, "api-inputs"}},
		{"GET", []string{proxyAny, "node-schemas"}}, {"GET", []string{proxyAny, "api-node-schemas"}},
		{"GET", []string{"poll-architect", proxyAny, "result"}}, {"POST", []string{"create"}},
		{"POST", []string{"architect"}}, {"POST", []string{"cloudfront-signed-url"}},
		{"POST", []string{proxyAny, "api-execute"}}, {"POST", []string{proxyAny, "thumbnail"}},
		{"POST", []string{proxyAny, "run"}}, {"POST", []string{proxyAny, "node", proxyAny, "run"}},
		{"DELETE", []string{"node-run", proxyAny}},
	},
}

var proxyBilledRules = map[string][]proxyRule{
	"agents":   {{"POST", []string{"by-slug", proxyAny, "chat"}}, {"POST", []string{"by-slug", proxyAny, "preview-realign"}}, {"POST", []string{"suggest"}}, {"POST", []string{}}},
	"workflow": {{"POST", []string{proxyAny, "run"}}, {"POST", []string{proxyAny, "node", proxyAny, "run"}}, {"POST", []string{proxyAny, "api-execute"}}, {"POST", []string{"architect"}}, {"POST", []string{"create"}}},
	"app":      {},
}

var proxyReservedSegments = map[string]bool{
	"chat": true, "like": true, "preview-realign": true, "profile": true, "skills": true, "suggest": true,
}

var proxyDeniedFirstSegments = map[string]bool{
	"account": true, "accounts": true, "balance": true, "billing": true, "wallet": true, "wallets": true,
	"history": true, "user": true, "users": true, "me": true, "profile": true, "key": true, "keys": true,
	"api-key": true, "apikey": true, "secret": true, "secrets": true, "token": true, "tokens": true,
	"subscription": true, "subscriptions": true, "subscribe": true, "team": true, "teams": true,
	"org": true, "orgs": true, "member": true, "members": true, "invoice": true, "invoices": true,
	"payment": true, "payments": true, "payout": true, "referral": true, "referrals": true,
	"usage": true, "quota": true, "admin": true, "internal": true, "debug": true, "metric": true, "metrics": true,
}

func proxyMatchesRule(rule []string, segments []string, scope string) bool {
	if len(rule) != len(segments) {
		return false
	}
	for i, rs := range rule {
		if rs == proxyAny {
			if segments[i] == "" || (scope == "agents" && proxyReservedSegments[segments[i]]) {
				return false
			}
			continue
		}
		if rs != segments[i] {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------------
// Legacy scoped MuAPI proxies — lib/security/legacyProxyPolicy.js (default-deny)
// ---------------------------------------------------------------------------

func proxyDecision(scope, method string, segments []string) (allow bool, decision string, status int) {
	if scope == "creative-agent" {
		if method == "GET" && len(segments) == 1 && segments[0] == "agent-skills" {
			return true, "ALLOW_UTILITY", 200
		}
		if method == "POST" && ((len(segments) == 3 && segments[0] == "sessions" && (segments[2] == "chat" || segments[2] == "run-skill")) ||
			(len(segments) == 3 && segments[0] == "jobs" && segments[2] != "cancel" && segments[2] != "stop")) {
			return false, "DENY_BILLING_REQUIRED", 402
		}
		return false, "DENY_PATH", 404
	}
	if scope == "generic-v1" {
		if len(segments) == 0 {
			return false, "DENY_PATH", 404
		}
		if proxyDeniedFirstSegments[segments[0]] {
			return false, "DENY_ACCOUNT", 403
		}
		joined := strings.Join(segments, "/")
		if method == "GET" {
			if len(segments) == 3 && segments[0] == "predictions" && segments[2] == "result" {
				return false, "DENY_PATH", 404
			}
			if len(segments) == 3 && segments[0] == "models" && segments[2] == "estimate-cost" {
				return true, "ALLOW_ESTIMATE", 200
			}
			return false, "DENY_PATH", 404
		}
		if method == "POST" {
			if joined == "upload_file" || joined == "app/calculate_dynamic_cost" {
				return true, "ALLOW_UTILITY", 200
			}
			return false, "DENY_BILLING_REQUIRED", 402
		}
		return false, "DENY_PATH", 404
	}
	rules := proxyAllowRules[scope]
	if rules == nil {
		return false, "DENY_PATH", 404
	}
	allowed := false
	for _, rule := range rules {
		if rule.method == method && proxyMatchesRule(rule.segments, segments, scope) {
			allowed = true
			break
		}
	}
	if !allowed {
		return false, "DENY_PATH", 404
	}
	for _, rule := range proxyBilledRules[scope] {
		if rule.method == method && proxyMatchesRule(rule.segments, segments, scope) {
			return false, "DENY_BILLING_REQUIRED", 402
		}
	}
	return true, "ALLOW_UTILITY", 200
}

func proxyDeny(w http.ResponseWriter, decision string, status int) {
	msg := "该接口不可用"
	if decision == "DENY_BILLING_REQUIRED" {
		msg = "该推理入口尚未接入平台额度结算，暂不可用"
	}
	envelope.DomainJSON(w, status, map[string]any{"error": msg, "code": decision})
}

func miscScopedProxy(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser) {
	path := r.URL.Path
	scope, upstreamPrefix := "", ""
	var segments []string
	switch {
	case strings.HasPrefix(path, "/api/v1/creative-agent"):
		scope, upstreamPrefix = "creative-agent", "/creative-agent"
		segments = strings.Split(strings.TrimPrefix(pathParam(r, "path"), "/"), "/")
	case strings.HasPrefix(path, "/api/agents"):
		scope, upstreamPrefix = "agents", "/agents"
		segments = strings.Split(strings.TrimPrefix(pathParam(r, "path"), "/"), "/")
	case strings.HasPrefix(path, "/api/app/"):
		scope, upstreamPrefix = "app", "/app"
		segments = strings.Split(strings.TrimPrefix(pathParam(r, "path"), "/"), "/")
	case strings.HasPrefix(path, "/api/workflow"):
		scope, upstreamPrefix = "workflow", "/workflow"
		segments = strings.Split(strings.TrimPrefix(pathParam(r, "path"), "/"), "/")
	case strings.HasPrefix(path, "/api/api/v1") || strings.HasPrefix(path, "/api/v1"):
		scope, upstreamPrefix = "generic-v1", "/api/v1"
		segments = strings.Split(strings.TrimPrefix(pathParam(r, "path"), "/"), "/")
	default:
		proxyDeny(w, "DENY_PATH", http.StatusNotFound)
		return
	}
	if len(segments) == 1 && segments[0] == "" {
		segments = nil
	}
	for i := range segments {
		segments[i] = strings.ToLower(segments[i])
	}

	method := strings.ToUpper(r.Method)
	allow, decision, status := proxyDecision(scope, method, segments)
	if !allow {
		proxyDeny(w, decision, status)
		return
	}

	// Read rate limit 600/min; billed burst/sustained are deliberately denied above, so no
	// additional billed limiter is needed before the (closed) inference gate.
	subject := clientIP(r)
	if u != nil {
		subject = u.ID
	}
	rl, err := miscConsumeRateLimit(r.Context(), d, "proxy_read_"+scope, subject, 600, time.Minute)
	if err != nil || !rl.Allowed {
		miscWriteRateLimited(w, rl)
		return
	}

	key := d.Config.MuAPIKey
	// Client-supplied x-api-key is never accepted; BYOK stays closed. Encrypted DB provider
	// secrets (ops_bill) are resolved by the admin rotation workflow and are an explicit
	// integration-verify item; without an env/config key the proxy fails closed with 503.
	if key == "" {
		envelope.DomainError(w, http.StatusServiceUnavailable, "模型服务未配置或不可用", "UPSTREAM_NOT_CONFIGURED")
		return
	}

	target, err := url.Parse(d.Config.UpstreamAIBase)
	if err != nil {
		envelope.DomainError(w, http.StatusBadGateway, "上游请求异常", "UPSTREAM_ERROR")
		return
	}
	if upstreamPrefix == "/api/v1" {
		target.Path = "/api/v1/" + strings.Join(segments, "/")
	} else if upstreamPrefix == "/v1" {
		target.Path = "/v1/" + strings.Join(segments, "/")
	} else {
		target.Path = upstreamPrefix
		if len(segments) > 0 && segments[0] != "" {
			target.Path += "/" + strings.Join(segments, "/")
		}
	}
	target.RawQuery = r.URL.RawQuery

	body, _ := readBodyLimit(r, 50<<20)
	req, err := http.NewRequestWithContext(r.Context(), method, target.String(), bytes.NewReader(body))
	if err != nil {
		envelope.DomainError(w, http.StatusBadGateway, "上游请求异常", "UPSTREAM_ERROR")
		return
	}
	for k, vals := range r.Header {
		lk := strings.ToLower(k)
		if lk == "host" || lk == "connection" || lk == "cookie" || lk == "authorization" || lk == "x-api-key" || lk == "content-length" {
			continue
		}
		for _, v := range vals {
			req.Header.Add(k, v)
		}
	}
	req.Header.Set("x-api-key", key) // server-managed credential only; BYOK stays closed

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		envelope.DomainError(w, http.StatusBadGateway, "上游请求异常", "UPSTREAM_ERROR")
		return
	}
	defer resp.Body.Close()
	for k, vals := range resp.Header {
		lk := strings.ToLower(k)
		if lk == "content-length" || lk == "transfer-encoding" || lk == "connection" {
			continue
		}
		for _, v := range vals {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, io.LimitReader(resp.Body, 50<<20))
}

// Compile-time guard for the upstream passthrough contract.
var _ = envelope.FormatUpstreamProxy

// ---------------------------------------------------------------------------
// Three distinct manifest routes (own source files, not catch-all aliases)
// ---------------------------------------------------------------------------

// miscAppModelsAvailable mirrors app/api/app/models/available/route.js:
// GET ?type=image -> { data: { models: [...], type } }, using the same active-model
// repository as /api/models/active and the public-directory serializer.
func miscAppModelsAvailable(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser) {
	typeArg := r.URL.Query().Get("type")
	if typeArg == "" {
		typeArg = "image"
	}
	if d.Generation == nil || d.Generation.Repo == nil {
		// No repository wired means no persistent model catalog; fail closed rather than
		// returning an invented model list.
		envelope.DomainError(w, http.StatusInternalServerError, "获取可用模型失败", "INTERNAL_ERROR")
		return
	}
	userID := ""
	if u != nil {
		userID = u.ID
	}
	res, err := d.Generation.GetActiveModels(r.Context(), "", userID)
	if err != nil {
		envelope.DomainError(w, http.StatusInternalServerError, "获取可用模型失败", "INTERNAL_ERROR")
		return
	}
	out := make([]map[string]any, 0, len(res.Models))
	for _, m := range res.Models {
		if m.Category != typeArg || !m.IsActive || !m.IsVisible {
			continue
		}
		credits := any(nil)
		starting := any(nil)
		if m.CreditsPrice > 0 {
			starting = m.CreditsPrice
			pricingType := ""
			if m.PricingType != nil {
				pricingType = *m.PricingType
			}
			if pricingType != "formula" {
				credits = m.CreditsPrice
			}
		} else if m.PricingType == nil {
			// preserve the source's `pricingType || 'unknown'` fallback
		}
		pricingType := "unknown"
		if m.PricingType != nil && *m.PricingType != "" {
			pricingType = *m.PricingType
		}
		out = append(out, map[string]any{
			"id": m.ID, "name": m.Name, "displayName": m.DisplayName,
			"category": m.Category, "credits": credits, "startingCredits": starting,
			"pricingType": pricingType, "quoteRequired": true, "creditsAreQuote": false,
			"priceCny": nil, "description": m.Description,
			"tags": []any{}, "features": []any{}, // capabilities JSONB is serialized by the model-center layer
			"recommended": m.Tier == "core", "isPinned": m.IsPinned,
			"availableRoutes": 0, "generationCapabilities": []any{},
		})
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{"models": out, "type": typeArg},
	})
}

// miscV1GetUploadURL mirrors app/api/v1/get_upload_url/route.js: authenticated,
// server-managed key only, proxies to {UPSTREAM_AI_BASE}/app/get_file_upload_url.
func miscV1GetUploadURL(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser) {
	if u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "请先登录", "UNAUTHORIZED")
		return
	}
	key := d.Config.MuAPIKey
	if key == "" {
		envelope.DomainError(w, http.StatusServiceUnavailable, "上传服务暂未配置或不可用", "UPSTREAM_NOT_CONFIGURED")
		return
	}
	target, err := url.Parse(d.Config.UpstreamAIBase)
	if err != nil {
		envelope.DomainError(w, http.StatusInternalServerError, "上传地址服务暂时不可用", "UPSTREAM_ERROR")
		return
	}
	target.Path = "/app/get_file_upload_url"
	target.RawQuery = r.URL.RawQuery
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, target.String(), nil)
	if err != nil {
		envelope.DomainError(w, http.StatusInternalServerError, "上传地址服务暂时不可用", "UPSTREAM_ERROR")
		return
	}
	miscCopyUpstreamHeaders(req, r, key)
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		envelope.DomainError(w, http.StatusInternalServerError, "上传地址服务暂时不可用", "UPSTREAM_ERROR")
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(body)
}

var miscBlockedUploadExt = map[string]bool{
	"html": true, "htm": true, "xhtml": true, "svg": true, "php": true, "phtml": true,
	"php3": true, "php4": true, "php5": true, "phps": true, "exe": true, "bat": true,
	"cmd": true, "sh": true, "bash": true, "js": true, "cgi": true, "pl": true,
	"py": true, "jar": true, "vbs": true, "scr": true, "msi": true,
}

var miscBlockedUploadMIME = map[string]bool{
	"text/html": true, "image/svg+xml": true, "application/xhtml+xml": true,
	"application/x-httpd-php": true, "application/x-msdownload": true,
	"application/x-executable": true, "application/x-sh": true,
	"application/x-shellscript": true, "application/javascript": true, "text/javascript": true,
}

func miscBlockedFileType(name, contentType string) bool {
	mime := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	if miscBlockedUploadMIME[mime] {
		return true
	}
	if idx := strings.LastIndex(name, "."); idx >= 0 {
		return miscBlockedUploadExt[strings.ToLower(strings.TrimSpace(name[idx+1:]))]
	}
	return false
}

// miscValidateUploadProxyTarget mirrors src/lib/uploadProxyTarget.js: https only, no private
// / loopback / IP-literal hosts, and only S3 hosts or UPLOAD_PROXY_ALLOWED_HOSTS allowlist.
func miscValidateUploadProxyTarget(raw string) (string, string) {
	if strings.TrimSpace(raw) == "" {
		return "", "missing_target"
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", "invalid_url"
	}
	if parsed.Scheme != "https" {
		return "", "unsafe_protocol"
	}
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if host == "" || host == "localhost" || host == "::1" || strings.Contains(host, ":") {
		return "", "host_not_allowed"
	}
	labels := strings.Split(host, ".")
	for _, l := range labels {
		if l == "" {
			return "", "host_not_allowed"
		}
	}
	if len(labels) == 4 && allDigits(labels) {
		return "", "host_not_allowed" // IP literal, incl. private ranges
	}
	allowedS3 := host == "s3.amazonaws.com" ||
		(strings.HasSuffix(host, ".s3.amazonaws.com") && len(host) > len(".s3.amazonaws.com")) ||
		(len(labels) == 4 && labels[0] == "s3" && labels[2] == "amazonaws" && labels[3] == "com")
	for _, extra := range strings.Split(os.Getenv("UPLOAD_PROXY_ALLOWED_HOSTS"), ",") {
		if strings.ToLower(strings.TrimSpace(extra)) == host {
			return parsed.String(), ""
		}
	}
	if !allowedS3 {
		return "", "host_not_allowed"
	}
	return parsed.String(), ""
}

func allDigits(parts []string) bool {
	for _, p := range parts {
		if p == "" {
			return false
		}
		for _, c := range p {
			if c < '0' || c > '9' {
				return false
			}
		}
	}
	return true
}

// miscV1UploadBinary mirrors app/api/v1/upload-binary/route.js: auth + 20/hour limit +
// multipart form -> validated S3 target (204 on upstream success), with blocked file types.
func miscV1UploadBinary(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser) {
	if u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "请先登录", "UNAUTHORIZED")
		return
	}
	rl, err := miscConsumeRateLimit(r.Context(), d, "binary_upload_user", u.ID, 20, time.Hour)
	if err != nil || !rl.Allowed {
		miscWriteRateLimited(w, rl)
		return
	}
	if err := r.ParseMultipartForm(25 << 20); err != nil {
		envelope.DomainError(w, http.StatusBadRequest, "Missing proxy target URL", "INVALID_BODY")
		return
	}
	target, reason := miscValidateUploadProxyTarget(r.FormValue("x-proxy-target-url"))
	if reason != "" {
		envelope.DomainJSON(w, http.StatusBadRequest, map[string]any{
			"error": "Invalid upload target", "reason": reason,
		})
		return
	}

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	contentType := firstNonEmptyValues(r.FormValue("Content-Type"), r.FormValue("content-type"))
	keyName := r.FormValue("key")
	for name, values := range r.MultipartForm.Value {
		if name == "x-proxy-target-url" {
			continue
		}
		for _, v := range values {
			_ = mw.WriteField(name, v)
		}
	}
	for name, headers := range r.MultipartForm.File {
		for _, fh := range headers {
			if miscBlockedFileType(fh.Filename, firstNonEmptyValues(fh.Header.Get("Content-Type"), contentType)) {
				mw.Close()
				envelope.DomainJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid file type", "reason": "blocked_file_type"})
				return
			}
			f, openErr := fh.Open()
			if openErr != nil {
				continue
			}
			part, partErr := mw.CreateFormFile(name, fh.Filename)
			if partErr == nil {
				_, _ = io.Copy(part, f)
			}
			_ = f.Close()
		}
	}
	if miscBlockedFileType(keyName, contentType) {
		mw.Close()
		envelope.DomainJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid file type", "reason": "blocked_file_type"})
		return
	}
	if err := mw.Close(); err != nil {
		envelope.DomainError(w, http.StatusBadRequest, "上传服务暂时不可用", "UPSTREAM_ERROR")
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, target, &buf)
	if err != nil {
		envelope.DomainError(w, http.StatusInternalServerError, "上传服务暂时不可用", "UPSTREAM_ERROR")
		return
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := (&http.Client{Timeout: 60 * time.Second}).Do(req)
	if err != nil {
		envelope.DomainError(w, http.StatusInternalServerError, "上传服务暂时不可用", "UPSTREAM_ERROR")
		return
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNoContent {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	envelope.DomainJSON(w, resp.StatusCode, map[string]any{"error": "上传服务暂时不可用"})
}

func miscCopyUpstreamHeaders(dst, src *http.Request, serverKey string) {
	for k, vals := range src.Header {
		lk := strings.ToLower(k)
		if lk == "host" || lk == "connection" || lk == "cookie" || lk == "authorization" || lk == "x-api-key" {
			continue
		}
		for _, v := range vals {
			dst.Header.Add(k, v)
		}
	}
	dst.Header.Set("x-api-key", serverKey)
}
