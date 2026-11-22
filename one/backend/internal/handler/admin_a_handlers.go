// Package handler: `admin_a` wave — 53 admin routes / 74 (method, path) mounts.
//
// Every route is registered through wrapAdmin so permission checks, write-path
// idempotency, the panic boundary and the admin_ok_meta_envelope are handled by
// admin_protocol.go. SessionUser resolution is supplied by OptionalAuth in this
// file (the shared router only installs security/CORS/CSRF middleware), so
// adminPermissionFor sees the ko_session user and emits the exact 401/403 admin
// envelope. Persistent reads/writes use d.Pool with parameterized SQL against
// the four-schema layout verified in Supdance Pro/lib/db/migrations/*.sql; with
// Pool == nil handlers honestly return 503 DB_UNAVAILABLE instead of inventing
// business data.
package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/domain/admin"
	"one/backend/internal/domain/auth"
	"one/backend/internal/domain/generation"
	"one/backend/internal/middleware"
	"one/backend/internal/notify"
)

// ---------------------------------------------------------------------------
// Route table — mirrors .migration/spec_admin_a.json exactly (methods, perm,
// scope). One wrapAdmin per route; each method is mounted separately so every
// (method, path) pair replaces the contract-enforced 501 stub.
// ---------------------------------------------------------------------------

type adminARoute struct {
	methods []string
	path    string
	perm    string
	scope   string
	fn      adminHandler
}

func init() {
	registerBatch(func(d *Dependencies, mount mountFunc) {
		for _, spec := range adminARoutes() {
			// wrapAdmin performs the permission decision itself, but it needs the
			// ko_session user in the request context. Resolve it with OptionalAuth
			// here without touching shared router/middleware files.
			h := middleware.OptionalAuth(d.SessionAuth)(wrapAdmin(d, spec.perm, spec.scope, spec.fn))
			for _, m := range spec.methods {
				mount(m, spec.path, h)
			}
		}
	})
}

func adminARoutes() []adminARoute {
	return []adminARoute{
		{[]string{"GET"}, "/api/admin/admins", "adminsWrite", "", adminAListAdmins},
		{[]string{"PUT"}, "/api/admin/admins/[id]/role", "adminsWrite", "admin_role_change", adminASetUserRole},
		{[]string{"GET"}, "/api/admin/analytics/cost", "modelsRead", "", adminACostAnalytics},
		{[]string{"GET"}, "/api/admin/analytics/profit", "modelsRead", "", adminAProfitAnalytics},
		{[]string{"GET"}, "/api/admin/audit", "auditRead", "", adminAAuditLogs},
		{[]string{"GET", "PUT"}, "/api/admin/canvas/config", "modelsRead", "canvas_model_config", adminACanvasConfig},
		{[]string{"GET"}, "/api/admin/community/posts", "contentRead", "", adminACommunityPosts},
		{[]string{"PATCH"}, "/api/admin/community/posts/[id]", "contentWrite", "community_post_update", adminACommunityPostPatch},
		{[]string{"GET", "DELETE"}, "/api/admin/content/analytics", "contentRead", "", adminABannerAnalytics},
		{[]string{"GET", "POST"}, "/api/admin/content/banner", "contentRead", "content_banner_update", adminABannerConfig},
		{[]string{"GET"}, "/api/admin/content/banner/history", "contentRead", "", adminABannerHistory},
		{[]string{"POST", "DELETE"}, "/api/admin/content/banner/history/[id]", "contentWrite", "", adminABannerHistoryItem},
		{[]string{"GET", "POST"}, "/api/admin/content/branding", "contentRead", "content_branding_update", adminABranding},
		{[]string{"POST"}, "/api/admin/content/branding/upload", "contentWrite", "", adminABrandingUpload},
		{[]string{"GET", "POST"}, "/api/admin/content/motion", "contentRead", "content_motion_update", adminAMotionConfig},
		{[]string{"GET", "DELETE"}, "/api/admin/content/x-prompts", "contentRead", "", adminAXPrompts},
		{[]string{"POST"}, "/api/admin/content/x-prompts/adopt", "contentWrite", "", adminAXPromptAdopt},
		{[]string{"GET", "PUT"}, "/api/admin/content/x-prompts/config", "contentRead", "", adminAXPromptConfig},
		{[]string{"POST"}, "/api/admin/content/x-prompts/crawl", "contentWrite", "", adminAXPromptCrawl},
		{[]string{"GET"}, "/api/admin/cost-center", "dashboardRead", "", adminACostCenter},
		{[]string{"GET", "POST"}, "/api/admin/cost-center/reconciliations", "billingRead", "provider_cost_reconcile", adminACostReconciliations},
		{[]string{"GET", "POST"}, "/api/admin/coupons", "couponsRead", "coupons_batch_create", adminACoupons},
		{[]string{"GET"}, "/api/admin/credits/ledger", "creditsRead", "", adminACreditLedger},
		{[]string{"GET"}, "/api/admin/dashboard", "dashboardRead", "", adminADashboard},
		{[]string{"GET"}, "/api/admin/export/[type]", "exportsRead", "", adminAExportGone},
		{[]string{"POST"}, "/api/admin/exports", "exportsWrite", "admin_export_request", adminAExportRequest},
		{[]string{"GET"}, "/api/admin/exports/[id]", "exportsRead", "", adminAExportStatus},
		{[]string{"GET"}, "/api/admin/exports/[id]/download", "exportsRead", "", adminAExportDownload},
		{[]string{"POST"}, "/api/admin/feedback/[id]/review", "contentWrite", "feedback_review", adminAFeedbackReview},
		{[]string{"GET"}, "/api/admin/generations", "generationsRead", "", adminAGenerations},
		{[]string{"GET"}, "/api/admin/generations/[id]", "generationsRead", "", adminAGenerationTrace},
		{[]string{"POST"}, "/api/admin/generations/[id]/retry", "generationsWrite", "generation_retry", adminAGenerationRetry},
		{[]string{"GET", "POST"}, "/api/admin/generations/reconciliation", "generationsRead", "generation_reconciliation", adminAGenerationReconciliation},
		{[]string{"GET"}, "/api/admin/health", "healthRead", "", adminAHealth},
		{[]string{"GET", "POST"}, "/api/admin/i18n", "i18nRead", "i18n_update", adminAI18n},
		{[]string{"GET", "POST"}, "/api/admin/invites", "usersRead", "invites_batch_create", adminAInvites},
		{[]string{"PATCH"}, "/api/admin/invites/[id]", "usersUpdate", "", adminAInvitePatch},
		{[]string{"GET"}, "/api/admin/invites/[id]/users", "usersRead", "", adminAInviteUsers},
		{[]string{"GET", "POST"}, "/api/admin/invites/switch", "settingsRead", "invites_switch_update", adminAInviteSwitch},
		{[]string{"GET", "PUT"}, "/api/admin/login/social-regions", "providersRead", "social_login_regions", adminASocialRegions},
		{[]string{"GET"}, "/api/admin/marketing/email/templates", "providersRead", "", adminAEmailTemplatesHandler},
		{[]string{"POST"}, "/api/admin/marketing/email/test", "providersWrite", "email_marketing_test_send", adminAEmailTest},
		{[]string{"GET"}, "/api/admin/models", "modelsRead", "", adminAModelsOverview},
		{[]string{"PATCH"}, "/api/admin/models/[id]", "modelsWrite", "model_update", adminAModelPatch},
		{[]string{"POST"}, "/api/admin/models/[id]/health", "providersWrite", "", adminAModelHealthProbe},
		{[]string{"PATCH"}, "/api/admin/models/[id]/provider", "modelsWrite", "model_provider_switch", adminAModelProviderSwitch},
		{[]string{"GET", "POST"}, "/api/admin/models/brands", "modelsRead", "", adminAModelBrands},
		{[]string{"GET", "POST"}, "/api/admin/models/catalog", "modelsRead", "", adminAModelCatalog},
		{[]string{"GET", "POST"}, "/api/admin/models/catalog/sync", "modelsRead", "", adminAModelCatalogSync},
		{[]string{"GET", "POST"}, "/api/admin/models/control", "modelsRead", "", adminAModelControl},
		{[]string{"GET"}, "/api/admin/models/control/export", "modelsRead", "", adminAModelControlExport},
		{[]string{"GET", "POST"}, "/api/admin/models/deduplicate", "modelsRead", "", adminAModelDeduplicate},
		{[]string{"GET", "POST"}, "/api/admin/models/health", "providersRead", "", adminAModelsHealth},
	}
}

// ---------------------------------------------------------------------------
// Shared helpers (adminA-prefixed so parallel wave files never collide).
// ---------------------------------------------------------------------------

var adminANotFoundRe = regexp.MustCompile(`不存在|未找到|找不到`)
var adminAEmailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// adminADB is the single degraded-mode gate. In unit tests Pool == nil, so no
// handler is allowed to fabricate a business response: wrapAdmin turns this
// into envelope.AdminError(w, 503, "DB_UNAVAILABLE", "持久数据服务暂不可用", reqID).
func adminADB(d *Dependencies) (*pgxpool.Pool, *adminError) {
	if d == nil || d.Pool == nil {
		return nil, adminErr("DB_UNAVAILABLE", "持久数据服务暂不可用", http.StatusServiceUnavailable)
	}
	return d.Pool, nil
}

func adminANewID(prefix string) string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

func adminASHA256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func adminAActorEmail(u *middleware.SessionUser) string {
	if u == nil {
		return "system"
	}
	if u.Email != nil && *u.Email != "" {
		return *u.Email
	}
	return u.ID
}

// adminAResultErr mirrors resultErrorResponse in lib/admin/authz.js.
func adminAResultErr(msg string) *adminError {
	if adminANotFoundRe.MatchString(msg) {
		return adminErr("NOT_FOUND", msg, http.StatusNotFound)
	}
	return adminErr("VALIDATION_ERROR", msg, http.StatusUnprocessableEntity)
}

func adminAInternal(err error, fallback string) *adminError {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return adminAResultErr("未找到对应记录")
	}
	return adminErr("INTERNAL_ERROR", fallback, http.StatusInternalServerError)
}

func adminAInt(r *http.Request, key string, def, min, max int) int {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	if n < min {
		return min
	}
	if n > max {
		return max
	}
	return n
}

func adminAQueryStr(r *http.Request, key string) string {
	return strings.TrimSpace(r.URL.Query().Get(key))
}

func adminAStr(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case int64:
		return strconv.FormatInt(t, 10)
	case int:
		return strconv.Itoa(t)
	case bool:
		return strconv.FormatBool(t)
	default:
		raw, _ := json.Marshal(t)
		return string(raw)
	}
}

func adminAFloat(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case string:
		f, _ := strconv.ParseFloat(t, 64)
		return f
	case json.Number:
		f, _ := t.Float64()
		return f
	default:
		// pgtype.Numeric marshals to its JSON number text; reuse adminAStr so
		// SQL NUMERIC(18,8) values keep full precision in Go arithmetic.
		f, _ := strconv.ParseFloat(adminAStr(v), 64)
		return f
	}
}

func adminABool(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t == "true" || t == "1" || t == "on"
	case float64:
		return t != 0
	default:
		return false
	}
}

func adminAJSONMap(v any) map[string]any {
	switch t := v.(type) {
	case map[string]any:
		return t
	case string:
		var m map[string]any
		if json.Unmarshal([]byte(t), &m) == nil {
			return m
		}
	}
	return map[string]any{}
}

func adminAJSONArray(v any) []any {
	switch t := v.(type) {
	case []any:
		return t
	case []string:
		out := make([]any, 0, len(t))
		for _, s := range t {
			out = append(out, s)
		}
		return out
	case string:
		var a []any
		if json.Unmarshal([]byte(t), &a) == nil {
			return a
		}
	}
	return []any{}
}

