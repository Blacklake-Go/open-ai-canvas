// Package handler: `admin_b` wave — 52 admin routes / 76 (method, path) mounts.
//
// Every route is registered through wrapAdmin so permission checks, write-path
// idempotency, the panic boundary and the admin_ok_meta_envelope are handled by
// admin_protocol.go. SessionUser resolution is supplied by OptionalAuth in this
// file so wrapAdmin can emit its exact 401/403 admin envelope. Persistent
// operations go through d.Pool with parameterized
// SQL against the four-schema PostgreSQL layout from
// Supdance Pro/lib/db/migrations/*.sql; with Pool == nil the handlers return an
// honest 503 DB_UNAVAILABLE instead of inventing business data.
package handler

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/scrypt"

	ai "one/backend/internal/adapters/ai"
	"one/backend/internal/domain/admin"
	"one/backend/internal/domain/billing"
	"one/backend/internal/domain/generation"
	"one/backend/internal/domain/site"
	"one/backend/internal/middleware"
	"one/backend/internal/notify"
	"one/backend/internal/pkg/seckey"
	"one/backend/internal/platform/runtimelog"
	"one/backend/internal/storage"
)

// ---------------------------------------------------------------------------
// Route table (mirrors .migration/spec_admin_b.json exactly, including scopes).
// ---------------------------------------------------------------------------

type adminBRoute struct {
	methods []string
	path    string
	perm    string
	scope   string
	fn      adminHandler
}

func init() {
	registerBatch(func(d *Dependencies, mount mountFunc) {
		for _, spec := range adminBRoutes() {
			// wrapAdmin performs the permission decision itself, but it needs the
			// ko_session user in the request context. Resolve it with OptionalAuth
			// here (adminPermissionFor then emits the exact 401/403 admin envelope)
			// without touching shared router/middleware files.
			h := middleware.OptionalAuth(d.SessionAuth)(wrapAdmin(d, spec.perm, spec.scope, spec.fn))
			for _, m := range spec.methods {
				mount(m, spec.path, h)
			}
		}
	})
}

func adminBRoutes() []adminBRoute {
	return []adminBRoute{
		{[]string{"POST"}, "/api/admin/models/health/reset", "providersWrite", "", adminBHealthReset},
		{[]string{"GET", "POST"}, "/api/admin/models/pricing", "modelsRead", "", adminBModelPricing},
		{[]string{"GET", "POST"}, "/api/admin/models/pricing/strategy", "modelsRead", "", adminBPricingStrategy},
		{[]string{"GET", "POST", "DELETE"}, "/api/admin/models/providers", "providersRead", "", adminBModelProviders},
		{[]string{"POST"}, "/api/admin/models/publication", "modelsRead", "", adminBModelPublication},
		{[]string{"GET", "POST", "DELETE"}, "/api/admin/models/routing", "modelsRead", "", adminBModelRouting},
		{[]string{"POST"}, "/api/admin/models/routing/test", "providersRead", "", adminBRoutingTest},
		{[]string{"GET"}, "/api/admin/models/telemetry", "modelsRead", "", adminBModelTelemetry},
		{[]string{"GET"}, "/api/admin/moderation", "moderationRead", "", adminBListRows("moderation")},
		{[]string{"POST"}, "/api/admin/moderation/[id]/resolve", "moderationWrite", "moderation_resolve", adminBResolveModeration},
		{[]string{"GET"}, "/api/admin/orders", "billingRead", "", adminBListRows("orders")},
		{[]string{"POST"}, "/api/admin/orders/[id]/refund", "billingWrite", "order_refund", adminBOrderRefund},
		{[]string{"GET"}, "/api/admin/plans", "plansRead", "", adminBPlans},
		{[]string{"POST"}, "/api/admin/plans", "plansWrite", "plan_create", adminBPlans},
		{[]string{"PATCH"}, "/api/admin/plans/[id]", "plansWrite", "plan_update", adminBPlanPatch},
		{[]string{"GET"}, "/api/admin/profit-center", "dashboardRead", "", adminBProfitCenter},
		{[]string{"GET"}, "/api/admin/providers", "providersRead", "", adminBProvidersOverview},
		{[]string{"PUT"}, "/api/admin/providers/[id]/enabled", "providersWrite", "payment_provider_toggle", adminBPaymentProviderEnabled},
		{[]string{"GET", "PUT"}, "/api/admin/providers/[id]/env", "providersRead", "", adminBProviderEnv},
		{[]string{"PUT"}, "/api/admin/providers/[id]/secret", "providersWrite", "provider_secret_rotate", adminBProviderSecretRotate},
		{[]string{"POST"}, "/api/admin/providers/[id]/test", "providersRead", "provider_health_check", adminBProviderHealthCheck},
		{[]string{"GET"}, "/api/admin/providers/[id]/webhooks", "providersRead", "", adminBProviderWebhooks},
		{[]string{"GET", "PUT"}, "/api/admin/providers/email", "providersRead", "email_smtp_config", adminBEmailConfig},
		{[]string{"POST"}, "/api/admin/providers/email/diagnose", "providersRead", "email_smtp_diagnose", adminBEmailDiagnose},
		{[]string{"POST"}, "/api/admin/providers/email/health", "providersRead", "email_smtp_health", adminBEmailHealth},
		{[]string{"POST"}, "/api/admin/providers/email/test", "providersWrite", "email_smtp_test_send", adminBEmailTest},
		{[]string{"GET", "PUT"}, "/api/admin/providers/sms", "providersRead", "sms_provider_config", adminBSMSConfig},
		{[]string{"POST"}, "/api/admin/providers/sms/health", "providersRead", "sms_provider_health", adminBSMSHealth},
		{[]string{"PUT"}, "/api/admin/providers/sms/secrets", "providersWrite", "sms_provider_secret_rotate", adminBSMSSecrets},
		{[]string{"POST"}, "/api/admin/providers/sms/test", "providersWrite", "sms_provider_test_send", adminBSMSTest},
		{[]string{"GET", "PATCH"}, "/api/admin/routing", "modelsRead", "", adminBRoutingOverview},
		{[]string{"GET", "PATCH"}, "/api/admin/routing/[modelId]/channels", "modelsRead", "", adminBRoutingChannels},
		{[]string{"POST", "DELETE"}, "/api/admin/security/sessions/[hash]", "sessionsRevoke", "session_revoke_single", adminBRevokeSessionByHash},
		{[]string{"GET"}, "/api/admin/security/sessions", "sessionsRevoke", "", adminBListSessions},
		{[]string{"GET", "POST"}, "/api/admin/seo/config", "settingsWrite", "", adminBSEOSettings("site_seo")},
		{[]string{"GET", "POST"}, "/api/admin/seo/push", "settingsWrite", "", adminBSEOPush},
		{[]string{"GET", "POST"}, "/api/admin/seo/push/config", "settingsWrite", "", adminBSEOSettings("search_push_config")},
		{[]string{"GET", "POST"}, "/api/admin/settings", "settingsRead", "system_setting_update", adminBSystemSettings},
		{[]string{"GET", "POST"}, "/api/admin/storage", "storageRead", "storage_settings_save", adminBStorage},
		{[]string{"GET", "POST"}, "/api/admin/storage/bucket", "storageRead", "", adminBStorageBucket},
		{[]string{"GET"}, "/api/admin/subscription-faq", "plansRead", "", adminBSubscriptionFAQ},
		{[]string{"PUT"}, "/api/admin/subscription-faq", "plansWrite", "subscription_faq_update", adminBSubscriptionFAQ},
		{[]string{"GET"}, "/api/admin/subscriptions", "billingRead", "", adminBListRows("subscriptions")},
		{[]string{"GET"}, "/api/admin/system/logs", "healthRead", "", adminBSystemLogs},
		{[]string{"GET"}, "/api/admin/users", "usersRead", "", adminBListRows("users")},
		{[]string{"GET", "PATCH"}, "/api/admin/users/[id]", "usersRead", "user_status_update", adminBUserDetail},
		{[]string{"POST"}, "/api/admin/users/[id]/credits", "creditsAdjust", "credits_adjust", adminBAdjustCredits},
		{[]string{"POST"}, "/api/admin/users/[id]/notes", "usersNote", "user_note_create", adminBUserNote},
		{[]string{"POST", "DELETE"}, "/api/admin/users/[id]/sessions", "sessionsRevoke", "user_sessions_revoke", adminBRevokeUserSessions},
		{[]string{"POST"}, "/api/admin/users/[id]/tags", "usersUpdate", "user_tag_update", adminBUserTag},
		{[]string{"GET"}, "/api/admin/users/dashboard", "usersRead", "", adminBUserDashboard},
		{[]string{"GET", "POST"}, "/api/admin/visitors/analytics", "settingsWrite", "visitor_analytics_update", adminBVisitorAnalytics},
		{[]string{"GET", "POST"}, "/api/admin/visitors/analytics/ga4", "usersRead", "", adminBVisitorGA4},
		{[]string{"GET"}, "/api/admin/webhooks", "webhooksRead", "", adminBListRows("webhooks")},
		{[]string{"POST"}, "/api/admin/webhooks/[id]/replay", "webhooksReplay", "webhook_replay", adminBWebhookReplay},
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

func adminBDB(d *Dependencies, reqID string) (*pgxpool.Pool, *adminError) {
	if d == nil || d.Pool == nil {
		return nil, adminErr("DB_UNAVAILABLE", "持久数据服务暂不可用", http.StatusServiceUnavailable)
	}
	return d.Pool, nil
}

func adminBBody(r *http.Request, max int64, dst any) *adminError {
	if r.Body == nil {
		return nil
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, max+1))
	if err != nil {
		return adminErr("INVALID_JSON", "请求体读取失败", http.StatusBadRequest)
	}
	if int64(len(raw)) > max {
		return adminErr("PAYLOAD_TOO_LARGE", "请求体过大", http.StatusRequestEntityTooLarge)
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return adminErr("INVALID_JSON", "请求体必须为合法 JSON 数据", http.StatusBadRequest)
	}
	if err := json.Unmarshal(raw, dst); err != nil {
		return adminErr("INVALID_JSON", "请求体必须为合法 JSON 数据", http.StatusBadRequest)
	}
	return nil
}

// adminBBodyOptional is used by routes whose source does `request.json().catch(() => ({}))`:
// an empty or malformed body is treated as {} and validation produces the source's
// own VALIDATION_ERROR rather than an INVALID_JSON error.
func adminBBodyOptional(r *http.Request, max int64, dst any) {
	if r.Body == nil {
		return
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, max+1))
	if err != nil || int64(len(raw)) > max || len(strings.TrimSpace(string(raw))) == 0 {
		return
	}
	_ = json.Unmarshal(raw, dst)
}

// adminBResultErr mirrors resultErrorResponse in lib/admin/authz.js: messages
// containing 不存在 / 未找到 / 找不到 become NOT_FOUND 404, otherwise VALIDATION_ERROR 422.
func adminBResultErr(msg string) *adminError {
	if regexp.MustCompile(`不存在|未找到|找不到`).MatchString(msg) {
		return adminErr("NOT_FOUND", msg, http.StatusNotFound)
	}
	return adminErr("VALIDATION_ERROR", msg, http.StatusUnprocessableEntity)
}

func adminBActorEmail(u *middleware.SessionUser) string {
	if u != nil && u.Email != nil {
		return *u.Email
	}
	if u != nil {
		return u.ID
	}
	return "system"
}

func adminBNewID(prefix string) string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

// adminBRows converts pgx.Rows into []map[string]any with JSON-friendly values.
func adminBRows(rows pgx.Rows) ([]map[string]any, error) {
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
				row[fields[i].Name] = adminBJSONValue(v)
			}
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func adminBJSONValue(v any) any {
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
		return adminBFormatUUID(t)
	case fmt.Stringer:
		return t.String()
	default:
		return v
	}
}

func adminBFormatUUID(b [16]byte) string {
	h := hex.EncodeToString(b[:])
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

func adminBQueryRows(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) ([]map[string]any, error) {
	rows, err := pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return adminBRows(rows)
}

func adminBQueryOne(ctx context.Context, pool *pgxpool.Pool, sql string, args ...any) (map[string]any, bool, error) {
	rows, err := pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, false, err
	}
	all, err := adminBRows(rows)
	if err != nil {
		return nil, false, err
	}
	if len(all) == 0 {
		return nil, false, nil
	}
	return all[0], true, nil
}

func adminBInternal(err error, fallback string) *adminError {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return adminBResultErr("未找到对应记录")
	}
	return adminErr("INTERNAL_ERROR", fallback, http.StatusInternalServerError)
}

