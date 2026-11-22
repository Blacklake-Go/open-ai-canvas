package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"one/backend/internal/pkg/envelope"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const SessionCookieName = "ko_session"

type SessionUser struct {
	ID            string  `json:"id"`
	UserNumber    string  `json:"userNumber"`
	Email         *string `json:"email"`
	Phone         *string `json:"phone"`
	DisplayName   string  `json:"displayName"`
	AvatarURL     *string `json:"avatar"`
	Role          string  `json:"role"`
	Status        string  `json:"status"`
	Locale        string  `json:"locale"`
	Credits       int64   `json:"credits"`
	IsSubscribed  bool    `json:"isSubscribed"`
	PlanID        string  `json:"planId"`
	OnboardingOK  bool    `json:"onboardingCompleted"`
	OnboardingStp int     `json:"onboardingStep"`
}

type SessionLookup interface {
	LookupByTokenHash(ctx context.Context, tokenHash string) (*SessionUser, error)
}

type PGSessionLookup struct {
	Pool *pgxpool.Pool
}

func HashSessionToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

const pgSessionLookupSQL = `
		SELECT
			u.id,
			COALESCE(u.user_number, u.id) AS user_number,
			u.email,
			u.phone,
			COALESCE(NULLIF(u.display_name, ''), NULLIF(split_part(u.email, '@', 1), ''), '创作者#' || u.id) AS display_name,
			u.avatar_url,
			COALESCE(u.role, 'user') AS role,
			COALESCE(u.status, 'active') AS status,
			COALESCE(NULLIF(u.locale, ''), 'en') AS locale,
			COALESCE(u.credits, 0)::bigint AS credits,
			(sub.plan_id IS NOT NULL) AS is_subscribed,
			COALESCE(NULLIF(sub.plan_id, ''), 'free') AS plan_id,
			COALESCE(u.onboarding_completed, false) AS onboarding_completed,
			COALESCE(u.onboarding_step, 0) AS onboarding_step,
			u.deletion_due_at,
			s.expires_at
		FROM auth_usr.sessions s
		JOIN auth_usr.users u ON u.id = s.user_id
		LEFT JOIN LATERAL (
			SELECT sub_inner.plan_id
			FROM ops_bill.subscriptions sub_inner
			WHERE sub_inner.user_id = u.id
			  AND sub_inner.status IN ('active', 'trialing')
			  AND (sub_inner.current_period_end IS NULL OR sub_inner.current_period_end > now())
			ORDER BY sub_inner.updated_at DESC
			LIMIT 1
		) sub ON TRUE
		WHERE s.token_hash = $1
		  AND s.revoked_at IS NULL
		LIMIT 1
	`

func (s *PGSessionLookup) LookupByTokenHash(ctx context.Context, tokenHash string) (*SessionUser, error) {
	if s == nil || s.Pool == nil {
		return nil, errors.New("session lookup pool is nil")
	}
	var u SessionUser
	var deletionDueAt *time.Time
	var expiresAt time.Time
	err := s.Pool.QueryRow(ctx, pgSessionLookupSQL, tokenHash).Scan(
		&u.ID,
		&u.UserNumber,
		&u.Email,
		&u.Phone,
		&u.DisplayName,
		&u.AvatarURL,
		&u.Role,
		&u.Status,
		&u.Locale,
		&u.Credits,
		&u.IsSubscribed,
		&u.PlanID,
		&u.OnboardingOK,
		&u.OnboardingStp,
		&deletionDueAt,
		&expiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !isSessionUserEligible(u.Status, deletionDueAt, expiresAt, time.Now()) {
		return nil, nil
	}
	if u.PlanID == "" {
		u.PlanID = "free"
	}
	return &u, nil
}

func isSessionUserEligible(status string, deletionDueAt *time.Time, expiresAt, now time.Time) bool {
	if status == "suspended" || status == "deleted" || !expiresAt.After(now) {
		return false
	}
	if status == "deletion_pending" && deletionDueAt != nil && !deletionDueAt.After(now) {
		return false
	}
	return true
}

type contextKey int

const userContextKey contextKey = 1

func UserFromContext(ctx context.Context) (*SessionUser, bool) {
	u, ok := ctx.Value(userContextKey).(*SessionUser)
	return u, ok && u != nil
}

func ContextWithUser(ctx context.Context, u *SessionUser) context.Context {
	return context.WithValue(ctx, userContextKey, u)
}

func ExtractSessionToken(r *http.Request) string {
	if r == nil {
		return ""
	}
	c, err := r.Cookie(SessionCookieName)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(c.Value)
}

// OptionalAuth resolves `ko_session` via SHA-256 lookup when present and attaches
// the SessionUser to request context without rejecting anonymous requests.
func OptionalAuth(store SessionLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if store != nil {
				if raw := ExtractSessionToken(r); raw != "" {
					if user, err := store.LookupByTokenHash(r.Context(), HashSessionToken(raw)); err == nil && user != nil {
						r = r.WithContext(ContextWithUser(r.Context(), user))
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequireAuth(store SessionLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return OptionalAuth(store)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, ok := UserFromContext(r.Context()); !ok {
				if strings.HasPrefix(r.URL.Path, "/api/admin/") {
					envelope.AdminError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "请先登录管理员账户", envelope.NewRequestID(r))
					return
				}
				if r.URL.Path == "/api/generations/events" {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}
				envelope.DomainError(w, http.StatusUnauthorized, "Unauthorized", "UNAUTHENTICATED")
				return
			}
			next.ServeHTTP(w, r)
		}))
	}
}

