package user

import (
	"context"
	"strings"
	"testing"
	"time"

	"one/backend/internal/domain/auth"
)

type memUserRepo struct {
	users     map[string]*Profile
	unlocked  map[string]map[string]bool
	following map[string]bool
	notifs    map[string][]NotificationItem
	oauth     map[string][]OAuthAccountItem
}

func newMemUserRepo() *memUserRepo {
	hash, salt, _ := auth.HashPassword("Secret123!")
	return &memUserRepo{
		users: map[string]*Profile{
			"100001": {
				ID: "100001", UserNumber: "100001", Email: "u1@example.com",
				DisplayName: "CreatorOne", Role: "user", Status: "active", Locale: "en",
				HasPassword: true, PasswordHash: hash, PasswordSalt: salt,
				IsActivityPublic: true, PrivacySettings: map[string]any{}, Preferences: map[string]any{}, SocialLinks: map[string]any{},
			},
			"100002": {
				ID: "100002", UserNumber: "100002", Email: "u2@example.com",
				DisplayName: "CreatorTwo", Role: "user", Status: "active", Locale: "zh-CN",
				IsActivityPublic: false, PrivacySettings: map[string]any{}, Preferences: map[string]any{}, SocialLinks: map[string]any{},
			},
		},
		unlocked:  map[string]map[string]bool{"100001": {"coin-gold": true}},
		following: map[string]bool{},
		notifs: map[string][]NotificationItem{
			"100001": {{ID: "ntf_1", Type: "system", Title: "Welcome", IsRead: false}},
		},
		oauth: map[string][]OAuthAccountItem{
			"100001": {{Provider: "google", ProviderUsername: "u1"}},
		},
	}
}