func adminBInt(r *http.Request, key string, def, min, max int) int {
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

// adminBPagedQuery mirrors lib/admin/pagination.js pagedQuery. `createdExpr` and
// `idExpr` are the SQL expressions used for keyset comparison and final ORDER BY;
// the caller supplies alias-qualified columns (e.g. "o.created_at", "o.id").
func adminBPagedQuery(ctx context.Context, pool *pgxpool.Pool, r *http.Request, baseSQL, createdExpr, idExpr string, args ...any) ([]map[string]any, map[string]any, error) {
	limit := adminBInt(r, "limit", 25, 1, 100)
	values := append([]any{}, args...)
	sql := baseSQL
	joiner := " WHERE "
	if strings.Contains(strings.ToUpper(sql), "WHERE") {
		joiner = " AND "
	}
	if cursorRaw := strings.TrimSpace(r.URL.Query().Get("cursor")); cursorRaw != "" {
		var cursor adminBCursor
		if decoded, err := adminBDecodeCursor(cursorRaw); err == nil {
			cursor = decoded
		} else if err := json.Unmarshal([]byte(cursorRaw), &cursor); err != nil {
			cursor = adminBCursor{}
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
	rows, err := adminBQueryRows(ctx, pool, sql, values...)
	if err != nil {
		return nil, nil, err
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	meta := map[string]any{"limit": limit, "hasMore": hasMore, "nextCursor": nil}
	if hasMore && len(rows) > 0 {
		meta["nextCursor"] = adminBEncodeCursor(rows[len(rows)-1], idExpr)
	}
	return rows, meta, nil
}

type adminBCursor struct {
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
}

func adminBLastCursorID(row map[string]any, idExpr string) string {
	name := idExpr
	if dot := strings.LastIndexByte(name, '.'); dot >= 0 {
		name = name[dot+1:]
	}
	v, _ := row[name].(string)
	return v
}

func adminBEncodeCursor(row map[string]any, idExpr string) string {
	id := adminBLastCursorID(row, idExpr)
	if id == "" {
		return ""
	}
	createdAt, _ := row["created_at"].(string)
	raw, _ := json.Marshal(adminBCursor{ID: id, CreatedAt: createdAt})
	return adminBBase64URL(raw)
}

func adminBDecodeCursor(s string) (adminBCursor, error) {
	var out adminBCursor
	raw, err := adminBUnbase64URL(s)
	if err != nil {
		return out, err
	}
	err = json.Unmarshal(raw, &out)
	return out, err
}

func adminBBase64URL(raw []byte) string {
	const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	var sb strings.Builder
	for i := 0; i < len(raw); i += 3 {
		var b [3]byte
		n := copy(b[:], raw[i:])
		v := uint32(b[0])<<16 | uint32(b[1])<<8 | uint32(b[2])
		sb.WriteByte(table[(v>>18)&63])
		sb.WriteByte(table[(v>>12)&63])
		if n > 1 {
			sb.WriteByte(table[(v>>6)&63])
		}
		if n > 2 {
			sb.WriteByte(table[v&63])
		}
	}
	return sb.String()
}

func adminBUnbase64URL(s string) ([]byte, error) {
	lookup := func(c byte) (uint32, bool) {
		switch {
		case c >= 'A' && c <= 'Z':
			return uint32(c - 'A'), true
		case c >= 'a' && c <= 'z':
			return uint32(c-'a') + 26, true
		case c >= '0' && c <= '9':
			return uint32(c-'0') + 52, true
		case c == '-':
			return 62, true
		case c == '_':
			return 63, true
		}
		return 0, false
	}
	var out []byte
	var acc uint32
	var bits int
	for i := 0; i < len(s); i++ {
		v, ok := lookup(s[i])
		if !ok {
			return nil, errors.New("invalid cursor")
		}
		acc = acc<<6 | v
		bits += 6
		if bits >= 8 {
			bits -= 8
			out = append(out, byte(acc>>bits))
		}
	}
	return out, nil
}

func adminBAudit(ctx context.Context, pool *pgxpool.Pool, u *middleware.SessionUser, action, targetType, targetID, risk, reqID string, after any) {
	actorID := "system"
	if u != nil && u.ID != "" {
		actorID = u.ID
	}
	svc := &admin.Service{Repo: &admin.PGRepository{Pool: pool}}
	_ = svc.RecordAudit(ctx, admin.AuditLogEntry{
		ID:         adminBNewID("aud"),
		ActorID:    actorID,
		ActorEmail: adminBActorEmail(u),
		Permission: action,
		TargetType: targetType,
		TargetID:   targetID,
		RiskLevel:  risk,
		AfterJSON:  after,
		RequestID:  reqID,
	})
}

// adminBWriteSetting upserts an ops_bill.system_settings row using the verified
// (key, value_json, visibility, version, updated_by, updated_at) shape.
func adminBWriteSetting(ctx context.Context, pool *pgxpool.Pool, key string, value any, visibility, actor string) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO ops_bill.system_settings (key, value_json, visibility, version, updated_by, updated_at)
		VALUES ($1, $2::jsonb, $3, 1, $4, now())
		ON CONFLICT (key) DO UPDATE SET
			value_json = excluded.value_json,
			visibility = excluded.visibility,
			version = system_settings.version + 1,
			updated_by = excluded.updated_by,
			updated_at = now()`, key, string(raw), visibility, actor)
	return err
}

func adminBReadSetting(ctx context.Context, pool *pgxpool.Pool, key string) (any, bool, error) {
	row, ok, err := adminBQueryOne(ctx, pool, `SELECT value_json FROM ops_bill.system_settings WHERE key = $1`, key)
	if err != nil || !ok {
		return nil, ok, err
	}
	return row["value_json"], true, nil
}

func adminBJSON(raw any) map[string]any {
	switch t := raw.(type) {
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

// ---------------------------------------------------------------------------
// /api/admin/models/health/reset
// lib/services/circuitBreaker.js resetProviderCircuit
// ---------------------------------------------------------------------------

func adminBHealthReset(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		ProviderID  string `json:"providerId"`
		ProviderID2 string `json:"provider_id"`
	}
	adminBBodyOptional(r, 32*1024, &body)
	providerID := firstNonEmpty(body.ProviderID, body.ProviderID2)
	if providerID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "请指定要重置熔断器的供应商 ID", 422)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	tag, err := pool.Exec(r.Context(), `
		UPDATE ai_studio.ai_providers
		SET circuit_state = 'closed', consecutive_failures = 0, circuit_opened_at = NULL,
		    health_status = 'healthy', updated_at = now()
		WHERE id = $1 OR slug = $1`, providerID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	return map[string]any{"success": true, "providerId": providerID, "circuit_state": "closed", "rowsAffected": tag.RowsAffected()}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/models/pricing — app/api/admin/models/pricing/route.js
// ---------------------------------------------------------------------------

func adminBModelPricing(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		rows, err := adminBQueryRows(r.Context(), pool, `
			SELECT m.id AS model_id,
			       COALESCE(m.display_name, m.name) AS model_name,
			       m.category, m.status AS model_status,
			       COALESCE(mp.pricing_type, 'fixed') AS pricing_type,
			       mp.base_credits, COALESCE(mp.formula_config, '{}'::jsonb) AS formula_config,
			       COALESCE(mp.min_credits, 10) AS min_credits,
			       GREATEST(COALESCE(mp.min_gross_margin_rate, 0.75), 0.75) AS min_gross_margin_rate,
			       COALESCE(mp.is_active, FALSE) AS is_active,
			       COALESCE(mp.updated_at, m.updated_at) AS updated_at
			FROM ai_studio.ai_models m
			LEFT JOIN ai_studio.model_pricing mp ON mp.model_id = m.id
			ORDER BY m.sort ASC, m.id ASC`)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		for _, row := range rows {
			row["subscriptionDiscounts"] = map[string]any{}
		}
		return map[string]any{"pricing": rows}, nil, nil
	}
	var body struct {
		ModelID             string         `json:"modelId"`
		ModelID2            string         `json:"model_id"`
		BaseCredits         *float64       `json:"baseCredits"`
		BaseCredits2        *float64       `json:"base_credits"`
		PricingType         string         `json:"pricingType"`
		PricingType2        string         `json:"pricing_type"`
		FormulaConfig       map[string]any `json:"formulaConfig"`
		FormulaConfig2      map[string]any `json:"formula_config"`
		MinCredits          *float64       `json:"minCredits"`
		MinCredits2         *float64       `json:"min_credits"`
		MinGrossMarginRate  *float64       `json:"minGrossMarginRate"`
		MinGrossMarginRate2 *float64       `json:"min_gross_margin_rate"`
		IsActive            *bool          `json:"isActive"`
		IsActive2           *bool          `json:"is_active"`
	}
	adminBBodyOptional(r, 64*1024, &body)
	modelID := firstNonEmpty(body.ModelID, body.ModelID2)
	if modelID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "modelId 为必填项", 422)
	}
	credits := 0.0
	switch {
	case body.BaseCredits != nil:
		credits = *body.BaseCredits
	case body.BaseCredits2 != nil:
		credits = *body.BaseCredits2
	}
	if credits != float64(int64(credits)) || credits <= 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "必须提供已核实的正整数积分价格", 422)
	}
	pricingType := firstNonEmpty(body.PricingType, body.PricingType2, "fixed")
	if pricingType != "fixed" && pricingType != "formula" {
		return nil, nil, adminErr("VALIDATION_ERROR", "pricing_type 必须为 fixed 或 formula", 422)
	}
	formula := body.FormulaConfig
	if formula == nil {
		formula = body.FormulaConfig2
	}
	if formula == nil {
		formula = map[string]any{}
	}
	formulaRaw, _ := json.Marshal(formula)
	minCredits := 10.0
	if body.MinCredits != nil {
		minCredits = *body.MinCredits
	} else if body.MinCredits2 != nil {
		minCredits = *body.MinCredits2
	}
	minRate := 0.75
	if body.MinGrossMarginRate != nil && *body.MinGrossMarginRate > minRate {
		minRate = *body.MinGrossMarginRate
	}
	if body.MinGrossMarginRate2 != nil && *body.MinGrossMarginRate2 > minRate {
		minRate = *body.MinGrossMarginRate2
	}
	active := true
	if body.IsActive != nil {
		active = *body.IsActive
	}
	if body.IsActive2 != nil {
		active = *body.IsActive2
	}
	before, _, err := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.model_pricing WHERE model_id = $1`, modelID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	_, err = pool.Exec(r.Context(), `
		INSERT INTO ai_studio.model_pricing
			(id, model_id, pricing_type, base_credits, formula_config, subscription_discounts,
			 min_credits, min_gross_margin_rate, is_active, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5::jsonb,'{}'::jsonb,$6,$7,$8,now(),now())
		ON CONFLICT (model_id) DO UPDATE SET
			pricing_type = excluded.pricing_type, base_credits = excluded.base_credits,
			formula_config = excluded.formula_config, subscription_discounts = '{}'::jsonb,
			min_credits = excluded.min_credits, min_gross_margin_rate = excluded.min_gross_margin_rate,
			is_active = excluded.is_active, updated_at = now()`,
		adminBNewID("mp"), modelID, pricingType, int64(credits), string(formulaRaw), int64(minCredits), minRate, active)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	updated, _, err := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.model_pricing WHERE model_id = $1`, modelID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "models.pricing_update", "model_pricing", modelID, "high", reqID,
		map[string]any{"before": before, "after": updated})
	return map[string]any{"pricing": updated}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/models/pricing/strategy — lib/services/pricingStrategy.js
// ---------------------------------------------------------------------------

func adminBPricingStrategy(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	strategySQL := `
		SELECT id, base_multiplier, min_margin_rate, category_multipliers,
		       tier_multipliers, spec_multipliers, rounding_strategy, is_active, updated_at
		FROM ai_studio.pricing_strategy WHERE is_active = TRUE
		ORDER BY updated_at DESC LIMIT 1`
	if r.Method == http.MethodGet {
		strategy, ok, err := adminBQueryOne(r.Context(), pool, strategySQL)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if !ok {
			strategy = map[string]any{"id": nil, "base_multiplier": 1.5, "min_margin_rate": 0.30,
				"category_multipliers": map[string]any{}, "tier_multipliers": map[string]any{},
				"spec_multipliers": map[string]any{}, "rounding_strategy": "ceil_to_0.01"}
		}
		return map[string]any{"strategy": strategy}, nil, nil
	}
	before, _, err := adminBQueryOne(r.Context(), pool, strategySQL)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	var body struct {
		BaseMultiplier      *float64       `json:"baseMultiplier"`
		MinMarginRate       *float64       `json:"minMarginRate"`
		CategoryMultipliers map[string]any `json:"categoryMultipliers"`
		TierMultipliers     map[string]any `json:"tierMultipliers"`
		SpecMultipliers     map[string]any `json:"specMultipliers"`
	}
	adminBBodyOptional(r, 64*1024, &body)
	if body.BaseMultiplier == nil || *body.BaseMultiplier < 1 {
		return nil, nil, adminErr("VALIDATION_ERROR", "基准倍率不能小于 1", 400)
	}
	if body.MinMarginRate == nil || *body.MinMarginRate < 0.1 || *body.MinMarginRate > 0.9 {
		return nil, nil, adminErr("VALIDATION_ERROR", "最低毛利率应在 10%-90% 之间", 400)
	}
	marshal := func(m map[string]any) string {
		if m == nil {
			m = map[string]any{}
		}
		raw, _ := json.Marshal(m)
		return string(raw)
	}
	id := adminBNewID("ps")
	_, err = pool.Exec(r.Context(), `
		UPDATE ai_studio.pricing_strategy SET is_active = FALSE WHERE is_active = TRUE`,
	)
	if err == nil {
		_, err = pool.Exec(r.Context(), `
			INSERT INTO ai_studio.pricing_strategy
				(id, name, base_multiplier, min_margin_rate, category_multipliers,
				 tier_multipliers, spec_multipliers, is_active, updated_at, created_at)
			VALUES ($1,'default',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,TRUE,now(),now())`,
			id, *body.BaseMultiplier, *body.MinMarginRate,
			marshal(body.CategoryMultipliers), marshal(body.TierMultipliers), marshal(body.SpecMultipliers))
	}
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	result, _, err := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.pricing_strategy WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "models.pricing_strategy_update", "pricing_strategy", id, "high", reqID,
		map[string]any{"before": before, "after": result})
	return map[string]any{"strategy": result, "message": "定价策略已保存"}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/models/providers — app/api/admin/models/providers/route.js
// ---------------------------------------------------------------------------

func adminBModelProviders(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		providers, err := adminBQueryRows(r.Context(), pool, `
			SELECT p.*, COALESCE(s.cnt, 0) AS secrets_count,
			       COALESCE(s.configured, FALSE) AS has_api_key
			FROM ai_studio.ai_providers p
			LEFT JOIN LATERAL (
				SELECT COUNT(*) AS cnt,
				       BOOL_OR(name = 'api_key') AS configured
				FROM ops_bill.provider_secrets ps WHERE ps.provider = p.id
			) s ON TRUE
			ORDER BY p.priority ASC, p.id ASC`)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		for _, p := range providers {
			p["maskedApiKey"] = ""
			p["storedSecrets"] = []any{}
			p["envNames"] = []any{}
			if configured, _ := p["has_api_key"].(bool); configured {
				p["maskedApiKey"] = "••••••••"
			}
			if url, ok := p["model_catalog_api_url"].(string); !ok || url == "" {
				p["modelCatalogApiUrl"] = ""
			} else {
				p["modelCatalogApiUrl"] = url
			}
		}
		return map[string]any{"providers": providers}, nil, nil
	}
	if r.Method == http.MethodDelete {
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "请指定要删除的供应商 ID", 422)
		}
		var related int
		if err := pool.QueryRow(r.Context(), `SELECT COUNT(*)::int FROM ai_studio.provider_models WHERE provider_id = $1`, id).Scan(&related); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if related > 0 {
			return nil, nil, adminErr("VALIDATION_ERROR", "供应商仍有关联渠道映射，不能删除", 422)
		}
		tag, err := pool.Exec(r.Context(), `DELETE FROM ai_studio.ai_providers WHERE id = $1`, id)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if tag.RowsAffected() == 0 {
			return nil, nil, adminBResultErr("未找到对应的供应商")
		}
		adminBAudit(r.Context(), pool, u, "providers.delete", "provider", id, "high", reqID, map[string]any{"id": id})
		return map[string]any{"success": true, "id": id}, nil, nil
	}
	var body struct {
		ID            string         `json:"id"`
		Name          string         `json:"name"`
		Slug          string         `json:"slug"`
		ProviderType  string         `json:"provider_type"`
		ProviderType2 string         `json:"providerType"`
		Enabled       *bool          `json:"enabled"`
		Priority      *int           `json:"priority"`
		BaseURL       string         `json:"base_url"`
		BaseURL2      string         `json:"baseUrl"`
		CatalogURL    *string        `json:"modelCatalogApiUrl"`
		CatalogURL2   *string        `json:"model_catalog_api_url"`
		APIMode       string         `json:"api_mode"`
		APIMode2      string         `json:"apiMode"`
		Balance       *float64       `json:"balance"`
		Currency      string         `json:"currency"`
		Metadata      map[string]any `json:"metadata"`
		APIKey        string         `json:"apiKey"`
	}
	adminBBodyOptional(r, 128*1024, &body)
	id := strings.ToLower(strings.TrimSpace(body.ID))
	if id == "" || strings.TrimSpace(body.Name) == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "供应商 ID 与名称为必填项", 422)
	}
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	priority := 100
	if body.Priority != nil {
		priority = *body.Priority
	}
	providerType := firstNonEmpty(body.ProviderType, body.ProviderType2, "aggregator")
	if providerType != "official" && providerType != "aggregator" && providerType != "direct" {
		return nil, nil, adminErr("VALIDATION_ERROR", "provider_type 必须为 aggregator/official/direct", 422)
	}
	apiMode := firstNonEmpty(body.APIMode, body.APIMode2, "async")
	if apiMode != "async" && apiMode != "sync" && apiMode != "stream" {
		return nil, nil, adminErr("VALIDATION_ERROR", "api_mode 必须为 async/sync/stream", 422)
	}
	catalogURL := ""
	if body.CatalogURL != nil {
		catalogURL = *body.CatalogURL
	} else if body.CatalogURL2 != nil {
		catalogURL = *body.CatalogURL2
	}
	metadata := body.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadataRaw, _ := json.Marshal(metadata)
	balance := 0.0
	if body.Balance != nil {
		balance = *body.Balance
	}
	currency := firstNonEmpty(body.Currency, "USD")
	slug := firstNonEmpty(body.Slug, id)
	baseURL := firstNonEmpty(body.BaseURL, body.BaseURL2)
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ai_studio.ai_providers
			(id, slug, name, provider_type, enabled, priority, base_url, api_mode,
			 model_catalog_api_url, balance, currency, metadata, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,now(),now())
		ON CONFLICT (id) DO UPDATE SET
			name = excluded.name, provider_type = excluded.provider_type, enabled = excluded.enabled,
			priority = excluded.priority, base_url = excluded.base_url, api_mode = excluded.api_mode,
			model_catalog_api_url = excluded.model_catalog_api_url, balance = excluded.balance,
			currency = excluded.currency, metadata = excluded.metadata, updated_at = now()`,
		id, slug, body.Name, providerType, enabled, priority, baseURL, apiMode,
		catalogURL, balance, currency, string(metadataRaw))
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if strings.TrimSpace(body.APIKey) != "" {
		secretKey := d.Config.ProviderSecretKey()
		if secretKey == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "未配置 PROVIDER_SECRETS_ENCRYPTION_KEY，拒绝明文写入密钥", 422)
		}
		execFn := func(ctx context.Context, sql string, args ...any) error {
			_, e := pool.Exec(ctx, sql, args...)
			return e
		}
		if err := seckey.SaveProviderSecret(r.Context(), execFn, secretKey, id, "api_key", strings.TrimSpace(body.APIKey)); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		_, _ = pool.Exec(r.Context(), `
			UPDATE ai_studio.ai_providers
			SET circuit_state = 'closed', consecutive_failures = 0, circuit_opened_at = NULL, updated_at = now()
			WHERE id = $1`, id)
		adminBAudit(r.Context(), pool, u, "providers.api_key_rotated", "provider", id, "high", reqID,
			map[string]any{"secretName": "api_key", "stored": true})
	}
	saved, _, err := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.ai_providers WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "providers.upsert", "provider", id, "medium", reqID, saved)
	return map[string]any{"provider": saved}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/models/publication — lib/services/modelPublication.js
// ---------------------------------------------------------------------------