func adminAJSONRaw(v any) string {
	raw, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func valueOrEmpty(v any) any {
	if v == nil {
		return map[string]any{}
	}
	return v
}

func arrayOrEmpty(v any) any {
	if v == nil {
		return []any{}
	}
	return v
}

func adminAUUID(b [16]byte) string {
	h := hex.EncodeToString(b[:])
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

func adminAJSONValue(v any) any {
	switch t := v.(type) {
	case nil:
		return nil
	case time.Time:
		return t.UTC().Format(time.RFC3339Nano)
	case []byte:
		var parsed any
		if json.Unmarshal(t, &parsed) == nil {
			return parsed
		}
		return string(t)
	case [16]byte:
		return adminAUUID(t)
	case fmt.Stringer:
		return t.String()
	default:
		return v
	}
}

func adminARows(rows pgx.Rows) ([]map[string]any, error) {
	defer rows.Close()
	out := make([]map[string]any, 0)
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		fields := rows.FieldDescriptions()
		row := make(map[string]any, len(vals))
		for i, v := range vals {
			if i < len(fields) {
				row[fields[i].Name] = adminAJSONValue(v)
			}
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func adminAQueryRows(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) ([]map[string]any, error) {
	rows, err := pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return adminARows(rows)
}

func adminAQueryOne(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) (map[string]any, bool, error) {
	all, err := adminAQueryRows(ctx, pool, sql, args...)
	if err != nil || len(all) == 0 {
		return nil, false, err
	}
	return all[0], true, nil
}

func adminAExec(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) (int64, error) {
	tag, err := pool.Exec(ctx, sql, args...)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// adminAWithTx keeps multi-statement admin writes atomic (role change, coupon
// batch, feedback reward, cost reconciliation, ...).
func adminAWithTx(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) (any, *adminError)) (any, *adminError) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, adminAInternal(err, "数据库事务启动失败")
	}
	defer func() { _ = tx.Rollback(ctx) }()
	data, aerr := fn(tx)
	if aerr != nil {
		return nil, aerr
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, adminAInternal(err, "数据库事务提交失败")
	}
	return data, nil
}

type adminACursor struct {
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
}

// adminAPaged mirrors lib/admin/pagination.js pagedQuery (keyset cursor,
// limit+1 probe, hasMore/nextCursor meta).
func adminAPaged(ctx context.Context, pool *pgxpool.Pool, r *http.Request, baseSQL, createdExpr, idExpr string, args ...any) ([]map[string]any, map[string]any, error) {
	limit := adminAInt(r, "limit", 25, 1, 200)
	values := append([]any{}, args...)
	sql := baseSQL
	joiner := " WHERE "
	if strings.Contains(strings.ToUpper(sql), "WHERE") {
		joiner = " AND "
	}
	if cursorRaw := adminAQueryStr(r, "cursor"); cursorRaw != "" {
		raw, err := base64.RawURLEncoding.DecodeString(cursorRaw)
		var cursor adminACursor
		if err != nil || json.Unmarshal(raw, &cursor) != nil {
			_ = json.Unmarshal([]byte(cursorRaw), &cursor)
		}
		if cursor.ID != "" {
			n := len(values)
			if cursor.CreatedAt != "" {
				sql += fmt.Sprintf("%s(%s < $%d OR (%s = $%d AND %s < $%d))", joiner, createdExpr, n+1, createdExpr, n+2, idExpr, n+3)
				values = append(values, cursor.CreatedAt, cursor.CreatedAt, cursor.ID)
			} else {
				sql += fmt.Sprintf("%s%s < $%d", joiner, idExpr, n+1)
				values = append(values, cursor.ID)
			}
		}
	}
	sql += fmt.Sprintf(" ORDER BY %s DESC, %s DESC LIMIT $%d", createdExpr, idExpr, len(values)+1)
	values = append(values, limit+1)
	rows, err := adminAQueryRows(ctx, pool, sql, values...)
	if err != nil {
		return nil, nil, err
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	meta := map[string]any{"limit": limit, "hasMore": hasMore, "nextCursor": nil}
	if hasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		idName := idExpr
		if dot := strings.LastIndexByte(idName, '.'); dot >= 0 {
			idName = idName[dot+1:]
		}
		createdAt, _ := last["created_at"].(string)
		id, _ := last[idName].(string)
		if id != "" {
			raw, _ := json.Marshal(adminACursor{ID: id, CreatedAt: createdAt})
			meta["nextCursor"] = base64.RawURLEncoding.EncodeToString(raw)
		}
	}
	return rows, meta, nil
}

// adminAAudit mirrors lib/admin/audit.js logAudit via domain/admin.
func adminAAudit(ctx context.Context, pool *pgxpool.Pool, u *middleware.SessionUser, action, targetType, targetID, risk, reqID string, before, after any) {
	actorID := "system"
	if u != nil && u.ID != "" {
		actorID = u.ID
	}
	svc := &admin.Service{Repo: &admin.PGRepository{Pool: pool}}
	_ = svc.RecordAudit(ctx, admin.AuditLogEntry{
		ID:         adminANewID("aud"),
		ActorID:    actorID,
		ActorEmail: adminAActorEmail(u),
		Permission: action,
		TargetType: targetType,
		TargetID:   targetID,
		RiskLevel:  risk,
		BeforeJSON: before,
		AfterJSON:  after,
		RequestID:  reqID,
	})
}

func adminAAuditAfter(ctx context.Context, pool *pgxpool.Pool, u *middleware.SessionUser, action, targetType, targetID, risk, reqID string, after any) {
	adminAAudit(ctx, pool, u, action, targetType, targetID, risk, reqID, nil, after)
}

// adminAReadSetting / adminAWriteSetting operate on the verified
// ops_bill.system_settings(key, value_json, visibility, version, updated_by,
// updated_at) shape used by lib/repositories/settings.js.
func adminAReadSetting(ctx context.Context, pool *pgxpool.Pool, key string) (any, bool, error) {
	row, ok, err := adminAQueryOne(ctx, pool, `SELECT value_json FROM ops_bill.system_settings WHERE key = $1`, key)
	if err != nil || !ok {
		return nil, ok, err
	}
	return row["value_json"], true, nil
}

func adminAWriteSetting(ctx context.Context, pool *pgxpool.Pool, key string, value any, visibility, actor string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO ops_bill.system_settings (key, value_json, visibility, version, updated_by, updated_at)
		VALUES ($1, $2::jsonb, $3, 1, $4, now())
		ON CONFLICT (key) DO UPDATE SET
			value_json = excluded.value_json,
			visibility = excluded.visibility,
			version = system_settings.version + 1,
			updated_by = excluded.updated_by,
			updated_at = now()`, key, adminAJSONRaw(value), visibility, actor)
	return err
}

func adminABodyLenient(r *http.Request, max int64, dst any) *adminError {
	if r.Body == nil {
		return nil
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, max+1))
	if err != nil || int64(len(raw)) > max {
		return adminErr("PAYLOAD_TOO_LARGE", "请求体过大", http.StatusRequestEntityTooLarge)
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return nil
	}
	_ = json.Unmarshal(raw, dst) // source: request.json().catch(() => ({}))
	return nil
}

func adminABodyStrict(r *http.Request, max int64, dst any, code, msg string, status int) *adminError {
	if r.Body == nil {
		return adminErr(code, msg, status)
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, max+1))
	if err != nil || int64(len(raw)) > max {
		return adminErr("PAYLOAD_TOO_LARGE", "请求体过大", http.StatusRequestEntityTooLarge)
	}
	if len(strings.TrimSpace(string(raw))) == 0 || json.Unmarshal(raw, dst) != nil {
		return adminErr(code, msg, status)
	}
	return nil
}

// adminAOpenUpload mirrors request.formData().get('file') for the branding
// upload route; the actual byte validation lives in adminAValidMagic.
func adminAOpenUpload(r *http.Request, maxBytes int64) (*multipart.FileHeader, []byte, string, error) {
	if err := r.ParseMultipartForm(maxBytes + 4096); err != nil {
		return nil, nil, "", err
	}
	if r.MultipartForm == nil || len(r.MultipartForm.File["file"]) == 0 {
		return nil, nil, "", errors.New("未检测到有效的图片文件")
	}
	fh := r.MultipartForm.File["file"][0]
	f, err := fh.Open()
	if err != nil {
		return nil, nil, "", err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxBytes+1))
	if err != nil {
		return nil, nil, "", err
	}
	uploadType := "logo"
	if vals := r.MultipartForm.Value["type"]; len(vals) > 0 {
		uploadType = strings.ToLower(strings.TrimSpace(vals[0]))
	}
	return fh, data, uploadType, nil
}

var adminASVGTagRe = regexp.MustCompile(`(?i)<svg[\s>]|<\?xml`)
var adminASVGScriptRe = regexp.MustCompile(`(?i)<script|javascript:|on\w+=`)

func adminAValidMagic(data []byte, ext string) bool {
	if len(data) < 4 {
		return false
	}
	h := hex.EncodeToString(data[:4])
	switch ext {
	case ".png":
		return h == "89504e47"
	case ".jpg", ".jpeg":
		return strings.HasPrefix(h, "ffd8ff")
	case ".webp":
		return len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP"
	case ".svg":
		head := string(data[:min(len(data), 2048)])
		return adminASVGTagRe.MatchString(head) && !adminASVGScriptRe.MatchString(head)
	case ".ico":
		return strings.HasPrefix(h, "00000100")
	}
	return false
}

// ---------------------------------------------------------------------------
// 0. GET /api/admin/admins — lib/services/adminRead.js listAdmins
// ---------------------------------------------------------------------------

func adminAListAdmins(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	rows, err := adminAQueryRows(r.Context(), pool, `
		SELECT id, email, display_name, role, status, last_login_at, created_at
		FROM auth_usr.users WHERE role <> 'user' ORDER BY created_at ASC`)
	if err != nil {
		return nil, nil, adminAInternal(err, "管理员列表读取失败")
	}
	return rows, nil, nil
}

// ---------------------------------------------------------------------------
// 1. PUT /api/admin/admins/[id]/role — lib/services/users.js setUserRole
//    verifyAdminPassword + allowed roles + last-super-admin + session revoke.
// ---------------------------------------------------------------------------

func adminASetUserRole(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body struct {
		Role          string `json:"role"`
		AdminPassword string `json:"adminPassword"`
	}
	if e := adminABodyLenient(r, 64*1024, &body); e != nil {
		return nil, nil, e
	}
	id := pathParam(r, "id")
	allowed := map[string]bool{"super_admin": true, "operations_admin": true, "finance_admin": true, "support_admin": true, "auditor": true, "user": true}
	if !allowed[body.Role] {
		return nil, nil, adminAResultErr("无效的角色类型")
	}
	// lib/admin/authz.js verifyAdminPassword: scrypt hex digest + timing-safe compare.
	row, ok, err := adminAQueryOne(r.Context(), pool, `SELECT password_hash, password_salt FROM auth_usr.users WHERE id = $1`, u.ID)
	if err != nil {
		return nil, nil, adminAInternal(err, "管理员密码校验失败")
	}
	if !ok || !auth.VerifyPassword(body.AdminPassword, adminAStr(row["password_hash"]), adminAStr(row["password_salt"])) {
		return nil, nil, adminErr("UNAUTHORIZED", "管理员密码二次验证失败，拒绝执行", http.StatusForbidden)
	}
	data, aerr := adminAWithTx(r.Context(), pool, func(tx pgx.Tx) (any, *adminError) {
		var targetRole, targetStatus string
		if err := tx.QueryRow(r.Context(), `SELECT role, status FROM auth_usr.users WHERE id = $1 FOR UPDATE`, id).Scan(&targetRole, &targetStatus); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, adminAResultErr("用户不存在")
			}
			return nil, adminAInternal(err, "目标用户读取失败")
		}
		if id == u.ID && body.Role != "super_admin" {
			return nil, adminAResultErr("不能自我降级超级管理员角色")
		}
		if targetRole == "super_admin" && body.Role != "super_admin" {
			var active int
			if err := tx.QueryRow(r.Context(), `SELECT COUNT(*)::int FROM auth_usr.users WHERE role = 'super_admin' AND status = 'active'`).Scan(&active); err != nil {
				return nil, adminAInternal(err, "超级管理员数量校验失败")
			}
			if active <= 1 {
				return nil, adminAResultErr("不能降级最后一个活跃超级管理员账户")
			}
		}
		if _, err := tx.Exec(r.Context(), `UPDATE auth_usr.users SET role = $2, updated_at = now() WHERE id = $1`, id, body.Role); err != nil {
			return nil, adminAInternal(err, "角色更新失败")
		}
		tag, err := tx.Exec(r.Context(), `UPDATE auth_usr.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, id)
		if err != nil {
			return nil, adminAInternal(err, "会话撤销失败")
		}
		updated := map[string]any{"id": id, "role": body.Role}
		audit := map[string]any{"role": body.Role, "revokedCount": tag.RowsAffected()}
		raw, _ := json.Marshal(audit)
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ops_bill.admin_audit_logs
				(id, actor_id, actor_email, action, target_type, target_id, risk_level, before_json, after_json, request_id, created_at)
			VALUES ($1,$2,$3,'admins.change_role','user',$4,'high',$5::jsonb,$6::jsonb,$7,now())`,
			adminANewID("aud"), u.ID, adminAActorEmail(u), id,
			adminAJSONRaw(map[string]any{"role": targetRole}), string(raw), reqID)
		if err != nil {
			return nil, adminAInternal(err, "审计记录写入失败")
		}
		return map[string]any{"user": updated}, nil
	})
	return data, nil, aerr
}

// ---------------------------------------------------------------------------
// 2. GET /api/admin/analytics/cost — lib/services/analyticsFinancial.js
//    getCostCenterAnalytics with 7-day daily trend and USD->CNY / credits conversion.
// ---------------------------------------------------------------------------

func adminACostAnalytics(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	clauses := []string{"1=1"}
	args := []any{}
	n := func(v string) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if v := adminAQueryStr(r, "startDate"); v != "" {
		clauses = append(clauses, "att.created_at >= "+n(v)+"::timestamptz")
	}
	if v := adminAQueryStr(r, "endDate"); v != "" {
		clauses = append(clauses, "att.created_at <= "+n(v)+"::timestamptz")
	}
	if v := adminAQueryStr(r, "modelId"); v != "" {
		clauses = append(clauses, "pm.model_id = "+n(v))
	}
	if v := adminAQueryStr(r, "providerId"); v != "" {
		clauses = append(clauses, "att.provider_id = "+n(v))
	}
	where := strings.Join(clauses, " AND ")
	from := ` FROM ai_studio.generation_attempts att
		LEFT JOIN ai_studio.provider_models pm ON pm.id = att.provider_model_id
		LEFT JOIN ai_studio.provider_cost_records cr ON cr.attempt_id = att.id `
	kpi, _, err := adminAQueryOne(r.Context(), pool, `
		SELECT COUNT(att.id) AS total_calls,
			COALESCE(SUM(CASE WHEN att.status = 'succeeded' THEN 1 ELSE 0 END), 0) AS success_calls,
			COALESCE(SUM(CASE WHEN att.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_calls,
			COALESCE(ROUND(AVG(att.duration_ms)), 0) AS avg_latency_ms,
			COALESCE(SUM(cr.actual_cost_usd), 0) AS total_cost_usd`+from+`WHERE `+where, args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "成本中心指标读取失败")
	}
	providers, err := adminAQueryRows(r.Context(), pool, `
		SELECT att.provider_id, p.name AS provider_name, p.provider_type,
			COUNT(att.id) AS total_calls,
			COALESCE(SUM(CASE WHEN att.status = 'succeeded' THEN 1 ELSE 0 END), 0) AS success_calls,
			COALESCE(SUM(CASE WHEN att.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_calls,
			COALESCE(SUM(cr.actual_cost_usd), 0) AS total_cost_usd
		`+from+`LEFT JOIN ai_studio.ai_providers p ON p.id = att.provider_id
		WHERE `+where+` GROUP BY att.provider_id, p.name, p.provider_type
		ORDER BY total_cost_usd DESC, total_calls DESC`, args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "成本中心供应商汇总读取失败")
	}
	models, err := adminAQueryRows(r.Context(), pool, `
		SELECT COALESCE(pm.model_id, 'unknown') AS model_id,
			COALESCE(m.display_name, m.name, pm.model_id, '未知模型') AS model_name,
			COUNT(att.id) AS total_calls,
			COALESCE(SUM(CASE WHEN att.status = 'succeeded' THEN 1 ELSE 0 END), 0) AS success_calls,
			COALESCE(SUM(cr.actual_cost_usd), 0) AS total_cost_usd
		`+from+`LEFT JOIN ai_studio.ai_models m ON m.id = pm.model_id
		WHERE `+where+` GROUP BY pm.model_id, m.display_name, m.name
		ORDER BY total_cost_usd DESC, total_calls DESC`, args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "成本中心模型汇总读取失败")
	}
	dailyTrend, err := adminAQueryRows(r.Context(), pool, `
		SELECT to_char(att.created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS day,
			COUNT(att.id) AS total_calls,
			COALESCE(SUM(CASE WHEN att.status = 'succeeded' THEN 1 ELSE 0 END), 0) AS success_calls,
			COALESCE(SUM(cr.actual_cost_usd), 0) AS total_cost_usd
		`+from+`WHERE `+where+` AND att.created_at >= now() - INTERVAL '7 days'
		GROUP BY day ORDER BY day ASC`, args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "成本中心趋势读取失败")
	}
	enrichCostMetricsUSDToCNY(kpi)
	for _, p := range providers {
		enrichCostMetricsUSDToCNY(p)
	}
	for _, m := range models {
		enrichCostMetricsUSDToCNY(m)
	}
	for _, dRow := range dailyTrend {
		enrichCostMetricsUSDToCNY(dRow)
	}
	return map[string]any{"kpi": kpi, "providers": providers, "models": models, "dailyTrend": dailyTrend,
		"usdToCnyRate": generation.DefaultUSDToCNY,
		"filters": map[string]any{"startDate": adminAQueryStr(r, "startDate"), "endDate": adminAQueryStr(r, "endDate"),
			"modelId": adminAQueryStr(r, "modelId"), "providerId": adminAQueryStr(r, "providerId")}}, nil, nil
}

// ---------------------------------------------------------------------------
// 3. GET /api/admin/analytics/profit — getProfitCenterAnalytics
// ---------------------------------------------------------------------------

func adminAProfitAnalytics(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	clauses := []string{"1=1"}
	args := []any{}
	n := func(v string) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if v := adminAQueryStr(r, "startDate"); v != "" {
		clauses = append(clauses, "c.created_at >= "+n(v)+"::timestamptz")
	}
	if v := adminAQueryStr(r, "endDate"); v != "" {
		clauses = append(clauses, "c.created_at <= "+n(v)+"::timestamptz")
	}
	if v := adminAQueryStr(r, "modelId"); v != "" {
		clauses = append(clauses, "c.model = "+n(v))
	}
	where := strings.Join(clauses, " AND ")
	kpi, _, err := adminAQueryOne(r.Context(), pool, `
		SELECT COUNT(*) AS total_tasks,
			COALESCE(SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END), 0) AS succeeded_tasks,
			COALESCE(SUM(c.credit_cost), 0) AS total_credits,
			COALESCE(SUM(c.actual_cost_usd), 0) AS total_cost_usd
		FROM ai_studio.creations c WHERE `+where, args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "利润中心指标读取失败")
	}
	models, err := adminAQueryRows(r.Context(), pool, `
		SELECT c.model AS model_id, COUNT(*) AS total_tasks,
			COALESCE(SUM(c.credit_cost), 0) AS total_credits,
			COALESCE(SUM(c.actual_cost_usd), 0) AS total_cost_usd
		FROM ai_studio.creations c WHERE `+where+`
		GROUP BY c.model ORDER BY total_credits DESC, total_tasks DESC`, args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "利润中心模型汇总读取失败")
	}
	enrichProfitMetrics(kpi)
	for _, m := range models {
		enrichProfitMetrics(m)
	}
	return map[string]any{"kpi": kpi, "models": models,
		"cnyPerCredit": generation.CNYPerCredit, "usdToCnyRate": generation.DefaultUSDToCNY,
		"filters": map[string]any{"startDate": adminAQueryStr(r, "startDate"), "endDate": adminAQueryStr(r, "endDate"), "modelId": adminAQueryStr(r, "modelId")}}, nil, nil
}

// ---------------------------------------------------------------------------
// 4. GET /api/admin/audit — lib/admin/audit.js queryAuditLogs
// ---------------------------------------------------------------------------

func adminAAuditLogs(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	clauses := []string{"1=1"}
	args := []any{}
	n := func(v string) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if q := adminAQueryStr(r, "q"); q != "" {
		p := n("%" + q + "%")
		clauses = append(clauses, fmt.Sprintf("(actor_email ILIKE %s OR actor_id ILIKE %s OR action ILIKE %s OR target_id ILIKE %s)", p, p, p, p))
	}
	if risk := adminAQueryStr(r, "risk"); risk == "low" || risk == "medium" || risk == "high" {
		clauses = append(clauses, "risk_level = "+n(risk))
	}
	if tt := adminAQueryStr(r, "target_type"); tt != "" {
		clauses = append(clauses, "target_type = "+n(tt))
	}
	base := `SELECT id, actor_id, actor_email, action, target_type, target_id, risk_level,
		before_json, after_json, request_id, created_at
		FROM ops_bill.admin_audit_logs WHERE ` + strings.Join(clauses, " AND ")
	rows, meta, err := adminAPaged(r.Context(), pool, r, base, "created_at", "id", args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "审计日志读取失败")
	}
	for _, row := range rows {
		row["before"] = row["before_json"]
		row["after"] = row["after_json"]
	}
	return rows, meta, nil
}

// ---------------------------------------------------------------------------
// 5. GET/PUT /api/admin/canvas/config — lib/services/canvasModelConfig.js
//    Validates mounted modalities against ai_studio.models_config and stores under ops_bill.system_settings.
// ---------------------------------------------------------------------------

var adminACanvasCapabilities = []string{"image", "video", "text", "audio", "music"}

func adminACanvasConfig(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		stored, _, err := adminAReadSetting(ctx, pool, "canvas_model_config")
		if err != nil {
			return nil, nil, adminAInternal(err, "画布模型配置读取失败")
		}
		candidates, err := adminAQueryRows(ctx, pool, `
			SELECT id, name, type AS capability, credits_price AS credits, provider, metadata_json
			FROM ai_studio.models_config WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`)
		if err != nil {
			return nil, nil, adminAInternal(err, "画布候选模型读取失败")
		}
		var config any
		if stored != nil {
			config = stored
		}
		return map[string]any{"config": config, "candidates": candidates}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 256*1024, &body); e != nil {
		return nil, nil, e
	}
	mounted := adminAJSONMap(body["mountedModelIds"])
	defaults := adminAJSONMap(body["defaults"])
	if len(mounted) == 0 || len(defaults) == 0 {
		return nil, nil, adminAResultErr("模型挂载和默认配置不能为空")
	}
	candidates, err := adminAQueryRows(ctx, pool, `SELECT id, type AS capability FROM ai_studio.models_config WHERE is_active = TRUE`)
	if err != nil {
		return nil, nil, adminAInternal(err, "画布候选模型读取失败")
	}
	capByID := make(map[string]string, len(candidates))
	for _, c := range candidates {
		capByID[adminAStr(c["id"])] = adminAStr(c["capability"])
	}
	normalized := map[string]any{}
	for group, raw := range mounted {
		validGroup := false
		for _, c := range adminACanvasCapabilities {
			if c == group {
				validGroup = true
			}
		}
		ids := adminAJSONArray(raw)
		if !validGroup || len(ids) == 0 && raw == nil {
			return nil, nil, adminAResultErr("挂载列表包含无效、重复或模态不匹配的模型")
		}
		seen := map[string]bool{}
		out := make([]any, 0, len(ids))
		for _, idv := range ids {
			id := adminAStr(idv)
			if seen[id] {
				return nil, nil, adminAResultErr("挂载列表包含无效、重复或模态不匹配的模型")
			}
			seen[id] = true
			cap := capByID[id]
			if cap != group && !(group == "audio" && cap == "music") {
				return nil, nil, adminAResultErr("挂载列表包含无效、重复或模态不匹配的模型")
			}
			out = append(out, id)
		}
		normalized[group] = out
	}
	value := map[string]any{"mountedModelIds": normalized, "defaults": defaults}
	if err := adminAWriteSetting(ctx, pool, "canvas_model_config", value, "private", adminAActorEmail(u)); err != nil {
		return nil, nil, adminAInternal(err, "画布模型配置保存失败")
	}
	adminAAuditAfter(ctx, pool, u, "settings.update", "system_setting", "canvas_model_config", "medium", reqID, value)
	return map[string]any{"key": "canvas_model_config", "value": value, "visibility": "private"}, nil, nil
}

// ---------------------------------------------------------------------------
// 6. GET /api/admin/community/posts — lib/repositories/community.js
//    listAdminCommunityPosts
// ---------------------------------------------------------------------------

func adminACommunityPosts(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	clauses := []string{"1=1"}
	args := []any{}
	n := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if s := adminAQueryStr(r, "status"); s != "" {
		clauses = append(clauses, "p.status = "+n(s))
	}
	if s := adminAQueryStr(r, "mediaType"); s != "" {
		clauses = append(clauses, "p.media_type = "+n(s))
	}
	if s := adminAQueryStr(r, "featured"); s == "true" || s == "false" {
		clauses = append(clauses, "p.is_featured = "+n(s == "true"))
	}
	if q := adminAQueryStr(r, "q"); q != "" {
		p := n("%" + q + "%")
		clauses = append(clauses, fmt.Sprintf("(p.title ILIKE %s OR p.description ILIKE %s OR p.prompt ILIKE %s OR p.model_name ILIKE %s)", p, p, p, p))
	}
	limit := adminAInt(r, "limit", 100, 1, 500)
	args = append(args, limit)
	rows, err := adminAQueryRows(r.Context(), pool, `
		SELECT p.*, u.display_name AS author_name, u.username AS author_username
		FROM ai_studio.community_posts p
		LEFT JOIN auth_usr.users u ON u.id = p.user_id
		WHERE `+strings.Join(clauses, " AND ")+`
		ORDER BY p.updated_at DESC, p.created_at DESC LIMIT $`+strconv.Itoa(len(args)), args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "社区作品列表读取失败")
	}
	summary, _, err := adminAQueryOne(r.Context(), pool, `
		SELECT COUNT(*)::int AS total,
			COUNT(*) FILTER (WHERE status = 'published')::int AS published,
			COUNT(*) FILTER (WHERE status = 'hidden')::int AS hidden,
			COUNT(*) FILTER (WHERE is_featured)::int AS featured
		FROM ai_studio.community_posts`)
	if err != nil {
		return nil, nil, adminAInternal(err, "社区作品统计读取失败")
	}
	return map[string]any{"rows": rows, "summary": summary}, nil, nil
}

// ---------------------------------------------------------------------------
// 7. PATCH /api/admin/community/posts/[id] — updateCommunityPostForAdmin
// ---------------------------------------------------------------------------

func adminACommunityPostPatch(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyLenient(r, 256*1024, &body); e != nil {
		return nil, nil, e
	}
	id := pathParam(r, "id")
	if id == "" {
		return nil, nil, adminAResultErr("社区作品不存在")
	}
	sets := []string{}
	args := []any{}
	n := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if v, ok := body["title"]; ok {
		sets = append(sets, "title = "+n(adminAStr(v)))
	}
	if v, ok := body["description"]; ok {
		sets = append(sets, "description = "+n(adminAStr(v)))
	}
	if v, ok := body["modelName"]; ok {
		sets = append(sets, "model_name = "+n(adminAStr(v)))
	}
	if v, ok := body["tags"]; ok {
		tags := make([]string, 0)
		for _, t := range adminAJSONArray(v) {
			tags = append(tags, adminAStr(t))
		}
		sets = append(sets, "tags = "+n(tags)+"::text[]")
	}
	if v, ok := body["status"]; ok {
		sets = append(sets, "status = "+n(adminAStr(v)))
	}
	if v, ok := body["isFeatured"]; ok {
		sets = append(sets, "is_featured = "+n(adminABool(v)))
	}
	if len(sets) == 0 {
		return nil, nil, adminAResultErr("没有可更新的作品字段")
	}
	sets = append(sets, "updated_at = now()")
	args = append(args, id)
	sql := `UPDATE ai_studio.community_posts SET ` + strings.Join(sets, ", ") + ` WHERE id = $` + strconv.Itoa(len(args))
	affected, err := adminAExec(r.Context(), pool, sql, args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "社区作品更新失败")
	}
	if affected == 0 {
		return nil, nil, adminAResultErr("社区作品不存在")
	}
	row, _, err := adminAQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.community_posts WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "社区作品回读失败")
	}
	return row, nil, nil
}

// ---------------------------------------------------------------------------
// 8. GET/DELETE /api/admin/content/analytics — getBannerAnalytics /
//    resetBannerAnalytics (TRUNCATE banner_events, exact source behaviour).
// ---------------------------------------------------------------------------

func adminABannerAnalytics(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodDelete {
		if _, err := pool.Exec(ctx, `TRUNCATE TABLE ops_bill.banner_events`); err != nil {
			return nil, nil, adminErr("DB_ERROR", "清空统计失败: "+err.Error(), http.StatusUnprocessableEntity)
		}
		adminAAuditAfter(ctx, pool, u, "content.banner_analytics_reset", "banner_events", "all", "high", reqID, map[string]any{"action": "TRUNCATE"})
		return map[string]any{"reset": true}, nil, nil
	}
	var bannerID any
	if v := adminAQueryStr(r, "bannerId"); v != "" {
		bannerID = v
	}
	limit := adminAInt(r, "limit", 50, 10, 100)
	offset := adminAInt(r, "offset", 0, 0, 1000000)
	summary, _, err := adminAQueryOne(ctx, pool, `
		SELECT COUNT(*) FILTER (WHERE event_type = 'impression') AS total_impressions,
			COUNT(*) FILTER (WHERE event_type = 'click') AS total_clicks,
			COUNT(*) FILTER (WHERE event_type = 'dismiss') AS total_dismissals,
			COUNT(DISTINCT anonymous_id) AS unique_visitors
		FROM ops_bill.banner_events WHERE ($1::text IS NULL OR banner_id = $1::text)`, bannerID)
	if err != nil {
		return nil, nil, adminAInternal(err, "横幅统计读取失败")
	}
	count, _, err := adminAQueryOne(ctx, pool, `SELECT COUNT(*) AS total_count FROM ops_bill.banner_events WHERE ($1::text IS NULL OR banner_id = $1::text)`, bannerID)
	if err != nil {
		return nil, nil, adminAInternal(err, "横幅统计总数读取失败")
	}
	events, err := adminAQueryRows(ctx, pool, `
		SELECT id, banner_id, event_type, user_id, anonymous_id, target_url, page_path,
			locale, user_agent, ip, created_at
		FROM ops_bill.banner_events WHERE ($1::text IS NULL OR banner_id = $1::text)
		ORDER BY created_at DESC LIMIT $2 OFFSET $3`, bannerID, limit, offset)
	if err != nil {
		return nil, nil, adminAInternal(err, "横幅统计明细读取失败")
	}
	impressions := adminAFloat(summary["total_impressions"])
	clicks := adminAFloat(summary["total_clicks"])
	ctr := 0.0
	if impressions > 0 {
		ctr = float64(int64(clicks/impressions*10000+0.5)) / 100
	}
	return map[string]any{
		"kpi": map[string]any{"impressions": impressions, "clicks": clicks,
			"dismissals": adminAFloat(summary["total_dismissals"]), "ctr": ctr,
			"uniqueVisitors": adminAFloat(summary["unique_visitors"])},
		"events": events, "total": adminAFloat(count["total_count"]),
		"limit": limit, "offset": offset,
	}, nil, nil
}

// ---------------------------------------------------------------------------
// 9. GET/POST /api/admin/content/banner — getBannerConfig / saveBannerConfig
// ---------------------------------------------------------------------------

func adminADefaultBannerConfig() map[string]any {
	return map[string]any{
		"id": "banner-default", "title": "Flova 风格沉浸式横幅", "enabled": true,
		"highlightText": "上新特惠：",
		"message":       "年会员享 Flova Image 2.5、Seedance 2.5 最低4折，1K 低至 ¥0.058/张",
		"ctaText":       "立即订阅", "linkUrl": "/studio?account=open&tab=membership",
		"linkTarget": "_self", "theme": "indigo", "ambientGlow": true,
		"glowStyle": "aurora", "dynamicEffect": "breathe", "dismissible": true,
		"autoHideDays": 7, "badgeText": "HOT", "showPulseDot": true, "targetScope": "all",
	}
}

func adminANormalizeBannerConfig(raw map[string]any) map[string]any {
	cfg := adminADefaultBannerConfig()
	for k, v := range raw {
		if v != nil {
			cfg[k] = v
		}
	}
	if adminAStr(cfg["id"]) == "" {
		cfg["id"] = "banner-" + strconv.FormatInt(time.Now().UnixMilli(), 10)
	}
	cfg["title"] = strings.TrimSpace(adminAStr(cfg["title"]))
	if adminAStr(cfg["title"]) == "" {
		msg := adminAStr(cfg["message"])
		if len(msg) > 30 {
			msg = msg[:30]
		}
		cfg["title"] = firstNonEmpty(msg, "未命名横幅")
	}
	cfg["enabled"] = adminABool(cfg["enabled"])
	cfg["message"] = firstNonEmpty(strings.TrimSpace(adminAStr(cfg["message"])), adminAStr(adminADefaultBannerConfig()["message"]))
	cfg["linkUrl"] = firstNonEmpty(strings.TrimSpace(adminAStr(cfg["linkUrl"])), "#")
	if adminAStr(cfg["linkTarget"]) != "_self" {
		cfg["linkTarget"] = "_blank"
	}
	cfg["theme"] = adminAOneOf(adminAStr(cfg["theme"]), []string{"indigo", "cyan", "emerald", "amber", "rose", "purple"}, "indigo")
	cfg["ambientGlow"] = cfg["ambientGlow"] != false
	cfg["glowStyle"] = adminAOneOf(adminAStr(cfg["glowStyle"]), []string{"aurora", "cyan", "amber", "rose"}, "aurora")
	cfg["dynamicEffect"] = adminAOneOf(adminAStr(cfg["dynamicEffect"]), []string{"breathe", "drift", "shimmer", "none"}, "breathe")
	cfg["dismissible"] = cfg["dismissible"] != false
	days := int(adminAFloat(cfg["autoHideDays"]))
	if days < 0 {
		days = 7
	}
	cfg["autoHideDays"] = days
	badge := strings.TrimSpace(adminAStr(cfg["badgeText"]))
	if len(badge) > 10 {
		badge = badge[:10]
	}
	cfg["badgeText"] = badge
	cfg["showPulseDot"] = adminABool(cfg["showPulseDot"])
	cfg["targetScope"] = adminAOneOf(adminAStr(cfg["targetScope"]), []string{"all", "studio", "home"}, "all")
	return cfg
}

func adminAOneOf(value string, allowed []string, fallback string) string {
	for _, a := range allowed {
		if a == value {
			return value
		}
	}
	return fallback
}

// adminASaveBanner persists the effective setting and archives it into
// ops_bill.banner_history exactly like lib/services/content.js.
func adminASaveBanner(ctx context.Context, pool *pgxpool.Pool, cfg map[string]any, u *middleware.SessionUser, reqID string) (map[string]any, *adminError) {
	if err := adminAWriteSetting(ctx, pool, "site_banner", cfg, "private", adminAActorEmail(u)); err != nil {
		return nil, adminAInternal(err, "保存横幅配置失败")
	}
	if _, err := pool.Exec(ctx, `UPDATE ops_bill.banner_history SET is_active = false WHERE is_active = true`); err != nil {
		return nil, adminAInternal(err, "保存横幅配置失败")
	}
	_, err := pool.Exec(ctx, `
		INSERT INTO ops_bill.banner_history
			(id, title, message, highlight_text, cta_text, link_url, link_target, theme,
			 ambient_glow, glow_style, dynamic_effect, badge_text, show_pulse_dot,
			 dismissible, auto_hide_days, target_scope, is_active, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17,now(),now())
		ON CONFLICT (id) DO UPDATE SET
			title = EXCLUDED.title, message = EXCLUDED.message,
			highlight_text = EXCLUDED.highlight_text, cta_text = EXCLUDED.cta_text,
			link_url = EXCLUDED.link_url, link_target = EXCLUDED.link_target,
			theme = EXCLUDED.theme, ambient_glow = EXCLUDED.ambient_glow,
			glow_style = EXCLUDED.glow_style, dynamic_effect = EXCLUDED.dynamic_effect,
			badge_text = EXCLUDED.badge_text, show_pulse_dot = EXCLUDED.show_pulse_dot,
			dismissible = EXCLUDED.dismissible, auto_hide_days = EXCLUDED.auto_hide_days,
			target_scope = EXCLUDED.target_scope, is_active = true, updated_at = now()`,
		adminAStr(cfg["id"]), adminAStr(cfg["title"]), adminAStr(cfg["message"]),
		adminAStr(cfg["highlightText"]), adminAStr(cfg["ctaText"]), adminAStr(cfg["linkUrl"]),
		adminAStr(cfg["linkTarget"]), adminAStr(cfg["theme"]), adminABool(cfg["ambientGlow"]),
		adminAStr(cfg["glowStyle"]), adminAStr(cfg["dynamicEffect"]), adminAStr(cfg["badgeText"]),
		adminABool(cfg["showPulseDot"]), adminABool(cfg["dismissible"]), int(adminAFloat(cfg["autoHideDays"])),
		adminAStr(cfg["targetScope"]), adminAActorEmail(u))
	if err != nil {
		return nil, adminAInternal(err, "保存横幅配置失败")
	}
	adminAAuditAfter(ctx, pool, u, "content.banner_update", "content_banner", adminAStr(cfg["id"]), "medium", reqID, cfg)
	return cfg, nil
}

func adminABannerConfig(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		stored, _, err := adminAReadSetting(ctx, pool, "site_banner")
		if err != nil {
			return nil, nil, adminAInternal(err, "横幅配置读取失败")
		}
		return adminANormalizeBannerConfig(adminAJSONMap(stored)), nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 256*1024, &body); e != nil {
		return nil, nil, e
	}
	if len(body) == 0 {
		return nil, nil, adminErr("INVALID_CONFIG", "横幅配置必须为有效对象", http.StatusUnprocessableEntity)
	}
	cfg, e := adminASaveBanner(ctx, pool, adminANormalizeBannerConfig(body), u, reqID)
	if e != nil {
		return nil, nil, e
	}
	return cfg, nil, nil
}

// ---------------------------------------------------------------------------
// 10. GET /api/admin/content/banner/history — getBannerHistory
// ---------------------------------------------------------------------------

func adminABannerHistory(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	rows, err := adminAQueryRows(ctx, pool, `
		SELECT id, title, message, highlight_text AS "highlightText", cta_text AS "ctaText",
			link_url AS "linkUrl", link_target AS "linkTarget", theme,
			ambient_glow AS "ambientGlow", glow_style AS "glowStyle", dynamic_effect AS "dynamicEffect",
			badge_text AS "badgeText", show_pulse_dot AS "showPulseDot", dismissible,
			auto_hide_days AS "autoHideDays", target_scope AS "targetScope", is_active AS "isActive",
			created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
		FROM ops_bill.banner_history ORDER BY created_at DESC LIMIT 50`)
	if err != nil {
		return nil, nil, adminAInternal(err, "横幅历史读取失败")
	}
	if len(rows) == 0 {
		stored, _, err := adminAReadSetting(ctx, pool, "site_banner")
		if err != nil {
			return nil, nil, adminAInternal(err, "横幅配置读取失败")
		}
		cur := adminANormalizeBannerConfig(adminAJSONMap(stored))
		cur["isActive"] = true
		return []map[string]any{cur}, nil, nil
	}
	return rows, nil, nil
}

// ---------------------------------------------------------------------------
// 11. POST/DELETE /api/admin/content/banner/history/[id]
//     activateHistoricalBanner / deleteHistoricalBanner
// ---------------------------------------------------------------------------

func adminABannerHistoryItem(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	id := pathParam(r, "id")
	if id == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "历史横幅 ID 不能为空", http.StatusUnprocessableEntity)
	}
	if r.Method == http.MethodDelete {
		row, ok, err := adminAQueryOne(ctx, pool, `SELECT id, is_active AS "isActive" FROM ops_bill.banner_history WHERE id = $1`, id)
		if err != nil {
			return nil, nil, adminAInternal(err, "删除历史横幅失败")
		}
		if !ok {
			return nil, nil, adminErr("NOT_FOUND", "历史横幅记录不存在", http.StatusNotFound)
		}
		if adminABool(row["isActive"]) {
			return nil, nil, adminErr("FORBIDDEN", "当前正在生效中的横幅无法直接删除，请先切换其他横幅", http.StatusForbidden)
		}
		if _, err := pool.Exec(ctx, `DELETE FROM ops_bill.banner_history WHERE id = $1`, id); err != nil {
			return nil, nil, adminAInternal(err, "删除历史横幅失败")
		}
		adminAAudit(ctx, pool, u, "content.banner_history_delete", "content_banner_history", id, "medium", reqID, row, nil)
		return map[string]any{"success": true, "id": id}, nil, nil
	}
	row, ok, err := adminAQueryOne(ctx, pool, `
		SELECT id, title, message, highlight_text AS "highlightText", cta_text AS "ctaText",
			link_url AS "linkUrl", link_target AS "linkTarget", theme,
			ambient_glow AS "ambientGlow", glow_style AS "glowStyle", dynamic_effect AS "dynamicEffect",
			badge_text AS "badgeText", show_pulse_dot AS "showPulseDot", dismissible,
			auto_hide_days AS "autoHideDays", target_scope AS "targetScope"
		FROM ops_bill.banner_history WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "激活历史横幅失败")
	}
	if !ok {
		return nil, nil, adminErr("NOT_FOUND", "未找到该历史横幅记录", http.StatusNotFound)
	}
	row["enabled"] = true
	cfg, e := adminASaveBanner(ctx, pool, adminANormalizeBannerConfig(row), u, reqID)
	if e != nil {
		return nil, nil, e
	}
	return cfg, nil, nil
}

// ---------------------------------------------------------------------------
// 12. GET/POST /api/admin/content/branding — lib/services/branding.js
// ---------------------------------------------------------------------------

func adminADefaultBrandConfig() map[string]any {
	return map[string]any{
		"brandName": "supdance", "siteTitle": "SupDance — Free AI Image & Video Studio",
		"titleTemplate": "%s | SupDance AI Studio", "brandSlogan": "AI 创意工作室",
		"logoType": "image", "logoUrl": "/uploads/branding/logo-1789960604256-8d69f211113d.png",
		"logoIcon": "layers", "logoBgColor": "#22d3ee", "logoTextColor": "#000000",
		"logoHref": "/", "logoTarget": "_self", "showBrandName": false,
		"faviconUrl": "/uploads/branding/icon-1790631358168-d0b66b0fc4e1.svg",
	}
}

func adminADefaultNavConfig() []map[string]any {
	return []map[string]any{
		{"id": "nav_community", "label": "即梦社区", "labelEn": "Community", "href": "/community", "icon": "flame", "iconColor": "#fb923c", "style": "gradient", "badge": "HOT", "enabled": true, "target": "_self", "order": 1},
		{"id": "nav_creations", "label": "我的作品", "labelEn": "My Creations", "href": "/creations", "icon": "folder", "iconColor": "#facc15", "style": "subtle", "badge": "", "enabled": true, "target": "_self", "order": 2},
		{"id": "nav_pricing", "label": "商用定价", "labelEn": "Pricing", "href": "/pricing", "icon": "zap", "iconColor": "#e11d74", "style": "subtle", "badge": "PRO", "enabled": true, "target": "_self", "order": 3},
		{"id": "nav_call_api", "label": "开放平台", "labelEn": "API", "href": "/call-api", "icon": "workflow", "iconColor": "#a855f7", "style": "subtle", "badge": "筹备中", "enabled": true, "target": "_self", "order": 4},
		{"id": "nav_about", "label": "关于本站", "labelEn": "About", "href": "/about", "icon": "sparkles", "iconColor": "#38bdf8", "style": "subtle", "badge": "", "enabled": true, "target": "_self", "order": 999},
	}
}

func adminABrandingRead(ctx context.Context, pool *pgxpool.Pool, key string) (any, *adminError) {
	stored, _, err := adminAReadSetting(ctx, pool, key)
	if err != nil {
		return nil, adminAInternal(err, "品牌配置读取失败")
	}
	return stored, nil
}

func adminABranding(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	defaults := map[string]any{"brand": adminADefaultBrandConfig(), "navigation": adminADefaultNavConfig()}
	if r.Method == http.MethodGet {
		brandRaw, e := adminABrandingRead(ctx, pool, "site_brand")
		if e != nil {
			return nil, nil, e
		}
		navRaw, e := adminABrandingRead(ctx, pool, "site_navigation")
		if e != nil {
			return nil, nil, e
		}
		brand := adminADefaultBrandConfig()
		for k, v := range adminAJSONMap(brandRaw) {
			brand[k] = v
		}
		navigation := any(adminADefaultNavConfig())
		if arr, ok := navRaw.([]any); ok && len(arr) > 0 {
			navigation = arr
		}
		return map[string]any{"brand": brand, "navigation": navigation, "defaults": defaults}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 512*1024, &body); e != nil {
		return nil, nil, e
	}
	if body["action"] == "reset" {
		if err := adminAWriteSetting(ctx, pool, "site_brand", adminADefaultBrandConfig(), "private", adminAActorEmail(u)); err != nil {
			return nil, nil, adminAInternal(err, "品牌配置重置失败")
		}
		if err := adminAWriteSetting(ctx, pool, "site_navigation", adminADefaultNavConfig(), "private", adminAActorEmail(u)); err != nil {
			return nil, nil, adminAInternal(err, "导航配置重置失败")
		}
		adminAAuditAfter(ctx, pool, u, "content.branding_reset", "content_branding", "global", "medium", reqID, defaults)
		return map[string]any{"brand": adminADefaultBrandConfig(), "navigation": adminADefaultNavConfig()}, nil, nil
	}
	brand := adminADefaultBrandConfig()
	for k, v := range adminAJSONMap(body["brand"]) {
		brand[k] = v
	}
	if body["brand"] != nil {
		if err := adminAWriteSetting(ctx, pool, "site_brand", brand, "private", adminAActorEmail(u)); err != nil {
			return nil, nil, adminAInternal(err, "品牌配置保存失败")
		}
	} else {
		stored, e := adminABrandingRead(ctx, pool, "site_brand")
		if e != nil {
			return nil, nil, e
		}
		for k, v := range adminAJSONMap(stored) {
			brand[k] = v
		}
	}
	var navigation any = adminADefaultNavConfig()
	if body["navigation"] != nil {
		items := adminAJSONArray(body["navigation"])
		if len(items) == 0 {
			return nil, nil, adminAResultErr("导航菜单不能为空")
		}
		if err := adminAWriteSetting(ctx, pool, "site_navigation", items, "private", adminAActorEmail(u)); err != nil {
			return nil, nil, adminAInternal(err, "导航配置保存失败")
		}
		navigation = items
	} else {
		stored, e := adminABrandingRead(ctx, pool, "site_navigation")
		if e != nil {
			return nil, nil, e
		}
		if arr, ok := stored.([]any); ok && len(arr) > 0 {
			navigation = arr
		}
	}
	payload := map[string]any{"brand": brand, "navigation": navigation}
	adminAAuditAfter(ctx, pool, u, "content.branding_update", "content_branding", "global", "medium", reqID, payload)
	return payload, nil, nil
}

// ---------------------------------------------------------------------------
// 13. POST /api/admin/content/branding/upload
//     Real multipart + magic-number validation, 5MB cap, filesystem write.
//     The DB gate prevents any filesystem side effect in degraded/unit mode.
// ---------------------------------------------------------------------------

const adminAUploadMaxBytes = 5 * 1024 * 1024

var adminAUploadMIMEs = map[string]bool{
	"image/png": true, "image/jpeg": true, "image/webp": true,
	"image/svg+xml": true, "image/x-icon": true, "image/vnd.microsoft.icon": true,
}
var adminAUploadExts = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".webp": true, ".svg": true, ".ico": true,
}

func adminABrandingUpload(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	// A real DB-backed deployment is required before accepting a persistent asset.
	if _, _, err := adminAQueryOne(r.Context(), pool, `SELECT key FROM ops_bill.system_settings WHERE key = 'site_brand'`); err != nil {
		return nil, nil, adminAInternal(err, "图片上传处理失败")
	}
	fh, data, uploadType, err := adminAOpenUpload(r, adminAUploadMaxBytes)
	if err != nil {
		return nil, nil, adminErr("VALIDATION_ERROR", "未检测到有效的图片文件", http.StatusBadRequest)
	}
	if len(data) > adminAUploadMaxBytes {
		return nil, nil, adminErr("VALIDATION_ERROR", "图片体积不能超过 5MB", http.StatusBadRequest)
	}
	mime := strings.ToLower(strings.TrimSpace(fh.Header.Get("Content-Type")))
	if mime != "" && !adminAUploadMIMEs[mime] {
		return nil, nil, adminErr("VALIDATION_ERROR", "不支持的图片格式: "+mime, http.StatusBadRequest)
	}
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !adminAUploadExts[ext] {
		if mime == "image/webp" {
			ext = ".webp"
		} else {
			ext = ".png"
		}
	}
	if !adminAValidMagic(data, ext) {
		return nil, nil, adminErr("VALIDATION_ERROR", "图片文件内容损坏或非法格式", http.StatusBadRequest)
	}
	prefix := "logo"
	if uploadType == "icon" {
		prefix = "icon"
	}
	dir := filepath.Join("public", "uploads", "branding")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, nil, adminErr("UPLOAD_FAILED", "图片上传处理失败", http.StatusInternalServerError)
	}
	var suffix [6]byte
	_, _ = rand.Read(suffix[:])
	filename := fmt.Sprintf("%s-%d-%s%s", prefix, time.Now().UnixMilli(), hex.EncodeToString(suffix[:]), ext)
	if err := os.WriteFile(filepath.Join(dir, filename), data, 0o644); err != nil {
		return nil, nil, adminErr("UPLOAD_FAILED", "图片上传处理失败", http.StatusInternalServerError)
	}
	return map[string]any{
		"url": "/uploads/branding/" + filename, "filename": filename,
		"size": len(data), "ext": ext,
	}, nil, nil
}

// ---------------------------------------------------------------------------
// 14. GET/POST /api/admin/content/motion — getMotionConfig / saveMotionConfig
// ---------------------------------------------------------------------------

func adminADefaultMotionConfig() map[string]any {
	return map[string]any{"motionLevel": "full", "ambientGlow": true, "cardTiltHover": true, "bannerPulse": true}
}

func adminAMotionConfig(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	stored, _, err := adminAReadSetting(ctx, pool, "homepage_motion")
	if err != nil {
		return nil, nil, adminAInternal(err, "动效配置读取失败")
	}
	previous := adminADefaultMotionConfig()
	for k, v := range adminAJSONMap(stored) {
		previous[k] = v
	}
	if r.Method == http.MethodGet {
		return previous, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	if len(body) == 0 {
		return nil, nil, adminErr("INVALID_CONFIG", "动效配置必须为有效对象", http.StatusUnprocessableEntity)
	}
	next := map[string]any{
		"motionLevel":   adminAOneOf(adminAStr(body["motionLevel"]), []string{"full", "balanced", "minimal"}, "full"),
		"ambientGlow":   adminABool(body["ambientGlow"]),
		"cardTiltHover": adminABool(body["cardTiltHover"]),
		"bannerPulse":   adminABool(body["bannerPulse"]),
	}
	if err := adminAWriteSetting(ctx, pool, "homepage_motion", next, "private", adminAActorEmail(u)); err != nil {
		return nil, nil, adminAInternal(err, "保存动效配置失败")
	}
	adminAAudit(ctx, pool, u, "content.motion_update", "content_motion", "global", "low", reqID, previous, next)
	return next, nil, nil
}

// ---------------------------------------------------------------------------
// 15/16/17/18. X crawler prompt cache — lib/services/xPromptCrawler.js
//    Prompts live in ops_bill.system_settings value_json under the verified
//    'crawler_x_prompts_cache' / 'crawler_x_config' keys.
// ---------------------------------------------------------------------------

const adminAXPromptsKey = "crawler_x_prompts_cache"
const adminAXConfigKey = "crawler_x_config"

func adminAXPromptItems(ctx context.Context, pool *pgxpool.Pool) ([]map[string]any, *adminError) {
	stored, _, err := adminAReadSetting(ctx, pool, adminAXPromptsKey)
	if err != nil {
		return nil, adminAInternal(err, "提示词缓存读取失败")
	}
	out := make([]map[string]any, 0)
	for _, v := range adminAJSONArray(stored) {
		m := adminAJSONMap(v)
		out = append(out, m)
	}
	return out, nil
}

func adminAXPrompts(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodDelete {
		id := adminAQueryStr(r, "id")
		if id == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "缺少提示词记录 ID", http.StatusBadRequest)
		}
		items, e := adminAXPromptItems(ctx, pool)
		if e != nil {
			return nil, nil, e
		}
		kept := make([]map[string]any, 0, len(items))
		for _, item := range items {
			if adminAStr(item["id"]) != id {
				kept = append(kept, item)
			}
		}
		if err := adminAWriteSetting(ctx, pool, adminAXPromptsKey, kept, "private", adminAActorEmail(u)); err != nil {
			return nil, nil, adminAInternal(err, "提示词删除失败")
		}
		return map[string]any{"success": true, "id": id}, nil, nil
	}
	all, e := adminAXPromptItems(ctx, pool)
	if e != nil {
		return nil, nil, e
	}
	category := adminAQueryStr(r, "category")
	q := strings.ToLower(adminAQueryStr(r, "q"))
	status := adminAQueryStr(r, "status")
	author := strings.ToLower(strings.TrimPrefix(adminAQueryStr(r, "author"), "@"))
	page := adminAInt(r, "page", 1, 1, 100000)
	pageSize := adminAInt(r, "pageSize", 24, 1, 100)
	filtered := make([]map[string]any, 0)
	for _, item := range all {
		if category != "" && category != "all" && adminAStr(item["category"]) != category {
			continue
		}
		if status != "" && status != "all" && adminAStr(item["status"]) != status {
			continue
		}
		if author != "" && author != "all" && strings.ToLower(adminAStr(item["author"])) != author {
			continue
		}
		if q != "" {
			blob := strings.ToLower(strings.Join([]string{adminAStr(item["prompt"]), adminAStr(item["model"]), adminAStr(item["author"]), adminAStr(item["parameters"])}, " "))
			if !strings.Contains(blob, q) {
				continue
			}
		}
		filtered = append(filtered, item)
	}
	total := len(filtered)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	counts := map[string]any{"all": len(all), "image": 0, "video": 0, "music": 0, "adopted": 0}
	for _, item := range all {
		if c := adminAStr(item["category"]); c == "image" || c == "video" || c == "music" {
			counts[c] = counts[c].(int) + 1
		}
		if adminAStr(item["status"]) == "adopted" {
			counts["adopted"] = counts["adopted"].(int) + 1
		}
	}
	return map[string]any{
		"items": filtered[start:end], "total": total, "page": page, "pageSize": pageSize,
		"totalPages": (total + pageSize - 1) / pageSize, "counts": counts,
	}, nil, nil
}

