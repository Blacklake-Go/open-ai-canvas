package socialauth

import (
	"testing"
	"time"

	"yingce/backend/internal/model"
)

func TestSocialAuthOnboardingAndAutoEmailBinding(t *testing.T) {
	repo := newTestRepo(t)
	svc := NewService(repo, &testHost{})
	seedChannel(t, svc, ProviderGoogle, "client_id", "client_secret", false)

	// 1. Manually mint an OnboardingTicket simulating Google OAuth returning an email
	ticketID := "onboard_" + RandomToken()
	ticket := &OnboardingTicket{
		TicketID:         ticketID,
		Provider:         ProviderGoogle,
		ProviderName:     "Google 登录",
		Subject:          "google_sub_109827364",
		ProviderUsername: "dancer@gmail.com",
		DisplayName:      "Dance Star",
		Email:            "dancer@gmail.com",
		AvatarURL:        "https://lh3.googleusercontent.com/avatar.jpg",
		ExpiresAt:        time.Now().Add(15 * time.Minute),
	}
	svc.saveTicket(ticket)

	// 2. Query Onboarding Profile
	profileView, err := svc.GetOnboardingProfile(ticketID)
	if err != nil {
		t.Fatalf("GetOnboardingProfile failed: %v", err)
	}
	if profileView.Email != "dancer@gmail.com" {
		t.Fatalf("expected email dancer@gmail.com, got %s", profileView.Email)
	}
	if !profileView.EmailAutoBound {
		t.Fatalf("expected EmailAutoBound to be true for Google login")
	}

	// 3. Complete Onboarding with custom username and optional password
	completeReq := CompleteOnboardingRequest{AcceptedTerms: true,
		TicketID:    ticketID,
		Username:    "alex_dance_pro",
		DisplayName: "Alex The Dancer",
		Email:       "dancer@gmail.com",
		Password:    "SecurePass123!",
	}
	user, identity, err := svc.CompleteOnboarding(completeReq)
	if err != nil {
		t.Fatalf("CompleteOnboarding failed: %v", err)
	}
	if user.Username != "alex_dance_pro" {
		t.Fatalf("expected username alex_dance_pro, got %s", user.Username)
	}
	if user.Email != "dancer@gmail.com" {
		t.Fatalf("expected email dancer@gmail.com, got %s", user.Email)
	}
	if user.EmailVerifiedAt == nil {
		t.Fatalf("expected EmailVerifiedAt to be set automatically for third-party email")
	}
	if user.PasswordHash == "" {
		t.Fatalf("expected PasswordHash to be set")
	}
	if identity == nil || identity.UserID != user.ID || identity.Provider != ProviderGoogle {
		t.Fatalf("expected a persisted login identity")
	}

	// 4. Ticket must be consumed (single-use)
	if _, err := svc.GetOnboardingProfile(ticketID); err == nil {
		t.Fatalf("expected ticket to be consumed and invalid on reuse")
	}
}