func adminBValidPublicationPolicy(policy map[string]any) bool {
	// Mirrors validateModelPublicationPolicy in lib/modelCenter/publicationPolicy.js.
	if policy == nil {
		return false
	}
	sites, ok := policy["sites"].([]any)
	if !ok || len(sites) == 0 {
		return false
	}
	seen := make(map[string]bool, len(sites))
	for _, raw := range sites {
		v, _ := raw.(string)
		if (v != "main" && v != "canvas") || seen[v] {
			return false
		}
		seen[v] = true
	}
	audience, _ := policy["audience"].(string)
	if audience != "all" && audience != "paid" && audience != "allowlist" {
		return false
	}
	userIDs, ok := policy["userIds"].([]any)
	if !ok {
		return false
	}
	for _, raw := range userIDs {
		v, _ := raw.(string)
		if !regexp.MustCompile(`^[0-9]+$`).MatchString(v) {
			return false
		}
	}
	return audience != "allowlist" || len(userIDs) > 0
}

func adminBPolicyHasSite(policy map[string]any, site string) bool {
	sites, _ := policy["sites"].([]any)
	for _, raw := range sites {
		if v, _ := raw.(string); v == site {
			return true
		}
	}
	return false
}

func adminBModelPublication(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		Action  string         `json:"action"`
		ModelID string         `json:"modelId"`
		Policy  map[string]any `json:"policy"`
	}
	adminBBodyOptional(r, 64*1024, &body)
	valid := map[string]bool{"inspect": true, "read_test": true, "prepare_test": true,
		"quote_test": true, "submit_test": true, "record_test": true, "publish": true}
	if !valid[body.Action] || strings.TrimSpace(body.ModelID) == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "请选择模型及有效操作", 422)
	}
	readOnly := body.Action == "inspect" || body.Action == "read_test"
	if !readOnly && !middleware.HasPermission(u.Role, adminPermission("modelsWrite")) {
		return nil, nil, adminErr("FORBIDDEN", "权限不足：当前角色无权执行 models.write 操作", 403)
	}
	if !readOnly {
		key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
		if len(key) < 8 || len(key) > 200 {
			return nil, nil, adminErr("IDEMPOTENCY_REQUIRED", "操作必须携带幂等标识", 422)
		}
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	model, ok, err := adminBQueryOne(r.Context(), pool, `
		SELECT id, name, display_name, category, status, tier, is_visible, capabilities
		FROM ai_studio.ai_models WHERE id = $1`, body.ModelID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !ok {
		return nil, nil, adminErr("MODEL_NOT_FOUND", "模型不存在", 422)
	}
	switch body.Action {
	case "inspect", "read_test":
		pricing, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.model_pricing WHERE model_id = $1`, body.ModelID)
		channels, _ := adminBQueryRows(r.Context(), pool, `SELECT id, provider_id, enabled FROM ai_studio.provider_models WHERE model_id = $1`, body.ModelID)
		return map[string]any{"model": model, "pricing": pricing, "channels": channels, "action": body.Action}, nil, nil
	case "publish":
		// Validates policy, active pricing, and enabled provider channels before publishing
		// and mirrors publication policy into canvas_model_config when mounted on canvas.
		if !adminBValidPublicationPolicy(body.Policy) {
			return nil, nil, adminErr("MODEL_SCOPE_INVALID", "请选择有效站点及用户开放范围", 422)
		}
		_, hasPricing, err := adminBQueryOne(r.Context(), pool, `SELECT model_id FROM ai_studio.model_pricing WHERE model_id = $1 AND is_active = TRUE`, body.ModelID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		channels, err := adminBQueryRows(r.Context(), pool, `SELECT id FROM ai_studio.provider_models WHERE model_id = $1 AND enabled = TRUE`, body.ModelID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if !hasPricing || len(channels) == 0 {
			return nil, nil, adminErr("MODEL_PUBLICATION_BLOCKED", "发布检查未通过，请完成所有阻塞项", 422)
		}
		capabilities := adminBJSON(model["capabilities"])
		capabilities["publicationPolicy"] = body.Policy
		_, err = pool.Exec(r.Context(), `
			UPDATE ai_studio.ai_models
			SET status = 'active', tier = 'core', is_visible = TRUE,
			    auto_route_eligible = TRUE, capabilities = $2::jsonb, updated_at = now()
			WHERE id = $1`, body.ModelID, adminBMustJSON(capabilities))
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		canvasMounted := adminBPolicyHasSite(body.Policy, "canvas")
		if canvasCfgRaw, ok, cfgErr := adminBReadSetting(r.Context(), pool, "canvas_model_config"); cfgErr == nil && ok {
			canvasCfg := adminBJSON(canvasCfgRaw)
			if canvasMounted {
				canvasCfg["activeModelId"] = body.ModelID
			}
			_ = adminBWriteSetting(r.Context(), pool, "canvas_model_config", canvasCfg, "private", adminBActorEmail(u))
		}
		adminBAudit(r.Context(), pool, u, "model.publish", "model", body.ModelID, "high", reqID, body.Policy)
		return map[string]any{"published": true, "policy": body.Policy, "canvasMounted": canvasMounted}, nil, nil
	default:
		return nil, nil, adminErr("MODEL_PUBLICATION_FAILED", "不支持的模型发布动作或请先完成前置测试", 422)
	}
}

// ---------------------------------------------------------------------------
// /api/admin/models/routing — app/api/admin/models/routing/route.js
// ---------------------------------------------------------------------------

func adminBModelRouting(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		modelID := strings.TrimSpace(r.URL.Query().Get("modelId"))
		models, err := adminBQueryRows(r.Context(), pool, `SELECT * FROM ai_studio.ai_models ORDER BY sort ASC, id ASC`)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		providers, err := adminBQueryRows(r.Context(), pool, `SELECT * FROM ai_studio.ai_providers ORDER BY priority ASC, id ASC`)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if modelID == "" {
			return map[string]any{"models": models, "providers": providers}, nil, nil
		}
		canonical, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.ai_models WHERE id = $1`, modelID)
		channels, err := adminBQueryRows(r.Context(), pool, `SELECT * FROM ai_studio.provider_models WHERE model_id = $1 ORDER BY priority DESC, id ASC`, modelID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		policy, ok, err := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.routing_policies WHERE model_id = $1`, modelID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if !ok {
			policy = map[string]any{"model_id": modelID, "routing_mode": "balanced",
				"weights":                map[string]any{"cost": 0.4, "success_rate": 0.3, "speed": 0.2, "capacity": 0.1},
				"circuit_breaker_config": map[string]any{"failure_threshold": 3, "cooling_period_sec": 60},
				"failover_enabled":       true}
		}
		return map[string]any{"canonicalModel": canonical, "providerModels": channels,
			"routingPolicy": policy, "availableProviders": providers}, nil, nil
	}
	if r.Method == http.MethodDelete {
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "请指定要删除的渠道映射 ID", 422)
		}
		tag, err := pool.Exec(r.Context(), `DELETE FROM ai_studio.provider_models WHERE id = $1`, id)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if tag.RowsAffected() == 0 {
			return nil, nil, adminBResultErr("未找到对应的渠道映射")
		}
		adminBAudit(r.Context(), pool, u, "models.channel_mapping_delete", "provider_model", id, "medium", reqID, map[string]any{"id": id})
		return map[string]any{"success": true, "id": id}, nil, nil
	}
	var body struct {
		Type string         `json:"type"`
		Data map[string]any `json:"data"`
	}
	adminBBodyOptional(r, 128*1024, &body)
	if body.Type == "" {
		body.Type = "provider_model"
	}
	if body.Type == "policy" {
		modelID, _ := body.Data["model_id"].(string)
		if strings.TrimSpace(modelID) == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "model_id 为必填项", 422)
		}
		mode, _ := body.Data["routing_mode"].(string)
		if mode == "" {
			mode = "balanced"
		}
		weightsRaw, _ := json.Marshal(body.Data["weights"])
		if body.Data["weights"] == nil {
			weightsRaw = []byte(`{"cost":0.4,"success_rate":0.3,"speed":0.2,"capacity":0.1}`)
		}
		failover := true
		if v, ok := body.Data["failover_enabled"].(bool); ok {
			failover = v
		}
		_, err := pool.Exec(r.Context(), `
			INSERT INTO ai_studio.routing_policies
				(id, model_id, routing_mode, weights, failover_enabled, created_at, updated_at)
			VALUES ($1,$2,$3,$4::jsonb,$5,now(),now())
			ON CONFLICT (model_id) DO UPDATE SET
				routing_mode = excluded.routing_mode, weights = excluded.weights,
				failover_enabled = excluded.failover_enabled, updated_at = now()`,
			adminBNewID("rp"), modelID, mode, string(weightsRaw), failover)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		updated, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.routing_policies WHERE model_id = $1`, modelID)
		adminBAudit(r.Context(), pool, u, "models.routing_policy_update", "routing_policy", modelID, "medium", reqID, updated)
		return map[string]any{"routingPolicy": updated}, nil, nil
	}
	modelID, _ := body.Data["model_id"].(string)
	providerID, _ := body.Data["provider_id"].(string)
	providerModelID, _ := body.Data["provider_model_id"].(string)
	if modelID == "" || providerID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "model_id 与 provider_id 均为必填项", 422)
	}
	if providerModelID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "provider_model_id 为必填项", 422)
	}
	enabled := true
	if v, ok := body.Data["enabled"].(bool); ok {
		enabled = v
	}
	priority := 100
	if v, ok := body.Data["priority"].(float64); ok {
		priority = int(v)
	}
	id := adminBNewID("pm")
	if v, _ := body.Data["id"].(string); v != "" {
		id = v
	}
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ai_studio.provider_models
			(id, model_id, provider_id, provider_model_id, enabled, priority, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,now(),now())
		ON CONFLICT (model_id, provider_id, provider_model_id) DO UPDATE SET
			enabled = excluded.enabled, priority = excluded.priority, updated_at = now()`,
		id, modelID, providerID, providerModelID, enabled, priority)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	updated, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.provider_models WHERE model_id = $1 AND provider_id = $2 AND provider_model_id = $3`, modelID, providerID, providerModelID)
	adminBAudit(r.Context(), pool, u, "models.channel_mapping_upsert", "provider_model", id, "medium", reqID, updated)
	return map[string]any{"providerModel": updated}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/models/routing/test
// ---------------------------------------------------------------------------

