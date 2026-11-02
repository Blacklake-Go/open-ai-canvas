package socialauth

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
	"yingce/backend/internal/model"
)

type probeTransport func(*http.Request) (*http.Response, error)

func (f probeTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func stubProbeClient(t *testing.T) {
	old := oauthUpstreamClient
	oauthUpstreamClient = &http.Client{Transport: probeTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.RawQuery != "" || r.Header.Get("Authorization") != "" {
			t.Fatal("probe transmitted credentials")
		}
		return &http.Response{StatusCode: 400, Body: io.NopCloser(strings.NewReader(`{}`)), Header: make(http.Header)}, nil
	})}
	t.Cleanup(func() { oauthUpstreamClient = old })
}

// Existing provider fixtures now exercise the browser-bound callback AND onboarding.
func completeBoundTestAuth(t *testing.T, svc *Service, r *http.Request, provider, state, code, userID string) (*SocialAuthCallbackResult, error) {
	t.Helper()
	r.AddCookie(&http.Cookie{Name: OAuthBindingCookie, Value: HashToken(state)})
	result, err := svc.CompleteAuth(r, provider, state, code, userID)
	if err != nil || result.OnboardingTicket == "" {
		return result, err
	}
	user, session, err := svc.CompleteOnboarding(CompleteOnboardingRequest{AcceptedTerms: true, TicketID: result.OnboardingTicket, Username: "creator_" + RandomToken()[:8]})
	if err != nil {
		return nil, err
	}
	result.User, result.Session = user, session
	return result, nil
}

func TestUnifiedPKCEUsesS256(t *testing.T) {
	u, _ := url.Parse(buildAuthorizeURL(ProviderX, ProviderConfig{ClientID: "client"}, "https://www.supdance.com/api/auth/social/x/callback", "state", "verifier"))
	if u.Query().Get("code_challenge_method") != "S256" || u.Query().Get("code_challenge") == "verifier" {
		t.Fatal("X authorization sends a plaintext PKCE verifier")
	}
}

func TestUnifiedCallbackRejectsMissingBrowserBinding(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderGoogle, "real_client", "real_secret", false)
	var hits int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits++; http.Error(w, "rejected", 400) }))
	defer server.Close()
	old := googleTokenURL
	googleTokenURL = server.URL
	t.Cleanup(func() { googleTokenURL = old })
	_, err := svc.CompleteAuth(intlRequest("/callback"), ProviderGoogle, mintState(t, repo, ProviderGoogle), "provider_code", "")
	if err == nil || hits != 0 || !strings.Contains(err.Error(), "浏览器") {
		t.Fatalf("callback without browser binding reached token exchange: hits=%d err=%v", hits, err)
	}
}

func TestUnifiedUnverifiedGoogleEmailIsNotTrusted(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			w.Write([]byte(`{"access_token":"test-token"}`))
			return
		}
		w.Write([]byte(`{"sub":"stable-subject","email":"unverified@example.test","email_verified":false}`))
	}))
	defer server.Close()
	withGoogleEndpoints(t, server.URL, server.URL)
	p, err := redeemGoogle(context.Background(), ProviderConfig{ClientID: "client", ClientSecret: "secret"}, "code", "https://www.supdance.com/api/auth/social/google/callback")
	if err != nil || p.Email != "" {
		t.Fatalf("unverified email trusted: profile=%+v err=%v", p, err)
	}
}

func TestUnifiedLegacyMockCredentialsCannotBeAdvertised(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	_ = repo
	seedChannel(t, svc, ProviderQQ, "legacy_client", "mock_qq_secret_builtin", false)
	view, err := svc.GetPublicProviders(cnRequest("/providers"))
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range view.Providers {
		if p.ID == ProviderQQ {
			t.Fatal("legacy mock credentials offered as a real login")
		}
	}
}

func TestUnifiedOnboardingValidationCanBeRetried(t *testing.T) {
	_, svc := newSecurityTestService(t)
	id := "onboard_" + RandomToken()
	svc.saveTicket(&OnboardingTicket{TicketID: id, Provider: ProviderGoogle, Subject: "retry-subject", ExpiresAt: time.Now().Add(time.Minute)})
	if _, _, err := svc.CompleteOnboarding(CompleteOnboardingRequest{AcceptedTerms: true, TicketID: id, Username: "x"}); err == nil {
		t.Fatal("invalid username accepted")
	}
	if _, err := svc.GetOnboardingProfile(id); err != nil {
		t.Fatalf("validation failure destroyed the onboarding ticket: %v", err)
	}
}

func TestUnifiedNoAccountOrSessionBeforeOnboarding(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderGoogle, "client", "secret", false)
	token, info, _ := startGoogleStub(t, "secret", "pending-subject", "verified@example.test", nil)
	withGoogleEndpoints(t, token, info)
	state := mintState(t, repo, ProviderGoogle)
	r := intlRequest("/callback")
	r.AddCookie(&http.Cookie{Name: OAuthBindingCookie, Value: HashToken(state)})
	result, err := svc.CompleteAuth(r, ProviderGoogle, state, "provider_code", "")
	if err != nil {
		t.Fatal(err)
	}
	var users int64
	repo.db.Model(&model.User{}).Count(&users)
	if users != 0 || result.User != nil || result.Session != nil || result.OnboardingTicket == "" {
		t.Fatalf("account created before onboarding: users=%d result=%+v", users, result)
	}
	req := CompleteOnboardingRequest{TicketID: result.OnboardingTicket, Username: "confirmed_user", AcceptedTerms: true}
	user, _, err := svc.CompleteOnboarding(req)
	if err != nil || user.EmailVerifiedAt == nil {
		t.Fatalf("verified profile completion failed: %v", err)
	}
	if _, _, err := svc.CompleteOnboarding(req); err == nil {
		t.Fatal("completed ticket replayed")
	}
}

func TestUnifiedEmptyOperationsListsAreArrays(t *testing.T) {
	_, svc := newSecurityTestService(t)
	logs, err := svc.GetLoginLogs(nil, 10)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(logs)
	if err != nil || string(encoded) != "[]" {
		t.Fatalf("empty logs are not an array: %s %v", encoded, err)
	}
	users, err := svc.SearchUsers(nil, "missing-user")
	if err != nil {
		t.Fatal(err)
	}
	encoded, err = json.Marshal(users)
	if err != nil || string(encoded) != "[]" {
		t.Fatalf("empty users are not an array: %s %v", encoded, err)
	}
}

func TestUnifiedEmptyPublicProviderListIsArray(t *testing.T) {
	_, svc := newSecurityTestService(t)
	view, err := svc.GetPublicProviders(intlRequest("/providers"))
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(view.Providers)
	if err != nil || string(encoded) != "[]" {
		t.Fatalf("empty public provider list is not an array: %s %v", encoded, err)
	}
}
