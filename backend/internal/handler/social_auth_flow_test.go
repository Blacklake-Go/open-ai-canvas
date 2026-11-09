package handler

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"yingce/backend/internal/database"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/service"
	"yingce/backend/internal/supdance/socialauth"
)

type socialProviderTransport func(*http.Request) (*http.Response, error)

func (f socialProviderTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestSocialAuthHTTPBindReauthenticateAndOnboard(t *testing.T) {
	dir := t.TempDir()
	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "auth.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := database.MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	repo := repository.New(db)
	svc := service.New(repo, dir)
	previousRuntimeService := runtimeService
	ConfigureRuntime(svc)
	t.Cleanup(func() { runtimeService = previousRuntimeService })
	admin := &model.User{ID: "admin", Role: model.UserRoleAdmin, Status: model.UserStatusActive}
	user := &model.User{ID: "profile-user", Username: "profile_user", Status: model.UserStatusActive}
	if err := db.Create(user).Error; err != nil {
		t.Fatal(err)
	}
	session := &model.AuthSession{ID: "profile-session", UserID: user.ID, TokenHash: socialauth.HashToken("test-session-token"), ExpiresAt: time.Now().Add(time.Hour)}
	if err := db.Create(session).Error; err != nil {
		t.Fatal(err)
	}
	loginCookie := &http.Cookie{Name: service.SessionCookieName, Value: session.ID + ".test-session-token"}
	providerConfig := socialauth.UpdateSettingsRequest{Providers: map[string]socialauth.UpdateProviderInput{
		socialauth.ProviderQQ: {Enabled: true, ClientID: "1000520", ClientSecret: "test-client-secret"},
	}}
	if _, err := svc.UpdateSocialAuthAdminSettings(httptest.NewRequest(http.MethodPut, "/", nil), admin, providerConfig); err != nil {
		t.Fatal(err)
	}
	setRegistration := func(enabled bool) {
		t.Helper()
		verify := false
		if _, err := svc.UpdateRegistrationSetting(admin, service.RegistrationSettingRequest{Enabled: enabled, EmailVerificationRequired: &verify}); err != nil {
			t.Fatal(err)
		}
	}
	setRegistration(true)
	subject := "bind-subject"
	originalTransport := http.DefaultTransport
	http.DefaultTransport = socialProviderTransport(func(req *http.Request) (*http.Response, error) {
		var body string
		switch req.URL.Path {
		case "/oauth2.0/token":
			body = "access_token=stub-token&expires_in=600"
		case "/oauth2.0/me":
			body = `callback({"client_id":"1000520","openid":"` + subject + `"});`
		case "/user/get_user_info":
			body = `{"ret":0,"nickname":"Fixture Creator"}`
		default:
			t.Fatalf("unexpected upstream path %s", req.URL.Path)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})
	t.Cleanup(func() { http.DefaultTransport = originalTransport })

	router := gin.New()
	RegisterSocialAuthRoutes(router.Group("/api"), svc)
	request := func(method, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, "https://www.supdance.com"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Real-IP", "223.5.5.5")
		for _, cookie := range cookies {
			req.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	readCookie := func(rec *httptest.ResponseRecorder, name string) *http.Cookie {
		for _, cookie := range rec.Result().Cookies() {
			if cookie.Name == name {
				return cookie
			}
		}
		return nil
	}
	authorize := func(startPath, code string, callbackCookies ...*http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		start := request(http.MethodGet, startPath, "", callbackCookies...)
		redirect, err := url.Parse(start.Header().Get("Location"))
		browserCookie := readCookie(start, socialauth.OAuthBindingCookie)
		if err != nil || start.Code != 302 || browserCookie == nil || redirect.Query().Get("state") == "" {
			t.Fatalf("authorization did not start: %d %s", start.Code, start.Body.String())
		}
		query := url.Values{"state": {redirect.Query().Get("state")}, "code": {code}}
		return request(http.MethodGet, "/api/auth/qq/callback?"+query.Encode(), "", append(callbackCookies, browserCookie)...)
	}

	next := "/settings?section=social#accounts"
	bind := authorize("/api/auth/social/qq/bind?next="+url.QueryEscape(next), "bind-code", loginCookie)
	if got := bind.Header().Get("Location"); bind.Code != 302 || got != "/settings?bind_success=qq&section=social#accounts" || readCookie(bind, service.SessionCookieName) != nil {
		t.Fatalf("bind callback: HTTP %d, location %q", bind.Code, got)
	}
	identity, err := repo.UserIdentityForUser(user.ID, socialauth.ProviderQQ)
	if err != nil || identity.Subject != "qq_openid_bind-subject" {
		t.Fatalf("bound identity was not persisted: %v", err)
	}
	list := request(http.MethodGet, "/api/auth/social/identities", "", loginCookie)
	if list.Code != 200 || !strings.Contains(list.Body.String(), `"bound":true`) || !strings.Contains(list.Body.String(), "Fixture Creator") {
		t.Fatalf("bound identity did not read back through HTTP: %d %s", list.Code, list.Body.String())
	}
	cancel := authorize("/api/auth/social/qq/bind?next="+url.QueryEscape(next), "", loginCookie)
	if got := cancel.Header().Get("Location"); got != "/settings?bind_error=1&section=social#accounts" {
		t.Fatalf("cancelled binding returned to %q", got)
	}
	start := request(http.MethodGet, "/api/auth/social/qq/bind?next="+url.QueryEscape(next), "", loginCookie)
	startURL, err := url.Parse(start.Header().Get("Location"))
	if err != nil || start.Code != 302 {
		t.Fatalf("could not start session mismatch test: HTTP %d, %v", start.Code, err)
	}
	subject = "wrong-session-subject"
	callbackQuery := url.Values{"state": {startURL.Query().Get("state")}, "code": {"wrong-session-code"}}
	withoutSession := request(http.MethodGet, "/api/auth/qq/callback?"+callbackQuery.Encode(), "", readCookie(start, socialauth.OAuthBindingCookie))
	if got := withoutSession.Header().Get("Location"); got != "/settings?bind_error=1&section=social#accounts" {
		t.Fatalf("callback without the initiating session returned to %q", got)
	}
	identity, err = repo.UserIdentityForUser(user.ID, socialauth.ProviderQQ)
	if err != nil || identity.Subject != "qq_openid_bind-subject" {
		t.Fatalf("a callback without the initiating session changed the identity: %v", err)
	}
	subject = "bind-subject"
	reverify := authorize("/api/auth/social/qq/reauth", "reauth-code", loginCookie)
	stored, err := repo.AuthSession(session.ID)
	if err != nil || stored.ReauthenticatedAt == nil || reverify.Header().Get("Location") != "/settings?reauth=success&section=profile" {
		t.Fatalf("same-session reauthentication did not complete: %q, %v", reverify.Header().Get("Location"), err)
	}

	subject = "onboarding-subject"
	onboard := authorize("/api/auth/social/qq/start?acceptedTerms=true", "signup-code")
	ticketCookie := readCookie(onboard, socialOnboardingCookie)
	if got := onboard.Header().Get("Location"); got != "/?onboarding=1" || ticketCookie == nil || !ticketCookie.HttpOnly || !ticketCookie.Secure || ticketCookie.Path != "/" || ticketCookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("unexpected onboarding redirect or cookie contract: %q", got)
	}
	profilePath := "/api/auth/social/onboarding/profile"
	if rec := request(http.MethodGet, profilePath+"?ticket="+url.QueryEscape(ticketCookie.Value), ""); rec.Code != 400 {
		t.Fatalf("query-only ticket was accepted: %d", rec.Code)
	}
	if rec := request(http.MethodGet, profilePath, "", ticketCookie); rec.Code != 200 || strings.Contains(rec.Body.String(), ticketCookie.Value) {
		t.Fatalf("profile did not honor cookie-only contract: %d", rec.Code)
	}
	completePath := "/api/auth/social/onboarding/complete"
	payload := `{"acceptedTerms":true,"username":"onboard_fixture"}`
	setRegistration(false)
	if rec := request(http.MethodPost, completePath, payload, ticketCookie); rec.Code != 403 {
		t.Fatalf("pending signup bypassed registration closure: %d", rec.Code)
	}
	setRegistration(true)
	requireEmail := true
	if _, err := svc.UpdateRegistrationSetting(admin, service.RegistrationSettingRequest{Enabled: true, EmailRequired: &requireEmail}); err != nil {
		t.Fatal(err)
	}
	if rec := request(http.MethodGet, profilePath, "", ticketCookie); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"emailRequired":true`) {
		t.Fatalf("onboarding profile ignored the host's required email setting: %d", rec.Code)
	}
	if rec := request(http.MethodPost, completePath, payload, ticketCookie); rec.Code != 400 {
		t.Fatalf("onboarding accepted a blank email while required by the host: %d", rec.Code)
	}
	requireEmail = false
	if _, err := svc.UpdateRegistrationSetting(admin, service.RegistrationSettingRequest{Enabled: true, EmailRequired: &requireEmail}); err != nil {
		t.Fatal(err)
	}
	disabledProvider := socialauth.UpdateSettingsRequest{Providers: map[string]socialauth.UpdateProviderInput{socialauth.ProviderQQ: {}}}
	if _, err := svc.UpdateSocialAuthAdminSettings(httptest.NewRequest(http.MethodPut, "/", nil), admin, disabledProvider); err != nil {
		t.Fatal(err)
	}
	if rec := request(http.MethodPost, completePath, payload, ticketCookie); rec.Code != 403 {
		t.Fatalf("pending signup bypassed channel closure: %d", rec.Code)
	}
	if _, err := svc.UpdateSocialAuthAdminSettings(httptest.NewRequest(http.MethodPut, "/", nil), admin, providerConfig); err != nil {
		t.Fatal(err)
	}
	if rec := request(http.MethodPost, completePath, `{"acceptedTerms":true,"username":"onboard_fixture","email":"victim@example.test"}`, ticketCookie); rec.Code != 400 {
		t.Fatalf("unverified manual email was accepted: %d", rec.Code)
	}
	finish := request(http.MethodPost, completePath, payload, ticketCookie)
	finishedSession := readCookie(finish, service.SessionCookieName)
	if finish.Code != 200 || finishedSession == nil || !finishedSession.HttpOnly || strings.Contains(finish.Body.String(), finishedSession.Value) || strings.Contains(finish.Body.String(), `"session":`) {
		t.Fatalf("onboarding failed or exposed the session credential: HTTP %d", finish.Code)
	}
	if rec := request(http.MethodPost, completePath, payload, ticketCookie); rec.Code != 400 {
		t.Fatalf("replayed ticket returned HTTP %d", rec.Code)
	}
	if _, err := svc.SetPluginPlatformAvailability(admin, "supdance-social-auth", false); err != nil {
		t.Fatal(err)
	}
	if rec := request(http.MethodPost, "/api/auth/social/qq/unbind", "", loginCookie); rec.Code != 403 {
		t.Fatalf("disabled plugin permitted unbinding: %d", rec.Code)
	}
	if _, err := repo.UserIdentityForUser(user.ID, socialauth.ProviderQQ); err != nil {
		t.Fatalf("disabled plugin mutated the identity: %v", err)
	}
}