func adminBRoutingTest(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		ChannelID  string `json:"channelId"`
		ChannelID2 string `json:"channel_id"`
	}
	adminBBodyOptional(r, 32*1024, &body)
	channelID := firstNonEmpty(body.ChannelID, body.ChannelID2)
	if channelID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "请指定要测试的渠道 ID (channelId)", 422)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	channel, ok, err := adminBQueryOne(r.Context(), pool, `
		SELECT pm.id, pm.provider_id, pm.provider_model_id, p.enabled, p.health_status
		FROM ai_studio.provider_models pm
		JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
		WHERE pm.id = $1`, channelID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !ok {
		return nil, nil, adminErr("NOT_FOUND", "未找到对应的供应商模型渠道", 404)
	}
	start := time.Now()
	providerID, _ := channel["provider_id"].(string)
	probe, probeErr := d.generationSvc(pool).ProbeProvider(r.Context(), providerID)
	if probeErr != nil {
		return nil, nil, adminBInternal(probeErr, "渠道探测失败")
	}
	okBool, _ := probe["ok"].(bool)
	enabled, _ := channel["enabled"].(bool)
	health, _ := probe["healthStatus"].(string)
	success := enabled && okBool
	return map[string]any{
		"success":         success,
		"channelId":       channelID,
		"providerId":      providerID,
		"providerModelId": channel["provider_model_id"],
		"latencyMs":       probe["latencyMs"],
		"elapsedMs":       time.Since(start).Milliseconds(),
		"message":         fmt.Sprintf("渠道探测结果 (%s): %v", health, probe["message"]),
		"details":         probe,
	}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/models/telemetry — lib/services/modelTelemetry.js
// ---------------------------------------------------------------------------

func adminBModelTelemetry(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	timeRange := firstNonEmpty(r.URL.Query().Get("timeRange"), r.URL.Query().Get("range"), "24h")
	interval := "INTERVAL '24 hours'"
	switch timeRange {
	case "7d":
		interval = "INTERVAL '7 days'"
	case "30d":
		interval = "INTERVAL '30 days'"
	}
	limit := adminBInt(r, "limit", 50, 1, 100)
	if limit < 5 {
		limit = 5
	}
	kpi, _, err := adminBQueryOne(r.Context(), pool, `
		SELECT
			COUNT(att.id)::int AS total_calls,
			COALESCE(SUM(CASE WHEN att.status = 'succeeded' THEN 1 ELSE 0 END), 0)::int AS success_calls,
			COALESCE(SUM(CASE WHEN att.status IN ('failed','timeout') THEN 1 ELSE 0 END), 0)::int AS failed_calls,
			COALESCE(ROUND(AVG(att.duration_ms) FILTER (WHERE att.duration_ms > 0)), 0)::int AS avg_duration_ms,
			COALESCE(ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY att.duration_ms) FILTER (WHERE att.duration_ms > 0))::numeric, 0)::int AS p50_duration_ms,
			COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY att.duration_ms) FILTER (WHERE att.duration_ms > 0))::numeric, 0)::int AS p90_duration_ms,
			COALESCE(SUM(att.actual_cost_usd), 0)::numeric(18,4) AS total_cost_usd,
			COALESCE(SUM(c.credit_cost), 0)::int AS total_credits_deducted,
			COUNT(DISTINCT COALESCE(c.model, att.provider_model_id))::int AS active_models_count
		FROM ai_studio.generation_attempts att
		LEFT JOIN ai_studio.creations c ON c.id = att.creation_id
		WHERE att.created_at >= NOW() - `+interval)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	topModels, err := adminBQueryRows(r.Context(), pool, `
		SELECT COALESCE(m.id, c.model, att.provider_model_id, 'unknown') AS model_id,
		       COALESCE(m.display_name, m.name, c.model, att.provider_model_id, '未知模型') AS model_name,
		       COALESCE(m.category, 'image') AS category,
		       COALESCE(m.tier, 'backup') AS tier,
		       COALESCE(m.is_visible, TRUE) AS is_visible,
		       COUNT(att.id)::int AS total_calls,
		       COALESCE(SUM(CASE WHEN att.status = 'succeeded' THEN 1 ELSE 0 END), 0)::int AS success_calls,
		       CASE WHEN COUNT(att.id) > 0
		            THEN ROUND((SUM(CASE WHEN att.status = 'succeeded' THEN 1 ELSE 0 END)::numeric / COUNT(att.id)::numeric) * 100, 1)
		            ELSE 100 END AS success_rate,
		       COALESCE(ROUND(AVG(att.duration_ms) FILTER (WHERE att.duration_ms > 0)), 0)::int AS avg_duration_ms,
		       COALESCE(SUM(att.actual_cost_usd), 0)::numeric(18,4) AS cost_usd,
		       COALESCE(SUM(c.credit_cost), 0)::int AS credits_deducted
		FROM ai_studio.generation_attempts att
		LEFT JOIN ai_studio.creations c ON c.id = att.creation_id
		LEFT JOIN ai_studio.ai_models m ON m.id = c.model OR m.slug = c.model
		WHERE att.created_at >= NOW() - `+interval+`
		GROUP BY 1, 2, 3, 4, 5
		ORDER BY total_calls DESC LIMIT $1`, limit)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	errors, err := adminBQueryRows(r.Context(), pool, `
		SELECT COALESCE(att.error_code, 'UNKNOWN') AS error_code,
		       COALESCE(att.error_reason, '未捕获原因') AS error_reason,
		       COUNT(att.id)::int AS count
		FROM ai_studio.generation_attempts att
		WHERE att.status IN ('failed','timeout') AND att.created_at >= NOW() - `+interval+`
		GROUP BY att.error_code, att.error_reason ORDER BY count DESC LIMIT 50`)
	if err != nil {
		return nil, nil, adminBInternal(err, "读取模型失败归因失败，请稍后重试")
	}
	return map[string]any{"timeRange": timeRange, "kpi": kpi,
		"topModels": topModels, "errorTaxonomy": errors, "limit": limit}, nil, nil
}

// ---------------------------------------------------------------------------
// Shared paged list handlers (lib/services/adminRead.js + repositories/*.js)
// ---------------------------------------------------------------------------

func adminBListRows(kind string) adminHandler {
	return func(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
		pool, ae := adminBDB(d, reqID)
		if ae != nil {
			return nil, nil, ae
		}
		q := r.URL.Query()
		like := "%" + strings.TrimSpace(q.Get("q")) + "%"
		var sql string
		var args []any
		idCol := "id"
		switch kind {
		case "users":
			sql = `SELECT id, user_number, email, phone, phone_country_code, display_name, avatar_url,
			              role, credits, status, registration_source, last_login_ip, last_login_at, created_at
			       FROM auth_usr.users WHERE 1=1`
			if strings.TrimSpace(q.Get("q")) != "" {
				sql += ` AND (email ILIKE $1 OR id ILIKE $1 OR display_name ILIKE $1 OR phone ILIKE $1 OR user_number::text ILIKE $1)`
				args = append(args, like)
			}
			if v := strings.TrimSpace(q.Get("role")); v != "" {
				sql += fmt.Sprintf(` AND role = $%d`, len(args)+1)
				args = append(args, v)
			}
			if v := strings.TrimSpace(q.Get("status")); v != "" {
				sql += fmt.Sprintf(` AND status = $%d`, len(args)+1)
				args = append(args, v)
			}
			sql += ` ORDER BY created_at DESC, id DESC`
		case "orders":
			idCol = "o.id"
			sql = `SELECT o.id, o.user_id, o.provider, o.plan_id, o.status, o.amount_minor, o.currency,
			              o.provider_order_id, o.failure_code, o.paid_at, o.refunded_at, o.created_at, o.updated_at, u.email
			       FROM ops_bill.orders o JOIN auth_usr.users u ON u.id = o.user_id WHERE 1=1`
			if strings.TrimSpace(q.Get("q")) != "" {
				sql += ` AND (u.email ILIKE $1 OR o.user_id ILIKE $1 OR o.id ILIKE $1 OR o.provider_order_id ILIKE $1)`
				args = append(args, like)
			}
			if v := strings.TrimSpace(q.Get("status")); v != "" {
				sql += fmt.Sprintf(` AND o.status = $%d`, len(args)+1)
				args = append(args, v)
			}
			if v := strings.TrimSpace(q.Get("provider")); v != "" {
				sql += fmt.Sprintf(` AND o.provider = $%d`, len(args)+1)
				args = append(args, v)
			}
			sql += ` ORDER BY o.created_at DESC, o.id DESC`
		case "subscriptions":
			idCol = "s.id"
			sql = `SELECT s.id, s.user_id, s.provider, s.plan_id, s.status, s.current_period_end,
			              s.cancel_at_period_end, s.created_at, s.updated_at, u.email
			       FROM ops_bill.subscriptions s JOIN auth_usr.users u ON u.id = s.user_id WHERE 1=1`
			if strings.TrimSpace(q.Get("q")) != "" {
				sql += ` AND (u.email ILIKE $1 OR s.user_id ILIKE $1 OR s.id ILIKE $1)`
				args = append(args, like)
			}
			if v := strings.TrimSpace(q.Get("status")); v != "" {
				sql += fmt.Sprintf(` AND s.status = $%d`, len(args)+1)
				args = append(args, v)
			}
			sql += ` ORDER BY s.created_at DESC, s.id DESC`
		case "moderation":
			idCol = "m.id"
			sql = `SELECT m.id, m.creation_id, m.status, m.reason_code, m.resolution, m.reviewer_id,
			              m.notes, m.reviewed_at, m.created_at, c.studio_id, c.label, c.result_url, c.user_id, u.email
			       FROM ops_bill.moderation_cases m
			       JOIN ai_studio.creations c ON c.id = m.creation_id
			       JOIN auth_usr.users u ON u.id = c.user_id WHERE 1=1`
			if v := strings.TrimSpace(q.Get("status")); v != "" {
				sql += ` AND m.status = $1`
				args = append(args, v)
			}
			sql += ` ORDER BY m.created_at DESC, m.id DESC`
		case "webhooks":
			idCol = "event_id"
			sql = `SELECT provider, event_id, event_type, status, attempts, last_error,
			              payload_json, processed_at, created_at
			       FROM ops_bill.webhook_events WHERE 1=1`
			if v := strings.TrimSpace(q.Get("provider")); v != "" {
				sql += fmt.Sprintf(` AND provider = $%d`, len(args)+1)
				args = append(args, v)
			}
			if v := strings.TrimSpace(q.Get("status")); v != "" {
				sql += fmt.Sprintf(` AND status = $%d`, len(args)+1)
				args = append(args, v)
			}
			if strings.TrimSpace(q.Get("q")) != "" {
				sql += fmt.Sprintf(` AND (event_id ILIKE $%d OR provider ILIKE $%d)`, len(args)+1, len(args)+2)
				args = append(args, like, like)
			}
			sql += ` ORDER BY created_at DESC, event_id DESC`
		default:
			return nil, nil, adminErr("INTERNAL_ERROR", "管理操作暂时不可用，请稍后重试", 500)
		}
		// adminBPagedQuery appends its own ORDER BY; strip the one above to avoid duplicates.
		if idx := strings.Index(strings.ToUpper(sql), " ORDER BY "); idx >= 0 {
			sql = sql[:idx]
		}
		createdExpr, idExpr := "created_at", idCol
		switch idCol {
		case "o.id":
			createdExpr = "o.created_at"
		case "s.id":
			createdExpr = "s.created_at"
		case "m.id":
			createdExpr = "m.created_at"
		}
		rows, meta, err := adminBPagedQuery(r.Context(), pool, r, sql, createdExpr, idExpr, args...)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		return rows, meta, nil
	}
}

// ---------------------------------------------------------------------------
// /api/admin/moderation/[id]/resolve — lib/services/moderation.js
// ---------------------------------------------------------------------------

func adminBResolveModeration(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		Resolution string `json:"resolution"`
		Notes      string `json:"notes"`
	}
	adminBBodyOptional(r, 32*1024, &body)
	if body.Resolution != "approved" && body.Resolution != "rejected" && body.Resolution != "dismissed" {
		return nil, nil, adminBResultErr("审核判定状态无效")
	}
	caseID := strings.TrimSpace(r.PathValue("id"))
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	existing, ok, err := adminBQueryOne(r.Context(), pool, `SELECT id, status FROM ops_bill.moderation_cases WHERE id = $1`, caseID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !ok {
		return nil, nil, adminBResultErr("审核案件不存在")
	}
	status := "rejected"
	if body.Resolution == "approved" {
		status = "approved"
	}
	_, err = pool.Exec(r.Context(), `
		UPDATE ops_bill.moderation_cases
		SET status = $1, resolution = $2, reviewer_id = $3, notes = $4, reviewed_at = now()
		WHERE id = $5`, status, body.Resolution, u.ID, body.Notes, caseID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	updated, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ops_bill.moderation_cases WHERE id = $1`, caseID)
	adminBAudit(r.Context(), pool, u, "moderation.resolve", "moderation_case", caseID, "medium", reqID,
		map[string]any{"before": existing["status"], "after": status, "resolution": body.Resolution, "notes": body.Notes})
	return map[string]any{"moderationCase": updated}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/orders/[id]/refund — lib/services/billing.js processOrderRefund
// ---------------------------------------------------------------------------

func adminBOrderRefund(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		Reason string `json:"reason"`
	}
	adminBBodyOptional(r, 32*1024, &body)
	orderID := strings.TrimSpace(r.PathValue("id"))
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	order, ok, err := adminBQueryOne(r.Context(), pool, `
		SELECT o.*, u.email FROM ops_bill.orders o JOIN auth_usr.users u ON u.id = o.user_id WHERE o.id = $1`, orderID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !ok {
		return nil, nil, adminBResultErr("未找到对应订单")
	}
	if order["status"] == "refunded" {
		return nil, nil, adminBResultErr("该订单已处于退款状态")
	}
	res, err := d.billingService().RefundOrder(r.Context(), orderID, body.Reason, u.ID)
	if err != nil {
		var be *billing.ServiceError
		if errors.As(err, &be) {
			if be.Code == "REFUND_AWAITING_PROVIDER" {
				adminBAudit(r.Context(), pool, u, "orders.refund_requested", "order", orderID, "high", reqID,
					map[string]any{"reason": body.Reason, "status": "awaiting_provider"})
			}
			status := be.Status
			if status < 400 {
				status = 422
			}
			return nil, nil, adminErr(be.Code, be.Message, status)
		}
		return nil, nil, adminBInternal(err, "退款处理失败")
	}
	adminBAudit(r.Context(), pool, u, "orders.refund", "order", orderID, "high", reqID,
		map[string]any{"reason": body.Reason, "status": "refunded", "externalRefundId": res.ExternalRefundID})
	updated, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ops_bill.orders WHERE id = $1`, orderID)
	return map[string]any{"order": updated, "reason": body.Reason, "externalRefundId": res.ExternalRefundID,
		"providerStatus": res.ProviderStatus}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/plans — lib/services/billing.js createPlan / getAllPlansConfig
// ---------------------------------------------------------------------------

func adminBPlans(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	repo := &billing.PGRepository{Pool: pool}
	if r.Method == http.MethodGet {
		plans, err := repo.PlanCatalog(r.Context())
		if err != nil {
			return nil, nil, adminBInternal(err, "读取套餐配置失败")
		}
		return plans, nil, nil
	}
	return adminBSavePlan(r, repo, u, reqID, true)
}

func adminBPlanPatch(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	return adminBSavePlan(r, &billing.PGRepository{Pool: pool}, u, reqID, false)
}

func adminBSavePlan(r *http.Request, repo *billing.PGRepository, u *middleware.SessionUser, reqID string, create bool) (any, map[string]any, *adminError) {
	var body billing.PlanChanges
	if ae := adminBBody(r, 64*1024, &body); ae != nil {
		return nil, nil, ae
	}
	before, after, err := repo.SavePlan(r.Context(), strings.TrimSpace(r.PathValue("id")), body, create)
	if err != nil {
		var validation *billing.ServiceError
		if errors.As(err, &validation) {
			return nil, nil, adminErr(validation.Code, validation.Message, validation.Status)
		}
		return nil, nil, adminBInternal(err, "保存套餐配置失败")
	}
	action := "plans.update"
	if create {
		action = "plans.create"
	}
	adminBAudit(r.Context(), repo.Pool, u, action, "plan", after.ID, "medium", reqID,
		map[string]any{"before": before, "after": after})
	return after, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/profit-center — app/api/admin/profit-center/route.js
// ---------------------------------------------------------------------------

func adminBProfitCenter(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	period := firstNonEmpty(r.URL.Query().Get("period"), "7d")
	var since, endClause string
	switch period {
	case "today":
		since, endClause = "now() - INTERVAL '1 day'", ""
	case "yesterday":
		since, endClause = "now() - INTERVAL '2 day'", "AND c.updated_at < now() - INTERVAL '1 day'"
	case "30d":
		since, endClause = "now() - INTERVAL '30 day'", ""
	case "month":
		since, endClause = "date_trunc('month', now())", ""
	default:
		since, endClause = "now() - INTERVAL '7 day'", ""
	}
	rows, err := adminBQueryRows(r.Context(), pool, `
		SELECT c.model AS model_id, m.display_name AS model_name, m.category, mp.min_gross_margin_rate,
		       SUM(c.credit_cost)::int AS total_credits_consumed,
		       ROUND(SUM(c.credit_cost) * 0.07, 2) AS revenue_cny,
		       ROUND(COALESCE(SUM(cost_agg.total_cost_usd), 0)::numeric, 4) AS total_cost_usd,
		       ROUND(SUM(c.credit_cost) * 0.07 - COALESCE(SUM(cost_agg.total_cost_usd), 0)::numeric * 7.25, 2) AS gross_profit_cny,
		       COUNT(*)::int AS generation_count
		FROM ai_studio.creations c
		LEFT JOIN ai_studio.ai_models m ON m.id = c.model
		LEFT JOIN ai_studio.model_pricing mp ON mp.model_id = c.model AND mp.is_active = TRUE
		LEFT JOIN LATERAL (
			SELECT SUM(COALESCE(pcr.actual_cost_usd, pcr.estimated_cost_usd, 0)) AS total_cost_usd
			FROM ai_studio.provider_cost_records pcr WHERE pcr.job_id = c.id
		) cost_agg ON TRUE
		WHERE c.status IN ('succeeded', 'completed') AND c.updated_at >= `+since+` `+endClause+`
		GROUP BY c.model, m.display_name, m.category, mp.min_gross_margin_rate
		ORDER BY revenue_cny DESC`)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	return map[string]any{"rows": rows, "period": period, "creditToCny": 0.07}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/providers — lib/services/providers.js getProvidersOverview
// ---------------------------------------------------------------------------

func adminBProvidersOverview(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	providers, err := adminBQueryRows(r.Context(), pool, `SELECT * FROM ai_studio.ai_providers ORDER BY priority ASC, id ASC`)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	for i := range providers {
		pid := adminBStr(providers[i]["id"])
		cred := ai.ResolveCredentials(r.Context(), pool, d.Config, pid)
		providers[i]["credentialStatus"] = cred.Status
		providers[i]["credentialSource"] = cred.Source
	}
	secrets, _ := adminBQueryRows(r.Context(), pool, `SELECT provider, name, updated_at FROM ops_bill.provider_secrets ORDER BY provider, name`)
	checks, _ := adminBQueryRows(r.Context(), pool, `
		SELECT DISTINCT ON (provider) provider, status, latency_ms, error_code, checked_at
		FROM ops_bill.provider_health_checks ORDER BY provider, checked_at DESC`)
	return map[string]any{"providers": providers, "secrets": secrets, "lastChecks": checks}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/providers/[id]/enabled — lib/services/paymentProviders.js
// ---------------------------------------------------------------------------

func adminBPaymentProviderEnabled(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	id := strings.TrimSpace(r.PathValue("id"))
	allowed := map[string]bool{"alipay": true, "wechat": true, "stripe": true, "paypal": true}
	if !allowed[id] {
		return nil, nil, adminErr("VALIDATION_ERROR", "不支持的支付渠道", 400)
	}
	var body struct {
		Enabled *bool `json:"enabled"`
	}
	adminBBodyOptional(r, 16*1024, &body)
	if body.Enabled == nil {
		return nil, nil, adminErr("VALIDATION_ERROR", "enabled 必须为布尔值", 422)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ops_bill.provider_configs (provider, kind, name, enabled, updated_by, updated_at)
		VALUES ($1, 'payment', $1, $2, $3, now())
		ON CONFLICT (provider) DO UPDATE SET enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = now()`,
		id, *body.Enabled, u.ID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	result, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ops_bill.provider_configs WHERE provider = $1`, id)
	adminBAudit(r.Context(), pool, u, "providers.set_payment_enabled", "provider", id, "medium", reqID, result)
	return result, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/providers/[id]/env — lib/repositories/providers.js
// ---------------------------------------------------------------------------

func adminBProviderEnv(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "请指定供应商 ID", 422)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	value, _, err := adminBReadSetting(r.Context(), pool, "provider_active_env")
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	envMap := adminBJSON(value)
	env := "production"
	if v, _ := envMap[id].(string); v == "sandbox" {
		env = "sandbox"
	}
	if r.Method == http.MethodGet {
		return map[string]any{"provider": id, "activeKeyEnv": env}, nil, nil
	}
	var body struct {
		Env string `json:"env"`
	}
	adminBBodyOptional(r, 16*1024, &body)
	next := "production"
	if body.Env == "sandbox" {
		next = "sandbox"
	}
	envMap[id] = next
	if err := adminBWriteSetting(r.Context(), pool, "provider_active_env", envMap, "private", adminBActorEmail(u)); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	_, _ = pool.Exec(r.Context(), `
		UPDATE ai_studio.ai_providers SET circuit_state = 'closed', consecutive_failures = 0,
		       circuit_opened_at = NULL, updated_at = now() WHERE id = $1`, id)
	adminBAudit(r.Context(), pool, u, "providers.rotate_key_env", "provider", id, "high", reqID,
		map[string]any{"before": map[string]string{"activeKeyEnv": env}, "after": map[string]string{"activeKeyEnv": next}})
	return map[string]any{"provider": id, "activeKeyEnv": next, "previousKeyEnv": env}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/providers/[id]/secret — lib/services/providers.js rotateProviderSecret
// ---------------------------------------------------------------------------

func adminBProviderSecretRotate(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	id := strings.TrimSpace(r.PathValue("id"))
	var body struct {
		Secrets     map[string]string `json:"secrets"`
		SecretValue string            `json:"secretValue"`
		SecretName  string            `json:"secretName"`
		ActiveEnv   string            `json:"activeEnv"`
	}
	adminBBodyOptional(r, 128*1024, &body)
	type item struct{ name, value string }
	var items []item
	if body.Secrets != nil {
		for k, v := range body.Secrets {
			if strings.TrimSpace(v) != "" {
				items = append(items, item{k, strings.TrimSpace(v)})
			}
		}
	} else if strings.TrimSpace(body.SecretValue) != "" {
		name := firstNonEmpty(body.SecretName, "api_key")
		items = append(items, item{name, body.SecretValue})
	}
	if len(items) == 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "未提供任何有效密钥内容", 422)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	secretKey := d.Config.ProviderSecretKey()
	if secretKey == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "未配置 PROVIDER_SECRETS_ENCRYPTION_KEY，拒绝明文写入密钥", 422)
	}
	tx, err := pool.Begin(r.Context())
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	execFn := func(ctx context.Context, sql string, args ...any) error {
		_, e := tx.Exec(ctx, sql, args...)
		return e
	}
	for _, it := range items {
		if err := seckey.SaveProviderSecret(r.Context(), execFn, secretKey, id, it.name, it.value); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		adminBAudit(r.Context(), pool, u, "providers.secret_rotated", "provider_secret", id, "high", reqID,
			map[string]any{"secretName": it.name, "stored": true})
	}
	if err := tx.Commit(r.Context()); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if body.ActiveEnv == "sandbox" || body.ActiveEnv == "production" {
		value, _, _ := adminBReadSetting(r.Context(), pool, "provider_active_env")
		envMap := adminBJSON(value)
		envMap[id] = body.ActiveEnv
		if err := adminBWriteSetting(r.Context(), pool, "provider_active_env", envMap, "private", adminBActorEmail(u)); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
	}
	_, _ = pool.Exec(r.Context(), `
		UPDATE ai_studio.ai_providers SET circuit_state = 'closed', consecutive_failures = 0,
		       circuit_opened_at = NULL, updated_at = now() WHERE id = $1`, id)
	return map[string]any{"success": true, "count": len(items), "provider": id,
		"activeKeyEnv": body.ActiveEnv, "stored": true}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/providers/[id]/test — lib/services/providers.js testProviderHealth
// ---------------------------------------------------------------------------

func adminBProviderHealthCheck(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "请指定供应商 ID", 422)
	}
	env := strings.TrimSpace(r.URL.Query().Get("env"))
	var body struct {
		Env string `json:"env"`
	}
	adminBBodyOptional(r, 16*1024, &body)
	if body.Env != "" {
		env = body.Env
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	provider, ok, err := adminBQueryOne(r.Context(), pool, `
		SELECT id, enabled, health_status, circuit_state, consecutive_failures, base_url
		FROM ai_studio.ai_providers WHERE id = $1`, id)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !ok {
		return nil, nil, adminErr("PROVIDER_NOT_FOUND", "未找到指定供应商", 404)
	}
	probe, probeErr := d.generationSvc(pool).ProbeProvider(r.Context(), id)
	if probeErr != nil {
		return nil, nil, adminBInternal(probeErr, "供应商健康检查失败")
	}
	status, _ := probe["healthStatus"].(string)
	errorCode := ""
	if ec, ok := probe["errorCode"].(string); ok {
		errorCode = ec
	}
	latency := probe["latencyMs"]
	adminBAudit(r.Context(), pool, u, "providers.health_check", "provider", id, "low", reqID,
		map[string]any{"status": status, "env": env})
	return map[string]any{"provider": id, "status": status, "latencyMs": latency,
		"errorCode": errorCode, "details": map[string]any{"provider": provider, "probe": probe}, "env": env}, nil, nil
}

func adminBNewUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return adminBFormatUUID(b)
}

func adminBMustJSON(v any) string {
	raw, _ := json.Marshal(v)
	return string(raw)
}

// ---------------------------------------------------------------------------
// /api/admin/providers/[id]/webhooks — app/api/admin/providers/[id]/webhooks/route.js
// ---------------------------------------------------------------------------

func adminBProviderWebhooks(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	id := strings.TrimSpace(r.PathValue("id"))
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	q := r.URL.Query()
	if q.Get("limit") == "" {
		q.Set("limit", "10")
	}
	q.Set("provider", id)
	r2 := r.Clone(r.Context())
	r2.URL.RawQuery = q.Encode()
	sql := `SELECT provider, event_id, event_type, status, attempts, last_error,
	               payload_json, processed_at, created_at
	        FROM ops_bill.webhook_events WHERE provider = $1`
	rows, meta, err := adminBPagedQuery(r2.Context(), pool, r2, sql, "created_at", "event_id", id)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	for _, row := range rows {
		status, _ := row["status"].(string)
		lastErr, _ := row["last_error"].(string)
		sig := status
		switch {
		case status == "rejected" && regexp.MustCompile(`(?i)签名|sign|verify`).MatchString(lastErr):
			sig = "验签未通过"
		case status == "processed" || status == "received":
			sig = "验签通过"
		case status == "replayed":
			sig = "已重放"
		case status == "failed":
			sig = "处理失败"
		}
		row["signatureStatus"] = sig
		payload := adminBJSON(row["payload_json"])
		row["orderId"] = firstNonEmpty(
			adminBStr(payload["order_id"]), adminBStr(payload["orderId"]),
			adminBStr(payload["out_trade_no"]), adminBStr(payload["outTradeNo"]),
			adminBStr(payload["id"]))
	}
	return rows, meta, nil
}

func adminBStr(v any) string {
	s, _ := v.(string)
	return s
}

// ---------------------------------------------------------------------------
// /api/admin/providers/email — lib/emailAdmin.js (setting key `email_smtp`)
// ---------------------------------------------------------------------------

func adminBEmailConfig(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		value, _, err := adminBReadSetting(r.Context(), pool, "email_smtp")
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		config := adminBJSON(value)
		logs, _ := adminBQueryRows(r.Context(), pool, `
			SELECT id, provider, purpose, recipient, status, error_code, latency_ms, created_at
			FROM auth_usr.email_send_logs ORDER BY created_at DESC LIMIT 20`)
		return map[string]any{"config": config, "configured": len(config) > 0,
			"logs": logs, "status": "not_checked", "passwordStored": false}, nil, nil
	}
	var body map[string]any
	if ae := adminBBody(r, 128*1024, &body); ae != nil {
		return nil, nil, ae
	}
	if len(body) == 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "邮箱配置格式无效", 400)
	}
	active, _ := body["activeProvider"].(string)
	if active == "" {
		active = "qq"
		body["activeProvider"] = active
	}
	if ae := saveEmailSMTPPasswords(r.Context(), pool, d.Config.ProviderSecretKey(), active, body); ae != nil {
		return nil, nil, ae
	}
	for k := range body {
		if regexp.MustCompile(`(?i)password|secret|api.?key`).MatchString(k) {
			delete(body, k)
		}
	}
	if err := adminBWriteSetting(r.Context(), pool, "email_smtp", body, "private", adminBActorEmail(u)); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "email.smtp.configure", "email_provider", "email_smtp", "medium", reqID, body)
	value, _, _ := adminBReadSetting(r.Context(), pool, "email_smtp")
	return adminBJSON(value), nil, nil
}

