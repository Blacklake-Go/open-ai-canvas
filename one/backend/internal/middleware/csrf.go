package middleware

import (
	"net/http"
	"net/url"
	"strings"

	"one/backend/internal/config"
	"one/backend/internal/pkg/envelope"
)

var csrfExemptExact = map[string]bool{
	"/api/billing/webhooks/stripe": true,
	"/api/billing/webhooks/alipay": true,
	"/api/billing/webhooks/wechat": true,
	"/api/billing/webhooks/paypal": true,
	// Bilibili / Douyin open-platform callbacks carry no browser Origin. Their route
	// sources call no guardMutation, so the edge guard must exempt them explicitly.
	"/api/webhooks/bilibili": true,
	"/api/webhooks/douyin":   true,
}

func IsCSRFExemptPath(path string) bool {
	if csrfExemptExact[path] {
		return true
	}
	// /api/generations/[id]/callback
	if strings.HasPrefix(path, "/api/generations/") && strings.HasSuffix(path, "/callback") {
		rest := strings.TrimSuffix(strings.TrimPrefix(path, "/api/generations/"), "/callback")
		if rest != "" && !strings.Contains(rest, "/") {
			return true
		}
	}
	// /api/auth/oauth/[provider]/webhook
	if strings.HasPrefix(path, "/api/auth/oauth/") && strings.HasSuffix(path, "/webhook") {
		rest := strings.TrimSuffix(strings.TrimPrefix(path, "/api/auth/oauth/"), "/webhook")
		if rest != "" && !strings.Contains(rest, "/") {
			return true
		}
	}
	// Machine-to-machine federation ticket bridge routes
	if strings.HasPrefix(path, "/api/supdance/federation/") {
		return true
	}
	return false
}

func safeOrigin(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	u, err := url.Parse(trimmed)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return strings.ToLower(u.Scheme + "://" + u.Host)
}

func isAllowedOriginDomain(originStr string, cfg config.Config) bool {
	u, err := url.Parse(originStr)
	if err != nil {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "supdance.com" || strings.HasSuffix(host, ".supdance.com") {
		return true
	}
	if cfg.PublicAppURL != "" {
		if cu, err := url.Parse(cfg.PublicAppURL); err == nil {
			ch := strings.ToLower(cu.Hostname())
			if host == ch || strings.HasSuffix(host, "."+ch) {
				return true
			}
			parts := strings.Split(ch, ".")
			if len(parts) >= 2 {
				apex := strings.Join(parts[len(parts)-2:], ".")
				if host == apex || strings.HasSuffix(host, "."+apex) {
					return true
				}
			}
		}
	}
	for _, allowed := range cfg.AdditionalAllowedOrigin {
		if originStr == allowed || host == allowed {
			return true
		}
	}
	if !cfg.IsProduction {
		if host == "localhost" || host == "127.0.0.1" || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".test") {
			return true
		}
	}
	return false
}

// CSRFOriginGuard enforces Origin/Referer validation on mutating HTTP methods
// with explicit exemption for signature-verified webhooks and M2M federation endpoints.
func CSRFOriginGuard(cfg config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}

			if IsCSRFExemptPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			origin := r.Header.Get("Origin")
			referer := r.Header.Get("Referer")
			supplied := safeOrigin(origin)
			if supplied == "" {
				supplied = safeOrigin(referer)
			}

			trusted := map[string]bool{
				"https://www.supdance.com":    true,
				"http://www.supdance.com":     true,
				"https://supdance.com":        true,
				"http://supdance.com":         true,
				"https://canvas.supdance.com": true,
				"http://canvas.supdance.com":  true,
			}
			if cfgOrigin := safeOrigin(cfg.PublicAppURL); cfgOrigin != "" {
				trusted[cfgOrigin] = true
			}
			proto := "http"
			if fp := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0]); fp != "" {
				proto = strings.ToLower(fp)
			} else if r.TLS != nil {
				proto = "https"
			}
			for _, hostHeader := range []string{r.Header.Get("X-Forwarded-Host"), r.Host} {
				for _, h := range strings.Split(hostHeader, ",") {
					clean := strings.TrimSpace(h)
					if clean == "" {
						continue
					}
					if o := safeOrigin(proto + "://" + clean); o != "" {
						trusted[o] = true
					}
				}
			}

			if supplied != "" {
				if !trusted[supplied] && !isAllowedOriginDomain(supplied, cfg) {
					writeCSRFRejected(w, r, "请求来源无效")
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			if cfg.CSRFOriginRequired {
				writeCSRFRejected(w, r, "请求缺少有效的来源校验")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeCSRFRejected(w http.ResponseWriter, r *http.Request, msg string) {
	if strings.HasPrefix(r.URL.Path, "/api/admin/") {
		envelope.AdminError(w, http.StatusForbidden, "CSRF_ORIGIN_INVALID", msg, envelope.NewRequestID(r))
		return
	}
	envelope.DomainError(w, http.StatusForbidden, msg, "CSRF_ORIGIN_INVALID")
}