func (m *memUserRepo) GetByID(_ context.Context, id string) (*Profile, error) {
	return m.users[id], nil
}
func (m *memUserRepo) GetProfileByIdentifier(_ context.Context, id string) (*Profile, error) {
	return m.users[id], nil
}
func (m *memUserRepo) UpdateProfile(_ context.Context, id string, dn, bio, web, av, un *string) (*Profile, error) {
	p := m.users[id]
	if dn != nil {
		p.DisplayName = *dn
	}
	if bio != nil {
		p.Bio = *bio
	}
	if web != nil {
		p.Website = *web
	}
	if av != nil {
		p.AvatarURL = *av
	}
	if un != nil {
		p.Username = *un
	}
	return p, nil
}
func (m *memUserRepo) SetAvatarFrame(_ context.Context, id, frame string) error {
	m.users[id].AvatarFrame = frame
	return nil
}
func (m *memUserRepo) HasUnlockedAvatarFrame(_ context.Context, id, frame string) (bool, error) {
	return m.unlocked[id][frame], nil
}
func (m *memUserRepo) GetOrInitAPIKey(_ context.Context, id string, gen func() string) (string, string, error) {
	p := m.users[id]
	if k, ok := p.SocialLinks["api_key"].(string); ok && k != "" {
		return k, "2026-11-15T00:00:00Z", nil
	}
	k := gen()
	p.SocialLinks["api_key"] = k
	return k, "2026-11-15T00:00:00Z", nil
}
func (m *memUserRepo) RotateAPIKey(_ context.Context, id, newKey string) (string, string, error) {
	m.users[id].SocialLinks["api_key"] = newKey
	return newKey, "2026-11-15T00:00:00Z", nil
}
func (m *memUserRepo) UpdatePassword(_ context.Context, id, h, s string) error {
	m.users[id].PasswordHash = h
	m.users[id].PasswordSalt = s
	m.users[id].HasPassword = true
	return nil
}
func (m *memUserRepo) BindEmail(_ context.Context, id, email string) error {
	m.users[id].Email = email
	return nil
}
func (m *memUserRepo) UnbindEmail(_ context.Context, id string) error {
	m.users[id].Email = ""
	return nil
}
func (m *memUserRepo) ClearAvatar(_ context.Context, id string) (*Profile, error) {
	m.users[id].AvatarURL = ""
	return m.users[id], nil
}
func (m *memUserRepo) IsEmailOwnedByAnother(_ context.Context, email, uid string) (bool, error) {
	for id, u := range m.users {
		if id != uid && strings.EqualFold(u.Email, email) {
			return true, nil
		}
	}
	return false, nil
}
func (m *memUserRepo) UpdatePhone(_ context.Context, id, phone, cc string) error {
	for uid, u := range m.users {
		if uid != id && u.Phone == phone {
			return ErrPhoneConflict
		}
	}
	m.users[id].Phone = phone
	m.users[id].PhoneCountryCode = cc
	return nil
}
func (m *memUserRepo) UnbindPhone(_ context.Context, id string) error {
	m.users[id].Phone = ""
	m.users[id].PhoneCountryCode = ""
	return nil
}
func (m *memUserRepo) GetPreferences(_ context.Context, id string) (map[string]any, error) {
	return m.users[id].Preferences, nil
}
func (m *memUserRepo) UpdatePreferences(_ context.Context, id string, prefs map[string]any) (map[string]any, error) {
	for k, v := range prefs {
		m.users[id].Preferences[k] = v
	}
	return m.users[id].Preferences, nil
}
func (m *memUserRepo) UpdatePrivacy(_ context.Context, id string, pub *bool, settings map[string]any) (bool, map[string]any, error) {
	if pub != nil {
		m.users[id].IsActivityPublic = *pub
	}
	for k, v := range settings {
		m.users[id].PrivacySettings[k] = v
	}
	return m.users[id].IsActivityPublic, m.users[id].PrivacySettings, nil
}
func (m *memUserRepo) IsFollowing(_ context.Context, u, t string) (bool, error) {
	return m.following[u+"->"+t], nil
}
func (m *memUserRepo) ToggleFollow(_ context.Context, u, t string) (bool, error) {
	key := u + "->" + t
	m.following[key] = !m.following[key]
	return m.following[key], nil
}
func (m *memUserRepo) ListNotifications(_ context.Context, id string, _ int) ([]NotificationItem, int, error) {
	items := m.notifs[id]
	unread := 0
	for _, n := range items {
		if !n.IsRead {
			unread++
		}
	}
	return items, unread, nil
}
func (m *memUserRepo) MarkAllNotificationsRead(_ context.Context, id string) error {
	for i := range m.notifs[id] {
		m.notifs[id][i].IsRead = true
	}
	return nil
}
func (m *memUserRepo) GetActivityDashboard(_ context.Context, _ string) (*ActivityDashboard, error) {
	return &ActivityDashboard{TotalCreations: 5, ActiveDays: 3, IsPublic: true, Heatmap: map[string]int{"2026-11-15": 5}}, nil
}
func (m *memUserRepo) GetOnboarding(_ context.Context, id string) (*OnboardingPayload, error) {
	return &OnboardingPayload{Completed: m.users[id].OnboardingComplete, Step: m.users[id].OnboardingStep}, nil
}
func (m *memUserRepo) SaveOnboarding(_ context.Context, id string, in OnboardingPayload) (*OnboardingPayload, error) {
	m.users[id].OnboardingComplete = in.Completed
	m.users[id].OnboardingStep = in.Step
	return &in, nil
}
func (m *memUserRepo) ListOAuthAccounts(_ context.Context, id string) ([]OAuthAccountItem, error) {
	return m.oauth[id], nil
}
func (m *memUserRepo) CountValidCredentials(_ context.Context, id string) (int, int, error) {
	cnt := len(m.oauth[id])
	if m.users[id].HasPassword {
		cnt++
	}
	return cnt, len(m.oauth[id]), nil
}
func (m *memUserRepo) UnbindOAuthProvider(_ context.Context, id, prov string) error {
	var next []OAuthAccountItem
	for _, it := range m.oauth[id] {
		if it.Provider != prov {
			next = append(next, it)
		}
	}
	m.oauth[id] = next
	return nil
}
func (m *memUserRepo) ScheduleDeactivation(_ context.Context, id string, due time.Time, _ string) error {
	m.users[id].Status = "deletion_pending"
	m.users[id].DeletionDueAt = &due
	return nil
}
func (m *memUserRepo) CancelDeactivation(_ context.Context, id string) error {
	m.users[id].Status = "active"
	m.users[id].DeletionDueAt = nil
	return nil
}