func (d *Dependencies) notifyService() *notify.Service {
	if d != nil && d.Notify != nil {
		return d.Notify
	}
	return &notify.Service{Pool: d.Pool, Config: d.Config}
}

func saveEmailSMTPPasswords(ctx context.Context, pool *pgxpool.Pool, secretKey, active string, body map[string]any) *adminError {
	type pwEntry struct{ keyName, val string }
	var entries []pwEntry
	collectPass := func(m map[string]any, keyName string) {
		for _, k := range []string{"password", "smtpPassword", "smtp_password"} {
			if s, ok := m[k].(string); ok && strings.TrimSpace(s) != "" {
				entries = append(entries, pwEntry{keyName, strings.TrimSpace(s)})
			}
			delete(m, k)
		}
	}
	topName := "smtp_password"
	if active != "" && active != "qq" {
		topName = "smtp_password_" + active
	}
	collectPass(body, topName)
	if provs, ok := body["providers"].(map[string]any); ok {
		for chName, raw := range provs {
			if chMap, ok := raw.(map[string]any); ok {
				kn := "smtp_password_" + chName
				if chName == "qq" {
					kn = "smtp_password"
				}
				collectPass(chMap, kn)
			}
		}
	}
	if len(entries) == 0 {
		return nil
	}
	if secretKey == "" {
		return adminErr("VALIDATION_ERROR", "未配置 PROVIDER_SECRETS_ENCRYPTION_KEY，拒绝保存 SMTP 密码", 422)
	}
	execFn := func(c context.Context, sql string, args ...any) error {
		_, e := pool.Exec(c, sql, args...)
		return e
	}
	for _, it := range entries {
		if err := seckey.SaveProviderSecret(ctx, execFn, secretKey, "email_smtp", it.keyName, it.val); err != nil {
			return adminBInternal(err, "保存邮箱密钥失败")
		}
	}
	return nil
}

func adminBEmailDiagnose(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		Channel string `json:"channel"`
	}
	adminBBodyOptional(r, 32*1024, &body)
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	value, _, err := adminBReadSetting(r.Context(), pool, "email_smtp")
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	config := adminBJSON(value)
	channel := firstNonEmpty(body.Channel, adminBStr(config["activeProvider"]), "qq")
	status, latMs, errCode := d.notifyService().VerifySMTP(r.Context(), channel)
	logs, _ := adminBQueryRows(r.Context(), pool, `
		SELECT status, error_code, latency_ms, created_at FROM auth_usr.email_send_logs
		WHERE provider = $1 ORDER BY created_at DESC LIMIT 20`, channel)
	return map[string]any{"channel": channel, "configured": len(config) > 0,
		"logCount": len(logs), "recentLogs": logs, "status": status, "latencyMs": latMs, "errorCode": errCode}, nil, nil
}

func adminBEmailHealth(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	value, _, err := adminBReadSetting(r.Context(), pool, "email_smtp")
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	config := adminBJSON(value)
	status, latMs, errCode := d.notifyService().VerifySMTP(r.Context(), "")
	_, _ = pool.Exec(r.Context(), `
		INSERT INTO ops_bill.provider_health_checks
			(id, provider, status, latency_ms, error_code, details_json, checked_at)
		VALUES ($1,'email_smtp',$2,$3,$4,$5::jsonb,now())`,
		adminBNewID("phc"), status, latMs, errCode,
		adminBMustJSON(map[string]any{"configured": len(config) > 0, "status": status}))
	checks, _ := adminBQueryRows(r.Context(), pool, `
		SELECT provider, status, latency_ms, error_code, checked_at
		FROM ops_bill.provider_health_checks WHERE provider LIKE 'email%'
		ORDER BY checked_at DESC LIMIT 20`)
	adminBAudit(r.Context(), pool, u, "email.smtp.health_check", "email_provider", "email_smtp", "low", reqID,
		map[string]any{"configured": len(config) > 0, "status": status, "latencyMs": latMs})
	return map[string]any{"configured": len(config) > 0, "checks": checks,
		"status": status, "latencyMs": latMs, "errorCode": errCode}, nil, nil
}

