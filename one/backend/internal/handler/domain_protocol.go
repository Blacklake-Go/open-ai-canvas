// Package handler: shared domain protocol layer for ONE's non-admin API routes.
//
// The 55 remaining non-admin routes (generation, assets, canvas, community, proxies, misc)
// share the same auth/preflight/error plumbing. wrapDomain centralizes it so wave batches
// only implement business behaviour and never re-invent middleware chains.
package handler

import (
	"net/http"
	"strconv"
	"strings"

	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

// domainFn writes the concrete response using envelope.*. It receives the (possibly nil)
// authenticated user; write-path handlers must validate ownership explicitly.
type domainFn func(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser)

// wrapDomain applies the route's policyTier auth policy. Canvas-style OPTIONS preflight is
// already terminated by middleware.CanvasCORS at the router level; for non-canvas OPTIONS the
// compiled route simply has no matching method and returns the standard 405 Allow header.
// `signature` tier still requires the business function to verify the provider signature.
func wrapDomain(d *Dependencies, policyTier string, fn domainFn) http.Handler {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, _ := middleware.UserFromContext(r.Context())
		fn(w, r, d, u)
	})
	switch policyTier {
	case "authenticated_or_domain", "signature":
		return middleware.RequireAuth(d.SessionAuth)(inner)
	default: // public, legacyProxy
		return middleware.OptionalAuth(d.SessionAuth)(inner)
	}
}

// dbUnavailable writes a truthful, format-correct error when a handler needs PostgreSQL but
// the process has no pool (unit-test / degraded mode). It never fabricates domain data.
func dbUnavailable(w http.ResponseWriter, r *http.Request, format envelope.Format) {
	envelope.WriteErrorByFormat(w, r, format, http.StatusServiceUnavailable, "DB_UNAVAILABLE", "持久数据服务暂不可用")
}

// pathParam returns a Next.js dynamic segment value already bound by the router.
func pathParam(r *http.Request, name string) string {
	return strings.TrimSpace(r.PathValue(name))
}

// queryInt parses an integer query parameter with a bounded default.
func queryInt(r *http.Request, key string, def, min, max int) int {
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