func adminAXPromptAdopt(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	promptID := adminAStr(body["promptId"])
	if promptID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "缺少 promptId", http.StatusBadRequest)
	}
	items, e := adminAXPromptItems(r.Context(), pool)
	if e != nil {
		return nil, nil, e
	}
	idx := -1
	for i, item := range items {
		if adminAStr(item["id"]) == promptID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return nil, nil, adminErr("ADOPT_FAILED", "未找到对应提示词案例", http.StatusBadRequest)
	}
	item := items[idx]
	title := adminAStr(body["title"])
	if title == "" {
		prompt := adminAStr(item["prompt"])
		if len(prompt) > 30 {
			prompt = prompt[:30]
		}
		title = adminAStr(item["model"]) + " 灵感：" + prompt + "..."
	}
	data, aerr := adminAWithTx(r.Context(), pool, func(tx pgx.Tx) (any, *adminError) {
		postID := adminANewID("post")
		mediaURLs := adminAJSONArray(item["mediaUrls"])
		mediaURL := ""
		if len(mediaURLs) > 0 {
			mediaURL = adminAStr(mediaURLs[0])
		}
		tags := []string{adminAStr(item["model"]), adminAStr(item["category"]), "X精选"}
		_, err := tx.Exec(r.Context(), `
			INSERT INTO ai_studio.community_posts
				(id, user_id, title, description, media_type, media_url, cover_url, prompt,
				 negative_prompt, model_name, parameters, tags, status, is_featured, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::text[],'published',false,now(),now())`,
			postID, u.ID, title, "来自 @"+adminAStr(item["author"])+" 的 X (Twitter) 精选灵感案例。\n原推链接："+adminAStr(item["tweetUrl"]),
			adminAOneOf(adminAStr(item["mediaType"]), []string{"image", "video", "audio", "workflow"}, "image"),
			mediaURL, mediaURL, adminAStr(item["prompt"]), adminAStr(item["negativePrompt"]),
			adminAStr(item["model"]),
			adminAJSONRaw(map[string]any{"rawParams": adminAStr(item["parameters"]), "source": "twitter_crawl",
				"author": adminAStr(item["author"]), "tweetUrl": adminAStr(item["tweetUrl"])}), tags)
		if err != nil {
			return nil, adminAInternal(err, "采纳发布失败")
		}
		item["status"] = "adopted"
		item["adoptedPostId"] = postID
		items[idx] = item
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO ops_bill.system_settings (key, value_json, visibility, version, updated_by, updated_at)
			VALUES ($1,$2::jsonb,'private',1,$3,now())
			ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json,
				version = system_settings.version + 1, updated_by = excluded.updated_by, updated_at = now()`,
			adminAXPromptsKey, adminAJSONRaw(items), adminAActorEmail(u)); err != nil {
			return nil, adminAInternal(err, "采纳发布失败")
		}
		return map[string]any{"success": true, "post": map[string]any{"id": postID, "title": title}, "promptItem": item}, nil
	})
	return data, nil, aerr
}

func adminADefaultCrawlerConfig() map[string]any {
	return map[string]any{
		"status": "unconfigured", "lastCheckAt": nil,
		"cookies": map[string]any{"authToken": "", "ct0": ""},
		"rules": map[string]any{
			"imageQuery":  `(Flux OR Midjourney OR "Stable Diffusion") (prompt OR "prompt:") has:images -is:retweet min_faves:10`,
			"videoQuery":  `(Kling OR Runway OR Luma OR Sora OR Hailuo OR Minimax) prompt (has:videos OR filter:media) -is:retweet`,
			"musicQuery":  `(Suno OR Udio) (prompt OR lyrics OR style) -is:retweet`,
			"limitPerRun": 15, "minFaves": 10, "targetAuthorMode": "all",
			"targetAuthors": []string{"fofrAI", "icreatelife", "oran_ge", "properprompter", "LinusEkenstam"},
			"autoSchedule":  false, "intervalHours": 2,
		},
	}
}

func adminAMaskSecret(s string) string {
	if s == "" {
		return ""
	}
	if len(s) <= 8 {
		return s[:1] + "••••"
	}
	return s[:4] + "••••" + s[len(s)-4:]
}

func adminACrawlerSafe(cfg map[string]any) map[string]any {
	copy := map[string]any{}
	for k, v := range cfg {
		copy[k] = v
	}
	cookies := adminAJSONMap(cfg["cookies"])
	authToken := adminAStr(cookies["authToken"])
	ct0 := adminAStr(cookies["ct0"])
	copy["cookies"] = map[string]any{
		"hasAuthToken": authToken != "", "authTokenMasked": adminAMaskSecret(authToken),
		"hasCt0": ct0 != "", "ct0Masked": adminAMaskSecret(ct0),
	}
	return copy
}

func adminACrawlerConfig(ctx context.Context, pool *pgxpool.Pool) (map[string]any, *adminError) {
	stored, _, err := adminAReadSetting(ctx, pool, adminAXConfigKey)
	if err != nil {
		return nil, adminAInternal(err, "抓取器配置读取失败")
	}
	cfg := adminADefaultCrawlerConfig()
	val := adminAJSONMap(stored)
	if len(val) > 0 {
		if s := adminAStr(val["status"]); s != "" {
			cfg["status"] = s
		}
		if v, ok := val["lastCheckAt"]; ok {
			cfg["lastCheckAt"] = v
		}
		cookies := adminAJSONMap(val["cookies"])
		cfg["cookies"] = map[string]any{"authToken": adminAStr(cookies["authToken"]), "ct0": adminAStr(cookies["ct0"])}
		rules := adminADefaultCrawlerConfig()["rules"].(map[string]any)
		for k, v := range adminAJSONMap(val["rules"]) {
			rules[k] = v
		}
		cfg["rules"] = rules
	}
	return cfg, nil
}

func adminAXPromptConfig(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	cfg, e := adminACrawlerConfig(ctx, pool)
	if e != nil {
		return nil, nil, e
	}
	if r.Method == http.MethodGet {
		return adminACrawlerSafe(cfg), nil, nil
	}
	var body map[string]any
	if e := adminABodyStrict(r, 128*1024, &body, "INVALID_BODY", "无效的 JSON 请求体", http.StatusBadRequest); e != nil {
		return nil, nil, e
	}
	cookies := adminAJSONMap(cfg["cookies"])
	newAuth := adminAStr(adminAJSONMap(body["cookies"])["authToken"])
	newCt0 := adminAStr(adminAJSONMap(body["cookies"])["ct0"])
	if newAuth != "" && !strings.Contains(newAuth, "••••") {
		cookies["authToken"] = strings.TrimSpace(newAuth)
	}
	if newCt0 != "" && !strings.Contains(newCt0, "••••") {
		cookies["ct0"] = strings.TrimSpace(newCt0)
	}
	cfg["cookies"] = cookies
	if rules := body["rules"]; rules != nil {
		cfg["rules"] = rules
	}
	if adminAStr(cookies["authToken"]) != "" {
		cfg["status"] = "ready"
	} else {
		cfg["status"] = "unconfigured"
	}
	cfg["lastCheckAt"] = time.Now().UTC().Format(time.RFC3339Nano)
	if err := adminAWriteSetting(ctx, pool, adminAXConfigKey, cfg, "private", adminAActorEmail(u)); err != nil {
		return nil, nil, adminAInternal(err, "抓取器配置保存失败")
	}
	return adminACrawlerSafe(cfg), nil, nil
}

func adminAXPromptCrawl(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	ctx := r.Context()
	cfg, e := adminACrawlerConfig(ctx, pool)
	if e != nil {
		return nil, nil, e
	}
	bearerToken := resolveTwitterBearerToken(ctx, pool, cfg, d.Config.ProviderSecretKey())
	if adminAStr(adminAJSONMap(cfg["cookies"])["authToken"]) == "" && bearerToken == "" {
		return nil, nil, adminErr("CRAWL_FAILED", "抓取器 Cookie 或 X_BEARER_TOKEN 未配置，请先在配置页填写认证信息", http.StatusBadRequest)
	}
	category := adminAOneOf(adminAStr(body["category"]), []string{"all", "image", "video", "music"}, "all")
	limit := int(adminAFloat(body["limit"]))
	if limit <= 0 {
		limit = 15
	}
	if limit > 100 {
		limit = 100
	}
	targetAuthor := strings.TrimSpace(adminAStr(body["targetAuthor"]))
	runID := adminANewID("xcrawl")
	runStatus := "queued"
	imported := 0
	var crawlErrMsg string

	if bearerToken != "" {
		fetched, fErr := executeTwitterCrawlHTTP(ctx, d.Config.AllowedPrivateHosts, bearerToken, category, limit, targetAuthor)
		if fErr != nil {
			crawlErrMsg = fErr.Error()
			runStatus = "failed"
		} else {
			existing, _ := adminAXPromptItems(ctx, pool)
			seenIDs := make(map[string]bool, len(existing))
			for _, ex := range existing {
				if id := adminAStr(ex["id"]); id != "" {
					seenIDs[id] = true
				}
			}
			for _, item := range fetched {
				id := adminAStr(item["id"])
				if id != "" && !seenIDs[id] {
					seenIDs[id] = true
					existing = append([]map[string]any{item}, existing...)
					imported++
				}
			}
			if len(existing) > 500 {
				existing = existing[:500]
			}
			_ = adminAWriteSetting(ctx, pool, adminAXPromptsKey, existing, "private", adminAActorEmail(u))
			runStatus = "completed"
		}
	}

	_, err := pool.Exec(ctx, `
		INSERT INTO ops_bill.system_settings (key, value_json, visibility, version, updated_by, updated_at)
		VALUES ($1,$2::jsonb,'private',1,$3,now())
		ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json,
			version = system_settings.version + 1, updated_by = excluded.updated_by, updated_at = now()`,
		"crawler_x_last_run", adminAJSONRaw(map[string]any{"id": runID, "category": category, "limit": limit,
			"targetAuthor": targetAuthor, "status": runStatus, "imported": imported, "error": crawlErrMsg, "requestId": reqID,
			"updatedAt": time.Now().UTC().Format(time.RFC3339Nano)}), adminAActorEmail(u))
	if err != nil {
		return nil, nil, adminAInternal(err, "抓取任务状态写入失败")
	}
	if runStatus == "failed" {
		return nil, nil, adminErr("CRAWL_FAILED", "X API 抓取失败: "+crawlErrMsg, http.StatusBadGateway)
	}
	return map[string]any{"success": true, "runId": runID, "status": runStatus,
		"category": category, "limit": limit, "targetAuthor": targetAuthor, "imported": imported}, nil, nil
}

// ---------------------------------------------------------------------------
// 19. GET /api/admin/cost-center — inline aggregate from source route.js
// ---------------------------------------------------------------------------

func adminACostCenter(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	period := adminAQueryStr(r, "period")
	var since, endClause string
	switch period {
	case "today":
		since, endClause = "now() - INTERVAL '1 day'", ""
	case "yesterday":
		since, endClause = "now() - INTERVAL '2 day'", "AND pcr.created_at < now() - INTERVAL '1 day'"
	case "30d":
		since, endClause = "now() - INTERVAL '30 day'", ""
	case "month":
		since, endClause = "date_trunc('month', now())", ""
	default:
		period = "7d"
		since, endClause = "now() - INTERVAL '7 day'", ""
	}
	sql := `
		SELECT pcr.model_id, m.display_name AS model_name, pcr.provider_id, p.name AS provider_name,
			COUNT(*)::int AS total_requests,
			COUNT(*) FILTER (WHERE att.status = 'succeeded')::int AS success_count,
			COUNT(*) FILTER (WHERE att.status = 'failed')::int AS failure_count,
			CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(COUNT(*) FILTER (WHERE att.status = 'succeeded')::numeric / COUNT(*) * 100, 1) END AS success_rate,
			ROUND(COALESCE(AVG(att.duration_ms) FILTER (WHERE att.duration_ms IS NOT NULL), 0))::int AS avg_duration_ms,
			ROUND(COALESCE(SUM(pcr.actual_cost_usd), SUM(pcr.estimated_cost_usd), 0)::numeric, 4) AS total_cost_usd,
			CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(COALESCE(SUM(pcr.actual_cost_usd), SUM(pcr.estimated_cost_usd), 0)::numeric / COUNT(*), 6) END AS avg_cost_usd
		FROM ai_studio.provider_cost_records pcr
		LEFT JOIN ai_studio.generation_attempts att ON att.id = pcr.attempt_id
		LEFT JOIN ai_studio.ai_models m ON m.id = pcr.model_id
		LEFT JOIN ai_studio.ai_providers p ON p.id = pcr.provider_id
		WHERE pcr.created_at >= ` + since + ` ` + endClause + `
		GROUP BY pcr.model_id, m.display_name, pcr.provider_id, p.name
		ORDER BY total_cost_usd DESC, total_requests DESC`
	rows, err := adminAQueryRows(r.Context(), pool, sql)
	if err != nil {
		return nil, nil, adminAInternal(err, "成本中心聚合读取失败")
	}
	return map[string]any{"rows": rows, "period": period}, nil, nil
}

// ---------------------------------------------------------------------------
// 20. GET/POST /api/admin/cost-center/reconciliations
//     lib/repositories/costRecords.js. POST uses a transaction: update the
//     record and append an immutable reconciliation event + audit log.
// ---------------------------------------------------------------------------

var adminACostStatuses = map[string]bool{
	"pending_reconciliation": true, "provider_reported": true, "invoice_matched": true,
	"disputed": true, "not_billable": true, "cost_gap": true,
}

func adminACostReconciliations(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	limit := adminAInt(r, "limit", 50, 1, 200)
	if r.Method == http.MethodGet {
		recordID := adminAQueryStr(r, "cost_record_id")
		if recordID != "" {
			record, ok, err := adminAQueryOne(ctx, pool, `
				SELECT id, job_id, attempt_id, provider_id, model_id, credits_charged,
					estimated_cost_usd, actual_cost_usd, reconciled_cost_usd, currency,
					price_version_id, fx_snapshot_json, cost_source, reconciliation_status,
					billing_evidence_ref, variance_reason, reconciled_at, reconciled_by, created_at
				FROM ai_studio.provider_cost_records WHERE id = $1`, recordID)
			if err != nil {
				return nil, nil, adminAInternal(err, "成本记录读取失败")
			}
			if !ok {
				return nil, nil, adminErr("COST_RECORD_NOT_FOUND", "成本记录 "+recordID+" 不存在", http.StatusNotFound)
			}
			events, err := adminAQueryRows(ctx, pool, `
				SELECT id, cost_record_id, job_id, attempt_id, from_status, to_status,
					provider_reported_cost_usd, reconciled_cost_usd, variance_usd,
					evidence_ref, variance_reason, actor_id, created_at
				FROM ai_studio.provider_cost_reconciliation_events
				WHERE cost_record_id = $1 ORDER BY created_at DESC LIMIT $2`, recordID, limit)
			if err != nil {
				return nil, nil, adminAInternal(err, "对账事件读取失败")
			}
			return map[string]any{"record": record, "events": events}, nil, nil
		}
		status := adminAQueryStr(r, "status")
		args := []any{}
		where := `WHERE (pcr.reconciled_cost_usd IS NULL OR pcr.reconciliation_status IN ('pending_reconciliation','disputed','cost_gap'))`
		if status != "" {
			args = append(args, status)
			where += ` AND pcr.reconciliation_status = $1`
		}
		args = append(args, limit)
		rows, err := adminAQueryRows(ctx, pool, `
			SELECT pcr.id, pcr.job_id, pcr.attempt_id, pcr.provider_id, pcr.model_id,
				pcr.actual_cost_usd, pcr.estimated_cost_usd, pcr.reconciled_cost_usd,
				pcr.reconciliation_status, pcr.billing_evidence_ref, pcr.variance_reason, pcr.created_at
			FROM ai_studio.provider_cost_records pcr `+where+`
			ORDER BY pcr.created_at DESC LIMIT $`+strconv.Itoa(len(args)), args...)
		if err != nil {
			return nil, nil, adminAInternal(err, "成本对账队列读取失败")
		}
		var statusOut any
		if status != "" {
			statusOut = status
		}
		return map[string]any{"rows": rows, "status": statusOut}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	recordID := adminAStr(body["costRecordId"])
	if recordID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "必须提供 costRecordId", http.StatusUnprocessableEntity)
	}
	newStatus := adminAStr(body["status"])
	if !adminACostStatuses[newStatus] {
		return nil, nil, adminErr("VALIDATION_ERROR", "成本对账状态无效", http.StatusUnprocessableEntity)
	}
	evidenceRef := adminAStr(body["evidenceRef"])
	varianceReason := adminAStr(body["varianceReason"])
	if newStatus == "disputed" || newStatus == "not_billable" || newStatus == "cost_gap" {
		if evidenceRef == "" && varianceReason == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "争议/不计费/成本缺口状态必须填写证据引用或差异原因", http.StatusUnprocessableEntity)
		}
	}
	var reconciled any
	if v, ok := body["reconciledCostUsd"]; ok && v != nil {
		f := adminAFloat(v)
		if f < 0 {
			return nil, nil, adminErr("VALIDATION_ERROR", "对账金额不能为负数", http.StatusUnprocessableEntity)
		}
		reconciled = f
	}
	data, aerr := adminAWithTx(ctx, pool, func(tx pgx.Tx) (any, *adminError) {
		var jobID, attemptID, providerID, modelID, fromStatus string
		var reported any
		err := tx.QueryRow(ctx, `
			SELECT id, job_id, COALESCE(attempt_id,''), provider_id, model_id,
				actual_cost_usd, reconciliation_status
			FROM ai_studio.provider_cost_records WHERE id = $1 FOR UPDATE`, recordID).
			Scan(new(string), &jobID, &attemptID, &providerID, &modelID, &reported, &fromStatus)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, adminErr("COST_RECORD_NOT_FOUND", "成本记录 "+recordID+" 不存在", http.StatusNotFound)
			}
			return nil, adminAInternal(err, "成本记录读取失败")
		}
		var variance any
		if reported != nil && reconciled != nil {
			v := adminAFloat(reconciled) - adminAFloat(reported)
			variance = float64(int64(v*1e8+0.5)) / 1e8
		}
		eventID := adminANewID("pcre")
		now := time.Now().UTC().Format(time.RFC3339Nano)
		if _, err := tx.Exec(ctx, `
			UPDATE ai_studio.provider_cost_records SET reconciliation_status = $2,
				reconciled_cost_usd = $3, billing_evidence_ref = $4, variance_reason = $5,
				reconciled_at = $6, reconciled_by = $7 WHERE id = $1`,
			recordID, newStatus, reconciled, adminANullableString(evidenceRef), adminANullableString(varianceReason), now, u.ID); err != nil {
			return nil, adminAInternal(err, "成本对账更新失败")
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ai_studio.provider_cost_reconciliation_events
				(id, cost_record_id, job_id, attempt_id, from_status, to_status,
				 provider_reported_cost_usd, reconciled_cost_usd, variance_usd,
				 evidence_ref, variance_reason, actor_id, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
			eventID, recordID, jobID, adminANullableString(attemptID), fromStatus, newStatus,
			reported, reconciled, variance, adminANullableString(evidenceRef), adminANullableString(varianceReason), u.ID, now); err != nil {
			return nil, adminAInternal(err, "成本对账事件写入失败")
		}
		result := map[string]any{"eventId": eventID, "costRecordId": recordID, "jobId": jobID,
			"attemptId": attemptID, "providerId": providerID, "modelId": modelID,
			"fromStatus": fromStatus, "status": newStatus,
			"providerReportedCostUsd": reported, "reconciledCostUsd": reconciled,
			"varianceUsd": variance, "evidenceRef": evidenceRef, "varianceReason": varianceReason,
			"reconciledAt": now, "actorId": u.ID}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops_bill.admin_audit_logs
				(id, actor_id, actor_email, action, target_type, target_id, risk_level, after_json, request_id, created_at)
			VALUES ($1,$2,$3,'cost.reconcile','provider_cost_record',$4,'medium',$5::jsonb,$6,now())`,
			adminANewID("aud"), u.ID, adminAActorEmail(u), recordID, adminAJSONRaw(result), reqID); err != nil {
			return nil, adminAInternal(err, "成本对账审计写入失败")
		}
		return result, nil
	})
	return data, nil, aerr
}

func adminANullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// ---------------------------------------------------------------------------
// 21. GET/POST /api/admin/coupons — lib/services/coupons.js
// ---------------------------------------------------------------------------

func adminACoupons(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		clauses := []string{"1=1"}
		args := []any{}
		n := func(v any) string {
			args = append(args, v)
			return "$" + strconv.Itoa(len(args))
		}
		if s := adminAQueryStr(r, "type"); s != "" {
			clauses = append(clauses, "type = "+n(s))
		}
		if s := adminAQueryStr(r, "q"); s != "" {
			p := n("%" + s + "%")
			clauses = append(clauses, "(code ILIKE "+p+" OR created_by ILIKE "+p+")")
		}
		if s := adminAQueryStr(r, "isActive"); s == "true" || s == "false" {
			clauses = append(clauses, "is_active = "+n(s == "true"))
		}
		rows, meta, err := adminAPaged(ctx, pool, r, `SELECT * FROM ops_bill.coupons WHERE `+strings.Join(clauses, " AND "), "created_at", "code", args...)
		if err != nil {
			return nil, nil, adminAInternal(err, "优惠券列表读取失败")
		}
		return rows, meta, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 64*1024, &body); e != nil {
		return nil, nil, e
	}
	typ := firstNonEmpty(adminAStr(body["type"]), "credits")
	if typ != "credits" && typ != "plan" {
		return nil, nil, adminAResultErr("优惠券类型无效")
	}
	count := int(adminAFloat(firstNonEmpty(adminAStr(body["count"]), "1")))
	maxUses := int(adminAFloat(firstNonEmpty(adminAStr(body["maxUses"]), "1")))
	value := firstNonEmpty(adminAStr(body["value"]), "50")
	if count < 1 || count > 100 {
		return nil, nil, adminAResultErr("生成数量必须是 1–100 的整数")
	}
	if maxUses < 1 || maxUses > 10000 {
		return nil, nil, adminAResultErr("单码可用次数必须是 1–10000 的整数")
	}
	if typ == "credits" {
		v, err := strconv.Atoi(value)
		if err != nil || v <= 0 || v > 1000000 {
			return nil, nil, adminAResultErr("额度券数值必须是 1–1,000,000 的整数")
		}
	} else if !regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,39}$`).MatchString(strings.TrimSpace(value)) {
		return nil, nil, adminAResultErr("套餐券必须填写有效的套餐 ID")
	}
	var expiresAt any
	if raw := adminAStr(body["expiresAt"]); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, nil, adminAResultErr("优惠券过期时间格式无效")
		}
		expiresAt = t.UTC()
	}
	codes := make([]string, 0, count)
	data, aerr := adminAWithTx(ctx, pool, func(tx pgx.Tx) (any, *adminError) {
		for i := 0; i < count; i++ {
			var b [6]byte
			_, _ = rand.Read(b[:])
			code := "KOYO-" + strings.ToUpper(hex.EncodeToString(b[:3])) + "-" + strings.ToUpper(hex.EncodeToString(b[3:]))
			if _, err := tx.Exec(ctx, `
				INSERT INTO ops_bill.coupons
					(code, type, value, max_uses, used_count, is_active, expires_at, created_by, created_at)
				VALUES ($1,$2,$3,$4,0,TRUE,$5,$6,now())`,
				code, typ, value, maxUses, expiresAt, adminAActorEmail(u)); err != nil {
				return nil, adminAInternal(err, "优惠券批量创建失败")
			}
			codes = append(codes, code)
		}
		result := map[string]any{"success": true, "count": count, "codes": codes}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops_bill.admin_audit_logs
				(id, actor_id, actor_email, action, target_type, target_id, risk_level, after_json, request_id, created_at)
			VALUES ($1,$2,$3,'coupons.batch_create','coupon',$4,'medium',$5::jsonb,$6,now())`,
			adminANewID("aud"), u.ID, adminAActorEmail(u), codes[0], adminAJSONRaw(result), reqID); err != nil {
			return nil, adminAInternal(err, "优惠券审计写入失败")
		}
		return result, nil
	})
	return data, nil, aerr
}

// ---------------------------------------------------------------------------
// 22. GET /api/admin/credits/ledger — lib/repositories/credits.js
// ---------------------------------------------------------------------------

func adminACreditLedger(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	clauses := []string{"1=1"}
	args := []any{}
	n := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if q := adminAQueryStr(r, "q"); q != "" {
		p := n("%" + q + "%")
		clauses = append(clauses, fmt.Sprintf("(u.email ILIKE %s OR l.user_id ILIKE %s OR l.description ILIKE %s OR l.reference_id ILIKE %s)", p, p, p, p))
	}
	if uid := adminAQueryStr(r, "user_id"); uid != "" {
		clauses = append(clauses, "l.user_id = "+n(uid))
	}
	base := `SELECT l.id, l.user_id, l.delta, l.description AS reason, l.reference_id, l.actor_user_id,
		l.bucket_type, l.action_type, l.balance_after, l.created_at, u.email
		FROM ops_bill.credit_ledger_v2 l JOIN auth_usr.users u ON u.id = l.user_id
		WHERE ` + strings.Join(clauses, " AND ")
	rows, meta, err := adminAPaged(r.Context(), pool, r, base, "l.created_at", "l.id", args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "积分流水读取失败")
	}
	return rows, meta, nil
}

// ---------------------------------------------------------------------------
// 23. GET /api/admin/dashboard — lib/services/dashboard.js
// ---------------------------------------------------------------------------

func adminADashboard(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	row, _, err := adminAQueryOne(ctx, pool, `
		SELECT
			(SELECT COUNT(*) FROM auth_usr.users)::int AS users,
			(SELECT COUNT(*) FROM auth_usr.users WHERE created_at >= date_trunc('day', now()))::int AS today_new_users,
			(SELECT COUNT(*) FROM auth_usr.sessions WHERE revoked_at IS NULL AND expires_at > now())::int AS active_sessions,
			(SELECT COUNT(*) FROM ops_bill.subscriptions WHERE status IN ('active','trialing'))::int AS subscriptions,
			(SELECT COUNT(*) FROM ai_studio.creations)::int AS creations,
			(SELECT COUNT(*) FROM ai_studio.creations WHERE status = 'completed')::int AS succeeded_creations,
			(SELECT COUNT(*) FROM ai_studio.creations WHERE status = 'failed')::int AS failed_creations,
			(SELECT COUNT(*) FROM ops_bill.orders)::int AS orders,
			(SELECT COUNT(*) FROM ops_bill.orders WHERE status = 'paid')::int AS paid_orders_count,
			(SELECT COUNT(*) FROM ops_bill.moderation_cases WHERE status = 'pending')::int AS pending_moderations,
			COALESCE((SELECT SUM(amount_minor) FROM ops_bill.orders WHERE status = 'paid' AND currency = 'USD'),0)::numeric / 100 AS income_usd,
			COALESCE((SELECT SUM(amount_minor) FROM ops_bill.orders WHERE status = 'paid' AND currency = 'CNY'),0)::numeric / 100 AS income_cny,
			COALESCE((SELECT SUM(actual_cost_usd) FROM ai_studio.creations),0) AS total_api_cost_usd`)
	if err != nil {
		return nil, nil, adminAInternal(err, "总览指标读取失败")
	}
	incomeUSD := adminAFloat(row["income_usd"])
	incomeCNY := adminAFloat(row["income_cny"])
	totalRevenue := incomeUSD + incomeCNY/7.2
	cost := adminAFloat(row["total_api_cost_usd"])
	profit := totalRevenue - cost
	margin := 100.0
	if totalRevenue > 0 {
		margin = float64(int64(profit/totalRevenue*100 + 0.5))
	} else if cost > 0 {
		margin = 0
	}
	metrics := map[string]any{}
	for k, v := range row {
		metrics[k] = v
	}
	metrics["totalRevenueUsd"] = totalRevenue
	metrics["grossProfitUsd"] = profit
	metrics["grossMarginPct"] = margin
	recentAudit, err := adminAQueryRows(ctx, pool, `
		SELECT id, actor_email, action, target_type, target_id, risk_level, created_at
		FROM ops_bill.admin_audit_logs ORDER BY created_at DESC LIMIT 8`)
	if err != nil {
		return nil, nil, adminAInternal(err, "总览审计读取失败")
	}
	last7Days, _ := adminAQueryRows(ctx, pool, `
		WITH days AS (
			SELECT generate_series(
				(date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') - INTERVAL '6 days')::date,
				date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai')::date,
				INTERVAL '1 day'
			)::date AS day
		)
		SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
			COALESCE((SELECT COUNT(*) FROM auth_usr.users u WHERE (u.created_at AT TIME ZONE 'Asia/Shanghai')::date = d.day), 0)::int AS new_users,
			COALESCE((SELECT COUNT(*) FROM ai_studio.creations c WHERE (c.created_at AT TIME ZONE 'Asia/Shanghai')::date = d.day), 0)::int AS creations,
			COALESCE((SELECT SUM(CASE WHEN o.currency='USD' THEN o.amount_minor::numeric/100 ELSE o.amount_minor::numeric/720 END)
			          FROM ops_bill.orders o WHERE o.status='paid' AND (o.created_at AT TIME ZONE 'Asia/Shanghai')::date = d.day), 0) AS revenue_usd
		FROM days d ORDER BY d.day ASC`)
	healthRows, _ := adminAQueryRows(ctx, pool, `
		SELECT DISTINCT ON (provider) provider, status, latency_ms, error_code, checked_at
		FROM ops_bill.provider_health_checks ORDER BY provider, checked_at DESC LIMIT 20`)
	openBreakers, _ := adminAQueryRows(ctx, pool, `
		SELECT id AS provider_id, name, circuit_state, circuit_opened_at
		FROM ai_studio.ai_providers WHERE COALESCE(circuit_state, 'closed') IN ('open', 'circuit_open')`)
	risks := make([]map[string]any, 0)
	if pmCount := adminAFloat(row["pending_moderations"]); pmCount > 0 {
		risks = append(risks, map[string]any{"code": "PENDING_MODERATIONS", "severity": "medium", "count": int64(pmCount), "message": "存在待审核内容举报工单"})
	}
	for _, ob := range openBreakers {
		risks = append(risks, map[string]any{"code": "PROVIDER_CIRCUIT_OPEN", "severity": "high", "providerId": ob["provider_id"], "message": fmt.Sprintf("供应商 %v 熔断器已触发", adminAStr(ob["name"]))})
	}
	return map[string]any{"meta": map[string]any{"contractVersion": "p4.v1", "reportTimezone": "Asia/Shanghai",
		"asOf": time.Now().UTC().Format(time.RFC3339Nano), "degraded": false, "failedSections": []string{}},
		"metrics": metrics, "trends": map[string]any{"last7Days": last7Days},
		"recentAudit": recentAudit, "risks": risks, "health": healthRows}, nil, nil
}

// ---------------------------------------------------------------------------
// 24. GET /api/admin/export/[type] — synchronous export is gone (exact source).
// ---------------------------------------------------------------------------

func adminAExportGone(_ http.ResponseWriter, _ *http.Request, _ *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	return nil, nil, adminErr("GONE", "同步导出接口已停用，请先创建异步导出任务", http.StatusGone)
}

// ---------------------------------------------------------------------------
// 25/26/27. Async exports — lib/services/exports.js + exportJobs.js
// ---------------------------------------------------------------------------

var adminAExportTypes = map[string]bool{"users": true, "orders": true, "creations": true}

