// Package handler: shared admin protocol layer for the ONE Go monolith.
//
// It mirrors Supdance Pro/lib/admin/{authz,idempotency}.js exactly:
//   - requirePermission: session + role + explicit permission, error codes/messages unchanged.
//   - checkIdempotency/complete/release: ops_bill.idempotency_keys INSERT ON CONFLICT DO NOTHING
//     with 24h expiry, cached completed-response replay, and processing-key release on failure.
//   - error boundary: any panic becomes INTERNAL_ERROR 500 in admin_ok_meta_envelope.
//
// Unit tests run with Pool == nil; the idempotency store then degrades to an in-memory table
// so write-path semantics remain verifiable without a live database.
package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

// ---------------------------------------------------------------------------
// Permission + response wrapper
// ---------------------------------------------------------------------------

// adminPermission normalizes the PERMISSIONS.<camelCaseKey> names extracted from source
// route files into the dotted permission strings consumed by middleware.HasPermission.
// Wave batches pass the raw `perms[0]` from .migration/spec_*.json; this is the single
// translation point (lib/admin/permissions.js is the source of truth).
var adminPermissionNames = map[string]string{
	"dashboardRead": "dashboard.read", "usersRead": "users.read", "usersUpdate": "users.update",
	"usersNote": "users.note", "usersDelete": "users.delete", "sessionsRevoke": "sessions.revoke",
	"creditsRead": "credits.read", "creditsAdjust": "credits.adjust", "billingRead": "billing.read",
	"billingWrite": "billing.write", "plansRead": "plans.read", "plansWrite": "plans.write",
	"generationsRead": "generations.read", "generationsWrite": "generations.write",
	"moderationRead": "moderation.read", "moderationWrite": "moderation.write",
	"providersRead": "providers.read", "providersWrite": "providers.write",
	"modelsRead": "models.read", "modelsWrite": "models.write",
	"couponsRead": "coupons.read", "couponsWrite": "coupons.write",
	"exportsRead": "exports.read", "exportsWrite": "exports.write",
	"webhooksRead": "webhooks.read", "webhooksReplay": "webhooks.replay",
	"healthRead": "health.read", "settingsRead": "settings.read", "settingsWrite": "settings.write",
	"storageRead": "storage.read", "storageWrite": "storage.write",
	"i18nRead": "i18n.read", "i18nWrite": "i18n.write", "auditRead": "audit.read",
	"adminsWrite": "admins.write", "contentRead": "content.read", "contentWrite": "content.write",
}

func adminPermission(raw string) string {
	if mapped, ok := adminPermissionNames[raw]; ok {
		return mapped
	}
	return raw // already dotted
}

func adminPermissionFor(w http.ResponseWriter, r *http.Request, permissionRaw string) (*middleware.SessionUser, string, bool) {
	permission := adminPermission(permissionRaw)
	reqID := envelope.NewRequestID(r)
	u, _ := middleware.UserFromContext(r.Context())
	if u == nil {
		envelope.AdminError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "请先登录管理员账户", reqID)
		return nil, reqID, false
	}
	if u.Role == "user" {
		envelope.AdminError(w, http.StatusForbidden, "FORBIDDEN", "当前账户为普通用户，无权访问管理运营后台", reqID)
		return nil, reqID, false
	}
	if !middleware.HasPermission(u.Role, permission) {
		envelope.AdminError(w, http.StatusForbidden, "FORBIDDEN", "权限不足：当前角色无权执行 "+permission+" 操作", reqID)
		return nil, reqID, false
	}
	return u, reqID, true
}

type adminError struct {
	code    string
	message string
	status  int
}

func adminErr(code, message string, status int) *adminError {
	return &adminError{code: code, message: message, status: status}
}

// adminAlreadyWritten is returned by a handler that wrote its own response (binary export,
// CSV download, etc.); wrapAdmin then skips the default AdminOK envelope.
type adminAlreadyWritten struct{}

var AdminAlreadyWritten = adminAlreadyWritten{}

// adminHandler returns response data + optional meta, or a typed admin error. It receives the
// authenticated admin user and requestId so wave batches never re-implement auth plumbing.
type adminHandler func(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError)

// wrapAdmin composes auth + idempotency (write routes only) + panic boundary + exact envelope.
// `permission` is the source route's PERMISSIONS.<key>; `scope` is its checkIdempotency scope
// (empty for read-only routes).
func wrapAdmin(d *Dependencies, permission, scope string, fn adminHandler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := envelope.NewRequestID(r)
		defer func() {
			if recover() != nil {
				envelope.AdminError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "管理操作暂时不可用，请稍后重试", reqID)
			}
		}()

		u, reqID, ok := adminPermissionFor(w, r, permission)
		if !ok {
			return
		}

		var keyHash string
		completed := false
		if scope != "" && isAdminWriteMethod(r.Method) {
			key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
			if len(key) < 8 || len(key) > 200 {
				envelope.AdminError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "高风险写操作必须提供有效的 Idempotency-Key", reqID)
				return
			}
			res, err := d.idempotency().Check(r.Context(), scope, key, u.ID)
			if err != nil {
				envelope.AdminError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "管理操作暂时不可用，请稍后重试", reqID)
				return
			}
			if !res.Allowed {
				if res.CachedResponse != nil {
					envelope.AdminOK(w, http.StatusOK, res.CachedResponse, reqID, nil)
				} else {
					envelope.AdminError(w, http.StatusConflict, "CONFLICT", "操作正在处理中", reqID)
				}
				return
			}
			keyHash = res.KeyHash
			defer func() {
				if keyHash != "" && !completed {
					_ = d.idempotency().Release(r.Context(), keyHash)
				}
			}()
		}

		data, meta, aerr := fn(w, r, d, u, reqID)
		if aerr != nil {
			envelope.AdminError(w, aerr.status, aerr.code, aerr.message, reqID)
			return
		}
		if keyHash != "" {
			if err := d.idempotency().Complete(r.Context(), keyHash, data); err != nil {
				envelope.AdminError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "管理操作暂时不可用，请稍后重试", reqID)
				return
			}
			completed = true
		}
		if _, already := data.(adminAlreadyWritten); already {
			return
		}
		envelope.AdminOK(w, http.StatusOK, data, reqID, meta)
	})
}

