package middleware

import (
	"net/http"
	"regexp"
	"strings"
)

var localhostOriginRe = regexp.MustCompile(`^https?://(localhost|127\.0\.0\.1)(:\d+)?$`)

func IsAllowedCanvasOrigin(origin string, isProduction bool) bool {
	trimmed := strings.TrimSpace(origin)
	if trimmed == "" {
		return false
	}
	lower := strings.ToLower(trimmed)
	switch lower {
	case "https://www.supdance.com", "https://supdance.com", "https://canvas.supdance.com":
		return true
	}
	if !isProduction && localhostOriginRe.MatchString(lower) {
		return true
	}
	return false
}

// CanvasCORS handles Canvas cross-origin API requests and OPTIONS preflight matching middleware.js.
func CanvasCORS(isProduction bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				origin := r.Header.Get("Origin")
				if IsAllowedCanvasOrigin(origin, isProduction) {
					h := w.Header()
					h.Set("Access-Control-Allow-Origin", origin)
					h.Set("Access-Control-Allow-Credentials", "true")
					h.Add("Vary", "Origin")
					if r.Method == http.MethodOptions {
						h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
						h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, X-KoyoSIM-Canvas, X-SupDance-Canvas, Accept, X-Requested-With")
						h.Set("Access-Control-Max-Age", "86400")
						w.WriteHeader(http.StatusNoContent)
						return
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