var rolePermissions = map[string]map[string]bool{
	"super_admin": nil, // wildcard all
	"admin":       nil, // wildcard all
	"operations_admin": {
		"dashboard.read": true, "users.read": true, "users.update": true, "users.note": true,
		"sessions.revoke": true, "generations.read": true, "generations.write": true,
		"moderation.read": true, "moderation.write": true, "providers.read": true,
		"models.read": true, "models.write": true, "webhooks.read": true,
		"exports.read": true, "exports.write": true, "health.read": true,
		"storage.read": true, "storage.write": true, "audit.read": true,
		"settings.read": true, "settings.write": true, "i18n.read": true,
		"i18n.write": true, "content.read": true, "content.write": true,
	},
	"finance_admin": {
		"dashboard.read": true, "users.read": true, "credits.read": true, "credits.adjust": true,
		"billing.read": true, "billing.write": true, "plans.read": true, "plans.write": true,
		"webhooks.read": true, "webhooks.replay": true, "providers.read": true, "models.read": true,
		"coupons.read": true, "coupons.write": true, "exports.read": true, "exports.write": true,
		"audit.read": true,
	},
	"support_admin": {
		"dashboard.read": true, "users.read": true, "sessions.revoke": true,
		"credits.read": true, "credits.adjust": true, "users.note": true,
		"generations.read": true, "coupons.read": true, "audit.read": true,
	},
	"auditor": {
		"dashboard.read": true, "users.read": true, "credits.read": true,
		"billing.read": true, "plans.read": true, "generations.read": true,
		"moderation.read": true, "providers.read": true, "models.read": true,
		"coupons.read": true, "exports.read": true, "webhooks.read": true,
		"health.read": true, "settings.read": true, "storage.read": true,
		"i18n.read": true, "audit.read": true,
	},
}

func HasPermission(role, permission string) bool {
	if role == "" || role == "user" || permission == "" {
		return false
	}
	if role == "super_admin" || role == "admin" {
		return true
	}
	perms, ok := rolePermissions[role]
	if !ok {
		return false
	}
	return perms[permission]
}

// RequirePermission mirrors Supdance Pro/lib/admin/authz.js `requirePermission`.
func RequirePermission(store SessionLookup, permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return RequireAuth(store)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqID := envelope.NewRequestID(r)
			user, _ := UserFromContext(r.Context())
			if user.Role == "user" {
				envelope.AdminError(w, http.StatusForbidden, "FORBIDDEN", "当前账户为普通用户，无权访问管理运营后台", reqID)
				return
			}
			if !HasPermission(user.Role, permission) {
				envelope.AdminError(w, http.StatusForbidden, "FORBIDDEN", "权限不足：当前角色无权执行 "+permission+" 操作", reqID)
				return
			}
			next.ServeHTTP(w, r)
		}))
	}
}