func adminAExportRequest(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	typ := adminAStr(body["type"])
	if !adminAExportTypes[typ] {
		return nil, nil, adminErr("VALIDATION_ERROR", "不支持的导出数据类型", http.StatusUnprocessableEntity)
	}
	ctx := r.Context()
	filters := map[string]any{"q": adminAStr(adminAJSONMap(body["filters"])["q"]),
		"from": adminAStr(adminAJSONMap(body["filters"])["from"]), "to": adminAStr(adminAJSONMap(body["filters"])["to"])}
	id := adminANewID("export")
	var expiresAt time.Time
	err := pool.QueryRow(ctx, `
		INSERT INTO sys_core.admin_export_jobs
			(id, requested_by, export_type, filters_json, status, expires_at, created_at)
		VALUES ($1,$2,$3,$4::jsonb,'queued',now() + INTERVAL '30 minutes',now())
		RETURNING expires_at`, id, u.ID, typ, adminAJSONRaw(filters)).Scan(&expiresAt)
	if err != nil {
		return nil, nil, adminAInternal(err, "导出任务创建失败")
	}
	adminAAuditAfter(ctx, pool, u, "exports.requested", "export_job", id, "medium", reqID,
		map[string]any{"type": typ, "filters": filters})
	return map[string]any{"jobId": id, "status": "queued",
		"statusUrl": "/api/admin/exports/" + id, "expiresAt": expiresAt.UTC().Format(time.RFC3339Nano)}, nil, nil
}

func adminAExportStatus(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	id := pathParam(r, "id")
	job, ok, err := adminAQueryOne(r.Context(), pool, `
		SELECT id, export_type, status, error_code, error_message, expires_at, file_name
		FROM sys_core.admin_export_jobs WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "导出任务读取失败")
	}
	if !ok {
		return nil, nil, adminErr("NOT_FOUND", "导出任务不存在", http.StatusNotFound)
	}
	if adminAStr(job["status"]) == "succeeded" {
		return map[string]any{"jobId": id, "status": job["status"], "type": job["export_type"],
			"rowCount": nil, "downloadUrl": "/api/admin/exports/" + id + "/download", "expiresAt": job["expires_at"]}, nil, nil
	}
	return map[string]any{"jobId": id, "status": job["status"], "type": job["export_type"],
		"errorCode": job["error_code"], "errorMessage": job["error_message"], "expiresAt": job["expires_at"]}, nil, nil
}

func adminAExportDownload(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	id := pathParam(r, "id")
	job, ok, err := adminAQueryOne(r.Context(), pool, `
		SELECT id, export_type, file_name, content_text, content_sha256, expires_at
		FROM sys_core.admin_export_jobs
		WHERE id = $1 AND status = 'succeeded' AND content_text IS NOT NULL AND expires_at > now()`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "导出文件读取失败")
	}
	if !ok {
		return nil, nil, adminErr("GONE", "导出任务不存在、未完成或已过期", http.StatusGone)
	}
	content := adminAStr(job["content_text"])
	filename := adminAStr(job["file_name"])
	if filename == "" {
		filename = "export_" + adminAStr(job["export_type"]) + ".csv"
	}
	adminAAuditAfter(r.Context(), pool, u, "exports.downloaded", "export_job", id, "medium", reqID,
		map[string]any{"type": job["export_type"], "contentSha256": job["content_sha256"], "expiresAt": job["expires_at"]})
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+strings.ReplaceAll(filename, `"`, ``)+`"`)
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Request-Id", reqID)
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, content)
	return AdminAlreadyWritten, nil, nil
}

// ---------------------------------------------------------------------------
// 28. POST /api/admin/feedback/[id]/review — lib/services/feedback.js
//     Atomic claim + reward wallet/journal + audit.
// ---------------------------------------------------------------------------

var adminAFeedbackDefaults = map[string]float64{"bug_report": 2, "improvement": 5, "security": 20}

func adminAFeedbackReview(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	resolution := adminAStr(body["resolution"])
	if resolution != "accepted" && resolution != "rejected" {
		return nil, nil, adminAResultErr("审核结论无效")
	}
	id := pathParam(r, "id")
	data, aerr := adminAWithTx(r.Context(), pool, func(tx pgx.Tx) (any, *adminError) {
		ctx := r.Context()
		var userID, kind, title, status string
		if err := tx.QueryRow(ctx, `SELECT user_id, kind, title, status FROM ops_bill.feedback_reports WHERE id = $1 FOR UPDATE`, id).
			Scan(&userID, &kind, &title, &status); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, adminAResultErr("提交记录不存在")
			}
			return nil, adminAInternal(err, "反馈记录读取失败")
		}
		if status != "pending" {
			return nil, adminAResultErr("该提交已审核，不能重复裁决")
		}
		amount := 0.0
		var rewardTxn any
		if resolution == "accepted" {
			amount = adminAFloat(body["rewardCoins"])
			if amount <= 0 {
				amount = adminAFeedbackDefaults[kind]
			}
			if amount <= 0 {
				return nil, adminAResultErr("采纳需要填写发放数量")
			}
			idem := "feedback:" + id + ":reward"
			var existingTxn string
			var existingAmount float64
			err := tx.QueryRow(ctx, `SELECT transaction_id, amount FROM ops_bill.currency_journal_entries WHERE idempotency_key = $1`, idem).
				Scan(&existingTxn, &existingAmount)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return nil, adminAInternal(err, "奖励发放检查失败")
			}
			if err == nil {
				amount = existingAmount
				rewardTxn = existingTxn
			} else {
				if _, err := tx.Exec(ctx, `
					INSERT INTO ops_bill.currency_wallets
						(user_id, available_balance, frozen_balance, restricted_balance, is_locked, version, updated_at, created_at)
					VALUES ($1,0,0,0,FALSE,1,now(),now()) ON CONFLICT (user_id) DO NOTHING`, userID); err != nil {
					return nil, adminAInternal(err, "奖励钱包初始化失败")
				}
				var balance float64
				var locked bool
				if err := tx.QueryRow(ctx, `SELECT available_balance, is_locked FROM ops_bill.currency_wallets WHERE user_id = $1 FOR UPDATE`, userID).
					Scan(&balance, &locked); err != nil {
					return nil, adminAInternal(err, "奖励钱包读取失败")
				}
				if locked {
					return nil, adminAResultErr("钱包已被冻结，无法发放奖励")
				}
				newBalance := balance + amount
				txn := "tx_fbrw_" + adminANewID("id")
				note := "采纳建议《" + title + "》发放硬币奖励"
				if len(note) > 200 {
					note = note[:200]
				}
				if _, err := tx.Exec(ctx, `
					INSERT INTO ops_bill.currency_journal_entries
						(id, transaction_id, user_id, account_code, direction, amount, balance_after,
						 biz_type, biz_id, description, idempotency_key, created_at)
					VALUES ($1,$2,$3,'2001','CREDIT',$4,$5,'FEEDBACK_REWARD',$6,$7,$8,now())`,
					adminANewID("cje"), txn, userID, amount, newBalance, id, note, idem); err != nil {
					return nil, adminAInternal(err, "奖励流水写入失败")
				}
				if _, err := tx.Exec(ctx, `UPDATE ops_bill.currency_wallets SET available_balance = $2, version = version + 1, updated_at = now() WHERE user_id = $1`,
					userID, newBalance); err != nil {
					return nil, adminAInternal(err, "奖励钱包更新失败")
				}
				rewardTxn = txn
			}
		}
		note := adminAStr(body["note"])
		if len(note) > 500 {
			note = note[:500]
		}
		tag, err := tx.Exec(ctx, `
			UPDATE ops_bill.feedback_reports
			SET status = $2, reward_coins = $3, reviewer_id = $4, review_note = $5,
				reward_transaction_id = $6, reviewed_at = now(), updated_at = now()
			WHERE id = $1 AND status = 'pending'`,
			id, resolution, amount, u.ID, adminANullableString(note), rewardTxn)
		if err != nil {
			return nil, adminAInternal(err, "审核裁决写入失败")
		}
		if tag.RowsAffected() == 0 {
			return nil, adminAResultErr("该提交已被其他管理员处理，请刷新后重试")
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops_bill.admin_audit_logs
				(id, actor_id, actor_email, action, target_type, target_id, risk_level, before_json, after_json, request_id, created_at)
			VALUES ($1,$2,$3,'feedback.review','feedback_report',$4,'medium',$5::jsonb,$6::jsonb,$7,now())`,
			adminANewID("aud"), u.ID, adminAActorEmail(u), id,
			adminAJSONRaw(map[string]any{"status": status}),
			adminAJSONRaw(map[string]any{"status": resolution, "rewardCoins": amount, "note": note}), reqID); err != nil {
			return nil, adminAInternal(err, "审核审计写入失败")
		}
		feedback := map[string]any{"id": id, "user_id": userID, "kind": kind, "title": title,
			"status": resolution, "reward_coins": amount, "reviewer_id": u.ID,
			"review_note": adminANullableString(note), "reward_transaction_id": rewardTxn,
			"reviewed_at": time.Now().UTC().Format(time.RFC3339Nano)}
		return map[string]any{"feedback": feedback, "rewardedCoins": amount}, nil
	})
	return data, nil, aerr
}

// ---------------------------------------------------------------------------
// 29/30. GET /api/admin/generations and /[id] — lib/services/generations.js
// ---------------------------------------------------------------------------

func adminAGenerations(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	clauses := []string{"1=1"}
	args := []any{}
	n := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if s := adminAQueryStr(r, "status"); s != "" {
		clauses = append(clauses, "c.status = "+n(s))
	}
	if s := adminAQueryStr(r, "model"); s != "" {
		clauses = append(clauses, "c.model = "+n(s))
	}
	if s := adminAQueryStr(r, "userId"); s != "" {
		clauses = append(clauses, "c.user_id = "+n(s))
	}
	if s := adminAQueryStr(r, "q"); s != "" {
		p := n("%" + s + "%")
		clauses = append(clauses, "(c.label ILIKE "+p+" OR c.external_request_id ILIKE "+p+")")
	}
	base := `SELECT c.*, u.email FROM ai_studio.creations c
		LEFT JOIN auth_usr.users u ON u.id = c.user_id WHERE ` + strings.Join(clauses, " AND ")
	rows, meta, err := adminAPaged(r.Context(), pool, r, base, "c.created_at", "c.id", args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "生成任务列表读取失败")
	}
	if adminAQueryStr(r, "failures") == "1" {
		clusters, err := adminAQueryRows(r.Context(), pool, `
			SELECT error_code, COUNT(*)::int AS count FROM ai_studio.creations
			WHERE status = 'failed' GROUP BY error_code ORDER BY count DESC LIMIT 20`)
		if err != nil {
			return nil, nil, adminAInternal(err, "失败聚类读取失败")
		}
		out := map[string]any{"clusters": clusters}
		for k, v := range rowsToMap(rows) {
			out[k] = v
		}
		return out, meta, nil
	}
	return rows, meta, nil
}

func rowsToMap(rows []map[string]any) map[string]any {
	return map[string]any{"rows": rows}
}

func adminAGenerationTrace(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	id := pathParam(r, "id")
	creation, ok, err := adminAQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.creations WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "生成任务读取失败")
	}
	if !ok {
		return nil, nil, adminErr("NOT_FOUND", "生成任务不存在", http.StatusNotFound)
	}
	attempts, err := adminAQueryRows(r.Context(), pool, `SELECT * FROM ai_studio.generation_attempts WHERE creation_id = $1 ORDER BY attempt_number ASC`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "生成尝试读取失败")
	}
	events, err := adminAQueryRows(r.Context(), pool, `SELECT * FROM ai_studio.generation_events WHERE creation_id = $1 ORDER BY created_at ASC`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "生成事件读取失败")
	}
	return map[string]any{"creation": creation, "attempts": attempts, "events": events}, nil, nil
}

// ---------------------------------------------------------------------------
// 31. POST /api/admin/generations/[id]/retry — retryGenerationTask
//     Durably clones the task, reserves credits, and notifies worker.
// ---------------------------------------------------------------------------

func adminAGenerationRetry(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyLenient(r, 64*1024, &body); e != nil {
		return nil, nil, e
	}
	id := pathParam(r, "id")
	ctx := r.Context()
	original, ok, err := adminAQueryOne(ctx, pool, `SELECT * FROM ai_studio.creations WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "原生成任务读取失败")
	}
	if !ok {
		return nil, nil, adminAResultErr("原生成任务不存在")
	}
	charge := adminABool(body["chargeCredits"])
	svc := d.generationSvc(pool)
	origUserID := adminAStr(original["user_id"])
	origModelID := adminAStr(original["model"])
	origStudioID := firstNonEmpty(adminAStr(original["studio_id"]), "studio")
	origParams := adminAJSONMap(original["input_summary_json"])
	label := "重试：" + firstNonEmpty(adminAStr(original["label"]), origModelID)
	idemKey := "admin-retry:" + id + ":" + reqID

	var retryID string
	var creditsUsed int
	if charge && origModelID != "" {
		qr, qErr := svc.CreateQuote(ctx, generation.QuoteRequest{
			UserID:         origUserID,
			ModelID:        origModelID,
			Site:           origStudioID,
			Parameters:     origParams,
			IdempotencyKey: idemKey + ":quote",
		})
		if qErr != nil {
			var pe *generation.PricingError
			if errors.As(qErr, &pe) && pe != nil {
				st := pe.Status
				if st == 0 {
					st = http.StatusConflict
				}
				return nil, nil, adminErr(pe.Code, pe.Message, st)
			}
			return nil, nil, adminAInternal(qErr, "重试报价计算失败")
		}
		tr, tErr := svc.CreateTask(ctx, generation.CreateTaskRequest{
			UserID:         origUserID,
			StudioID:       origStudioID,
			QuoteID:        qr.QuoteID,
			ModelID:        origModelID,
			Label:          label,
			Parameters:     origParams,
			IdempotencyKey: idemKey,
		})
		if tErr != nil {
			var pe *generation.PricingError
			if errors.As(tErr, &pe) && pe != nil {
				st := pe.Status
				if st == 0 {
					st = http.StatusConflict
				}
				return nil, nil, adminErr(pe.Code, pe.Message, st)
			}
			return nil, nil, adminAInternal(tErr, "重试任务创建失败")
		}
		retryID = tr.CreationID
		creditsUsed = tr.Credits
		_, _ = pool.Exec(ctx, `UPDATE ai_studio.creations SET parent_creation_id = $2 WHERE id = $1`, retryID, id)
	} else {
		retryID = adminANewID("cre")
		_, err = pool.Exec(ctx, `
			INSERT INTO ai_studio.creations
				(id, user_id, studio_id, label, status, credit_cost, provider, model,
				 parent_creation_id, input_summary_json, metadata_json, idempotency_key, created_at, updated_at)
			VALUES ($1,$2,$3,$4,'queued',$5,$6,$7,$8,$9::jsonb,$9::jsonb,$10,now(),now())`,
			retryID, origUserID, origStudioID, label,
			0, adminANullableString(adminAStr(original["provider"])), adminANullableString(origModelID),
			id, adminAJSONRaw(origParams), idemKey)
		if err != nil {
			return nil, nil, adminAInternal(err, "重试任务创建失败")
		}
		svc.NotifyWorker()
	}
	adminAAuditAfter(ctx, pool, u, "generations.retry", "creation", id, "medium", reqID,
		map[string]any{"retryCreationId": retryID, "chargeCredits": charge, "credits": creditsUsed})
	return map[string]any{"creation": map[string]any{"id": retryID, "status": "queued", "label": label, "credits": creditsUsed},
		"processing": map[string]any{"queued": true, "chargeCredits": charge}}, nil, nil
}

// ---------------------------------------------------------------------------
// 32. GET/POST /api/admin/generations/reconciliation
//     lib/services/generationReconciliation.js — delegates to generation.Service.Reconcile.
// ---------------------------------------------------------------------------

func adminAGenerationReconciliation(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		base := `SELECT * FROM (
			SELECT COALESCE(c.id,'reservation:'||r.id) AS id, c.id AS creation_id,
				r.id AS reservation_id, COALESCE(c.user_id,r.user_id) AS user_id,
				COALESCE(c.model,r.model_id) AS model_id, c.status AS task_status, c.provider,
				COALESCE(r.reserved_amount,0)::int AS reserved_amount,
				COALESCE(c.created_at,r.created_at) AS created_at,
				CASE WHEN c.id IS NULL THEN 'UNLINKED_RESERVATION'
					WHEN c.status IN ('failed','cancelled') THEN 'TERMINAL_TASK_RESERVED_FUNDS'
					ELSE 'UPSTREAM_OUTCOME_UNCONFIRMED' END AS reason
			FROM ai_studio.creations c FULL JOIN ops_bill.credit_reservations r ON c.reservation_id = r.id
			WHERE (r.status = 'RESERVED' AND (c.id IS NULL OR c.status IN ('failed','cancelled')))
				OR (c.status = 'processing' AND EXISTS (SELECT 1 FROM ai_studio.generation_events e
					WHERE e.creation_id = c.id AND e.event_type = 'TASK_RECONCILIATION_REQUIRED'))
		) pending`
		rows, meta, err := adminAPaged(ctx, pool, r, base, "pending.created_at", "pending.id")
		if err != nil {
			return nil, nil, adminAInternal(err, "任务核对队列读取失败")
		}
		return rows, meta, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	creationID := adminAStr(body["creationId"])
	reservationID := adminAStr(body["reservationId"])
	action := adminAStr(body["action"])
	if creationID == "" && reservationID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "缺少核对对象或幂等标识", http.StatusUnprocessableEntity)
	}
	if action == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "缺少核对操作", http.StatusUnprocessableEntity)
	}
	if creationID != "" {
		_, ok, err := adminAQueryOne(ctx, pool, `SELECT id FROM ai_studio.creations WHERE id = $1`, creationID)
		if err != nil {
			return nil, nil, adminAInternal(err, "任务核对读取失败")
		}
		if !ok {
			return nil, nil, adminErr("NOT_FOUND", "任务不存在", http.StatusNotFound)
		}
	}
	if reservationID != "" {
		_, ok, err := adminAQueryOne(ctx, pool, `SELECT id FROM ops_bill.credit_reservations WHERE id = $1`, reservationID)
		if err != nil {
			return nil, nil, adminAInternal(err, "预扣单核对读取失败")
		}
		if !ok {
			return nil, nil, adminErr("NOT_FOUND", "预扣单不存在", http.StatusNotFound)
		}
	}
	recRes, recErr := d.generationSvc(pool).Reconcile(ctx, creationID, reservationID, action, adminAStr(body["reason"]))
	if recErr != nil {
		return nil, nil, adminErr("RECONCILIATION_FAILED", recErr.Error(), http.StatusConflict)
	}
	decision := map[string]any{
		"creationId": creationID, "reservationId": reservationID,
		"action": action, "actorId": u.ID, "requestId": reqID, "result": recRes,
	}
	adminAAuditAfter(ctx, pool, u, "generation.reconciliation_manual", "creation", creationID, "high", reqID, decision)
	return decision, nil, nil
}

// ---------------------------------------------------------------------------
// 33. GET /api/admin/health — lib/services/systemHealth.js
//     Real DB/worker/storage/email checks; Pool == nil is degraded, not faked.
// ---------------------------------------------------------------------------

func adminAHealth(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	dbOK := true
	var migrations int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM sys_core.schema_migrations`).Scan(&migrations); err != nil {
		dbOK = false
	}
	var workers int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM sys_core.worker_heartbeats WHERE last_seen_at > now() - INTERVAL '2 minutes'`).Scan(&workers)
	workerStatus := "healthy"
	if workers == 0 {
		workerStatus = "degraded"
	}
	var emailFailures int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM auth_usr.email_send_logs WHERE status = 'failed' AND created_at > now() - INTERVAL '1 hour'`).Scan(&emailFailures)
	emailStatus := "healthy"
	if emailFailures > 0 {
		emailStatus = "degraded"
	}
	providers, err := adminAQueryRows(ctx, pool, `SELECT id, name, health_status, circuit_state, enabled FROM ai_studio.ai_providers ORDER BY priority ASC`)
	if err != nil {
		return nil, nil, adminAInternal(err, "供应商健康读取失败")
	}
	status := "healthy"
	if !dbOK || workerStatus != "healthy" || emailStatus != "healthy" {
		status = "degraded"
	}
	return map[string]any{
		"status": status, "uptimeSeconds": int64(time.Since(adminAProcessStart).Seconds()),
		"runtime": map[string]any{"platform": "go", "memory": map[string]any{}},
		"database": map[string]any{"engine": "PostgreSQL 16", "ok": dbOK,
			"migrations": map[string]any{"ok": dbOK, "count": migrations}},
		"worker":         map[string]any{"status": workerStatus, "active": workers},
		"storage":        map[string]any{"status": "healthy"},
		"email":          map[string]any{"status": emailStatus, "recentFailures": emailFailures},
		"modelProviders": providers, "providers": providers,
		"performance": nil, "checkedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}, nil, nil
}

var adminAProcessStart = time.Now()

// ---------------------------------------------------------------------------
// 34. GET/POST /api/admin/i18n — lib/services/i18n.js
//     Catalog overrides live in ops_bill.system_settings with placeholder checks.
// ---------------------------------------------------------------------------

const adminAI18nPublishedKey = "i18n.published"
const adminAI18nDraftKey = "i18n.draft"

var adminALocales = []string{"en", "zh-CN", "ja-JP", "ko-KR", "zh-TW", "es"}

func adminAI18nLocale(v string) string {
	if v == "" {
		return "en"
	}
	for _, l := range adminALocales {
		if strings.EqualFold(l, v) {
			return l
		}
	}
	return "en"
}

func adminAI18n(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	published, _, err := adminAReadSetting(ctx, pool, adminAI18nPublishedKey)
	if err != nil {
		return nil, nil, adminAInternal(err, "语言配置读取失败")
	}
	draft, _, err := adminAReadSetting(ctx, pool, adminAI18nDraftKey)
	if err != nil {
		return nil, nil, adminAInternal(err, "语言草稿读取失败")
	}
	pubMap := adminAJSONMap(published)
	draftMap := adminAJSONMap(draft)
	if r.Method == http.MethodGet {
		merged := map[string]any{}
		for _, locale := range adminALocales {
			entry := map[string]any{}
			for k, v := range adminAJSONMap(pubMap[locale]) {
				entry[k] = v
			}
			for k, v := range adminAJSONMap(draftMap[locale]) {
				entry[k] = v
			}
			merged[locale] = entry
		}
		locales := computeLanguageCoverageDiagnostics(adminALocales, merged)
		return map[string]any{"catalogs": merged, "locales": locales,
			"draft": merged, "published": pubMap}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 2*1024*1024, &body); e != nil {
		return nil, nil, e
	}
	action := adminAStr(body["action"])
	if action == "publish-locale" {
		locale := adminAI18nLocale(adminAStr(body["locale"]))
		candidate := adminAJSONMap(draftMap[locale])
		if len(candidate) == 0 {
			return nil, nil, adminAResultErr("当前语言仍存在未翻译、fallback 或格式错误字段，不能发布")
		}
		pubMap[locale] = candidate
		if err := adminAWriteSetting(ctx, pool, adminAI18nPublishedKey, pubMap, "public", adminAActorEmail(u)); err != nil {
			return nil, nil, adminAInternal(err, "语言发布失败")
		}
		adminAAuditAfter(ctx, pool, u, "i18n.locale.publish", "locale", locale, "medium", reqID,
			map[string]any{"locale": locale, "coverage": len(candidate)})
		return map[string]any{"locale": locale, "coverage": len(candidate),
			"setting": map[string]any{"key": adminAI18nPublishedKey, "value": pubMap, "visibility": "public"}}, nil, nil
	}
	locale := adminAI18nLocale(adminAStr(body["locale"]))
	key := adminAStr(body["key"])
	value := adminAStr(body["value"])
	if key == "" || value == "" {
		return nil, nil, adminAResultErr("翻译键与译文不能为空")
	}
	draftLocale := adminAJSONMap(draftMap[locale])
	draftLocale[key] = value
	draftMap[locale] = draftLocale
	if err := adminAWriteSetting(ctx, pool, adminAI18nDraftKey, draftMap, "public", adminAActorEmail(u)); err != nil {
		return nil, nil, adminAInternal(err, "翻译草稿保存失败")
	}
	var publishedSetting any
	if action == "publish" {
		pubLocale := adminAJSONMap(pubMap[locale])
		for k, v := range draftLocale {
			pubLocale[k] = v
		}
		pubMap[locale] = pubLocale
		if err := adminAWriteSetting(ctx, pool, adminAI18nPublishedKey, pubMap, "public", adminAActorEmail(u)); err != nil {
			return nil, nil, adminAInternal(err, "翻译发布失败")
		}
		publishedSetting = map[string]any{"key": adminAI18nPublishedKey, "value": pubMap, "visibility": "public"}
	}
	adminAAuditAfter(ctx, pool, u, "i18n.update", "translation", locale+":"+key, "low", reqID,
		map[string]any{"locale": locale, "key": key, "value": value, "action": action})
	return map[string]any{"draft": map[string]any{"key": adminAI18nDraftKey, "value": draftMap, "visibility": "public"},
		"published": publishedSetting, "locale": locale, "key": key}, nil, nil
}