func adminBEmailTest(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		To string `json:"to"`
	}
	if ae := adminBBody(r, 32*1024, &body); ae != nil {
		return nil, nil, ae
	}
	to := strings.TrimSpace(body.To)
	if !regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`).MatchString(to) {
		return nil, nil, adminErr("VALIDATION_ERROR", "请输入有效的测试收件邮箱", 422)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	latMs, err := d.notifyService().SendTestEmail(r.Context(), to, u.ID)
	if err != nil {
		var se *notify.ServiceError
		if errors.As(err, &se) {
			return nil, nil, adminErr(se.Code, se.Message, 422)
		}
		return nil, nil, adminErr("SMTP_UNAVAILABLE", err.Error(), 422)
	}
	adminBAudit(r.Context(), pool, u, "email.smtp.test", "email_provider", "email_smtp", "low", reqID,
		map[string]any{"to": to, "latencyMs": latMs})
	return map[string]any{"ok": true, "to": to, "latencyMs": latMs}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/providers/sms — lib/smsAdmin.js (setting key `sms_routing`)
// ---------------------------------------------------------------------------

func adminBSMSConfig(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		value, _, err := adminBReadSetting(r.Context(), pool, "sms_routing")
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		logs, _ := adminBQueryRows(r.Context(), pool, `
			SELECT id, provider, masked_phone, country, status, error_code, latency_ms, created_at
			FROM auth_usr.sms_delivery_logs ORDER BY created_at DESC LIMIT 20`)
		return map[string]any{"config": adminBJSON(value), "logs": logs, "configured": value != nil}, nil, nil
	}
	var body map[string]any
	if ae := adminBBody(r, 128*1024, &body); ae != nil {
		return nil, nil, ae
	}
	if len(body) == 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "配置格式无效", 400)
	}
	for k := range body {
		if regexp.MustCompile(`(?i)secret|password|api.?key`).MatchString(k) {
			delete(body, k)
		}
	}
	if err := adminBWriteSetting(r.Context(), pool, "sms_routing", body, "private", adminBActorEmail(u)); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "sms.providers.configure", "sms_provider", "sms_routing", "medium", reqID, body)
	value, _, _ := adminBReadSetting(r.Context(), pool, "sms_routing")
	return adminBJSON(value), nil, nil
}

func adminBSMSHealth(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		Provider string `json:"provider"`
	}
	if ae := adminBBody(r, 32*1024, &body); ae != nil {
		return nil, nil, ae
	}
	provider := strings.TrimSpace(body.Provider)
	if provider == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "Provider 参数无效", 400)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	value, _, err := adminBReadSetting(r.Context(), pool, "sms_routing")
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	config := adminBJSON(value)
	providers := adminBJSON(config["providers"])
	providerConfig := adminBJSON(providers[provider])
	enabled := true
	if v, ok := providerConfig["enabled"].(bool); ok {
		enabled = v
	}
	status, latMs, errCode := d.notifyService().HealthCheckSMS(r.Context(), provider)
	_, _ = pool.Exec(r.Context(), `
		INSERT INTO ops_bill.provider_health_checks
			(id, provider, status, latency_ms, error_code, details_json, checked_at)
		VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())`,
		adminBNewID("phc"), "sms:"+provider, status, latMs, errCode,
		adminBMustJSON(map[string]any{"provider": provider, "enabled": enabled}))
	adminBAudit(r.Context(), pool, u, "sms.providers.health_check", "sms_provider", provider, "low", reqID,
		map[string]any{"status": status, "latencyMs": latMs})
	logs, _ := adminBQueryRows(r.Context(), pool, `
		SELECT status, error_code, latency_ms, created_at FROM auth_usr.sms_delivery_logs
		WHERE provider = $1 ORDER BY created_at DESC LIMIT 20`, provider)
	return map[string]any{"provider": provider, "status": status, "latencyMs": latMs, "errorCode": errCode,
		"configured": len(providerConfig) > 0, "recentLogs": logs}, nil, nil
}

func adminBSMSSecrets(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		AdminPassword string         `json:"adminPassword"`
		Secrets       map[string]any `json:"secrets"`
	}
	if ae := adminBBody(r, 128*1024, &body); ae != nil {
		return nil, nil, ae
	}
	if strings.TrimSpace(body.AdminPassword) == "" || len(body.Secrets) == 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "密钥配置格式无效", 400)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	// verifyAdminPassword uses scrypt(password, salt, 64) over auth_usr.users.
	row, ok, err := adminBQueryOne(r.Context(), pool, `
		SELECT password_hash, password_salt FROM auth_usr.users WHERE id = $1`, u.ID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !ok || !adminBVerifyPassword(row, body.AdminPassword) {
		return nil, nil, adminErr("UNAUTHENTICATED", "管理员密码验证失败", 401)
	}
	type smsEntry struct{ provider, name, val string }
	var entries []smsEntry
	for k, raw := range body.Secrets {
		switch v := raw.(type) {
		case string:
			if clean := strings.TrimSpace(v); clean != "" {
				entries = append(entries, smsEntry{"sms", k, clean})
			}
		case map[string]any:
			for subK, subRaw := range v {
				if s, ok := subRaw.(string); ok && strings.TrimSpace(s) != "" {
					entries = append(entries, smsEntry{k, subK, strings.TrimSpace(s)})
				}
			}
		}
	}
	if len(entries) == 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "没有填写新的密钥", 400)
	}
	secretKey := d.Config.ProviderSecretKey()
	if secretKey == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "未配置 PROVIDER_SECRETS_ENCRYPTION_KEY，拒绝明文写入密钥", 422)
	}
	tx, err := pool.Begin(r.Context())
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	execFn := func(ctx context.Context, sql string, args ...any) error {
		_, e := tx.Exec(ctx, sql, args...)
		return e
	}
	for _, it := range entries {
		if err := seckey.SaveProviderSecret(r.Context(), execFn, secretKey, it.provider, it.name, it.val); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		adminBAudit(r.Context(), pool, u, "sms.providers.rotate_secrets", "sms_provider", it.provider+":"+it.name, "high", reqID,
			map[string]any{"secretName": it.name, "stored": true})
	}
	if err := tx.Commit(r.Context()); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	return map[string]any{"success": true, "count": len(entries), "stored": true}, nil, nil
}

// Mirrors verifyAdminPassword in lib/admin/authz.js: crypto.scryptSync(password,
// salt, 64) uses Node's default N=16384/r=8/p=1, compared in constant time.
func adminBVerifyPassword(row map[string]any, password string) bool {
	hashHex, _ := row["password_hash"].(string)
	salt, _ := row["password_salt"].(string)
	if hashHex == "" || salt == "" || password == "" {
		return false
	}
	expected, err := hex.DecodeString(hashHex)
	if err != nil {
		return false
	}
	derived, err := scrypt.Key([]byte(password), []byte(salt), 16384, 8, 1, len(expected))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(derived, expected) == 1
}

func adminBSMSTest(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	var body struct {
		Provider string `json:"provider"`
		Phone    string `json:"phone"`
	}
	if ae := adminBBody(r, 32*1024, &body); ae != nil {
		return nil, nil, ae
	}
	provider, phone := strings.TrimSpace(body.Provider), strings.TrimSpace(body.Phone)
	if provider == "" || !regexp.MustCompile(`^\+?[0-9][0-9\-]{5,20}$`).MatchString(phone) {
		return nil, nil, adminErr("VALIDATION_ERROR", "测试短信参数无效", 400)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if err := d.notifyService().SendTestSMS(r.Context(), provider, phone); err != nil {
		var se *notify.ServiceError
		if errors.As(err, &se) {
			return nil, nil, adminErr(se.Code, se.Message, 422)
		}
		return nil, nil, adminErr("SMS_UNAVAILABLE", err.Error(), 422)
	}
	adminBAudit(r.Context(), pool, u, "sms.providers.test", "sms_provider", provider, "low", reqID,
		map[string]any{"provider": provider, "sent": true})
	return map[string]any{"ok": true, "provider": provider, "phone": phone}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/routing — app/api/admin/routing/route.js
// ---------------------------------------------------------------------------

func adminBRoutingOverview(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		rows, err := adminBQueryRows(r.Context(), pool, `
			SELECT m.id, m.name, m.display_name, m.category, m.status, m.sort,
			       rp.routing_mode, rp.weights, rp.failover_enabled, rp.circuit_breaker_config,
			       COALESCE(ch.enabled_count, 0)::int AS enabled_channels,
			       COALESCE(ch.total_count, 0)::int AS total_channels,
			       COALESCE(health.healthy_count, 0)::int AS healthy_channels
			FROM ai_studio.ai_models m
			LEFT JOIN ai_studio.routing_policies rp ON rp.model_id = m.id
			LEFT JOIN LATERAL (
				SELECT COUNT(*)::int AS total_count,
				       COUNT(*) FILTER (WHERE pm.enabled = TRUE)::int AS enabled_count
				FROM ai_studio.provider_models pm WHERE pm.model_id = m.id
			) ch ON TRUE
			LEFT JOIN LATERAL (
				SELECT COUNT(*)::int AS healthy_count
				FROM ai_studio.provider_models pm
				JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
				WHERE pm.model_id = m.id AND pm.enabled = TRUE
				  AND p.enabled = TRUE AND p.health_status IN ('healthy','degraded')
			) health ON TRUE
			ORDER BY m.sort ASC, m.created_at ASC`)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		return map[string]any{"models": rows}, nil, nil
	}
	var body struct {
		ModelID         string         `json:"model_id"`
		RoutingMode     string         `json:"routing_mode"`
		Weights         map[string]any `json:"weights"`
		FailoverEnabled *bool          `json:"failover_enabled"`
	}
	adminBBodyOptional(r, 64*1024, &body)
	if strings.TrimSpace(body.ModelID) == "" {
		return nil, nil, adminBResultErr("model_id required")
	}
	mode := firstNonEmpty(body.RoutingMode, "balanced")
	validMode := map[string]bool{"cost": true, "quality": true, "stability": true, "balanced": true, "priority": true}
	if !validMode[mode] {
		return nil, nil, adminErr("VALIDATION_ERROR", "routing_mode 无效", 422)
	}
	weightsRaw, _ := json.Marshal(body.Weights)
	if body.Weights == nil {
		weightsRaw = []byte(`{"cost":0.4,"success_rate":0.3,"speed":0.2,"capacity":0.1}`)
	}
	failover := true
	if body.FailoverEnabled != nil {
		failover = *body.FailoverEnabled
	}
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ai_studio.routing_policies
			(id, model_id, routing_mode, weights, failover_enabled, created_at, updated_at)
		VALUES ($1,$2,$3,$4::jsonb,$5,now(),now())
		ON CONFLICT (model_id) DO UPDATE SET
			routing_mode = excluded.routing_mode, weights = excluded.weights,
			failover_enabled = excluded.failover_enabled, updated_at = now()`,
		adminBNewID("rp"), body.ModelID, mode, string(weightsRaw), failover)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	policy, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.routing_policies WHERE model_id = $1`, body.ModelID)
	adminBAudit(r.Context(), pool, u, "models.routing_policy_update", "routing_policy", body.ModelID, "medium", reqID, policy)
	return map[string]any{"policy": policy}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/routing/[modelId]/channels
// ---------------------------------------------------------------------------

func adminBRoutingChannels(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	modelID := strings.TrimSpace(r.PathValue("modelId"))
	if modelID == "" {
		return nil, nil, adminBResultErr("modelId required")
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		rows, err := adminBQueryRows(r.Context(), pool, `
			SELECT pm.id, pm.model_id, pm.provider_id, pm.provider_model_id, pm.enabled,
			       pm.priority, pm.timeout, pm.max_retries, pm.concurrency_limit, pm.rate_limit,
			       pm.review_status, pm.provider_model_version, pm.provider_endpoint,
			       pm.metadata, pm.cost_config,
			       COALESCE((pm.metadata->>'primary')::boolean, FALSE) AS is_primary,
			       p.name AS provider_name, p.provider_type, p.health_status, p.circuit_state,
			       p.consecutive_failures, p.balance AS provider_balance, p.currency AS provider_currency,
			       COALESCE(active.active_count, 0)::int AS active_attempt_count,
			       COALESCE(stats.success_rate, 0)::numeric AS success_rate,
			       COALESCE(stats.average_latency_ms, 0)::numeric AS average_latency_ms,
			       COALESCE(stats.total_attempts, 0)::int AS total_recent_attempts
			FROM ai_studio.provider_models pm
			JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
			LEFT JOIN LATERAL (
				SELECT COUNT(*)::int AS active_count FROM ai_studio.generation_attempts att
				WHERE att.provider_id = pm.provider_id AND att.provider_model_id = pm.provider_model_id
				  AND att.status IN ('submitted','processing')
			) active ON TRUE
			LEFT JOIN LATERAL (
				SELECT COUNT(*) AS total_attempts,
				       CASE WHEN COUNT(*) = 0 THEN 0
				            ELSE COUNT(*) FILTER (WHERE a2.status = 'succeeded')::numeric / COUNT(*) END AS success_rate,
				       AVG(a2.duration_ms) FILTER (WHERE a2.duration_ms IS NOT NULL) AS average_latency_ms
				FROM (SELECT status, duration_ms FROM ai_studio.generation_attempts
				      WHERE provider_id = pm.provider_id ORDER BY created_at DESC LIMIT 100) a2
			) stats ON TRUE
			WHERE pm.model_id = $1
			ORDER BY COALESCE((pm.metadata->>'primary')::boolean, FALSE) DESC, pm.priority DESC, pm.id ASC`, modelID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		return map[string]any{"channels": rows}, nil, nil
	}
	var body struct {
		ChannelID string `json:"channel_id"`
		Enabled   *bool  `json:"enabled"`
		Priority  *int   `json:"priority"`
		IsPrimary bool   `json:"is_primary"`
	}
	adminBBodyOptional(r, 64*1024, &body)
	channelID := strings.TrimSpace(body.ChannelID)
	if channelID == "" {
		return nil, nil, adminBResultErr("channel_id required")
	}
	exists, ok, err := adminBQueryOne(r.Context(), pool, `SELECT id, metadata FROM ai_studio.provider_models WHERE id = $1 AND model_id = $2`, channelID, modelID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !ok {
		return nil, nil, adminBResultErr("未找到对应的渠道映射")
	}
	if body.IsPrimary {
		// setChannelPrimary clears the primary flag on siblings then marks this one.
		_, err = pool.Exec(r.Context(), `
			UPDATE ai_studio.provider_models
			SET metadata = COALESCE(metadata, '{}'::jsonb) - 'primary', updated_at = now()
			WHERE model_id = $1 AND id <> $2`, modelID, channelID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		meta := adminBJSON(exists["metadata"])
		meta["primary"] = true
		_, err = pool.Exec(r.Context(), `
			UPDATE ai_studio.provider_models SET metadata = $1::jsonb, updated_at = now()
			WHERE id = $2 AND model_id = $3`, adminBMustJSON(meta), channelID, modelID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
	}
	if body.Enabled != nil || body.Priority != nil {
		sets := []string{"updated_at = now()"}
		args := []any{}
		if body.Enabled != nil {
			args = append(args, *body.Enabled)
			sets = append(sets, fmt.Sprintf("enabled = $%d", len(args)))
		}
		if body.Priority != nil {
			args = append(args, *body.Priority)
			sets = append(sets, fmt.Sprintf("priority = $%d", len(args)))
		}
		args = append(args, channelID, modelID)
		_, err = pool.Exec(r.Context(), fmt.Sprintf(`UPDATE ai_studio.provider_models SET %s WHERE id = $%d AND model_id = $%d`, strings.Join(sets, ", "), len(args)-1, len(args)), args...)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
	}
	adminBAudit(r.Context(), pool, u, "models.channel_update", "provider_model", channelID, "medium", reqID, body)
	return map[string]any{"ok": true, "channel_id": channelID, "is_primary": body.IsPrimary}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/security/sessions/[hash] — lib/repositories/sessions.js
// ---------------------------------------------------------------------------

func adminBListSessions(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	query := `
		SELECT s.token_hash, s.user_id, s.created_at, s.last_seen_at, s.expires_at,
		       u.display_name, u.email, u.phone, u.phone_country_code, u.role
		FROM auth_usr.sessions s
		JOIN auth_usr.users u ON u.id = s.user_id
		WHERE s.revoked_at IS NULL AND s.expires_at > now()
	`
	var args []any
	if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
		query += ` AND strpos(lower(concat_ws(' ', u.id, u.email, u.phone, u.display_name)), lower($1)) > 0`
		args = append(args, q)
	}
	rows, meta, err := adminBPagedQuery(r.Context(), pool, r, query, "s.created_at", "s.token_hash", args...)
	if err != nil {
		return nil, nil, adminBInternal(err, "读取活跃会话失败，请稍后重试")
	}
	return rows, meta, nil
}

func adminBRevokeSessionByHash(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	hash := strings.TrimSpace(r.PathValue("hash"))
	if hash == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "请指定要撤销的会话", 422)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	tag, err := pool.Exec(r.Context(), `
		UPDATE auth_usr.sessions SET revoked_at = COALESCE(revoked_at, now())
		WHERE token_hash = $1`, hash)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "sessions.revoke_single", "session", hash, "medium", reqID,
		map[string]any{"tokenHash": hash, "rowCount": tag.RowsAffected()})
	return map[string]any{"ok": true, "tokenHash": hash}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/seo/config + /api/admin/seo/push/config
// lib/repositories/seo.js uses ops_bill.system_settings keys site_seo / search_push_config
// ---------------------------------------------------------------------------

func adminBSEOSettings(key string) adminHandler {
	return func(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
		pool, ae := adminBDB(d, reqID)
		if ae != nil {
			return nil, nil, ae
		}
		if r.Method == http.MethodGet {
			value, ok, err := adminBReadSetting(r.Context(), pool, key)
			if err != nil {
				return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
			}
			if !ok {
				if key == "search_push_config" {
					return map[string]any{
						"indexNow":  map[string]any{"enabled": true, "host": "www.supdance.com", "key": "3f82a45c81924619b068ad1d5d893f44"},
						"baiduPush": map[string]any{"enabled": false, "site": "https://www.supdance.com", "token": ""},
					}, nil, nil
				}
				return map[string]any{}, nil, nil
			}
			return adminBJSON(value), nil, nil
		}
		var body map[string]any
		if ae := adminBBody(r, 128*1024, &body); ae != nil {
			return nil, nil, ae
		}
		if len(body) == 0 {
			return nil, nil, adminErr("INVALID_JSON", "请求体必须为合法 JSON 数据", 400)
		}
		if err := adminBWriteSetting(r.Context(), pool, key, body, "private", adminBActorEmail(u)); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		adminBAudit(r.Context(), pool, u, "seo.config_save", "system_setting", key, "low", reqID, body)
		value, _, _ := adminBReadSetting(r.Context(), pool, key)
		return adminBJSON(value), nil, nil
	}
}

// ---------------------------------------------------------------------------
// /api/admin/seo/push — lib/repositories/seo.js + lib/services/seoPush.js
// ---------------------------------------------------------------------------

func adminBSEOPush(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		limit := adminBInt(r, "limit", 50, 1, 200)
		offset := adminBInt(r, "offset", 0, 0, 1<<30)
		engine := strings.TrimSpace(r.URL.Query().Get("engine"))
		sql := `SELECT id, engine, urls, url_count, status, status_code, response_body,
		               error_message, latency_ms, created_by, actor_email, created_at
		        FROM ops_bill.seo_push_logs WHERE 1=1`
		args := []any{}
		if engine != "" {
			args = append(args, engine)
			sql += ` AND engine = $1`
		}
		args = append(args, limit, offset)
		sql += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args))
		rows, err := adminBQueryRows(r.Context(), pool, sql, args...)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		return rows, map[string]any{"limit": limit, "offset": offset, "count": len(rows)}, nil
	}
	var body struct {
		Engine string   `json:"engine"`
		URLs   []string `json:"urls"`
	}
	if ae := adminBBody(r, 128*1024, &body); ae != nil {
		return nil, nil, ae
	}
	if len(body.URLs) == 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "推送 URL 列表不能为空且必须为数组", 422)
	}
	if len(body.URLs) > 100 {
		return nil, nil, adminErr("VALIDATION_ERROR", "单次推送 URL 不能超过 100 条", 422)
	}
	engine := firstNonEmpty(body.Engine, "all")
	urlsRaw, _ := json.Marshal(body.URLs)
	cfgRaw, _, _ := adminBReadSetting(r.Context(), pool, "search_push_config")
	attempts := executeSEOPushHTTP(r.Context(), engine, body.URLs, adminBJSON(cfgRaw), d.Config.IndexNowKey, d.Config.AllowedPrivateHosts)

	anyAttempted := false
	anyFailed := false
	for _, att := range attempts {
		if att.Status == "skipped" {
			continue
		}
		anyAttempted = true
		if att.Status != "succeeded" {
			anyFailed = true
		}
		respJSON, _ := json.Marshal(att.ResponseBody)
		if _, err := pool.Exec(r.Context(), `
			INSERT INTO ops_bill.seo_push_logs
				(id, engine, urls, urls_json, url_count, status, status_code, response_body,
				 error_message, latency_ms, created_by, actor_email, created_at)
			VALUES ($1,$2,$3::jsonb,$3::jsonb,$4,$5,$6,$7::jsonb,$8,$9,$10,$10,now())`,
			adminBNewUUID(), att.Engine, string(urlsRaw), len(body.URLs), att.Status,
			att.StatusCode, string(respJSON), att.ErrorMessage, att.LatencyMs, adminBActorEmail(u)); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
	}
	adminBAudit(r.Context(), pool, u, "seo.push", "seo_push", engine, "low", reqID, map[string]any{"urls": len(body.URLs), "attempts": attempts})
	if !anyAttempted {
		return nil, nil, adminErr("SEO_PUSH_NOT_CONFIGURED", "尚未启用或配置任何搜索引擎推送凭证", 422)
	}
	if anyFailed {
		return map[string]any{"engine": engine, "urlCount": len(body.URLs), "attempts": attempts, "ok": false}, nil, nil
	}
	return map[string]any{"engine": engine, "urlCount": len(body.URLs), "attempts": attempts, "ok": true}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/settings — lib/services/settings.js
// ---------------------------------------------------------------------------

func adminBSystemSettings(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		rows, err := adminBQueryRows(r.Context(), pool, `
			SELECT key, value_json, visibility, version, updated_by, updated_at
			FROM ops_bill.system_settings ORDER BY key ASC`)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		return rows, nil, nil
	}
	var body struct {
		Key        string `json:"key"`
		Value      any    `json:"value"`
		Visibility string `json:"visibility"`
		Action     string `json:"action"`
		IP         string `json:"ip"`
	}
	if ae := adminBBody(r, 128*1024, &body); ae != nil {
		return nil, nil, ae
	}
	if body.Key == "canvas_model_config" {
		return nil, nil, adminErr("VALIDATION_ERROR", "无限画布配置请在专用控制面板中修改", 422)
	}
	// Legacy china-ip-block plugin action is not supported in the Go backend.
	if body.Action == "test_china_ip" {
		return nil, nil, adminErr("VALIDATION_ERROR", "该临时插件动作尚未接入 Go 后端", 422)
	}
	if !regexp.MustCompile(`^[a-z][a-z0-9_.-]{1,80}$`).MatchString(body.Key) {
		return nil, nil, adminBResultErr("配置键名格式无效（仅限小写字母、数字及下划线）")
	}
	if regexp.MustCompile(`(?i)secret|password|token|key|private`).MatchString(body.Key) {
		return nil, nil, adminBResultErr("系统设置中严禁存储密钥与私钥敏感信息")
	}
	visibility := firstNonEmpty(body.Visibility, "private")
	if visibility != "public" && visibility != "private" {
		return nil, nil, adminBResultErr("配置可见性值无效")
	}
	raw, err := json.Marshal(body.Value)
	if err != nil || len(raw) > 10000 {
		return nil, nil, adminBResultErr("配置内容必须是可序列化数据且不能超过 10,000 个字符")
	}
	before, _, _ := adminBReadSetting(r.Context(), pool, body.Key)
	if err := adminBWriteSetting(r.Context(), pool, body.Key, body.Value, visibility, adminBActorEmail(u)); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "settings.update", "system_setting", body.Key, "medium", reqID,
		map[string]any{"before": before, "after": body.Value})
	value, _, _ := adminBReadSetting(r.Context(), pool, body.Key)
	return map[string]any{"key": body.Key, "value": value, "visibility": visibility}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/storage + /api/admin/storage/bucket
// lib/storage/storageSettingsV2.js / lib/services/storageBucketAdmin.js
// ---------------------------------------------------------------------------

func adminBStorage(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	settingsKey := "storage_config_v2"
	if r.Method == http.MethodGet {
		value, _, err := adminBReadSetting(r.Context(), pool, settingsKey)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		locations, _ := adminBQueryRows(r.Context(), pool, `
			SELECT id, scope, owner_id, provider, tested_at, created_at, updated_at
			FROM ai_studio.storage_locations ORDER BY created_at DESC LIMIT 100`)
		migrations, _ := adminBQueryRows(r.Context(), pool, `
			SELECT id, target_location_id, target_provider, status, phase, scanned, migrated,
			       skipped, failed, last_error, started_at, finished_at, updated_at
			FROM ai_studio.storage_migration_runs ORDER BY started_at DESC LIMIT 20`)
		return map[string]any{"settings": adminBJSON(value), "locations": locations,
			"migrations": migrations}, nil, nil
	}
	var body struct {
		Action           string         `json:"action"`
		Config           map[string]any `json:"config"`
		TargetLocationID string         `json:"targetLocationId"`
		RunID            string         `json:"runId"`
		MaxItems         int            `json:"maxItems"`
	}
	if ae := adminBBody(r, 256*1024, &body); ae != nil {
		return nil, nil, ae
	}
	stSvc := d.Storage
	if stSvc == nil {
		stSvc = &storage.Service{Pool: pool, Config: d.Config}
	}
	action := firstNonEmpty(body.Action, "save")
	if strings.HasPrefix(action, "migrate.") {
		switch action {
		case "migrate.start":
			if strings.TrimSpace(body.TargetLocationID) == "" {
				return nil, nil, adminErr("VALIDATION_ERROR", "请指定目标存储位置", 422)
			}
			loc, ok, err := adminBQueryOne(r.Context(), pool, `SELECT id, provider FROM ai_studio.storage_locations WHERE id = $1`, body.TargetLocationID)
			if err != nil {
				return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
			}
			if !ok {
				return nil, nil, adminErr("STORAGE_LOCATION_NOT_FOUND", "目标存储位置不存在", 404)
			}
			if fmt.Sprint(loc["provider"]) == "local" {
				return nil, nil, adminErr("STORAGE_MIGRATION_LOCAL_TARGET", "目标位置不能是服务器本地存储", 422)
			}
			id := adminBNewID("smr")
			_, err = pool.Exec(r.Context(), `
				INSERT INTO ai_studio.storage_migration_runs
					(id, target_location_id, target_provider, status, phase, started_at, updated_at)
				VALUES ($1,$2,$3,'running','assets',now(),now())`,
				id, body.TargetLocationID, loc["provider"])
			if err != nil {
				return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
			}
			run, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ai_studio.storage_migration_runs WHERE id = $1`, id)
			adminBAudit(r.Context(), pool, u, "storage.migrate_start", "storage_migration", id, "high", reqID, run)
			return map[string]any{"run": run}, nil, nil
		case "migrate.cancel":
			tag, err := pool.Exec(r.Context(), `
				UPDATE ai_studio.storage_migration_runs
				SET status = 'cancelled', finished_at = now(), updated_at = now()
				WHERE status = 'running'`)
			if err != nil {
				return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
			}
			return map[string]any{"cancelled": tag.RowsAffected()}, nil, nil
		case "migrate.advance", "migrate.step":
			runID := strings.TrimSpace(body.RunID)
			if runID == "" {
				_ = pool.QueryRow(r.Context(), `SELECT id FROM ai_studio.storage_migration_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1`).Scan(&runID)
			}
			if runID == "" {
				return nil, nil, adminErr("STORAGE_MIGRATION_NOT_FOUND", "没有正在运行的迁移任务", 404)
			}
			run, err := stSvc.AdvanceMigration(r.Context(), runID, body.MaxItems)
			if err != nil {
				return nil, nil, adminErr("STORAGE_MIGRATION_FAILED", fmt.Sprintf("迁移批次推进失败: %v", err), 422)
			}
			return map[string]any{"run": run}, nil, nil
		default:
			return nil, nil, adminErr("VALIDATION_ERROR", "不支持的迁移操作", 422)
		}
	}
	if action == "test" {
		res, err := stSvc.TestConfig(r.Context(), body.Config)
		if err != nil {
			return nil, nil, adminErr("STORAGE_TEST_FAILED", err.Error(), 422)
		}
		return res, nil, nil
	}
	saved, err := stSvc.SaveConfig(r.Context(), body.Config, adminBActorEmail(u))
	if err != nil {
		return nil, nil, adminErr("STORAGE_SETTINGS_INVALID", err.Error(), 422)
	}
	adminBAudit(r.Context(), pool, u, "storage.settings_save", "system_setting", settingsKey, "medium", reqID, saved)
	return map[string]any{"settings": saved, "storageLocationId": saved["storageLocationId"]}, nil, nil
}

