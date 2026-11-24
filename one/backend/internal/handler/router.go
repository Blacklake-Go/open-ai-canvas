package handler

import (
	"fmt"
	"net/http"
	"sort"
	"strings"

	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

type segKind int

const (
	segOptCatchAll segKind = 1
	segCatchAll    segKind = 2
	segParam       segKind = 3
	segStatic      segKind = 4
)

type routeSegment struct {
	kind  segKind
	value string
}

type compiledRoute struct {
	nextPath string
	segments []routeSegment
	methods  map[string]http.Handler
}

func compileNextPath(nextPath string) []routeSegment {
	trimmed := strings.Trim(nextPath, "/")
	if trimmed == "" {
		return nil
	}
	parts := strings.Split(trimmed, "/")
	segs := make([]routeSegment, 0, len(parts))
	for _, part := range parts {
		if strings.HasPrefix(part, "[[...") && strings.HasSuffix(part, "]]") {
			name := strings.TrimSuffix(strings.TrimPrefix(part, "[[..."), "]]")
			segs = append(segs, routeSegment{kind: segOptCatchAll, value: name})
			continue
		}
		if strings.HasPrefix(part, "[...") && strings.HasSuffix(part, "]") {
			name := strings.TrimSuffix(strings.TrimPrefix(part, "[..."), "]")
			segs = append(segs, routeSegment{kind: segCatchAll, value: name})
			continue
		}
		if strings.HasPrefix(part, "[") && strings.HasSuffix(part, "]") {
			name := strings.TrimSuffix(strings.TrimPrefix(part, "["), "]")
			segs = append(segs, routeSegment{kind: segParam, value: name})
			continue
		}
		segs = append(segs, routeSegment{kind: segStatic, value: part})
	}
	return segs
}

func splitRequestPath(path string) []string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func matchSegments(segs []routeSegment, reqParts []string) (map[string]string, bool) {
	var params map[string]string
	for i, seg := range segs {
		switch seg.kind {
		case segStatic:
			if i >= len(reqParts) || reqParts[i] != seg.value {
				return nil, false
			}
		case segParam:
			if i >= len(reqParts) || reqParts[i] == "" {
				return nil, false
			}
			if params == nil {
				params = make(map[string]string, 2)
			}
			params[seg.value] = reqParts[i]
		case segCatchAll:
			if i >= len(reqParts) {
				return nil, false
			}
			if params == nil {
				params = make(map[string]string, 1)
			}
			params[seg.value] = strings.Join(reqParts[i:], "/")
			return params, true
		case segOptCatchAll:
			if params == nil {
				params = make(map[string]string, 1)
			}
			if i < len(reqParts) {
				params[seg.value] = strings.Join(reqParts[i:], "/")
			} else {
				params[seg.value] = ""
			}
			return params, true
		}
	}
	if len(reqParts) != len(segs) {
		return nil, false
	}
	return params, true
}

// compareRouteSpecificity returns >0 if a is strictly more specific than b
// under Next.js App Router precedence (static > [param] > [...catchAll] > [[...optCatchAll]]).
func compareRouteSpecificity(a, b []routeSegment) int {
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	for i := 0; i < n; i++ {
		if a[i].kind != b[i].kind {
			if a[i].kind > b[i].kind {
				return 1
			}
			return -1
		}
	}
	if len(a) != len(b) {
		if len(a) > len(b) {
			return 1
		}
		return -1
	}
	return 0
}

type nextRouter struct {
	routes []*compiledRoute
}

func (nr *nextRouter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	reqParts := splitRequestPath(r.URL.Path)

	var best *compiledRoute
	var bestParams map[string]string
	for _, rt := range nr.routes {
		params, ok := matchSegments(rt.segments, reqParts)
		if !ok {
			continue
		}
		if best == nil || compareRouteSpecificity(rt.segments, best.segments) > 0 {
			best = rt
			bestParams = params
		}
	}

	if best == nil {
		envelope.DomainError(w, http.StatusNotFound, "Not Found", "NOT_FOUND")
		return
	}

	method := strings.ToUpper(r.Method)
	h, ok := best.methods[method]
	if !ok && method == http.MethodHead {
		h, ok = best.methods[http.MethodGet]
	}
	if !ok {
		allowed := make([]string, 0, len(best.methods))
		for m := range best.methods {
			allowed = append(allowed, m)
		}
		sort.Strings(allowed)
		w.Header().Set("Allow", strings.Join(allowed, ", "))
		envelope.DomainError(w, http.StatusMethodNotAllowed, "Method Not Allowed", "METHOD_NOT_ALLOWED")
		return
	}

	for k, v := range bestParams {
		r.SetPathValue(k, v)
	}
	h.ServeHTTP(w, r)
}

func wrapMiddleware(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		if mws[i] != nil {
			h = mws[i](h)
		}
	}
	return h
}