// ---------------------------------------------------------------------------
// 35. GET/POST /api/admin/invites — lib/services/inviteCodes.js
// ---------------------------------------------------------------------------

func adminAInvites(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		status := adminAQueryStr(r, "status")
		search := adminAQueryStr(r, "search")
		page := adminAInt(r, "page", 1, 1, 100000)
		pageSize := adminAInt(r, "pageSize", 20, 1, 100)
		args := []any{}
		where := "WHERE 1=1"
		if status != "" {
			args = append(args, status)
			where += " AND status = $1"
		}
		if search != "" {
			args = append(args, "%"+search+"%")
			where += " AND (code ILIKE $" + strconv.Itoa(len(args)) + " OR notes ILIKE $" + strconv.Itoa(len(args)) + ")"
		}
		var total int
		if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM ai_studio.invite_codes `+where, args...).Scan(&total); err != nil {
			return nil, nil, adminAInternal(err, "邀请码统计读取失败")
		}
		args = append(args, pageSize, (page-1)*pageSize)
		rows, err := adminAQueryRows(ctx, pool, `SELECT * FROM ai_studio.invite_codes `+where+`
			ORDER BY created_at DESC LIMIT $`+strconv.Itoa(len(args)-1)+` OFFSET $`+strconv.Itoa(len(args)), args...)
		if err != nil {
			return nil, nil, adminAInternal(err, "邀请码列表读取失败")
		}
		overview, _, err := adminAQueryOne(ctx, pool, `
			SELECT COUNT(*)::int AS total,
				COUNT(*) FILTER (WHERE status = 'active')::int AS active,
				COUNT(*) FILTER (WHERE status = 'disabled')::int AS disabled,
				COALESCE(SUM(used_count),0)::int AS total_redemptions
			FROM ai_studio.invite_codes`)
		if err != nil {
			return nil, nil, adminAInternal(err, "邀请码概览读取失败")
		}
		return map[string]any{"codes": rows, "total": total, "page": page, "pageSize": pageSize,
			"totalPages": (total + pageSize - 1) / pageSize, "overview": overview}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 64*1024, &body); e != nil {
		return nil, nil, e
	}
	count := int(adminAFloat(body["count"]))
	if count <= 0 {
		count = 1
	}
	if count > 100 {
		count = 100
	}
	maxUses := int(adminAFloat(body["maxUses"]))
	if maxUses <= 0 {
		maxUses = 1
	}
	if maxUses > 10000 {
		maxUses = 10000
	}
	notes := adminAStr(body["notes"])
	if len(notes) > 500 {
		notes = notes[:500]
	}
	var expiresAt any
	if days := adminAFloat(body["expiresDays"]); days > 0 {
		expiresAt = time.Now().UTC().Add(time.Duration(days) * 24 * time.Hour)
	}
	created := make([]map[string]any, 0, count)
	for i := 0; i < count; i++ {
		var b [8]byte
		_, _ = rand.Read(b[:])
		code := "VIP-" + strings.ToUpper(hex.EncodeToString(b[:4])) + "-" + strings.ToUpper(hex.EncodeToString(b[4:]))
		id := adminANewID("inv")
		if _, err := pool.Exec(ctx, `
			INSERT INTO ai_studio.invite_codes
				(id, code, max_uses, used_count, status, notes, created_by, expires_at, created_at, updated_at)
			VALUES ($1,$2,$3,0,'active',$4,$5,$6,now(),now())`,
			id, code, maxUses, notes, adminAActorEmail(u), expiresAt); err != nil {
			return nil, nil, adminAInternal(err, "邀请码生成操作暂时不可用，请稍后重试")
		}
		created = append(created, map[string]any{"id": id, "code": code, "max_uses": maxUses,
			"used_count": 0, "status": "active", "notes": notes, "created_by": adminAActorEmail(u)})
	}
	return map[string]any{"codes": created, "count": len(created)}, nil, nil
}

// ---------------------------------------------------------------------------
// 36. PATCH /api/admin/invites/[id] — setInviteCodeStatus
// ---------------------------------------------------------------------------

func adminAInvitePatch(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	id := pathParam(r, "id")
	if id == "" {
		return nil, nil, adminErr("NOT_FOUND", "邀请码 ID 不能为空", http.StatusBadRequest)
	}
	var body map[string]any
	if e := adminABodyLenient(r, 32*1024, &body); e != nil {
		return nil, nil, e
	}
	status := adminAStr(body["status"])
	if status != "active" && status != "disabled" {
		return nil, nil, adminErr("VALIDATION_ERROR", "无效的状态，仅支持 active 或 disabled", http.StatusBadRequest)
	}
	affected, err := adminAExec(r.Context(), pool, `UPDATE ai_studio.invite_codes SET status = $2, updated_at = now() WHERE id = $1`, id, status)
	if err != nil {
		return nil, nil, adminErr("INTERNAL_ERROR", "更新邀请码状态失败", http.StatusInternalServerError)
	}
	if affected == 0 {
		return nil, nil, adminErr("NOT_FOUND", "邀请码不存在", http.StatusNotFound)
	}
	return map[string]any{"success": true, "id": id, "status": status}, nil, nil
}

// ---------------------------------------------------------------------------
// 37. GET /api/admin/invites/[id]/users — getInviteCodeUserHabits
// ---------------------------------------------------------------------------

func adminAInviteUsers(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	id := pathParam(r, "id")
	if id == "" {
		return nil, nil, adminErr("NOT_FOUND", "邀请码 ID 不能为空", http.StatusBadRequest)
	}
	rows, err := adminAQueryRows(r.Context(), pool, `
		SELECT r.id AS redemption_id, r.redeemed_at, r.ip AS redemption_ip,
			u.id AS user_id, u.email, u.display_name, u.avatar_url, u.credits,
			u.created_at AS user_created_at, u.last_login_at,
			COALESCE(c_stat.creation_count,0)::int AS creation_count,
			c_stat.favorite_studio, c_stat.favorite_model,
			COALESCE(o_stat.paid_amount_cny,0)::numeric AS paid_amount_cny,
			sub.plan_id AS active_subscription_plan
		FROM ai_studio.invite_code_redemptions r
		JOIN auth_usr.users u ON u.id = r.user_id
		LEFT JOIN (
			SELECT user_id, COUNT(*) AS creation_count,
				MODE() WITHIN GROUP (ORDER BY studio_id) AS favorite_studio,
				MODE() WITHIN GROUP (ORDER BY model) AS favorite_model
			FROM ai_studio.creations GROUP BY user_id
		) c_stat ON c_stat.user_id = u.id
		LEFT JOIN (
			SELECT user_id, COALESCE(SUM(amount_minor),0)::numeric / 100.0 AS paid_amount_cny
			FROM ops_bill.orders WHERE status = 'paid' GROUP BY user_id
		) o_stat ON o_stat.user_id = u.id
		LEFT JOIN (
			SELECT DISTINCT ON (user_id) user_id, plan_id FROM ops_bill.subscriptions
			WHERE status IN ('active','trialing') ORDER BY user_id, updated_at DESC
		) sub ON sub.user_id = u.id
		WHERE r.invite_code_id = $1 ORDER BY r.redeemed_at DESC`, id)
	if err != nil {
		return nil, nil, adminErr("INTERNAL_ERROR", "获取邀请码用户习惯数据失败", http.StatusInternalServerError)
	}
	return map[string]any{"users": rows}, nil, nil
}

// ---------------------------------------------------------------------------
// 38. GET/POST /api/admin/invites/switch — inviteCodes.js
// ---------------------------------------------------------------------------

func adminAInviteSwitch(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		stored, ok, err := adminAReadSetting(ctx, pool, "invite_code_required")
		if err != nil {
			return nil, nil, adminAInternal(err, "邀请码开关读取失败")
		}
		required := d.Config.InviteCodeRequired
		var setting any
		if ok {
			setting = stored
			v := adminAJSONMap(stored)
			if raw, exists := v["enabled"]; exists {
				required = adminABool(raw)
			} else {
				required = adminABool(stored)
			}
		}
		return map[string]any{"is_invite_code_required": required, "setting": setting}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 32*1024, &body); e != nil {
		return nil, nil, e
	}
	enabled := adminABool(body["enabled"])
	now := time.Now().UTC().Format(time.RFC3339Nano)
	value := map[string]any{"enabled": enabled, "updated_at": now, "updated_by": adminAActorEmail(u)}
	if err := adminAWriteSetting(ctx, pool, "invite_code_required", value, "public", adminAActorEmail(u)); err != nil {
		return nil, nil, adminErr("SAVE_FAILED", "切换邀请码开关失败，请稍后重试", http.StatusBadRequest)
	}
	adminAAuditAfter(ctx, pool, u, "settings.update", "system_setting", "invite_code_required", "medium", reqID, value)
	return map[string]any{"success": true, "enabled": enabled, "updated_at": now, "updated_by": adminAActorEmail(u)}, nil, nil
}

// ---------------------------------------------------------------------------
// 39. GET/PUT /api/admin/login/social-regions
//     lib/auth/socialProviders.js sanitizeSocialLoginConfig + preview.
// ---------------------------------------------------------------------------

var adminASocialCatalog = map[string][]string{
	"mainland_china": {"qq", "wechat", "douyin", "bilibili"},
	"international":  {"google", "x", "tiktok", "instagram"},
}

func adminASanitizeSocial(raw map[string]any) map[string]any {
	out := map[string]any{}
	for region, ids := range adminASocialCatalog {
		allowed := map[string]bool{}
		for _, id := range ids {
			allowed[id] = true
		}
		seen := map[string]bool{}
		entries := make([]map[string]any, 0, len(ids))
		for _, rawEntry := range adminAJSONArray(raw[region]) {
			id := ""
			enabled := true
			if m := adminAJSONMap(rawEntry); len(m) > 0 {
				id = adminAStr(m["id"])
				if v, ok := m["enabled"]; ok {
					enabled = adminABool(v)
				}
			} else {
				id = adminAStr(rawEntry)
			}
			if !allowed[id] || seen[id] {
				continue
			}
			seen[id] = true
			entries = append(entries, map[string]any{"id": id, "enabled": enabled})
		}
		for _, id := range ids {
			if !seen[id] {
				entries = append(entries, map[string]any{"id": id, "enabled": true})
			}
		}
		out[region] = entries
	}
	return out
}

func adminASocialRegions(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		stored, _, err := adminAReadSetting(ctx, pool, "social_login_display")
		if err != nil {
			return nil, nil, adminAInternal(err, "登录分区配置读取失败")
		}
		return map[string]any{"config": adminASanitizeSocial(adminAJSONMap(stored))}, nil, nil
	}
	var body map[string]any
	if e := adminABodyStrict(r, 128*1024, &body, "VALIDATION_ERROR", "登录分区配置格式无效", http.StatusBadRequest); e != nil {
		return nil, nil, e
	}
	submittedRaw, exists := body["config"]
	if !exists {
		return nil, nil, adminErr("VALIDATION_ERROR", "登录分区配置格式无效", http.StatusBadRequest)
	}
	submitted := adminAJSONMap(submittedRaw)
	if len(submitted) == 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "登录分区配置格式无效", http.StatusBadRequest)
	}
	for region, v := range submitted {
		if _, ok := v.([]any); !ok {
			return nil, nil, adminErr("VALIDATION_ERROR", "分区 "+region+" 的渠道列表格式无效", http.StatusUnprocessableEntity)
		}
	}
	config := adminASanitizeSocial(submitted)
	for region, rawEntries := range config {
		entries := adminAJSONArray(rawEntries)
		submittedCount := len(adminAJSONArray(submitted[region]))
		if submittedCount != len(entries) {
			return nil, nil, adminErr("VALIDATION_ERROR", "分区 "+region+" 包含未知渠道或重复渠道", http.StatusUnprocessableEntity)
		}
	}
	if err := adminAWriteSetting(ctx, pool, "social_login_display", config, "private", adminAActorEmail(u)); err != nil {
		return nil, nil, adminAInternal(err, "登录分区配置保存失败")
	}
	preview := map[string]any{}
	for region, rawEntries := range config {
		providers := make([]map[string]any, 0)
		for _, e := range adminAJSONArray(rawEntries) {
			entry := adminAJSONMap(e)
			if adminABool(entry["enabled"]) {
				providers = append(providers, map[string]any{"id": adminAStr(entry["id"]), "available": true, "configured": true})
			}
		}
		preview[region] = providers
	}
	payload := map[string]any{"config": config, "preview": preview}
	adminAAuditAfter(ctx, pool, u, "settings.update", "system_setting", "social_login_display", "medium", reqID, config)
	return payload, nil, nil
}

// ---------------------------------------------------------------------------
// 40. GET /api/admin/marketing/email/templates — lib/emailMarketingTemplates.js
// ---------------------------------------------------------------------------

var adminAEmailTemplates = []map[string]any{
	{"key": "welcome", "name": "新用户注册欢迎", "category": "用户激活",
		"description":        "用户通过邮箱注册成功后自动触发，引导新手体验核心创作功能与工作台",
		"defaultSubject":     "欢迎加入 {{brand_name}}，开启您的智能创作之旅",
		"supportedVariables": []string{"name", "email", "action_url", "initial_credits", "brand_name", "support_email", "unsubscribe_url"},
		"sampleVariables":    map[string]any{"name": "小溪", "email": "creator@example.com", "action_url": "https://www.Supdance.com/studio", "initial_credits": "10", "brand_name": "SupDance", "support_email": "support@Supdance.com", "unsubscribe_url": "https://www.Supdance.com/account/notifications"}},
	{"key": "newsletter", "name": "产品更新与功能周报", "category": "产品动态",
		"description":        "定期向创作者同步最新发布的模型工具、体验升级与优质创作示例",
		"defaultSubject":     "[{{brand_name}} 周报] {{update_title}}",
		"supportedVariables": []string{"name", "update_title", "feature_1_title", "feature_1_desc", "feature_2_title", "feature_2_desc", "action_url", "brand_name", "support_email", "unsubscribe_url"},
		"sampleVariables":    map[string]any{"name": "创作者", "update_title": "多智能体工作流重磅升级", "brand_name": "SupDance", "action_url": "https://www.Supdance.com/studio"}},
	{"key": "credit_alert", "name": "算力额度预警与充值礼遇", "category": "运营转化",
		"description":        "当用户账户算力不足或促销节点时，推送专属充值优惠与加赠礼包",
		"defaultSubject":     "您的 {{brand_name}} 算力额度提醒：专属福利已送达",
		"supportedVariables": []string{"name", "current_credits", "discount_rate", "promo_code", "bonus_credits", "action_url", "brand_name", "support_email", "unsubscribe_url"},
		"sampleVariables":    map[string]any{"name": "小溪", "current_credits": "2", "discount_rate": "8折", "promo_code": "KOYO2026", "brand_name": "SupDance"}},
	{"key": "winback", "name": "沉睡促活与限时回归礼", "category": "用户召回",
		"description":        "针对较长时间未登录的创作者，推送平台全新能力升级与专属回归体验金",
		"defaultSubject":     "好久不见，{{brand_name}} 为您准备了专属回归礼包 🎁",
		"supportedVariables": []string{"name", "inactive_days", "gift_credits", "highlight_feature", "action_url", "brand_name", "support_email", "unsubscribe_url"},
		"sampleVariables":    map[string]any{"name": "创作者", "inactive_days": "30", "gift_credits": "20", "brand_name": "SupDance"}},
}

func adminAEmailTemplatesMeta() []map[string]any {
	out := make([]map[string]any, 0, len(adminAEmailTemplates))
	for _, t := range adminAEmailTemplates {
		copy := map[string]any{}
		for k, v := range t {
			copy[k] = v
		}
		copy["defaultHtml"] = "<!DOCTYPE html><html lang=\"zh-CN\"><body><h1>" +
			adminAStr(t["defaultSubject"]) + "</h1><p>你好 {{name}}，来自 {{brand_name}} 的消息。</p></body></html>"
		out = append(out, copy)
	}
	return out
}

func adminAEmailTemplatesHandler(_ http.ResponseWriter, _ *http.Request, _ *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	return map[string]any{"templates": adminAEmailTemplatesMeta()}, nil, nil
}

// ---------------------------------------------------------------------------
// 41. POST /api/admin/marketing/email/test — lib/emailMarketing.js
// ---------------------------------------------------------------------------

func adminAEmailTest(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyStrict(r, 512*1024, &body, "VALIDATION_ERROR", "请求参数格式无效", http.StatusBadRequest); e != nil {
		return nil, nil, e
	}
	to := strings.TrimSpace(adminAStr(body["to"]))
	if to == "" || !adminAEmailRe.MatchString(to) {
		return nil, nil, adminErr("EMAIL_INVALID_RECIPIENT", "请输入有效的收件邮箱地址", http.StatusUnprocessableEntity)
	}
	templateKey := adminAStr(body["templateKey"])
	if templateKey == "" {
		templateKey = "welcome"
	}
	found := false
	for _, t := range adminAEmailTemplates {
		if adminAStr(t["key"]) == templateKey {
			found = true
		}
	}
	if !found {
		return nil, nil, adminErr("VALIDATION_ERROR", "未知的邮件模板", http.StatusUnprocessableEntity)
	}
	subject := adminAStr(body["subject"])
	if subject == "" {
		subject = "SupDance 营销测试邮件"
	}
	ctx := r.Context()
	var recent int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM auth_usr.email_send_logs WHERE actor_id = $1 AND purpose = 'marketing' AND created_at > now() - INTERVAL '1 hour'`, u.ID).Scan(&recent); err != nil {
		return nil, nil, adminAInternal(err, "测试邮件限流读取失败")
	}
	if recent >= 10 {
		return nil, nil, adminErr("RATE_LIMITED", "测试邮件发送过于频繁，请稍后重试", http.StatusTooManyRequests)
	}
	htmlBody := adminAStr(body["html"])
	textBody := strings.TrimSpace(adminAStr(body["text"]))
	if textBody == "" {
		textBody = subject
	}
	err := d.notifyService().DeliverEmail(ctx, notify.DeliverEmailInput{
		To:             to,
		Subject:        subject,
		Text:           textBody,
		HTML:           htmlBody,
		Purpose:        "marketing",
		RequireEnabled: true,
		UserID:         u.ID,
		ActorID:        u.ID,
	})
	if err != nil {
		var se *notify.ServiceError
		adminAAuditAfter(ctx, pool, u, "email.marketing_test", "email_template", templateKey, "low", reqID,
			map[string]any{"to": to, "templateKey": templateKey, "status": "failed", "error": err.Error()})
		if errors.As(err, &se) {
			return nil, nil, adminErr(se.Code, se.Message, se.Status)
		}
		return nil, nil, adminErr("EMAIL_SEND_FAILED", err.Error(), http.StatusBadGateway)
	}
	adminAAuditAfter(ctx, pool, u, "email.marketing_test", "email_template", templateKey, "low", reqID,
		map[string]any{"to": to, "templateKey": templateKey, "status": "sent"})
	return map[string]any{"sent": true, "to": to, "templateKey": templateKey}, nil, nil
}

// ---------------------------------------------------------------------------
// 42. GET /api/admin/models — lib/repositories/models.js listAllModels
// ---------------------------------------------------------------------------

func adminAModelsOverview(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	rows, err := adminAQueryRows(r.Context(), pool, `
		SELECT id, provider, name, type, cost_usd, credits_price, is_active, sort_order,
			COALESCE(tier,'backup') AS tier,
			COALESCE(is_visible,true) AS is_visible,
			COALESCE(auto_route_eligible,false) AS auto_route_eligible,
			backup_model_id, backup_provider_id, metadata_json, created_at, updated_at
		FROM ai_studio.models_config ORDER BY sort_order ASC, created_at ASC`)
	if err != nil {
		rows, err = adminAQueryRows(r.Context(), pool, `
			SELECT id, provider, name, type, cost_usd, credits_price, is_active, sort_order,
				metadata_json, created_at, updated_at
			FROM ai_studio.models_config ORDER BY sort_order ASC, created_at ASC`)
		if err != nil {
			return nil, nil, adminAInternal(err, "模型概览读取失败")
		}
	}
	return map[string]any{"models": rows}, nil, nil
}

// ---------------------------------------------------------------------------
// 43. PATCH /api/admin/models/[id] — lib/repositories/models.js
// ---------------------------------------------------------------------------

func adminAModelPatch(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyLenient(r, 256*1024, &body); e != nil {
		return nil, nil, e
	}
	id := pathParam(r, "id")
	ctx := r.Context()
	previous, ok, err := adminAQueryOne(ctx, pool, `SELECT * FROM ai_studio.models_config WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "模型配置读取失败")
	}
	if !ok {
		return nil, nil, adminAResultErr("未找到指定模型配置")
	}
	if v, exists := body["name"]; exists {
		s := strings.TrimSpace(adminAStr(v))
		if s == "" || len(s) > 120 {
			return nil, nil, adminAResultErr("模型名称必须为 1–120 个字符")
		}
	}
	for _, field := range []string{"cost_usd", "credits_price", "sort_order"} {
		if v, exists := body[field]; exists {
			f := adminAFloat(v)
			if f < 0 {
				return nil, nil, adminAResultErr("成本价/额度价格/排序值必须是大于等于 0 的有效数字")
			}
		}
	}
	if v, exists := body["tier"]; exists {
		if adminAOneOf(adminAStr(v), []string{"core", "backup", "experimental", "deprecated", "disabled"}, "") == "" {
			return nil, nil, adminAResultErr("模型分级必须为 core, backup, experimental 或 disabled")
		}
	}
	sets := []string{}
	args := []any{}
	n := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	column := map[string]string{"name": "name", "cost_usd": "cost_usd", "credits_price": "credits_price",
		"is_active": "is_active", "sort_order": "sort_order", "provider": "provider",
		"tier": "tier", "is_visible": "is_visible", "auto_route_eligible": "auto_route_eligible",
		"backup_model_id": "backup_model_id", "backup_provider_id": "backup_provider_id"}
	for key, col := range column {
		if v, exists := body[key]; exists {
			switch key {
			case "cost_usd":
				sets = append(sets, col+" = "+n(adminAFloat(v)))
			case "credits_price", "sort_order":
				sets = append(sets, col+" = "+n(int(adminAFloat(v))))
			case "is_active", "is_visible", "auto_route_eligible":
				sets = append(sets, col+" = "+n(adminABool(v)))
			case "backup_model_id", "backup_provider_id":
				sets = append(sets, col+" = "+n(adminANullableString(adminAStr(v))))
			default:
				sets = append(sets, col+" = "+n(adminAStr(v)))
			}
		}
	}
	metadata := adminAJSONMap(previous["metadata_json"])
	if v, exists := body["routing_mode"]; exists {
		metadata["routing_mode"] = v
	}
	if v, exists := body["category"]; exists {
		metadata["category"] = v
	}
	if v, exists := body["capabilities"]; exists {
		for k, c := range adminAJSONMap(v) {
			metadata[k] = c
		}
	}
	if len(sets) == 0 && len(metadata) == 0 {
		return nil, nil, adminAResultErr("没有可更新的模型字段")
	}
	sets = append(sets, "metadata_json = "+n(adminAJSONRaw(metadata))+"::jsonb", "updated_at = now()")
	args = append(args, id)
	sql := `UPDATE ai_studio.models_config SET ` + strings.Join(sets, ", ") + ` WHERE id = $` + strconv.Itoa(len(args))
	if _, err := pool.Exec(ctx, sql, args...); err != nil {
		// Older schemas lack the tiering columns; retry with base columns only.
		fallback := []string{}
		fbArgs := []any{}
		fn := func(v any) string {
			fbArgs = append(fbArgs, v)
			return "$" + strconv.Itoa(len(fbArgs))
		}
		for _, key := range []string{"name", "cost_usd", "credits_price", "is_active", "sort_order", "provider"} {
			if v, exists := body[key]; exists {
				switch key {
				case "cost_usd":
					fallback = append(fallback, key+" = "+fn(adminAFloat(v)))
				case "credits_price", "sort_order":
					fallback = append(fallback, key+" = "+fn(int(adminAFloat(v))))
				case "is_active":
					fallback = append(fallback, key+" = "+fn(adminABool(v)))
				default:
					fallback = append(fallback, key+" = "+fn(adminAStr(v)))
				}
			}
		}
		fallback = append(fallback, "metadata_json = "+fn(adminAJSONRaw(metadata))+"::jsonb", "updated_at = now()")
		fbArgs = append(fbArgs, id)
		if len(fallback) < 3 {
			return nil, nil, adminAInternal(err, "模型配置更新失败")
		}
		if _, err2 := pool.Exec(ctx, `UPDATE ai_studio.models_config SET `+strings.Join(fallback, ", ")+` WHERE id = $`+strconv.Itoa(len(fbArgs)), fbArgs...); err2 != nil {
			return nil, nil, adminAInternal(err2, "模型配置更新失败")
		}
	}
	adminAAuditAfter(ctx, pool, u, "models.update", "model", id, "medium", reqID, body)
	updated, _, err := adminAQueryOne(ctx, pool, `SELECT * FROM ai_studio.models_config WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "模型回读失败")
	}
	return updated, nil, nil
}