func adminBStorageBucket(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		value, _, err := adminBReadSetting(r.Context(), pool, "storage_config_v2")
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		logs, _ := adminBQueryRows(r.Context(), pool, `
			SELECT id, asset_id, user_id, provider, object_key, operation, size_bytes,
			       duration_ms, status, error_code, created_at
			FROM ai_studio.storage_operation_logs ORDER BY created_at DESC LIMIT 50`)
		return map[string]any{"settings": adminBJSON(value), "logs": logs}, nil, nil
	}
	var body struct {
		Action          string `json:"action"`
		Section         string `json:"section"`
		Value           any    `json:"value"`
		AccessKeyID     string `json:"accessKeyId"`
		AccessKeySecret string `json:"accessKeySecret"`
	}
	if ae := adminBBody(r, 128*1024, &body); ae != nil {
		return nil, nil, ae
	}
	if body.Action != "credentials.save" && body.Action != "config.update" {
		return nil, nil, adminErr("VALIDATION_ERROR", "不支持的桶级配置操作", 422)
	}
	if body.Action == "credentials.save" {
		akID := strings.TrimSpace(body.AccessKeyID)
		akSecret := strings.TrimSpace(body.AccessKeySecret)
		if akID == "" || akSecret == "" {
			return nil, nil, adminErr("VALIDATION_ERROR", "accessKeyId 与 accessKeySecret 均为必填项", 422)
		}
		storageKey := d.Config.StorageSecretKey()
		if storageKey == "" {
			return nil, nil, adminErr("STORAGE_ENCRYPTION_KEY_REQUIRED", "未配置 STORAGE_SECRETS_ENCRYPTION_KEY，拒绝明文写入桶级凭据", 422)
		}
		env, err := seckey.EncryptStorageEnvelope(storageKey, akSecret)
		if err != nil {
			return nil, nil, adminBInternal(err, "加密存储凭据失败")
		}
		now := time.Now().UTC().Format(time.RFC3339)
		payload := map[string]any{
			"accessKeyId":     akID,
			"accessKeySecret": env,
			"updatedAt":       now,
		}
		if err := adminBWriteSetting(r.Context(), pool, "storage_bucket_admin_v1", payload, "private", adminBActorEmail(u)); err != nil {
			return nil, nil, adminBInternal(err, "保存桶级凭据失败")
		}
		adminBAudit(r.Context(), pool, u, "storage.bucket_credentials_saved", "system_setting", "storage_bucket_admin_v1", "high", reqID,
			map[string]any{"accessKeyId": akID, "accessKeySecret": seckey.MaskSecret(akSecret), "stored": true})
		return map[string]any{
			"stored":      true,
			"credentials": map[string]any{"configured": true, "accessKeyId": akID, "accessKeySecret": seckey.MaskSecret(akSecret), "updatedAt": now},
		}, nil, nil
	}
	section := strings.TrimSpace(body.Section)
	validSections := map[string]bool{
		"activeProvider": true, "local": true, "s3": true, "r2": true,
		"aliyun_oss": true, "tencent_cos": true, "cdn": true, "publicBaseUrl": true, "credentials": true,
	}
	if section == "" || !validSections[section] {
		return nil, nil, adminErr("VALIDATION_ERROR", "section 不合法或不受支持", 422)
	}
	value, _, err := adminBReadSetting(r.Context(), pool, "storage_config_v2")
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	cfg := adminBJSON(value)
	cfg[section] = body.Value
	if err := adminBWriteSetting(r.Context(), pool, "storage_config_v2", cfg, "private", adminBActorEmail(u)); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "storage.bucket_config_update", "system_setting", section, "medium", reqID, body.Value)
	return map[string]any{"overview": cfg}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/subscription-faq — lib/services/subscriptionFaq.js
// ---------------------------------------------------------------------------

func adminBSubscriptionFAQ(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	locale, key, ok := site.SubscriptionFAQLocale(r.URL.Query().Get("locale"))
	if !ok {
		return nil, nil, adminErr("UNSUPPORTED_LOCALE", "不支持的订阅说明语言", http.StatusBadRequest)
	}
	ctx := r.Context()
	var revision int
	if r.Method == http.MethodGet {
		var raw json.RawMessage
		err := pool.QueryRow(ctx, `SELECT value_json, version FROM ops_bill.system_settings WHERE key = $1`, key).Scan(&raw, &revision)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, adminBInternal(err, "暂时无法读取订阅说明")
		}
		config, err := site.DecodeSubscriptionFAQ(raw, locale)
		if err != nil {
			return nil, nil, adminBInternal(err, "暂时无法读取订阅说明")
		}
		return map[string]any{"locale": locale, "revision": revision, "config": config, "defaults": site.DefaultSubscriptionFAQ(locale)}, nil, nil
	}
	var body struct {
		Config           *site.SubscriptionFAQPayload `json:"config"`
		ExpectedRevision *int                         `json:"expectedRevision"`
	}
	if ae := adminBBody(r, 128*1024, &body); ae != nil {
		return nil, nil, ae
	}
	if body.Config == nil || body.ExpectedRevision == nil || *body.ExpectedRevision < 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "请提交完整的订阅说明与版本号。", http.StatusUnprocessableEntity)
	}
	config, err := site.ValidateSubscriptionFAQ(*body.Config)
	if err != nil {
		return nil, nil, adminErr("INVALID_SUBSCRIPTION_FAQ", err.Error(), http.StatusUnprocessableEntity)
	}
	value, err := json.Marshal(config)
	if err != nil {
		return nil, nil, adminBInternal(err, "暂时无法保存订阅说明")
	}
	actor := adminBActorEmail(u)
	if *body.ExpectedRevision == 0 {
		err = pool.QueryRow(ctx, `
			INSERT INTO ops_bill.system_settings (key, value_json, visibility, version, updated_by, updated_at)
			VALUES ($1, $2::jsonb, 'public', 1, $3, now())
			ON CONFLICT (key) DO NOTHING RETURNING version`, key, string(value), actor).Scan(&revision)
	} else {
		err = pool.QueryRow(ctx, `
			UPDATE ops_bill.system_settings SET value_json = $2::jsonb, visibility = 'public',
				version = version + 1, updated_by = $3, updated_at = now()
			WHERE key = $1 AND version = $4 RETURNING version`, key, string(value), actor, *body.ExpectedRevision).Scan(&revision)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, adminErr("SUBSCRIPTION_FAQ_REVISION_CONFLICT", "另一标签页已更新订阅说明，请先读取最新版本。", http.StatusConflict)
	}
	if err != nil {
		return nil, nil, adminBInternal(err, "暂时无法保存订阅说明")
	}
	adminBAudit(ctx, pool, u, "settings.subscription_faq_update", "system_setting", key, "medium", reqID,
		map[string]any{"locale": locale, "previousRevision": *body.ExpectedRevision, "revision": revision})
	return map[string]any{"success": true, "locale": locale, "revision": revision, "config": config}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/system/logs — process-local operational events.
// ---------------------------------------------------------------------------

