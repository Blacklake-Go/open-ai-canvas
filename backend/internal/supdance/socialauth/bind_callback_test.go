package socialauth

import (
	"errors"
	"net/http"
	"net/url"
	"testing"
	"time"

	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

func TestBindCallbackReturnsToProfileAfterPersistingIdentity(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderQQ, "1000520", "bind-test-secret", false)
	useQQStub(t, "bind-test-secret", "7F8A9B0C1D2E3F40")
	user := &model.User{ID: "bind-user", Username: "bind_user", Status: model.UserStatusActive}
	if err := repo.db.Create(user).Error; err != nil {
		t.Fatal(err)
	}
	session := &model.AuthSession{ID: "bind-session", UserID: user.ID, TokenHash: "bind-token-hash", ExpiresAt: time.Now().Add(time.Hour)}
	if err := repo.db.Create(session).Error; err != nil {
		t.Fatal(err)
	}
	location, err := svc.BeginBind(session, ProviderQQ, "/settings?section=profile#accounts", false)
	if err != nil {
		t.Fatal(err)
	}
	state := oauthStateFromRedirect(t, location)
	callback := cnRequest("/callback")
	callback.AddCookie(&http.Cookie{Name: OAuthBindingCookie, Value: HashToken(state)})
	result, err := svc.CompleteAuth(callback, ProviderQQ, state, "bind-code", session)
	if err != nil {
		t.Fatal(err)
	}
	identity, err := repo.UserIdentity(ProviderQQ, "qq_openid_7F8A9B0C1D2E3F40")
	if err != nil || identity.UserID != user.ID {
		t.Fatalf("callback did not persist the identity for the current account: %v", err)
	}
	next, err := url.Parse(result.Next)
	if err != nil || next.Path != "/settings" || next.Query().Get("section") != "profile" || next.Query().Get("bind_success") != ProviderQQ || next.Fragment != "accounts" || result.User != nil {
		t.Fatalf("callback did not return to the profile: %q", result.Next)
	}
}

func TestUnboundOAuthIdentityCannotBeRecreatedByInflightLogin(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderQQ, "1000520", "bind-test-secret", false)
	user := &model.User{ID: "existing-user", Username: "existing_user", Status: model.UserStatusActive, PasswordHash: "password-exists"}
	identity := &model.UserIdentity{ID: "existing-identity", UserID: user.ID, Provider: ProviderQQ, Subject: "existing-subject"}
	if err := repo.CreateOAuthUser(user, identity); err != nil {
		t.Fatal(err)
	}
	stale, err := repo.UserIdentity(identity.Provider, identity.Subject)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Unbind(user, ProviderQQ); err != nil {
		t.Fatal(err)
	}
	stale.ProviderUsername = "new upstream nickname"
	if err := repo.UpdateOAuthIdentityProfile(stale); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("stale profile update error = %v", err)
	}
	pending := &model.AuthSession{ID: "pending-session", UserID: user.ID, TokenHash: "pending-token", ExpiresAt: time.Now().Add(time.Hour)}
	if err := repo.CreateAuthSessionForOAuthIdentity(user, stale, pending, nil); !errors.Is(err, repository.ErrProfileAuthorization) {
		t.Fatalf("stale identity issued a login session: %v", err)
	}
	if _, err := repo.UserIdentity(identity.Provider, identity.Subject); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("identity was recreated: %v", err)
	}
}