func isAdminWriteMethod(method string) bool {
	switch strings.ToUpper(method) {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}

// ---------------------------------------------------------------------------
// Idempotency store
// ---------------------------------------------------------------------------

type idempotencyResult struct {
	Allowed        bool
	KeyHash        string
	CachedResponse any
}

type idempotencyStore struct {
	pool *pgxpool.Pool
}

type idempotencyRecord struct {
	Status   string
	Response any
	Expires  time.Time
}

func (d *Dependencies) idempotency() *idempotencyStore {
	return &idempotencyStore{pool: d.Pool}
}

// A process-wide in-memory fallback keeps replay semantics consistent across requests in
// tests (a fresh table per request would never observe a duplicate key).
var (
	globalMemMu    sync.Mutex
	globalMemStore = make(map[string]*idempotencyRecord)
)

func hashIdempotencyKey(scope, actorID, key string) string {
	sum := sha256.Sum256([]byte(scope + ":" + actorID + ":" + key))
	return hex.EncodeToString(sum[:])
}

func (s *idempotencyStore) Check(ctx context.Context, scope, key, actorID string) (*idempotencyResult, error) {
	keyHash := hashIdempotencyKey(scope, actorID, key)
	if s.pool == nil {
		globalMemMu.Lock()
		defer globalMemMu.Unlock()
		now := time.Now()
		for k, rec := range globalMemStore {
			if rec.Expires.Before(now) {
				delete(globalMemStore, k)
			}
		}
		if rec, ok := globalMemStore[keyHash]; ok {
			if rec.Status == "completed" && rec.Response != nil {
				return &idempotencyResult{Allowed: false, KeyHash: keyHash, CachedResponse: rec.Response}, nil
			}
			return &idempotencyResult{Allowed: false, KeyHash: keyHash}, nil
		}
		globalMemStore[keyHash] = &idempotencyRecord{Status: "processing", Expires: now.Add(24 * time.Hour)}
		return &idempotencyResult{Allowed: true, KeyHash: keyHash}, nil
	}

	now := time.Now().UTC()
	if _, err := s.pool.Exec(ctx, `DELETE FROM ops_bill.idempotency_keys WHERE expires_at < $1`, now); err != nil {
		return nil, err
	}
	var inserted string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO ops_bill.idempotency_keys (key_hash, scope, actor_id, status, created_at, expires_at)
		VALUES ($1, $2, $3, 'processing', $4, $5)
		ON CONFLICT (key_hash) DO NOTHING
		RETURNING key_hash`, keyHash, scope, actorID, now, now.Add(24*time.Hour)).Scan(&inserted)
	if err == nil {
		return &idempotencyResult{Allowed: true, KeyHash: keyHash}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	var status string
	var raw []byte
	if err := s.pool.QueryRow(ctx, `SELECT status, COALESCE(response_json::text, '') FROM ops_bill.idempotency_keys WHERE key_hash = $1`, keyHash).Scan(&status, &raw); err != nil {
		return nil, err
	}
	if status == "completed" && len(raw) > 0 {
		var cached any
		if json.Unmarshal(raw, &cached) == nil {
			return &idempotencyResult{Allowed: false, KeyHash: keyHash, CachedResponse: cached}, nil
		}
	}
	return &idempotencyResult{Allowed: false, KeyHash: keyHash}, nil
}

func (s *idempotencyStore) Complete(ctx context.Context, keyHash string, data any) error {
	if keyHash == "" {
		return nil
	}
	if s.pool == nil {
		globalMemMu.Lock()
		defer globalMemMu.Unlock()
		if rec, ok := globalMemStore[keyHash]; ok {
			rec.Status = "completed"
			rec.Response = data
		}
		return nil
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `UPDATE ops_bill.idempotency_keys SET status = 'completed', response_json = $1::jsonb WHERE key_hash = $2`, raw, keyHash)
	return err
}

func (s *idempotencyStore) Release(ctx context.Context, keyHash string) error {
	if keyHash == "" {
		return nil
	}
	if s.pool == nil {
		globalMemMu.Lock()
		defer globalMemMu.Unlock()
		if rec, ok := globalMemStore[keyHash]; ok && rec.Status == "processing" {
			delete(globalMemStore, keyHash)
		}
		return nil
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM ops_bill.idempotency_keys WHERE key_hash = $1 AND status = 'processing'`, keyHash)
	return err
}