func adminBSystemLogs(w http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	w.Header().Set("Cache-Control", "private, no-store")
	logType := firstNonEmpty(r.URL.Query().Get("type"), "out")
	if logType != "out" && logType != "error" {
		return nil, nil, adminErr("VALIDATION_ERROR", "日志类型必须是 out 或 error", 422)
	}
	return map[string]any{
		"type": logType, "lines": d.RuntimeLog.Tail(logType == "error"),
		"missing": d.RuntimeLog == nil, "maxLines": runtimelog.Limit,
	}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/users/[id] — lib/services/users.js getUserDetailFull / setUserStatus
// ---------------------------------------------------------------------------

func adminBUserDetail(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	userID := strings.TrimSpace(r.PathValue("id"))
	if userID == "" {
		return nil, nil, adminBResultErr("用户不存在")
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	if r.Method == http.MethodGet {
		user, ok, err := adminBQueryOne(r.Context(), pool, `
			SELECT id, user_number, email, phone, display_name, avatar_url, role, credits,
			       status, registration_source, last_login_at, created_at
			FROM auth_usr.users WHERE id = $1`, userID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if !ok {
			return nil, nil, adminErr("NOT_FOUND", "用户不存在", 404)
		}
		detail := map[string]any{"user": user}
		queries := map[string]string{
			"subscriptions": `SELECT * FROM ops_bill.subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
			"orders":        `SELECT * FROM ops_bill.orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
			"creations":     `SELECT id, studio_id, label, status, credit_cost, model, created_at FROM ai_studio.creations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
			"ledger":        `SELECT * FROM ops_bill.credit_ledger_v2 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
			"sessions":      `SELECT token_hash, expires_at, last_seen_at, revoked_at, created_at FROM auth_usr.sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
			"notes":         `SELECT * FROM ops_bill.admin_notes WHERE target_type = 'user' AND target_id = $1 ORDER BY created_at DESC LIMIT 20`,
			"audit":         `SELECT * FROM ops_bill.admin_audit_logs WHERE target_type = 'user' AND target_id = $1 ORDER BY created_at DESC LIMIT 20`,
		}
		for name, sql := range queries {
			rows, err := adminBQueryRows(r.Context(), pool, sql, userID)
			if err != nil {
				// getUserDetailFull degrades each sub-query independently.
				detail[name] = []any{}
				continue
			}
			detail[name] = rows
		}
		wallet, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ops_bill.credit_wallets WHERE user_id = $1`, userID)
		detail["creditWallet"] = wallet
		currency, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ops_bill.currency_wallets WHERE user_id = $1`, userID)
		detail["currencyWallet"] = currency
		allTags, _ := adminBQueryRows(r.Context(), pool, `SELECT id, name, slug, color, description, created_at FROM ops_bill.tags ORDER BY created_at ASC`)
		detail["allTags"] = allTags
		return detail, nil, nil
	}
	var body struct {
		Status string `json:"status"`
	}
	adminBBodyOptional(r, 32*1024, &body)
	if body.Status != "active" && body.Status != "suspended" {
		return nil, nil, adminBResultErr("无效的用户状态参数")
	}
	user, ok, err := adminBQueryOne(r.Context(), pool, `SELECT id, role, status FROM auth_usr.users WHERE id = $1`, userID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if !ok {
		return nil, nil, adminBResultErr("用户不存在")
	}
	if body.Status == "suspended" && user["role"] == "super_admin" {
		var count int
		if err := pool.QueryRow(r.Context(), `SELECT COUNT(*)::int FROM auth_usr.users WHERE role = 'super_admin' AND status = 'active'`).Scan(&count); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		if count <= 1 {
			return nil, nil, adminBResultErr("不能封禁最后一个活跃超级管理员账户")
		}
	}
	_, err = pool.Exec(r.Context(), `UPDATE auth_usr.users SET status = $1, updated_at = now() WHERE id = $2`, body.Status, userID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	revoked := int64(0)
	if body.Status == "suspended" {
		tag, err := pool.Exec(r.Context(), `
			UPDATE auth_usr.sessions SET revoked_at = COALESCE(revoked_at, now())
			WHERE user_id = $1 AND revoked_at IS NULL`, userID)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		revoked = tag.RowsAffected()
	}
	updated, _, _ := adminBQueryOne(r.Context(), pool, `SELECT id, user_number, email, phone, phone_country_code, display_name, avatar_url,
			       role, credits, status, registration_source, last_login_ip, last_login_at,
			       created_at, updated_at
			FROM auth_usr.users WHERE id = $1`, userID)
	adminBAudit(r.Context(), pool, u, map[bool]string{true: "users.suspend", false: "users.activate"}[body.Status == "suspended"],
		"user", userID, "high", reqID, map[string]any{"before": user["status"], "after": body.Status, "revokedCount": revoked})
	return updated, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/users/[id]/credits — lib/services/credits.js adjustUserCredits
// ---------------------------------------------------------------------------

func adminBAdjustCredits(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	userID := strings.TrimSpace(r.PathValue("id"))
	var body struct {
		Delta       *float64 `json:"delta"`
		Reason      string   `json:"reason"`
		ReferenceID string   `json:"referenceId"`
	}
	adminBBodyOptional(r, 64*1024, &body)
	if body.Delta == nil || *body.Delta != float64(int64(*body.Delta)) || *body.Delta == 0 {
		return nil, nil, adminBResultErr("额度调整必须是非零整数")
	}
	amount := int64(*body.Delta)
	if u.Role == "support_admin" && (amount > 500 || amount < -500) {
		return nil, nil, adminBResultErr("支持人员单次调额上限为 500 额度")
	}
	if amount > 100000 || amount < -100000 {
		return nil, nil, adminBResultErr("单次调整额度不能超过 100,000")
	}
	reason := strings.TrimSpace(body.Reason)
	if reason == "" || len([]rune(reason)) > 200 {
		return nil, nil, adminBResultErr("请填写 1–200 字的调额原因")
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	tx, err := pool.Begin(r.Context())
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	defer tx.Rollback(r.Context())
	var legacyCredits int64
	if err := tx.QueryRow(r.Context(), `SELECT credits FROM auth_usr.users WHERE id = $1 FOR UPDATE`, userID).Scan(&legacyCredits); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, adminBResultErr("目标用户不存在")
		}
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	var perpetual int64
	err = tx.QueryRow(r.Context(), `SELECT perpetual_credits FROM ops_bill.credit_wallets WHERE user_id = $1 FOR UPDATE`, userID).Scan(&perpetual)
	if errors.Is(err, pgx.ErrNoRows) {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ops_bill.credit_wallets
				(user_id, daily_free_credits, subscription_credits, perpetual_credits, frozen_credits, version, created_at, updated_at)
			VALUES ($1,0,0,$2,0,1,now(),now())`, userID, legacyCredits)
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		perpetual = legacyCredits
	} else if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if perpetual+amount < 0 {
		return nil, nil, adminBResultErr("永久额度不足，不能从已冻结或过期额度中扣减")
	}
	if _, err := tx.Exec(r.Context(), `
		UPDATE ops_bill.credit_wallets SET perpetual_credits = $1, version = version + 1, updated_at = now()
		WHERE user_id = $2`, perpetual+amount, userID); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if err := generation.SyncLegacyUserCredits(r.Context(), tx, userID, time.Now().UTC()); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	ledgerID := adminBNewID("cl2")
	ref := body.ReferenceID
	if len(ref) > 120 {
		ref = ref[:120]
	}
	_, err = tx.Exec(r.Context(), `
		INSERT INTO ops_bill.credit_ledger_v2
			(id, user_id, bucket_type, delta, balance_after, action_type, reference_id,
			 description, idempotency_key, actor_user_id, created_at)
		VALUES ($1,$2,'PERPETUAL',$3,$4,'ADMIN_ADJUSTMENT',$5,$6,$7,$8,now())`,
		ledgerID, userID, amount, perpetual+amount, ref, reason,
		"admin-credit:"+strings.TrimSpace(r.Header.Get("Idempotency-Key")), u.ID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "credits.adjust", "user", userID, "high", reqID,
		map[string]any{"before": perpetual, "delta": amount, "reason": reason})
	if err := tx.Commit(r.Context()); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	return map[string]any{"success": true, "userId": userID, "credits": perpetual + amount,
		"delta": amount, "ledgerId": ledgerID}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/users/[id]/notes — lib/services/users.js addUserAdminNote
// ---------------------------------------------------------------------------

func adminBUserNote(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	userID := strings.TrimSpace(r.PathValue("id"))
	var body struct {
		Body string `json:"body"`
	}
	adminBBodyOptional(r, 64*1024, &body)
	text := strings.TrimSpace(body.Body)
	if text == "" {
		return nil, nil, adminBResultErr("备注内容不能为空")
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	var exists int
	if err := pool.QueryRow(r.Context(), `SELECT 1 FROM auth_usr.users WHERE id = $1`, userID).Scan(&exists); errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, adminBResultErr("用户不存在")
	} else if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	id := adminBNewID("note")
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ops_bill.admin_notes (id, target_type, target_id, body, author_id, author_email, created_at)
		VALUES ($1,'user',$2,$3,$4,$5,now())`, id, userID, text, u.ID, adminBActorEmail(u))
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	note, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ops_bill.admin_notes WHERE id = $1`, id)
	adminBAudit(r.Context(), pool, u, "notes.create", "user", userID, "low", reqID, map[string]any{"noteId": id})
	return map[string]any{"note": note}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/users/[id]/sessions — lib/services/users.js revokeUserSessions
// ---------------------------------------------------------------------------

func adminBRevokeUserSessions(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	userID := strings.TrimSpace(r.PathValue("id"))
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	var exists int
	if err := pool.QueryRow(r.Context(), `SELECT 1 FROM auth_usr.users WHERE id = $1`, userID).Scan(&exists); errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, adminBResultErr("用户不存在")
	} else if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	tag, err := pool.Exec(r.Context(), `
		UPDATE auth_usr.sessions SET revoked_at = COALESCE(revoked_at, now())
		WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "sessions.revoke_all", "user", userID, "medium", reqID,
		map[string]any{"revokedCount": tag.RowsAffected()})
	return map[string]any{"revokedCount": tag.RowsAffected()}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/users/[id]/tags — lib/services/users.js manageUserTag
// ---------------------------------------------------------------------------

func adminBUserTag(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	userID := strings.TrimSpace(r.PathValue("id"))
	var body struct {
		TagID  string `json:"tagId"`
		Action string `json:"action"`
	}
	adminBBodyOptional(r, 32*1024, &body)
	tagID := strings.TrimSpace(body.TagID)
	if tagID == "" {
		return nil, nil, adminErr("VALIDATION_ERROR", "缺少 tagId 参数", 422)
	}
	action := "add"
	if body.Action == "remove" {
		action = "remove"
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	var exists int
	if err := pool.QueryRow(r.Context(), `SELECT 1 FROM auth_usr.users WHERE id = $1`, userID).Scan(&exists); errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, adminBResultErr("用户不存在")
	} else if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if err := pool.QueryRow(r.Context(), `SELECT 1 FROM ops_bill.tags WHERE id = $1`, tagID).Scan(&exists); errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, adminBResultErr("标签不存在")
	} else if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	if action == "add" {
		_, err := pool.Exec(r.Context(), `
			INSERT INTO ops_bill.user_tags (user_id, tag_id, created_by, created_at)
			VALUES ($1,$2,$3,now()) ON CONFLICT (user_id, tag_id) DO NOTHING`, userID, tagID, adminBActorEmail(u))
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
	} else {
		if _, err := pool.Exec(r.Context(), `DELETE FROM ops_bill.user_tags WHERE user_id = $1 AND tag_id = $2`, userID, tagID); err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
	}
	refreshed, _, _ := adminBQueryOne(r.Context(), pool, `SELECT id, user_number, email, phone, phone_country_code, display_name, avatar_url,
			       role, credits, status, registration_source, last_login_ip, last_login_at,
			       created_at, updated_at
			FROM auth_usr.users WHERE id = $1`, userID)
	adminBAudit(r.Context(), pool, u, map[bool]string{true: "users.tag_add", false: "users.tag_remove"}[action == "add"],
		"user", userID, "low", reqID, map[string]any{"tagId": tagID, "action": action})
	return refreshed, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/users/dashboard — lib/services/userDashboard.js
// ---------------------------------------------------------------------------

func adminBUserDashboard(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	period := firstNonEmpty(r.URL.Query().Get("period"), "day")
	interval := "INTERVAL '1 day'"
	switch period {
	case "7d", "week":
		interval = "INTERVAL '7 days'"
	case "30d", "month":
		interval = "INTERVAL '30 days'"
	}
	// Queries user KPIs, registrations series, and paid conversions for the requested period.
	kpi, _, err := adminBQueryOne(r.Context(), pool, `
		SELECT
			COUNT(*) FILTER (WHERE created_at >= now() - `+interval+`)::int AS new_users,
			COUNT(*)::int AS total_users,
			COUNT(*) FILTER (WHERE status = 'active')::int AS active_users,
			COUNT(*) FILTER (WHERE last_login_at >= now() - `+interval+`)::int AS returning_users
		FROM auth_usr.users`)
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	daily, _ := adminBQueryRows(r.Context(), pool, `
		SELECT date_trunc('day', created_at)::date::text AS day, COUNT(*)::int AS count
		FROM auth_usr.users WHERE created_at >= now() - `+interval+`
		GROUP BY 1 ORDER BY 1 ASC`)
	paidConversions, _ := adminBQueryRows(r.Context(), pool, `
		SELECT date_trunc('day', COALESCE(paid_at, created_at))::date::text AS day,
			COUNT(*)::int AS orders, COUNT(DISTINCT user_id)::int AS buyers
		FROM ops_bill.orders WHERE status = 'paid' AND COALESCE(paid_at, created_at) >= now() - `+interval+`
		GROUP BY 1 ORDER BY 1 ASC`)
	data := map[string]any{"period": period, "kpi": kpi, "registrations": daily, "paidConversions": paidConversions}
	return data, map[string]any{"period": period}, nil
}

// ---------------------------------------------------------------------------
// /api/admin/visitors/analytics — lib/services/visitorAnalytics.js
// ---------------------------------------------------------------------------

func adminBVisitorAnalytics(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	defaults := map[string]any{
		"googleAnalytics": map[string]any{"enabled": false, "measurementId": "", "propertyId": "",
			"serviceAccountEmail": "", "serviceAccountPrivateKey": ""},
		"baiduTongji":      map[string]any{"enabled": false, "siteId": ""},
		"microsoftClarity": map[string]any{"enabled": false, "projectId": ""},
		"customScript":     map[string]any{"enabled": false, "code": ""},
	}
	links := map[string]any{
		"googleAnalytics": map[string]any{"name": "Google Analytics 4", "consoleUrl": "https://analytics.google.com/",
			"dashboardUrl": "https://analytics.google.com/analytics/web/#/realtime", "docsUrl": "https://support.google.com/analytics/answer/9304153"},
		"baiduTongji": map[string]any{"name": "百度统计", "consoleUrl": "https://tongji.baidu.com/",
			"dashboardUrl": "https://tongji.baidu.com/web/welcome/login", "docsUrl": "https://tongji.baidu.com/help/getstart/code.html"},
		"microsoftClarity": map[string]any{"name": "Microsoft Clarity", "consoleUrl": "https://clarity.microsoft.com/",
			"dashboardUrl": "https://clarity.microsoft.com/projects", "docsUrl": "https://learn.microsoft.com/en-us/clarity/"},
	}
	if r.Method == http.MethodGet {
		value, ok, err := adminBReadSetting(r.Context(), pool, "visitor_analytics")
		if err != nil {
			return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
		}
		config := defaults
		if ok {
			config = adminBJSON(value)
		}
		return map[string]any{"config": config, "defaults": defaults, "links": links}, nil, nil
	}
	var body map[string]any
	if ae := adminBBody(r, 128*1024, &body); ae != nil {
		return nil, nil, adminErr("VALIDATION_ERROR", "请求体必须为合法 JSON", 400)
	}
	config := body["config"]
	if config == nil {
		config = body
	}
	cfg, ok := config.(map[string]any)
	if !ok || len(cfg) == 0 {
		return nil, nil, adminErr("VALIDATION_ERROR", "请求体必须为合法 JSON", 400)
	}
	// validateVisitorAnalyticsConfig rejects unknown keys and non-boolean enabled flags.
	for name, section := range cfg {
		m, ok := section.(map[string]any)
		if !ok {
			return nil, nil, adminErr("VALIDATION_ERROR", name+" 配置必须是对象", 422)
		}
		if _, exists := defaults[name]; !exists {
			return nil, nil, adminErr("VALIDATION_ERROR", "不支持的分析渠道: "+name, 422)
		}
		if enabled, exists := m["enabled"]; exists {
			if _, ok := enabled.(bool); !ok {
				return nil, nil, adminErr("VALIDATION_ERROR", name+".enabled 必须为布尔值", 422)
			}
		}
	}
	if err := adminBWriteSetting(r.Context(), pool, "visitor_analytics", cfg, "public", adminBActorEmail(u)); err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	adminBAudit(r.Context(), pool, u, "visitor_analytics.update", "system_setting", "visitor_analytics", "medium", reqID, cfg)
	return map[string]any{"config": cfg, "links": links}, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/visitors/analytics/ga4 — lib/services/ga4DataApi.js
// ---------------------------------------------------------------------------

func adminBVisitorGA4(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	value, _, err := adminBReadSetting(r.Context(), pool, "visitor_analytics")
	if err != nil {
		return nil, nil, adminBInternal(err, "管理操作暂时不可用，请稍后重试")
	}
	config := adminBJSON(adminBJSON(value)["googleAnalytics"])
	var body struct {
		PropertyID          string `json:"propertyId"`
		ServiceAccountEmail string `json:"serviceAccountEmail"`
		ServiceAccountKey   string `json:"serviceAccountPrivateKey"`
	}
	if r.Method == http.MethodPost {
		if ae := adminBBody(r, 128*1024, &body); ae != nil {
			return nil, nil, ae
		}
		if v := strings.TrimSpace(body.PropertyID); v != "" {
			config["propertyId"] = v
		}
		if v := strings.TrimSpace(body.ServiceAccountEmail); v != "" {
			config["serviceAccountEmail"] = v
		}
		if v := strings.TrimSpace(body.ServiceAccountKey); v != "" {
			config["serviceAccountPrivateKey"] = v
		}
	}
	propertyID := adminBStr(config["propertyId"])
	hasCredentials := adminBStr(config["serviceAccountEmail"]) != "" && adminBStr(config["serviceAccountPrivateKey"]) != ""
	if propertyID == "" {
		return map[string]any{"configured": false, "measurementId": adminBStr(config["measurementId"]),
			"propertyId": "", "hasCredentials": hasCredentials,
			"message": "尚未配置完整的 GA4 Property ID 或 Service Account 凭据"}, nil, nil
	}
	if !hasCredentials {
		return map[string]any{"configured": false, "measurementId": adminBStr(config["measurementId"]),
			"propertyId": propertyID, "hasCredentials": false,
			"message": "尚未配置完整的 GA4 Service Account 凭据"}, nil, nil
	}
	report, err := fetchGA4AnalyticsReport(r.Context(), config, d.Config.AllowedPrivateHosts)
	if err != nil {
		return nil, nil, adminErr("GA4_API_ERROR", fmt.Sprintf("GA4 数据拉取失败: %v", err), 502)
	}
	return report, nil, nil
}

// ---------------------------------------------------------------------------
// /api/admin/webhooks/[id]/replay — lib/services/webhookDispatcher.js
// ---------------------------------------------------------------------------

func adminBWebhookReplay(_ http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError) {
	eventID := strings.TrimSpace(r.PathValue("id"))
	if eventID == "" {
		return nil, nil, adminErr("NOT_FOUND", "Webhook 事件记录不存在", 404)
	}
	pool, ae := adminBDB(d, reqID)
	if ae != nil {
		return nil, nil, ae
	}
	res, err := d.billingService().ReplayWebhookEvent(r.Context(), eventID)
	if err != nil {
		var be *billing.ServiceError
		if errors.As(err, &be) {
			return nil, nil, adminErr(be.Code, be.Message, be.Status)
		}
		return nil, nil, adminBInternal(err, "Webhook 重放执行失败")
	}
	updated, _, _ := adminBQueryOne(r.Context(), pool, `SELECT * FROM ops_bill.webhook_events WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1`, eventID)
	adminBAudit(r.Context(), pool, u, "webhooks.replay", "webhook_event", eventID, "medium", reqID,
		map[string]any{"action": res.Action, "orderId": res.OrderID})
	return map[string]any{"event": updated, "dispatch": res}, nil, nil
}