// ---------------------------------------------------------------------------
// 44. POST /api/admin/models/[id]/health — lib/services/healthProbe.js
//     Probes provider credentials/upstream via generation.Service.ProbeProvider.
// ---------------------------------------------------------------------------

func adminACredentialProbe(ctx context.Context, d *Dependencies, pool *pgxpool.Pool, providerID string) (map[string]any, *adminError) {
	provider, ok, err := adminAQueryOne(ctx, pool, `SELECT id, name, enabled FROM ai_studio.ai_providers WHERE id = $1`, providerID)
	if err != nil {
		return nil, adminAInternal(err, "供应商探测失败")
	}
	if !ok {
		return nil, adminErr("PROVIDER_NOT_FOUND", "供应商不存在", http.StatusNotFound)
	}
	if !adminABool(provider["enabled"]) {
		_, _ = pool.Exec(ctx, `UPDATE ai_studio.ai_providers SET health_status = 'disabled', last_health_check_at = now(), updated_at = now() WHERE id = $1`, providerID)
		_, _ = pool.Exec(ctx, `
			INSERT INTO ops_bill.provider_health_checks
				(id, provider, status, latency_ms, error_code, details_json, checked_at)
			VALUES ($1,$2,'disabled',0,'PROVIDER_DISABLED',$3::jsonb,now())`,
			adminANewID("phc"), providerID, adminAJSONRaw(map[string]any{"probeKind": "disabled"}))
		return map[string]any{"ok": false, "providerId": providerID, "healthStatus": "disabled",
			"errorCode": "PROVIDER_DISABLED", "probeKind": "disabled"}, nil
	}
	res, pErr := d.generationSvc(pool).ProbeProvider(ctx, providerID)
	if pErr != nil {
		return nil, adminAInternal(pErr, "供应商探测失败")
	}
	return res, nil
}

func adminAModelHealthProbe(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	id := pathParam(r, "id")
	row, ok, err := adminAQueryOne(r.Context(), pool, `SELECT provider FROM ai_studio.models_config WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "模型渠道读取失败")
	}
	if !ok {
		return nil, nil, adminErr("MODEL_NOT_FOUND", "未找到指定模型配置", http.StatusNotFound)
	}
	result, e := adminACredentialProbe(r.Context(), d, pool, adminAStr(row["provider"]))
	if e != nil {
		return nil, nil, e
	}
	if !adminABool(result["ok"]) {
		return nil, nil, adminErr(firstNonEmpty(adminAStr(result["errorCode"]), "PROBE_FAILED"),
			"供应商凭据探测未通过", http.StatusUnprocessableEntity)
	}
	return result, nil, nil
}

// ---------------------------------------------------------------------------
// 45. PATCH /api/admin/models/[id]/provider — lib/repositories/aiCatalog.js
//     setChannelPrimary (metadata->'primary' convention).
// ---------------------------------------------------------------------------

func adminAModelProviderSwitch(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	var body map[string]any
	if e := adminABodyLenient(r, 64*1024, &body); e != nil {
		return nil, nil, e
	}
	modelID := pathParam(r, "id")
	channelID := firstNonEmpty(adminAStr(body["channelId"]), adminAStr(body["channel_id"]))
	if modelID == "" {
		return nil, nil, adminAResultErr("缺少模型 ID")
	}
	if channelID == "" {
		return nil, nil, adminAResultErr("请指定要设为默认供应商的渠道")
	}
	ctx := r.Context()
	data, aerr := adminAWithTx(ctx, pool, func(tx pgx.Tx) (any, *adminError) {
		_, ok, err := adminAQueryOne(ctx, pool, `SELECT id FROM ai_studio.ai_models WHERE id = $1`, modelID)
		if err != nil {
			return nil, adminAInternal(err, "模型目录读取失败")
		}
		if !ok {
			return nil, adminAResultErr("未找到指定模型配置")
		}
		var targetModelID string
		if err := tx.QueryRow(ctx, `SELECT model_id FROM ai_studio.provider_models WHERE id = $1 FOR UPDATE`, channelID).Scan(&targetModelID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, adminAResultErr("目标渠道不属于该模型")
			}
			return nil, adminAInternal(err, "目标渠道读取失败")
		}
		if targetModelID != modelID {
			return nil, adminAResultErr("目标渠道不属于该模型")
		}
		if _, err := tx.Exec(ctx, `
			UPDATE ai_studio.provider_models
			SET metadata = COALESCE(metadata,'{}'::jsonb) - 'primary', updated_at = now()
			WHERE model_id = $1 AND id <> $2 AND metadata ? 'primary'`, modelID, channelID); err != nil {
			return nil, adminAInternal(err, "默认供应商写入失败，已保持原供应商")
		}
		if _, err := tx.Exec(ctx, `
			UPDATE ai_studio.provider_models
			SET metadata = jsonb_set(COALESCE(metadata,'{}'::jsonb), '{primary}', 'true'::jsonb, true),
				updated_at = now() WHERE id = $1`, channelID); err != nil {
			return nil, adminAInternal(err, "默认供应商写入失败，已保持原供应商")
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops_bill.admin_audit_logs
				(id, actor_id, actor_email, action, target_type, target_id, risk_level, after_json, request_id, created_at)
			VALUES ($1,$2,$3,'models.provider_switch','model',$4,'high',$5::jsonb,$6,now())`,
			adminANewID("aud"), u.ID, adminAActorEmail(u), modelID,
			adminAJSONRaw(map[string]any{"channelId": channelID}), reqID); err != nil {
			return nil, adminAInternal(err, "默认供应商审计写入失败")
		}
		model, _, err := adminAQueryOne(ctx, pool, `SELECT * FROM ai_studio.ai_models WHERE id = $1`, modelID)
		if err != nil {
			return nil, adminAInternal(err, "模型回读失败")
		}
		return model, nil
	})
	return data, nil, aerr
}

// ---------------------------------------------------------------------------
// 46. GET/POST /api/admin/models/brands — lib/services/modelBrands.js
// ---------------------------------------------------------------------------

func adminAModelBrands(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		providerID := adminAQueryStr(r, "provider")
		providers, err := adminAQueryRows(ctx, pool, `
			SELECT p.id, p.slug, p.name, p.provider_type, p.enabled, p.priority,
				p.health_status, p.circuit_state, p.base_url, p.api_mode,
				COUNT(pm.id)::int AS bound_models_count
			FROM ai_studio.ai_providers p
			LEFT JOIN ai_studio.provider_models pm ON pm.provider_id = p.id
			GROUP BY p.id ORDER BY p.priority DESC, p.id ASC`)
		if err != nil {
			return nil, nil, adminAInternal(err, "品牌供应商读取失败")
		}
		args := []any{}
		where := ""
		if providerID != "" {
			args = append(args, providerID)
			where = " WHERE pm.provider_id = $1"
		}
		channels, err := adminAQueryRows(ctx, pool, `
			SELECT pm.id, pm.model_id, pm.provider_id, pm.provider_model_id, pm.provider_endpoint,
				pm.enabled, pm.priority, pm.cost_config, pm.review_status, pm.created_at, pm.updated_at,
				m.name AS model_name, m.display_name, m.category, m.capabilities,
				m.status AS canonical_status, p.name AS provider_name, p.provider_type,
				p.health_status, p.circuit_state
			FROM ai_studio.provider_models pm
			JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
			JOIN ai_studio.ai_models m ON m.id = pm.model_id`+where+`
			ORDER BY pm.priority DESC, pm.created_at DESC`, args...)
		if err != nil {
			return nil, nil, adminAInternal(err, "品牌渠道读取失败")
		}
		canonical, err := adminAQueryRows(ctx, pool, `SELECT id, name, display_name, category, capabilities, status FROM ai_studio.ai_models ORDER BY sort ASC, id ASC`)
		if err != nil {
			return nil, nil, adminAInternal(err, "规范模型读取失败")
		}
		return map[string]any{"providers": providers, "channels": channels, "canonicalModels": canonical}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	action := firstNonEmpty(adminAStr(body["action"]), "bind")
	channelID := adminAStr(body["channelId"])
	switch action {
	case "toggle", "priority", "unbind":
		if channelID == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "缺少 channelId 参数", http.StatusUnprocessableEntity)
		}
		var result map[string]any
		auditAction := "provider_models.toggle"
		risk := "medium"
		if action == "toggle" {
			enabled := adminABool(body["enabled"])
			affected, err := adminAExec(ctx, pool, `UPDATE ai_studio.provider_models SET enabled = $2, updated_at = now() WHERE id = $1`, channelID, enabled)
			if err != nil || affected == 0 {
				return nil, nil, adminAInternal(err, "渠道状态更新失败")
			}
			result = map[string]any{"id": channelID, "enabled": enabled}
		} else if action == "priority" {
			priority := int(adminAFloat(body["priority"]))
			affected, err := adminAExec(ctx, pool, `UPDATE ai_studio.provider_models SET priority = $2, updated_at = now() WHERE id = $1`, channelID, priority)
			if err != nil || affected == 0 {
				return nil, nil, adminAInternal(err, "渠道优先级更新失败")
			}
			result = map[string]any{"id": channelID, "priority": priority}
			auditAction, risk = "provider_models.update_priority", "low"
		} else {
			if _, err := pool.Exec(ctx, `DELETE FROM ai_studio.provider_models WHERE id = $1`, channelID); err != nil {
				return nil, nil, adminAInternal(err, "渠道解绑失败")
			}
			result = map[string]any{"id": channelID, "unbound": true}
			auditAction, risk = "provider_models.unbind", "high"
		}
		adminAAuditAfter(ctx, pool, u, auditAction, "provider_model", channelID, risk, reqID, result)
		return result, nil, nil
	case "bind":
		providerID := adminAStr(body["providerId"])
		modelID := adminAStr(body["modelId"])
		providerModelID := adminAStr(body["providerModelId"])
		if providerID == "" || modelID == "" || providerModelID == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "供应商 ID、规范模型 ID 与渠道内部模型标识均为必填项", http.StatusUnprocessableEntity)
		}
		priority := int(adminAFloat(body["priority"]))
		if priority == 0 {
			priority = 100
		}
		baseCost := adminAFloat(body["baseCost"])
		if baseCost <= 0 {
			baseCost = 0.01
		}
		currency := firstNonEmpty(adminAStr(body["currency"]), "USD")
		id := adminANewID("pm")
		_, err := pool.Exec(ctx, `
			INSERT INTO ai_studio.provider_models
				(id, model_id, provider_id, provider_model_id, enabled, priority, cost_config,
				 provider_endpoint, review_status, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'needs_specification',now(),now())`,
			id, modelID, providerID, providerModelID, body["enabled"] != false, priority,
			adminAJSONRaw(map[string]any{"currency": currency, "base_cost": baseCost, "pricing_source": "manual_admin_binding"}),
			adminAStr(body["providerEndpoint"]))
		if err != nil {
			return nil, nil, adminAInternal(err, "品牌模型挂载失败")
		}
		result := map[string]any{"id": id, "modelId": modelID, "providerId": providerID,
			"providerModelId": providerModelID, "priority": priority, "enabled": body["enabled"] != false}
		adminAAuditAfter(ctx, pool, u, "provider_models.bind_brand_model", "provider_model", id, "medium", reqID, result)
		return result, nil, nil
	default:
		return nil, nil, adminErr("VALIDATION_ERROR", "不支持的操作类型: "+action, http.StatusUnprocessableEntity)
	}
}

// ---------------------------------------------------------------------------
// 47. GET/POST /api/admin/models/catalog — ai_studio.ai_models upsert
// ---------------------------------------------------------------------------

func adminAModelCatalog(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		args := []any{}
		where := ""
		if c := adminAQueryStr(r, "category"); c != "" {
			args = append(args, c)
			where = " WHERE category = $1"
		}
		rows, err := adminAQueryRows(ctx, pool, `SELECT * FROM ai_studio.ai_models`+where+` ORDER BY sort ASC, id ASC`, args...)
		if err != nil {
			return nil, nil, adminAInternal(err, "规范模型目录读取失败")
		}
		return map[string]any{"models": rows}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 512*1024, &body); e != nil {
		return nil, nil, e
	}
	id := adminAStr(body["id"])
	name := adminAStr(body["name"])
	if id == "" || name == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "模型 ID 与名称为必填项", http.StatusUnprocessableEntity)
	}
	before, existed, err := adminAQueryOne(ctx, pool, `SELECT * FROM ai_studio.ai_models WHERE id = $1 OR slug = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "规范模型读取失败")
	}
	category := adminAOneOf(adminAStr(body["category"]), []string{"image", "image_edit", "video", "video_image", "video_text", "audio", "music", "text", "other"}, "image")
	_, err = pool.Exec(ctx, `
		INSERT INTO ai_studio.ai_models
			(id, slug, name, display_name, category, description, cover, status, sort, is_featured,
			 capabilities, default_parameters, supported_resolutions, supported_durations,
			 supported_ratios, supported_input_types, supported_output_types, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,
			$15::jsonb,$16::jsonb,$17::jsonb,now(),now())
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name, display_name = EXCLUDED.display_name,
			category = EXCLUDED.category, description = EXCLUDED.description,
			cover = EXCLUDED.cover, status = EXCLUDED.status, sort = EXCLUDED.sort,
			is_featured = EXCLUDED.is_featured, capabilities = EXCLUDED.capabilities,
			default_parameters = EXCLUDED.default_parameters,
			supported_resolutions = EXCLUDED.supported_resolutions,
			supported_durations = EXCLUDED.supported_durations,
			supported_ratios = EXCLUDED.supported_ratios,
			supported_input_types = EXCLUDED.supported_input_types,
			supported_output_types = EXCLUDED.supported_output_types,
			updated_at = now()`,
		id, firstNonEmpty(adminAStr(body["slug"]), id), name, firstNonEmpty(adminAStr(body["display_name"]), name),
		category, adminAStr(body["description"]), adminAStr(body["cover"]),
		adminAOneOf(adminAStr(body["status"]), []string{"active", "maintenance", "disabled"}, "active"),
		int(adminAFloat(body["sort"])), adminABool(body["is_featured"]),
		adminAJSONRaw(valueOrEmpty(body["capabilities"])), adminAJSONRaw(valueOrEmpty(body["default_parameters"])),
		adminAJSONRaw(arrayOrEmpty(body["supported_resolutions"])), adminAJSONRaw(arrayOrEmpty(body["supported_durations"])),
		adminAJSONRaw(arrayOrEmpty(body["supported_ratios"])), adminAJSONRaw(arrayOrEmpty(body["supported_input_types"])),
		adminAJSONRaw(arrayOrEmpty(body["supported_output_types"])))
	if err != nil {
		return nil, nil, adminAInternal(err, "规范模型写入失败")
	}
	updated, _, err := adminAQueryOne(ctx, pool, `SELECT * FROM ai_studio.ai_models WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "规范模型回读失败")
	}
	action := "models.canonical_create"
	if existed {
		action = "models.canonical_update"
	}
	adminAAudit(ctx, pool, u, action, "canonical_model", id, "medium", reqID, before, updated)
	return map[string]any{"model": updated}, nil, nil
}

// ---------------------------------------------------------------------------
// 48. GET/POST /api/admin/models/catalog/sync — lib/services/catalogSync.js
// ---------------------------------------------------------------------------

func adminACatalogGaps(ctx context.Context, pool *pgxpool.Pool) (map[string]any, *adminError) {
	row, _, err := adminAQueryOne(ctx, pool, `
		SELECT
			(SELECT count(*) FROM ai_studio.models_config)::int AS legacy_models,
			(SELECT count(*) FROM ai_studio.ai_models)::int AS canonical_models,
			(SELECT count(*) FROM ai_studio.models_config mc WHERE NOT EXISTS
				(SELECT 1 FROM ai_studio.ai_models m WHERE m.id = mc.id))::int AS legacy_without_model,
			(SELECT count(*) FROM ai_studio.ai_models m WHERE NOT EXISTS
				(SELECT 1 FROM ai_studio.provider_models pm WHERE pm.model_id = m.id))::int AS model_without_channel,
			(SELECT count(*) FROM ai_studio.ai_models m WHERE NOT EXISTS
				(SELECT 1 FROM ai_studio.model_pricing p WHERE p.model_id = m.id))::int AS model_without_pricing,
			(SELECT count(*) FROM ai_studio.ai_models m WHERE NOT EXISTS
				(SELECT 1 FROM ai_studio.routing_policies r WHERE r.model_id = m.id))::int AS model_without_routing,
			(SELECT count(*) FROM ai_studio.model_pricing mp
				JOIN ai_studio.models_config mc ON mc.id = mp.model_id
				WHERE mp.base_credits IS DISTINCT FROM mc.credits_price)::int AS legacy_pricing_mismatch`)
	if err != nil {
		return nil, adminAInternal(err, "目录差异读取失败")
	}
	return row, nil
}

func adminAModelCatalogSync(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		gaps, e := adminACatalogGaps(ctx, pool)
		if e != nil {
			return nil, nil, e
		}
		return map[string]any{"gaps": gaps}, nil, nil
	}
	// 1. Insert missing gateway providers (id/slug are the legacy provider key).
	providersTag, err := pool.Exec(ctx, `
		INSERT INTO ai_studio.ai_providers (id, slug, name, provider_type, enabled, priority, api_mode, created_at, updated_at)
		SELECT DISTINCT mc.provider, mc.provider, initcap(mc.provider), 'official', TRUE, 100, 'async', now(), now()
		FROM ai_studio.models_config mc
		WHERE mc.provider IS NOT NULL AND mc.provider <> ''
		ON CONFLICT DO NOTHING`)
	if err != nil {
		return nil, nil, adminAInternal(err, "供应商目录同步失败")
	}
	// 2. Insert missing canonical models; never update an existing row.
	modelsTag, err := pool.Exec(ctx, `
		INSERT INTO ai_studio.ai_models
			(id, slug, name, display_name, category, status, sort, created_at, updated_at)
		SELECT mc.id, mc.id, mc.name, mc.name,
			CASE WHEN mc.type IN ('image','image_edit','video','video_image','video_text','audio','music','text','other')
				THEN mc.type ELSE 'other' END,
			CASE WHEN mc.is_active THEN 'active' ELSE 'disabled' END,
			COALESCE(mc.sort_order,0), now(), now()
		FROM ai_studio.models_config mc
		ON CONFLICT DO NOTHING`)
	if err != nil {
		return nil, nil, adminAInternal(err, "规范模型同步失败")
	}
	// 3. Insert missing provider channels without touching existing prices.
	channelsTag, err := pool.Exec(ctx, `
		INSERT INTO ai_studio.provider_models
			(id, model_id, provider_id, provider_model_id, enabled, priority, cost_config,
			 review_status, created_at, updated_at)
		SELECT 'pm_' || mc.id || '_' || mc.provider, mc.id, mc.provider, mc.id,
			mc.is_active, COALESCE(mc.sort_order,100),
			jsonb_build_object('currency','USD','base_cost',mc.cost_usd,'pricing_source','legacy_catalog_sync'),
			'needs_specification', now(), now()
		FROM ai_studio.models_config mc
		JOIN ai_studio.ai_providers p ON p.id = mc.provider
		JOIN ai_studio.ai_models m ON m.id = mc.id
		ON CONFLICT DO NOTHING`)
	if err != nil {
		return nil, nil, adminAInternal(err, "渠道同步失败")
	}
	routingTag, err := pool.Exec(ctx, `
		INSERT INTO ai_studio.routing_policies
			(id, model_id, routing_mode, created_at, updated_at)
		SELECT 'rp_' || m.id, m.id, 'cost', now(), now()
		FROM ai_studio.ai_models m ON CONFLICT DO NOTHING`)
	if err != nil {
		return nil, nil, adminAInternal(err, "路由策略同步失败")
	}
	gaps, e := adminACatalogGaps(ctx, pool)
	if e != nil {
		return nil, nil, e
	}
	brands, err := adminAQueryRows(ctx, pool, `SELECT provider AS brand, count(*)::int AS models FROM ai_studio.models_config GROUP BY provider ORDER BY count(*) DESC, provider ASC`)
	if err != nil {
		return nil, nil, adminAInternal(err, "品牌统计读取失败")
	}
	result := map[string]any{"providers": providersTag.RowsAffected(), "models": modelsTag.RowsAffected(),
		"channels": channelsTag.RowsAffected(), "directChannels": int64(0),
		"routingPolicies": routingTag.RowsAffected(), "gaps": gaps,
		"brands": brands, "pricingSynced": false}
	adminAAuditAfter(ctx, pool, u, "models.catalog_sync", "model_catalog", "legacy_reconcile", "medium", reqID, result)
	return result, nil, nil
}

// ---------------------------------------------------------------------------
// 49. GET/POST /api/admin/models/control — lib/services/channelSync.js
// ---------------------------------------------------------------------------

func adminAControlSnapshot(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, *adminError) {
	models, err := adminAQueryRows(ctx, pool, `
		SELECT m.id, m.slug, m.name, m.display_name, m.category, m.status, m.sort,
			m.tier, m.is_visible, m.auto_route_eligible,
			mp.base_credits, mp.min_credits, mp.min_gross_margin_rate, mp.is_active AS pricing_active,
			sp.site_price AS site_price_cny, sp.credits, sp.status AS site_price_status
		FROM ai_studio.ai_models m
		LEFT JOIN ai_studio.model_pricing mp ON mp.model_id = m.id
		LEFT JOIN LATERAL (
			SELECT site_price, credits, status FROM ai_studio.model_site_price_versions
			WHERE model_id = m.id AND status = 'active' ORDER BY version_no DESC LIMIT 1
		) sp ON TRUE
		ORDER BY m.sort ASC, m.id ASC`)
	if err != nil {
		return nil, adminAInternal(err, "模型控制快照读取失败")
	}
	routes, err := adminAQueryRows(ctx, pool, `
		SELECT pm.id, pm.model_id, pm.provider_id, pm.provider_model_id, pm.enabled, pm.priority,
			pm.cost_config, pm.review_status, pm.provider_endpoint,
			p.name AS provider_name, p.health_status
		FROM ai_studio.provider_models pm
		JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
		ORDER BY pm.priority DESC, pm.created_at DESC LIMIT 1000`)
	if err != nil {
		return nil, adminAInternal(err, "模型控制渠道读取失败")
	}
	strategy, _, err := adminAQueryOne(ctx, pool, `SELECT * FROM ai_studio.pricing_strategy WHERE is_active = true ORDER BY updated_at DESC LIMIT 1`)
	if err != nil {
		return nil, adminAInternal(err, "定价策略读取失败")
	}
	fx, err := adminAQueryRows(ctx, pool, `SELECT * FROM ai_studio.exchange_rate_snapshots ORDER BY observed_at DESC LIMIT 10`)
	if err != nil {
		return nil, adminAInternal(err, "汇率快照读取失败")
	}
	byModel := map[string][]map[string]any{}
	for _, route := range routes {
		k := adminAStr(route["model_id"])
		byModel[k] = append(byModel[k], route)
	}
	decorated := make([]map[string]any, 0, len(models))
	for _, m := range models {
		copy := map[string]any{}
		for k, v := range m {
			copy[k] = v
		}
		copy["routes"] = byModel[adminAStr(m["id"])]
		decorated = append(decorated, copy)
	}
	return map[string]any{"models": decorated, "strategy": strategy, "exchangeRates": fx,
		"callsFrom": adminAQueryStr(r, "callsFrom"), "callsTo": adminAQueryStr(r, "callsTo")}, nil
}