// mountFunc is the signature each wave batch uses to register real handlers. Batches live in
// independent *_handlers.go files and self-register via init() -> registerBatch, so parallel
// migration work never needs to touch this file. Any route left unmounted by VS1/B1/B2 or a
// registered batch keeps the contract-enforced 501 stub until its batch lands.
type mountFunc func(method, nextPath string, h http.Handler)

var batchMounts []func(d *Dependencies, mount mountFunc)

func registerBatch(fn func(d *Dependencies, mount mountFunc)) {
	batchMounts = append(batchMounts, fn)
}

// NewRouter builds the full HTTP router wrapped with ONE's security, CORS, and CSRF guards,
// mounts Vertical Slice #1 domain handlers, and registers contract-enforced stubs for all
// remaining baseline routes in envelope/routes_manifest.json with exact Next.js precedence.
func NewRouter(deps Dependencies) (http.Handler, error) {
	contracts, err := envelope.LoadRouteContracts()
	if err != nil {
		return nil, err
	}

	byPath := make(map[string]*compiledRoute, len(contracts))
	ordered := make([]*compiledRoute, 0, len(contracts))

	ensureRoute := func(nextPath string) *compiledRoute {
		if rt, ok := byPath[nextPath]; ok {
			return rt
		}
		rt := &compiledRoute{
			nextPath: nextPath,
			segments: compileNextPath(nextPath),
			methods:  make(map[string]http.Handler),
		}
		byPath[nextPath] = rt
		ordered = append(ordered, rt)
		return rt
	}

	mount := func(method, nextPath string, h http.Handler) {
		rt := ensureRoute(nextPath)
		rt.methods[strings.ToUpper(method)] = h
	}

	// Vertical Slice #1 real handlers
	mount("GET", "/api/health", http.HandlerFunc(deps.handleHealth))
	mount("GET", "/api/live", http.HandlerFunc(deps.handleLive))
	mount("GET", "/api/ready", http.HandlerFunc(deps.handleReady))

	mount("GET", "/api/site/branding", http.HandlerFunc(deps.handleSiteBranding))
	mount("GET", "/uploads/branding/[filename]", http.HandlerFunc(deps.handleBrandingUploadRead))
	mount("HEAD", "/uploads/branding/[filename]", http.HandlerFunc(deps.handleBrandingUploadRead))
	mount("GET", "/api/site/content-config", http.HandlerFunc(deps.handleSiteContentConfig))
	mount("GET", "/api/site/subscription-faq", http.HandlerFunc(deps.handleSiteSubscriptionFAQ))

	mount("GET", "/api/i18n", http.HandlerFunc(deps.handleGetI18n))
	mount("POST", "/api/i18n", http.HandlerFunc(deps.handlePostI18n))

	mount("GET", "/api/auth/me", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleAuthMe)))
	mount("GET", "/api/models/active", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleModelsActive)))

	mount("GET", "/api/generations/events", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleGenerationsEvents)))
	mount("GET", "/api/generations/references/[job]/[asset]", http.HandlerFunc(deps.handleDesignAssetReference))
	mount("HEAD", "/api/generations/references/[job]/[asset]", http.HandlerFunc(deps.handleDesignAssetReference))

	// Batch B1: Auth, OAuth, Non-API Auth/Sitemap, and User Domain (40 newly mounted routes; /api/auth/me mounted above)
	mount("POST", "/api/auth/login", http.HandlerFunc(deps.handleAuthLogin))
	mount("POST", "/api/auth/logout", http.HandlerFunc(deps.handleAuthLogout))
	mount("POST", "/api/auth/refresh", http.HandlerFunc(deps.handleAuthRefresh))
	mount("POST", "/api/auth/register", http.HandlerFunc(deps.handleAuthRegister))
	mount("POST", "/api/auth/register/send-code", http.HandlerFunc(deps.handleAuthRegisterSendCode))
	mount("GET", "/api/auth/social-options", http.HandlerFunc(deps.handleAuthSocialOptions))
	mount("POST", "/api/auth/phone/send-code", http.HandlerFunc(deps.handleAuthPhoneSendCode))
	mount("POST", "/api/auth/phone/verify", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleAuthPhoneVerify)))
	mount("POST", "/api/auth/password/forgot/email", http.HandlerFunc(deps.handleAuthPasswordForgotEmail))
	mount("POST", "/api/auth/password/reset/email", http.HandlerFunc(deps.handleAuthPasswordResetEmail))
	mount("POST", "/api/auth/password/reset/phone", http.HandlerFunc(deps.handleAuthPasswordResetPhone))
	mount("POST", "/api/auth/username/forgot/email", http.HandlerFunc(deps.handleAuthUsernameForgotEmail))
	mount("POST", "/api/auth/username/recover/email", http.HandlerFunc(deps.handleAuthUsernameRecoverEmail))
	mount("GET", "/api/auth/oauth/[provider]", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleAuthOAuthStart)))
	mount("GET", "/api/auth/oauth/[provider]/callback", http.HandlerFunc(deps.handleAuthOAuthCallback))
	mount("POST", "/api/auth/oauth/[provider]/callback", http.HandlerFunc(deps.handleAuthOAuthCallback))
	mount("GET", "/api/auth/oauth/[provider]/webhook", http.HandlerFunc(deps.handleAuthOAuthWebhook))
	mount("POST", "/api/auth/oauth/[provider]/webhook", http.HandlerFunc(deps.handleAuthOAuthWebhook))
	mount("GET", "/api/auth/oauth/google/one-tap", http.HandlerFunc(deps.handleAuthGoogleOneTap))
	mount("POST", "/api/auth/oauth/google/one-tap", http.HandlerFunc(deps.handleAuthGoogleOneTap))
	mount("GET", "/api/auth/oauth/onboarding", http.HandlerFunc(deps.handleAuthOAuthOnboarding))
	mount("POST", "/api/auth/oauth/onboarding", http.HandlerFunc(deps.handleAuthOAuthOnboarding))
	mount("GET", "/api/auth/qq/callback", http.HandlerFunc(deps.handleAuthOAuthCallback))

	mount("GET", "/auth/[provider]/callback", http.HandlerFunc(deps.handleAuthOAuthCallback))
	mount("GET", "/auth/tiktok", http.HandlerFunc(deps.handleAuthOAuthCallback))
	mount("GET", "/auth/tiktok/callback", http.HandlerFunc(deps.handleAuthOAuthCallback))
	mount("GET", "/sitemap.xml", http.HandlerFunc(deps.handleSitemapXML))

	mount("GET", "/api/user/activity-dashboard", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserActivityDashboard)))
	mount("GET", "/api/user/avatar", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserAvatar)))
	mount("POST", "/api/user/avatar", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserAvatar)))
	mount("DELETE", "/api/user/avatar", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserAvatar)))
	mount("POST", "/api/user/avatar-frame", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserAvatarFrame)))
	mount("POST", "/api/user/cancel-deletion", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserCancelDeletion)))
	mount("POST", "/api/user/deactivate", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserDeactivate)))
	mount("POST", "/api/user/email", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserEmail)))
	mount("DELETE", "/api/user/email", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserEmail)))
	mount("GET", "/api/user/follow", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserFollow)))
	mount("POST", "/api/user/follow", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserFollow)))
	mount("GET", "/api/user/notifications", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserNotifications)))
	mount("POST", "/api/user/notifications", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserNotifications)))
	mount("GET", "/api/user/oauth/[provider]", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserOAuthProvider)))
	mount("DELETE", "/api/user/oauth/[provider]", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserOAuthProvider)))
	mount("GET", "/api/user/oauth-security", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserOAuthSecurity)))
	mount("POST", "/api/user/oauth-security", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserOAuthSecurity)))
	mount("POST", "/api/user/onboarding", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserOnboarding)))
	mount("POST", "/api/user/password", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserPassword)))
	mount("POST", "/api/user/phone", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserPhone)))
	mount("DELETE", "/api/user/phone", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserPhone)))
	mount("GET", "/api/user/preferences", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserPreferences)))
	mount("PUT", "/api/user/preferences", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserPreferences)))
	mount("GET", "/api/user/privacy", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserPrivacy)))
	mount("PATCH", "/api/user/privacy", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserPrivacy)))
	mount("GET", "/api/user/profile", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserProfile)))
	mount("PUT", "/api/user/profile", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleUserProfile)))

	// Batch B2: Finance, Billing, Coupons, and Webhooks (28 routes)
	mount("GET", "/api/financial/credits/wallet", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCreditsWallet)))
	mount("GET", "/api/financial/credits/ledger", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCreditsLedger)))
	mount("POST", "/api/financial/credits/checkin", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCreditsCheckin)))
	mount("POST", "/api/financial/credits/reserve", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCreditsReserve)))
	mount("POST", "/api/financial/credits/commit", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCreditsCommit)))
	mount("POST", "/api/financial/credits/void", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCreditsVoid)))
	mount("GET", "/api/financial/currency/wallet", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyWallet)))
	mount("GET", "/api/financial/currency/daily-login", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyDailyLogin)))
	mount("POST", "/api/financial/currency/daily-login", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyDailyLogin)))
	mount("GET", "/api/financial/currency/rewards", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyRewards)))
	mount("POST", "/api/financial/currency/rewards", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyRewards)))
	mount("POST", "/api/financial/currency/benefits", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyBenefits)))
	mount("POST", "/api/financial/currency/exchange", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyExchange)))
	mount("POST", "/api/financial/currency/transfer", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyTransfer)))
	mount("POST", "/api/financial/currency/password", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleFinancialCurrencyPassword)))

	mount("GET", "/api/billing/plans", http.HandlerFunc(deps.handleBillingPlans))
	mount("GET", "/api/billing/credit-packs", middleware.OptionalAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleBillingCreditPacks)))
	mount("GET", "/api/billing/credits", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleBillingCredits)))
	mount("GET", "/api/billing/entitlements", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleBillingEntitlements)))
	mount("GET", "/api/billing/subscription", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleBillingSubscription)))
	mount("GET", "/api/billing/usage", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleBillingUsage)))
	mount("GET", "/api/billing/orders/my", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleBillingOrdersMy)))
	mount("GET", "/api/billing/orders/[id]/status", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleBillingOrderStatus)))
	mount("POST", "/api/billing/checkout", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleBillingCheckout)))
	mount("POST", "/api/billing/webhooks/stripe", http.HandlerFunc(deps.handleStripeWebhook))
	mount("POST", "/api/billing/webhooks/alipay", http.HandlerFunc(deps.handleAlipayWebhook))
	mount("POST", "/api/billing/webhooks/wechat", http.HandlerFunc(deps.handleWechatWebhook))
	mount("POST", "/api/billing/webhooks/paypal", http.HandlerFunc(deps.handlePayPalWebhook))

	mount("POST", "/api/coupons/verify", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleCouponVerify)))
	mount("POST", "/api/coupons/redeem", middleware.RequireAuth(deps.SessionAuth)(http.HandlerFunc(deps.handleCouponRedeem)))

	// Wave 2/3 batches register their handlers in independent files via init(); each mount
	// overrides the registry stub for exactly the (method, path) pairs it implements.
	for _, fn := range batchMounts {
		fn(&deps, mount)
	}

	// Register all remaining routes from the verified 238-route baseline manifest.
	for _, c := range contracts {
		rt := ensureRoute(c.RoutePath)
		stub := buildRegistryStub(c, deps.SessionAuth)
		for _, method := range c.Methods {
			m := strings.ToUpper(method)
			if _, exists := rt.methods[m]; !exists {
				rt.methods[m] = stub
			}
		}
	}

	nr := &nextRouter{routes: ordered}
	return wrapMiddleware(
		nr,
		middleware.SecurityHeaders(deps.Config.IsProduction),
		middleware.CanvasCORS(deps.Config.IsProduction),
		middleware.CSRFOriginGuard(deps.Config),
	), nil
}

func buildRegistryStub(c envelope.RouteContract, store middleware.SessionLookup) http.Handler {
	base := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		msg := fmt.Sprintf("Endpoint %s %s is registered in ONE Go monolith (%s); domain handler scheduled in Phase 3", r.Method, c.RoutePath, c.ResponseFormat)
		envelope.WriteErrorByFormat(w, r, c.ResponseFormat, http.StatusNotImplemented, "NOT_IMPLEMENTED", msg)
	})

	switch c.PolicyTier {
	case "admin":
		return middleware.RequirePermission(store, "dashboard.read")(base)
	case "authenticated_or_domain":
		return middleware.RequireAuth(store)(base)
	default:
		return middleware.OptionalAuth(store)(base)
	}
}