func TestUserServiceOperations(t *testing.T) {
	repo := newMemUserRepo()
	svc := &Service{Repo: repo}
	ctx := context.Background()

	// Avatar default & update
	if url := svc.GetAvatarRedirectURL(ctx, "100001"); url != DefaultAvatarPath {
		t.Fatalf("expected default avatar, got %s", url)
	}
	if _, err := svc.UpdateAvatar(ctx, "100001", "https://cdn.supdance.com/a.png"); err != nil {
		t.Fatalf("UpdateAvatar error = %v", err)
	}
	if url := svc.GetAvatarRedirectURL(ctx, "100001"); url != "https://cdn.supdance.com/a.png" {
		t.Fatalf("expected updated avatar, got %s", url)
	}

	// Avatar frame requires ownership
	if _, err := svc.WearAvatarFrame(ctx, "100001", "coin-cyan"); err == nil {
		t.Fatal("expected unowned avatar frame error")
	}
	if _, err := svc.WearAvatarFrame(ctx, "100001", "coin-gold"); err != nil {
		t.Fatalf("WearAvatarFrame coin-gold error = %v", err)
	}

	// API key init & rotate
	k1, _, err := svc.GetAPIKey(ctx, "100001")
	if err != nil || !strings.HasPrefix(k1, "sk-koyo-live-") {
		t.Fatalf("GetAPIKey = %q err=%v", k1, err)
	}
	k2, _, err := svc.RotateAPIKey(ctx, "100001")
	if err != nil || k2 == k1 {
		t.Fatalf("RotateAPIKey failed: k1=%q k2=%q err=%v", k1, k2, err)
	}

	// Change password checks current password
	if err := svc.ChangePassword(ctx, "100001", "wrong", "NewPass999!"); err == nil {
		t.Fatal("expected current password rejection")
	}
	if err := svc.ChangePassword(ctx, "100001", "Secret123!", "NewPass999!"); err != nil {
		t.Fatalf("ChangePassword error = %v", err)
	}

	// Follow & Notifications & Private Activity Dashboard
	following, err := svc.ToggleFollow(ctx, "100001", "100002")
	if err != nil || !following {
		t.Fatalf("ToggleFollow = %v, err=%v", following, err)
	}
	if _, err := svc.GetActivityDashboard(ctx, "100002", "100001"); err == nil {
		t.Fatal("expected forbidden on private activity dashboard")
	}
	if _, err := svc.GetActivityDashboard(ctx, "100002", "100002"); err != nil {
		t.Fatalf("owner viewing private dashboard error = %v", err)
	}

	_, unread, _ := svc.ListNotifications(ctx, "100001", 20)
	if unread != 1 {
		t.Fatalf("unread = %d, want 1", unread)
	}
	_ = svc.MarkAllNotificationsRead(ctx, "100001")
	_, unread, _ = svc.ListNotifications(ctx, "100001", 20)
	if unread != 0 {
		t.Fatalf("unread after mark read = %d, want 0", unread)
	}

	// Deactivate & cancel deletion
	if _, err := svc.DeactivateAccount(ctx, "100001", "NewPass999!", "done"); err != nil {
		t.Fatalf("DeactivateAccount error = %v", err)
	}
	if repo.users["100001"].Status != "deletion_pending" {
		t.Fatalf("expected deletion_pending, got %s", repo.users["100001"].Status)
	}
	if err := svc.CancelDeletion(ctx, "100001"); err != nil {
		t.Fatalf("CancelDeletion error = %v", err)
	}
	if repo.users["100001"].Status != "active" {
		t.Fatalf("expected active after cancel, got %s", repo.users["100001"].Status)
	}
}