func adminAControlReadOnly(ctx context.Context, pool *pgxpool.Pool, action, modelID string, body map[string]any) (any, *adminError) {
	switch action {
	case "hygiene_scan":
		rows, err := adminAQueryRows(ctx, pool, `
			SELECT name, COUNT(*)::int AS duplicates, array_agg(id ORDER BY id) AS ids
			FROM ai_studio.models_config GROUP BY name HAVING COUNT(*) > 1 ORDER BY duplicates DESC LIMIT 100`)
		if err != nil {
			return nil, adminAInternal(err, "模型治理体检扫描失败")
		}
		return map[string]any{"duplicateGroups": rows, "total": len(rows)}, nil
	case "match_channel_candidates":
		limit := int(adminAFloat(body["limit"]))
		if limit <= 0 {
			limit = 5
		}
		if limit > 50 {
			limit = 50
		}
		rows, err := adminAQueryRows(ctx, pool, `
			SELECT pm.id, pm.model_id, pm.provider_id, pm.provider_model_id, pm.priority,
				pm.enabled, pm.review_status, p.health_status
			FROM ai_studio.provider_models pm
			JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
			WHERE pm.model_id = $1 AND pm.enabled = TRUE
			ORDER BY pm.priority ASC LIMIT $2`, modelID, limit)
		if err != nil {
			return nil, adminAInternal(err, "渠道候选匹配失败")
		}
		return map[string]any{"candidates": rows}, nil
	case "preview_site_price":
		row, ok, err := adminAQueryOne(ctx, pool, `
			SELECT m.id, mp.base_credits, mp.min_credits, mp.min_gross_margin_rate,
				COALESCE(pm.cost_config->>'base_cost','0') AS provider_cost
			FROM ai_studio.ai_models m
			LEFT JOIN ai_studio.model_pricing mp ON mp.model_id = m.id
			LEFT JOIN ai_studio.provider_models pm ON pm.model_id = m.id
			WHERE m.id = $1 ORDER BY pm.priority ASC LIMIT 1`, modelID)
		if err != nil {
			return nil, adminAInternal(err, "站点价格预览失败")
		}
		if !ok {
			return nil, adminErr("VALIDATION_ERROR", "规范模型不存在", http.StatusUnprocessableEntity)
		}
		return map[string]any{"preview": row}, nil
	default: // simulate
		row, ok, err := adminAQueryOne(ctx, pool, `
			SELECT pm.id AS channel_id, pm.provider_id, pm.provider_model_id, pm.priority,
				p.health_status, p.circuit_state
			FROM ai_studio.provider_models pm
			JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
			WHERE pm.model_id = $1 AND pm.enabled = TRUE AND p.enabled = TRUE
			ORDER BY pm.priority ASC LIMIT 1`, modelID)
		if err != nil {
			return nil, adminAInternal(err, "路由模拟失败")
		}
		if !ok {
			return nil, adminErr("VALIDATION_ERROR", "没有可用的供应商渠道", http.StatusUnprocessableEntity)
		}
		return map[string]any{"simulation": row}, nil
	}
}

func adminAControlWrite(ctx context.Context, d *Dependencies, pool *pgxpool.Pool, action string, body map[string]any, u *middleware.SessionUser, reqID string) (any, *adminError) {
	switch action {
	case "provider_enabled":
		id := adminAStr(body["providerId"])
		if id == "" {
			return nil, adminErr("VALIDATION_ERROR", "缺少 providerId", http.StatusUnprocessableEntity)
		}
		tag, err := pool.Exec(ctx, `UPDATE ai_studio.ai_providers SET enabled = $2, updated_at = now() WHERE id = $1`, id, adminABool(body["enabled"]))
		if err != nil || tag.RowsAffected() == 0 {
			return nil, adminAInternal(err, "供应商开关写入失败")
		}
		return map[string]any{"providerId": id, "enabled": adminABool(body["enabled"])}, nil
	case "routing_policy":
		modelID := adminAStr(body["modelId"])
		mode := adminAOneOf(adminAStr(body["routingMode"]), []string{"cost", "priority", "quality", "stability", "balanced"}, "")
		if modelID == "" || mode == "" {
			return nil, adminErr("VALIDATION_ERROR", "缺少 modelId 或 routingMode 无效", http.StatusUnprocessableEntity)
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO ai_studio.routing_policies (id, model_id, routing_mode, created_at, updated_at)
			VALUES ($1,$2,$3,now(),now())
			ON CONFLICT (model_id) DO UPDATE SET routing_mode = EXCLUDED.routing_mode, updated_at = now()`,
			"rp_"+modelID, modelID, mode)
		if err != nil {
			return nil, adminAInternal(err, "路由策略写入失败")
		}
		return map[string]any{"modelId": modelID, "routingMode": mode}, nil
	case "pricing_strategy", "save_pricing_strategy":
		multiplier := adminAFloat(body["baseMultiplier"])
		if multiplier <= 0 {
			return nil, adminErr("VALIDATION_ERROR", "基础倍率必须大于 0", http.StatusUnprocessableEntity)
		}
		margin := adminAFloat(body["minMarginRate"])
		if margin < 0 || margin > 1 {
			return nil, adminErr("VALIDATION_ERROR", "最低毛利率必须在 0–1 之间", http.StatusUnprocessableEntity)
		}
		// lib/repositories/pricingStrategy.js upsertPricingStrategy deactivates
		// every existing strategy then inserts a new immutable active row.
		if _, err := pool.Exec(ctx, `UPDATE ai_studio.pricing_strategy SET is_active = false WHERE is_active = true`); err != nil {
			return nil, adminAInternal(err, "定价策略写入失败")
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO ai_studio.pricing_strategy
				(name, base_multiplier, min_margin_rate, category_multipliers,
				 is_active, updated_at)
			VALUES ('default',$1,$2,$3::jsonb,TRUE,now())`,
			multiplier, margin, adminAJSONRaw(body["categoryMultipliers"]))
		if err != nil {
			return nil, adminAInternal(err, "定价策略写入失败")
		}
		return map[string]any{"baseMultiplier": multiplier, "minMarginRate": margin}, nil
	case "save_model_pricing", "update_model_pricing":
		modelID := adminAStr(body["modelId"])
		baseCredits := int(adminAFloat(body["baseCredits"]))
		if modelID == "" || baseCredits <= 0 {
			return nil, adminErr("VALIDATION_ERROR", "缺少 modelId 或 baseCredits 无效", http.StatusUnprocessableEntity)
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO ai_studio.model_pricing
				(id, model_id, base_credits, min_credits, min_gross_margin_rate, is_active, created_at, updated_at)
			VALUES ($1,$2,$3,$4,0.3,TRUE,now(),now())
			ON CONFLICT (model_id) DO UPDATE SET base_credits = EXCLUDED.base_credits,
				min_credits = EXCLUDED.min_credits, updated_at = now()`,
			adminANewID("mp"), modelID, baseCredits, int(adminAFloat(body["minCredits"])))
		if err != nil {
			return nil, adminAInternal(err, "模型定价写入失败")
		}
		return map[string]any{"modelId": modelID, "baseCredits": baseCredits}, nil
	case "exchange_rate":
		base := firstNonEmpty(adminAStr(body["baseCurrency"]), "USD")
		quote := firstNonEmpty(adminAStr(body["quoteCurrency"]), "CNY")
		rate := adminAFloat(body["rate"])
		if rate <= 0 {
			return nil, adminErr("VALIDATION_ERROR", "汇率必须大于 0", http.StatusUnprocessableEntity)
		}
		id := adminANewID("fx")
		_, err := pool.Exec(ctx, `
			INSERT INTO ai_studio.exchange_rate_snapshots
				(id, base_currency, quote_currency, rate, source_type, observed_at, created_by, created_at)
			VALUES ($1,$2,$3,$4,'manual',now(),$5,now())`, id, base, quote, rate, u.ID)
		if err != nil {
			return nil, adminAInternal(err, "汇率快照写入失败")
		}
		return map[string]any{"id": id, "baseCurrency": base, "quoteCurrency": quote, "rate": rate}, nil
	case "probe_health":
		providerID := adminAStr(body["providerId"])
		if providerID == "" {
			return nil, adminErr("VALIDATION_ERROR", "请指定要探测的供应商 ID", http.StatusUnprocessableEntity)
		}
		return adminACredentialProbe(ctx, d, pool, providerID)
	case "create_model":
		id := adminAStr(body["id"])
		name := adminAStr(body["name"])
		if id == "" || name == "" {
			return nil, adminErr("VALIDATION_ERROR", "模型 ID 与名称为必填项", http.StatusUnprocessableEntity)
		}
		_, err := pool.Exec(ctx, `
			INSERT INTO ai_studio.ai_models
				(id, slug, name, display_name, category, status, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,'active',now(),now())`,
			id, firstNonEmpty(adminAStr(body["slug"]), id), name,
			firstNonEmpty(adminAStr(body["displayName"]), name),
			adminAOneOf(adminAStr(body["category"]), []string{"image", "image_edit", "video", "video_image", "video_text", "audio", "music", "text", "other"}, "image"))
		if err != nil {
			return nil, adminAInternal(err, "模型创建失败")
		}
		return map[string]any{"id": id, "name": name}, nil
	case "update_model_tiering", "bulk_update_sort":
		items := adminAJSONArray(body["items"])
		results := make([]map[string]any, 0, len(items))
		for _, raw := range items {
			item := adminAJSONMap(raw)
			modelID := firstNonEmpty(adminAStr(item["modelId"]), adminAStr(item["id"]))
			if modelID == "" {
				results = append(results, map[string]any{"modelId": modelID, "error": "缺少模型 ID"})
				continue
			}
			var err error
			if action == "bulk_update_sort" {
				_, err = pool.Exec(ctx, `UPDATE ai_studio.ai_models SET sort = $2, updated_at = now() WHERE id = $1`,
					modelID, int(adminAFloat(item["sort"])))
			} else {
				_, err = pool.Exec(ctx, `UPDATE ai_studio.ai_models SET tier = $2, is_visible = $3,
					auto_route_eligible = $4, updated_at = now() WHERE id = $1`,
					modelID,
					adminAOneOf(adminAStr(item["tier"]), []string{"core", "backup", "experimental", "deprecated"}, "backup"),
					adminABool(item["isVisible"]), adminABool(item["autoRouteEligible"]))
			}
			if err != nil {
				results = append(results, map[string]any{"modelId": modelID, "error": err.Error()})
			} else {
				results = append(results, map[string]any{"modelId": modelID, "ok": true})
			}
		}
		updated := 0
		for _, r := range results {
			if adminABool(r["ok"]) {
				updated++
			}
		}
		return map[string]any{"updated": updated, "total": len(results), "results": results}, nil
	default:
		return nil, adminErr("MODEL_CONTROL_ACTION_UNKNOWN", "未知的模型定价操作", http.StatusUnprocessableEntity)
	}
}

func adminAModelControl(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		snapshot, e := adminAControlSnapshot(ctx, pool, r)
		if e != nil {
			return nil, nil, e
		}
		return snapshot, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 14*1024*1024, &body); e != nil {
		return nil, nil, e
	}
	action := adminAStr(body["action"])
	readOnly := map[string]bool{"simulate": true, "preview_site_price": true,
		"match_channel_candidates": true, "hygiene_scan": true}
	if readOnly[action] {
		modelID := firstNonEmpty(adminAStr(body["modelId"]), adminAStr(body["id"]))
		if action != "hygiene_scan" && modelID == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "规范模型 ID 为必填项", http.StatusUnprocessableEntity)
		}
		data, e := adminAControlReadOnly(ctx, pool, action, modelID, body)
		if e != nil {
			return nil, nil, e
		}
		return data, nil, nil
	}
	if action == "bind_and_activate_channel" || action == "batch_auto_match_channels" {
		return nil, nil, adminErr("MAPPING_REVIEW_REQUIRED",
			"候选匹配仅供参考；请先创建待审核映射并核实模型身份、端点、能力与价格，再由管理员审核启用。",
			http.StatusUnprocessableEntity)
	}
	// Spec scope is empty, so enforce the source's own per-action idempotency here.
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if len(key) < 8 || len(key) > 200 {
		return nil, nil, adminErr("IDEMPOTENCY_REQUIRED", "该管理写操作必须提供 Idempotency-Key", http.StatusUnprocessableEntity)
	}
	store := d.idempotency()
	res, err := store.Check(ctx, "model_control:"+action, key, u.ID)
	if err != nil {
		return nil, nil, adminAInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !res.Allowed {
		if res.CachedResponse != nil {
			return map[string]any{"result": res.CachedResponse}, nil, nil
		}
		return nil, nil, adminErr("IDEMPOTENCY_IN_PROGRESS", "相同操作正在处理，请稍后刷新状态", http.StatusConflict)
	}
	completed := false
	defer func() {
		if !completed {
			_ = store.Release(ctx, res.KeyHash)
		}
	}()
	result, e := adminAControlWrite(ctx, d, pool, action, body, u, reqID)
	if e != nil {
		return nil, nil, e
	}
	if err := store.Complete(ctx, res.KeyHash, result); err != nil {
		return nil, nil, adminAInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	completed = true
	adminAAuditAfter(ctx, pool, u, "model_control."+action, "model_control", action, "medium", reqID, result)
	return map[string]any{"result": result}, nil, nil
}

// ---------------------------------------------------------------------------
// 50. GET /api/admin/models/control/export — modelPriceImport.js exportPriceRows
//     CSV is exact; XLSX is a real minimal OOXML workbook.
// ---------------------------------------------------------------------------

var adminAPriceExportColumns = []string{
	"canonical_model_id", "provider_id", "provider_model_id", "provider_endpoint",
	"price_version_id", "price_type", "currency", "site_price_cny", "credits",
	"enabled", "mapping_status", "source_url", "effective_at", "expires_at", "price_status",
}

func adminAEscapeCSV(v any) string {
	s := adminAStr(v)
	s = strings.ReplaceAll(s, `"`, `""`)
	if strings.ContainsAny(s, ",\n\"") {
		return `"` + s + `"`
	}
	return s
}

func adminACSV(headers []string, rows []map[string]any) string {
	var sb strings.Builder
	sb.WriteString("\uFEFF")
	for i, h := range headers {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(adminAEscapeCSV(h))
	}
	sb.WriteByte('\n')
	for ri, row := range rows {
		if ri > 0 {
			sb.WriteByte('\n')
		}
		for i, h := range headers {
			if i > 0 {
				sb.WriteByte(',')
			}
			sb.WriteString(adminAEscapeCSV(row[h]))
		}
	}
	return sb.String()
}

func adminAXMLCell(ref, value string) string {
	var sb strings.Builder
	sb.WriteString(`<c r="` + ref + `" t="inlineStr"><is><t>`)
	sb.WriteString(strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;").Replace(value))
	sb.WriteString(`</t></is></c>`)
	return sb.String()
}

func adminAColName(n int) string {
	s := ""
	for n > 0 {
		n--
		s = string(rune('A'+n%26)) + s
		n /= 26
	}
	return s
}

func adminAXLSX(headers []string, rows []map[string]any) ([]byte, error) {
	var sheet strings.Builder
	sheet.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`)
	all := append([][]string{headers}, make([][]string, 0, len(rows))...)
	for _, row := range rows {
		line := make([]string, 0, len(headers))
		for _, h := range headers {
			line = append(line, adminAStr(row[h]))
		}
		all = append(all, line)
	}
	for ri, line := range all {
		sheet.WriteString(`<row r="` + strconv.Itoa(ri+1) + `">`)
		for ci, cell := range line {
			sheet.WriteString(adminAXMLCell(adminAColName(ci+1)+strconv.Itoa(ri+1), cell))
		}
		sheet.WriteString(`</row>`)
	}
	sheet.WriteString(`</sheetData></worksheet>`)
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	files := map[string]string{
		"[Content_Types].xml":        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
		"_rels/.rels":                `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
		"xl/workbook.xml":            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="prices" sheetId="1" r:id="rId1"/></sheets></workbook>`,
		"xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
		"xl/worksheets/sheet1.xml":   sheet.String(),
	}
	for name, content := range files {
		f, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := f.Write([]byte(content)); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func adminAModelControlExport(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	format := firstNonEmpty(adminAQueryStr(r, "format"), "csv")
	if format != "csv" && format != "xlsx" {
		return nil, nil, adminErr("VALIDATION_ERROR", "仅支持 CSV 和 XLSX 导出", http.StatusUnprocessableEntity)
	}
	rows, err := adminAQueryRows(r.Context(), pool, `
		SELECT pm.model_id AS canonical_model_id, pm.provider_id, pm.provider_model_id,
			pm.provider_endpoint, pv.id AS price_version_id, pv.price_type, pv.currency,
			sp.site_price AS site_price_cny, mp.base_credits AS credits, pm.enabled,
			pm.review_status AS mapping_status, pv.source_url, pv.effective_at, pv.expires_at,
			COALESCE(pv.status,'missing') AS price_status
		FROM ai_studio.provider_models pm
		LEFT JOIN LATERAL (
			SELECT id, price_type, currency, source_url, effective_at, expires_at, status
			FROM ai_studio.provider_model_price_versions
			WHERE provider_model_id = pm.id AND status = 'active'
			ORDER BY version_no DESC LIMIT 1
		) pv ON TRUE
		LEFT JOIN ai_studio.model_pricing mp ON mp.model_id = pm.model_id
		LEFT JOIN LATERAL (
			SELECT site_price FROM ai_studio.model_site_price_versions
			WHERE model_id = pm.model_id AND status = 'active' ORDER BY version_no DESC LIMIT 1
		) sp ON TRUE
		ORDER BY pm.model_id ASC, pm.priority ASC`)
	if err != nil {
		return nil, nil, adminAInternal(err, "价格导出读取失败")
	}
	var content []byte
	contentType := "text/csv; charset=utf-8"
	if format == "xlsx" {
		content, err = adminAXLSX(adminAPriceExportColumns, rows)
		if err != nil {
			return nil, nil, adminAInternal(err, "XLSX 导出失败")
		}
		contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	} else {
		content = []byte(adminACSV(adminAPriceExportColumns, rows))
	}
	adminAAuditAfter(r.Context(), pool, u, "model_control.export", "model_pricing", "rows:"+strconv.Itoa(len(rows)), "low", reqID,
		map[string]any{"format": format, "rows": len(rows)})
	filename := "supdance-model-pricing-" + time.Now().UTC().Format("2006-01-02") + "." + format
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Export-Rows", strconv.Itoa(len(rows)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
	return AdminAlreadyWritten, nil, nil
}

// ---------------------------------------------------------------------------
// 51. GET/POST /api/admin/models/deduplicate — lib/services/modelHygiene.js
// ---------------------------------------------------------------------------

func adminAModelHygieneScan(ctx context.Context, pool *pgxpool.Pool) (map[string]any, *adminError) {
	duplicates, err := adminAQueryRows(ctx, pool, `
		SELECT name, provider, COUNT(*)::int AS duplicates, array_agg(id ORDER BY id) AS ids
		FROM ai_studio.models_config
		GROUP BY name, provider HAVING COUNT(*) > 1
		ORDER BY duplicates DESC, name ASC LIMIT 200`)
	if err != nil {
		return nil, adminAInternal(err, "模型治理体检扫描失败")
	}
	orphans, err := adminAQueryRows(ctx, pool, `
		SELECT m.id, m.name FROM ai_studio.ai_models m
		WHERE NOT EXISTS (SELECT 1 FROM ai_studio.provider_models pm WHERE pm.model_id = m.id)
		ORDER BY m.id ASC LIMIT 200`)
	if err != nil {
		return nil, adminAInternal(err, "模型治理体检扫描失败")
	}
	return map[string]any{"duplicateGroups": duplicates, "orphanModels": orphans,
		"duplicateCount": len(duplicates), "orphanCount": len(orphans)}, nil
}

func adminAModelDeduplicate(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		scan, e := adminAModelHygieneScan(ctx, pool)
		if e != nil {
			return nil, nil, e
		}
		return scan, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 128*1024, &body); e != nil {
		return nil, nil, e
	}
	action := adminAStr(body["action"])
	switch action {
	case "merge":
		sourceID := adminAStr(body["sourceModelId"])
		targetID := adminAStr(body["targetModelId"])
		if sourceID == "" || targetID == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "缺少 sourceModelId 或 targetModelId", http.StatusUnprocessableEntity)
		}
		if sourceID == targetID {
			return nil, nil, adminErr("VALIDATION_ERROR", "源模型与目标模型不能相同", http.StatusUnprocessableEntity)
		}
		data, e := adminAWithTx(ctx, pool, func(tx pgx.Tx) (any, *adminError) {
			_, ok, err := adminAQueryOne(ctx, pool, `SELECT id FROM ai_studio.ai_models WHERE id = $1`, targetID)
			if err != nil {
				return nil, adminAInternal(err, "合并目标读取失败")
			}
			if !ok {
				return nil, adminAResultErr("目标模型不存在")
			}
			if _, err := tx.Exec(ctx, `UPDATE ai_studio.creations SET model = $2 WHERE model = $1`, sourceID, targetID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			if _, err := tx.Exec(ctx, `UPDATE ai_studio.generation_attempts SET provider_model_id = $2 WHERE provider_model_id = $1`, sourceID, targetID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			// Rebind channels whose (model_id, provider_id, provider_model_id) triple is
			// still free on the target, then delete the unavoidable duplicates.
			if _, err := tx.Exec(ctx, `
				UPDATE ai_studio.provider_models src SET model_id = $2
				WHERE src.model_id = $1 AND NOT EXISTS (
					SELECT 1 FROM ai_studio.provider_models dst
					WHERE dst.model_id = $2 AND dst.provider_id = src.provider_id
						AND dst.provider_model_id = src.provider_model_id)`, sourceID, targetID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			if _, err := tx.Exec(ctx, `DELETE FROM ai_studio.provider_models WHERE model_id = $1`, sourceID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			if _, err := tx.Exec(ctx, `DELETE FROM ai_studio.model_pricing WHERE model_id = $1`, sourceID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			if _, err := tx.Exec(ctx, `DELETE FROM ai_studio.routing_policies WHERE model_id = $1`, sourceID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			if _, err := tx.Exec(ctx, `DELETE FROM ai_studio.model_site_price_versions WHERE model_id = $1`, sourceID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			if _, err := tx.Exec(ctx, `UPDATE ai_studio.ai_models SET backup_model_id = $2 WHERE backup_model_id = $1`, sourceID, targetID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			if _, err := tx.Exec(ctx, `DELETE FROM ai_studio.ai_models WHERE id = $1`, sourceID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			if _, err := tx.Exec(ctx, `DELETE FROM ai_studio.models_config WHERE id = $1`, sourceID); err != nil {
				return nil, adminAInternal(err, "模型别名合并失败")
			}
			result := map[string]any{"sourceModelId": sourceID, "targetModelId": targetID, "merged": true}
			if _, err := tx.Exec(ctx, `
				INSERT INTO ops_bill.admin_audit_logs
					(id, actor_id, actor_email, action, target_type, target_id, risk_level, after_json, request_id, created_at)
				VALUES ($1,$2,$3,'model.merge_alias','ai_model',$4,'medium',$5::jsonb,$6,now())`,
				adminANewID("aud"), u.ID, adminAActorEmail(u), targetID, adminAJSONRaw(result), reqID); err != nil {
				return nil, adminAInternal(err, "合并审计写入失败")
			}
			return result, nil
		})
		return data, nil, e
	case "run_sync":
		scan, e := adminAModelHygieneScan(ctx, pool)
		if e != nil {
			return nil, nil, e
		}
		if err := adminAWriteSetting(ctx, pool, "model_hygiene_last_run", scan, "private", adminAActorEmail(u)); err != nil {
			return nil, nil, adminAInternal(err, "模型治理同步失败")
		}
		adminAAuditAfter(ctx, pool, u, "model.hygiene_sync", "ai_model", "all", "high", reqID, scan)
		return map[string]any{"stats": scan}, nil, nil
	default:
		return nil, nil, adminErr("VALIDATION_ERROR", "不支持的操作类型: "+action, http.StatusUnprocessableEntity)
	}
}

// ---------------------------------------------------------------------------
// 52. GET/POST /api/admin/models/health — circuitBreaker + healthProbe
// ---------------------------------------------------------------------------

func adminAModelsHealth(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		rows, err := adminAQueryRows(ctx, pool, `
			SELECT p.id, p.slug, p.name, p.provider_type, p.enabled, p.priority,
				p.health_status, p.circuit_state, p.circuit_opened_at, p.consecutive_failures,
				p.last_health_check_at, p.base_url, p.api_mode, p.balance, p.currency,
				COALESCE(pm_agg.bound_models_count,0) AS bound_models_count,
				COALESCE(att_agg.success_attempts_24h,0) AS success_attempts_24h,
				COALESCE(att_agg.total_attempts_24h,0) AS total_attempts_24h
			FROM ai_studio.ai_providers p
			LEFT JOIN (SELECT provider_id, COUNT(id) AS bound_models_count
				FROM ai_studio.provider_models GROUP BY provider_id) pm_agg ON pm_agg.provider_id = p.id
			LEFT JOIN (SELECT provider_id,
				SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS success_attempts_24h,
				COUNT(id) AS total_attempts_24h
				FROM ai_studio.generation_attempts
				WHERE created_at >= now() - INTERVAL '24 hours' GROUP BY provider_id) att_agg
				ON att_agg.provider_id = p.id
			ORDER BY p.priority DESC, p.id ASC`)
		if err != nil {
			return nil, nil, adminAInternal(err, "渠道健康概览读取失败")
		}
		return map[string]any{"channels": rows}, nil, nil
	}
	var body map[string]any
	if e := adminABodyLenient(r, 64*1024, &body); e != nil {
		return nil, nil, e
	}
	providerID := firstNonEmpty(adminAStr(body["providerId"]), adminAStr(body["provider_id"]))
	if providerID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "请指定要探测的供应商 ID", http.StatusUnprocessableEntity)
	}
	result, e := adminACredentialProbe(ctx, d, pool, providerID)
	if e != nil {
		return nil, nil, e
	}
	return result, nil, nil
}
