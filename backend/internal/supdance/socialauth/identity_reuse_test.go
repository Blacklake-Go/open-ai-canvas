package socialauth

import (
	"fmt"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

func TestVerifiedSocialIdentityReusedAcrossDifferentAuthorizationCodes(t *testing.T) {
	for _, provider := range []string{ProviderQQ, ProviderGoogle, ProviderBilibili, ProviderX} {
		t.Run(provider, func(t *testing.T) {
			repo, svc := newSecurityTestService(t)
			request := intlRequest
			prefix := "upstream_code_repeat_"
			switch provider {
			case ProviderQQ:
				seedChannel(t, svc, provider, "1000520", "real_qq_secret", false)
				useQQStub(t, "real_qq_secret", "stable-openid")
				request = cnRequest
			case ProviderGoogle:
				seedChannel(t, svc, provider, "client", "secret", false)
				token, info, _ := startGoogleStub(t, "secret", "stable-subject", "verified@example.test", nil)
				withGoogleEndpoints(t, token, info)
			case ProviderX:
				seedChannel(t, svc, provider, "client", "secret", false)
				token, info := startXStub(t, "client", "secret", "stable-user-id", "same-name")
				withXEndpoints(t, token, info)
			case ProviderBilibili:
				seedChannel(t, svc, provider, "bili-client", "bili-secret", false)
				useBilibiliStub(t, biliTokenFixture, biliInfoFixture)
				request = cnRequest
				prefix = "provider-code-"
			}
			var userID string
			for attempt := 0; attempt < 3; attempt++ {
				result, err := completeBoundTestAuth(t, svc, request("/callback"), provider, mintState(t, repo, provider), fmt.Sprintf("%s%d", prefix, attempt), "")
				if err != nil {
					t.Fatal(err)
				}
				if attempt == 0 {
					userID = result.User.ID
				} else if result.User.ID != userID || result.OnboardingTicket != "" {
					t.Fatal("a repeated verified identity created a different account or onboarding")
				}
			}
			var users, identities int64
			repo.db.Model(&model.User{}).Count(&users)
			repo.db.Model(&model.UserIdentity{}).Count(&identities)
			if users != 1 || identities != 1 {
				t.Fatalf("same identity produced users=%d identities=%d", users, identities)
			}
		})
	}
}

func TestPendingOnboardingTicketsForSameIdentityReuseAccountWithoutOverwritingCredentials(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderQQ, "1000520", "client_secret", false)
	tickets := []string{"onboard_" + RandomToken(), "onboard_" + RandomToken()}
	for _, id := range tickets {
		svc.saveTicket(&OnboardingTicket{TicketID: id, Provider: ProviderQQ, Subject: "qq_openid_same-user", ExpiresAt: time.Now().Add(time.Minute)})
	}
	first, _, err := svc.CompleteOnboarding(CompleteOnboardingRequest{TicketID: tickets[0], AcceptedTerms: true, Username: "first_account", Password: "original-password"})
	if err != nil {
		t.Fatal(err)
	}
	second, _, err := svc.CompleteOnboarding(CompleteOnboardingRequest{TicketID: tickets[1], AcceptedTerms: true, Username: "another_account", Password: "must-not-replace-password"})
	if err != nil {
		t.Fatal(err)
	}
	if second.ID != first.ID || second.Username != first.Username || second.PasswordHash != first.PasswordHash {
		t.Fatal("stale onboarding created or overwrote an existing account")
	}
	var users int64
	repo.db.Model(&model.User{}).Count(&users)
	if users != 1 {
		t.Fatal("pending tickets created duplicate accounts")
	}
}