func TestSocialAuthIdentitiesAndUnbindSafetyGuard(t *testing.T) {
	repo := newTestRepo(t)
	svc := NewService(repo, &testHost{})

	// 1. Create a user without password and with 1 bound identity (e.g. WeChat)
	user := &model.User{
		ID:        "user_dance_1",
		Username:  "dancer_wechat",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	identWeChat := &model.UserIdentity{
		ID:               "ident_wx_1",
		UserID:           user.ID,
		Provider:         ProviderWeChat,
		Subject:          "wx_sub_123",
		ProviderUsername: "舞蹈家小李",
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
	if err := repo.CreateOAuthUser(user, identWeChat); err != nil {
		t.Fatalf("CreateOAuthUser failed: %v", err)
	}

	// 2. Query identities: WeChat should show bound with providerUsername
	view, err := svc.GetUserIdentities(user)
	if err != nil {
		t.Fatalf("GetUserIdentities failed: %v", err)
	}
	if view.HasPassword {
		t.Fatalf("expected user to not have password")
	}
	var wxItem *UserIdentityItem
	for i := range view.Identities {
		if view.Identities[i].Provider == ProviderWeChat {
			wxItem = &view.Identities[i]
			break
		}
	}
	if wxItem == nil || !wxItem.Bound || wxItem.ProviderUsername != "舞蹈家小李" {
		t.Fatalf("expected WeChat to be bound with '舞蹈家小李', got %+v", wxItem)
	}

	// 3. Security Guard: Trying to unbind the ONLY identity without password must fail!
	err = svc.Unbind(user, ProviderWeChat)
	if err == nil {
		t.Fatalf("expected unbind to be blocked when it is the only login credential")
	}

	// 4. Bind a second identity (e.g. Google)
	identGoogle := &model.UserIdentity{
		ID:               "ident_google_2",
		UserID:           user.ID,
		Provider:         ProviderGoogle,
		Subject:          "google_sub_888",
		ProviderUsername: "dancer@gmail.com",
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
	if err := repo.UpsertUserIdentity(identGoogle); err != nil {
		t.Fatalf("UpsertUserIdentity failed: %v", err)
	}

	if err := svc.Unbind(user, ProviderWeChat); err == nil {
		t.Fatal("a disabled alternative must not permit unbinding the only usable identity")
	}
	seedChannel(t, svc, ProviderGoogle, "client_id", "client_secret", false)
	// The remaining identity is now usable.
	if err := svc.Unbind(user, ProviderWeChat); err != nil {
		t.Fatalf("expected unbind to succeed with 2 identities: %v", err)
	}

	// 6. Verify WeChat is unbound, Google remains bound
	viewAfter, err := svc.GetUserIdentities(user)
	if err != nil {
		t.Fatalf("GetUserIdentities failed: %v", err)
	}
	for _, item := range viewAfter.Identities {
		if item.Provider == ProviderWeChat && item.Bound {
			t.Fatalf("expected WeChat to be unbound")
		}
		if item.Provider == ProviderGoogle && (!item.Bound || item.ProviderUsername != "dancer@gmail.com") {
			t.Fatalf("expected Google to still be bound with dancer@gmail.com")
		}
	}
}

func TestBeginBindGeneratesCorrectState(t *testing.T) {
	repo := newTestRepo(t)
	svc := NewService(repo, &testHost{})

	// Seed settings with sandbox mock
	settings := DefaultInitialSettings()
	cfg := settings.Providers[ProviderGoogle]
	cfg.Enabled = true
	cfg.ClientID = "test_client_id"
	cfg.ClientSecret = "test_client_secret"
	settings.Providers[ProviderGoogle] = cfg
	if err := svc.SaveSettings(&model.User{ID: "admin"}, settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	session := &model.AuthSession{ID: "session_dancer_99", UserID: "user_dancer_99"}
	bindURL, err := svc.BeginBind(session, ProviderGoogle, "", false)
	if err != nil {
		t.Fatalf("BeginBind failed: %v", err)
	}
	if bindURL == "" {
		t.Fatalf("expected non-empty bind URL")
	}
}

func TestSocialAuthOnboardingTicketSharedAcrossServiceInstances(t *testing.T) {
	repo := newTestRepo(t)
	svc1 := NewService(repo, &testHost{})
	seedChannel(t, svc1, ProviderGoogle, "client_id", "client_secret", false)

	ticketID := "onboard_" + RandomToken()
	ticket := &OnboardingTicket{
		TicketID:         ticketID,
		Provider:         ProviderGoogle,
		ProviderName:     "Google 登录",
		Subject:          "google_sub_102938",
		ProviderUsername: "dancer@gmail.com",
		DisplayName:      "The Dancer",
		Email:            "dancer@gmail.com",
		ExpiresAt:        time.Now().Add(15 * time.Minute),
	}
	svc1.saveTicket(ticket)

	// Simulate subsequent HTTP request handled by a freshly created Service instance (svc2)
	svc2 := NewService(repo, &testHost{})
	profileView, err := svc2.GetOnboardingProfile(ticketID)
	if err != nil {
		t.Fatalf("expected svc2 to find ticket created by svc1: %v", err)
	}
	if profileView.ProviderUsername != "dancer@gmail.com" {
		t.Fatalf("expected provider username dancer@gmail.com, got %s", profileView.ProviderUsername)
	}
}
