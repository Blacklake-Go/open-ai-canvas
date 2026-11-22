package middleware

import (
	"net/http"
	"strings"
)

const baseCSP = "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://*.googletagmanager.com https://hm.baidu.com https://www.clarity.ms https://*.clarity.ms https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https://canvas.supdance.com https://*.supdance.com https://muapi.ai https://*.muapi.ai https://www.runninghub.ai https://*.runninghub.ai https://*.runninghub.cn https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://hm.baidu.com https://www.clarity.ms https://*.clarity.ms https://accounts.google.com; font-src 'self' data: https://fonts.gstatic.com; frame-src 'self' https://*.alipay.com https://openapi.alipay.com https://excashier.alipay.com https://unitradeprod.alipay.com https://*.alipayobjects.com https://accounts.google.com;"

// SecurityHeaders mirrors Supdance Pro/middleware.js `addSecurityHeaders` including the `/embed-auth` exception.
func SecurityHeaders(isProduction bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			embeddedAuth := r.URL.Path == "/embed-auth"

			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			if embeddedAuth {
				h.Del("X-Frame-Options")
			} else {
				h.Set("X-Frame-Options", "DENY")
			}
			h.Set("X-XSS-Protection", "1; mode=block")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			if !strings.HasPrefix(r.URL.Path, "/api/generations/events") {
				h.Set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
				h.Set("Pragma", "no-cache")
			}

			framePolicy := "frame-ancestors 'none';"
			if embeddedAuth {
				framePolicy = "frame-ancestors 'self' https://canvas.supdance.com https://www.supdance.com https://supdance.com;"
				if !isProduction {
					framePolicy = "frame-ancestors 'self' https://canvas.supdance.com https://www.supdance.com https://supdance.com http://localhost:* http://127.0.0.1:*;"
				}
			}
			h.Set("Content-Security-Policy", baseCSP+" "+framePolicy)

			next.ServeHTTP(w, r)
		})
	}
}
