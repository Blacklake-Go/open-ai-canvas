package app

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"yingce/backend/internal/auth"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/emailcenter"
)

func emailCenterFixture(t *testing.T) (*Service, *gorm.DB, *model.User) {
	t.Helper()
	t.Setenv("CANVAS_PUBLIC_BASE_URL", "https://mail.example.com")
	t.Setenv("CANVAS_EMAIL_MARKETING_ENABLED", "false")
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.SystemSetting{}, &model.AdminAuditEvent{}, &model.PluginPlatformState{}, &model.SupDanceEmailTemplate{}, &model.SupDanceEmailRevision{}, &model.SupDanceEmailReceipt{}, &model.SupDanceEmailContact{}, &model.SupDanceEmailBrandAsset{}, &model.SupDanceEmailCampaign{}, &model.SupDanceEmailJob{}, &model.EmailLog{}); err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	svc := &Service{repo: repository.New(db), dataDir: t.TempDir()}
	actor := &model.User{ID: "email-admin", Role: model.UserRoleAdmin, Status: model.UserStatusActive, Email: "admin@example.com"}
	return svc, db, actor
}
func TestEmailCenterPreservesLegacyAndSeparatesDraftPublishRollback(t *testing.T) {
	s, db, actor := emailCenterFixture(t)
	legacy := `{"welcome":{"subject":"original subject","html":"<b>original user HTML</b>"}}`
	if err := db.Create(&model.SystemSetting{Key: EmailMarketingTemplatesSettingKey, ValueJSON: legacy}).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.InitializeEmailCenter(actor); err != nil {
		t.Fatal(err)
	}
	if err := s.InitializeEmailCenter(actor); err != nil {
		t.Fatal(err)
	}
	history, err := s.repo.EmailRevisions("welcome", emailcenter.Locale)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 {
		t.Fatal("migration duplicated or lost versions", len(history))
	}
	state, _ := s.repo.EmailTemplate("welcome", emailcenter.Locale)
	published := state.PublishedID
	doc, _, _ := s.emailCenterDocument("welcome")
	doc.Subject = "Updated · {{brand_name}}"
	if err := s.SaveEmailCenterDraft(actor, "welcome", EmailCenterEditRequest{Document: doc, ExpectedRevision: state.Revision}); err != nil {
		t.Fatal(err)
	}
	still, _, err := s.emailCenterDocument("welcome")
	if err != nil {
		t.Fatal(err)
	}
	if still.Subject == doc.Subject {
		t.Fatal("draft affected live send")
	}
	if err := s.SaveEmailCenterDraft(actor, "welcome", EmailCenterEditRequest{Document: doc, ExpectedRevision: state.Revision}); err == nil {
		t.Fatal("stale save accepted")
	}
	state, _ = s.repo.EmailTemplate("welcome", emailcenter.Locale)
	if err := s.PublishEmailCenter(actor, "welcome", EmailCenterEditRequest{RevisionID: state.DraftID, ExpectedRevision: state.Revision}); err != nil {
		t.Fatal(err)
	}
	state, _ = s.repo.EmailTemplate("welcome", emailcenter.Locale)
	if err := s.PublishEmailCenter(actor, "welcome", EmailCenterEditRequest{RevisionID: published, ExpectedRevision: state.Revision}); err != nil {
		t.Fatal(err)
	}
	var oldID string
	for _, row := range history {
		if row.Kind == "legacy" {
			oldID = row.ID
		}
	}
	state, _ = s.repo.EmailTemplate("welcome", emailcenter.Locale)
	if err := s.PublishEmailCenter(actor, "welcome", EmailCenterEditRequest{RevisionID: oldID, ExpectedRevision: state.Revision}); err == nil {
		t.Fatal("unsafe legacy HTML published")
	}
	stored, _ := s.repo.SystemSetting(EmailMarketingTemplatesSettingKey)
	if stored.ValueJSON != legacy {
		t.Fatal("legacy setting overwritten")
	}
	if err := s.SaveEmailCenterDraft(&model.User{ID: "normal", Role: model.UserRoleUser}, "welcome", EmailCenterEditRequest{Document: doc, ExpectedRevision: state.Revision}); err == nil {
		t.Fatal("non-admin wrote template")
	}
}
func TestEmailCenterQueuedUnsubscribeAndCrashAreNeverReplayed(t *testing.T) {
	s, db, actor := emailCenterFixture(t)
	if err := s.InitializeEmailCenter(actor); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	contact := model.SupDanceEmailContact{Email: "reader@example.com", Marketing: true, Scope: "marketing", Source: "explicit_form", ConsentedAt: &now, UpdatedAt: now}
	if err := s.repo.SaveEmailContact(&contact); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateEmailCampaign(actor, EmailCampaignRequest{Name: "Verified update", TemplateKey: "welcome", Variables: map[string]string{"name": "Creator"}}); err != nil {
		t.Fatal(err)
	}
	rows, _ := s.repo.EmailCampaigns()
	id := rows[0].ID
	if err := s.repo.ScheduleEmailCampaign(id, now); err != nil {
		t.Fatal(err)
	}
	brand := emailcenter.Brand{SiteURL: "https://mail.example.com"}
	link, err := s.emailUnsubscribeURL(contact.Email, brand)
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(link)
	token := u.Query().Get("token")
	if strings.Contains(link, contact.Email) {
		t.Fatal("unsubscribe URL exposes recipient")
	}
	forged := base64.RawURLEncoding.EncodeToString([]byte("email-marketing-unsubscribe:" + contact.Email))
	if err := s.UnsubscribeEmailCenter(forged); err == nil {
		t.Fatal("plaintext forged token accepted")
	}
	if err := s.UnsubscribeEmailCenter(token); err != nil {
		t.Fatal(err)
	}
	if err := s.UnsubscribeEmailCenter(token); err != nil {
		t.Fatal("repeat unsubscribe must be idempotent", err)
	}
	t.Setenv("CANVAS_EMAIL_MARKETING_ENABLED", "true")
	t.Setenv("CANVAS_EMAIL_MARKETING_DAILY_LIMIT", "10")
	key, keyErr := rsa.GenerateKey(rand.Reader, 2048)
	if keyErr != nil {
		t.Fatal(keyErr)
	}
	keyFile := filepath.Join(t.TempDir(), "dkim.pem")
	if err := os.WriteFile(keyFile, pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CANVAS_EMAIL_DKIM_KEY_FILE", keyFile)
	t.Setenv("CANVAS_EMAIL_DKIM_SELECTOR", "test")
	if err := db.Create(&model.SystemSetting{Key: "email", ValueJSON: `{"enabled":true,"host":"127.0.0.1","port":1,"fromEmail":"support@example.com"}`}).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.runEmailCenterJob(context.Background(), now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	stats, _ := s.repo.EmailJobStats(id)
	if stats["suppressed"] != 1 {
		t.Fatal(stats)
	}
	if err := s.repo.ScheduleEmailCampaign(id, now); err == nil {
		t.Fatal("rescheduling active campaign accepted")
	}
	job := model.SupDanceEmailJob{ID: "crashed", CampaignID: id, Recipient: contact.Email, Status: "sending", UpdatedAt: now.Add(-10 * time.Minute)}
	if err := db.Create(&job).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.repo.MarkAbandonedEmailJobs(now); err != nil {
		t.Fatal(err)
	}
	var recovered model.SupDanceEmailJob
	db.First(&recovered, "id = ?", job.ID)
	if recovered.Status != "unknown" {
		t.Fatal("crashed SMTP attempt replayed")
	}
}
func TestEmailCenterTestWhitelistAndAccountSwitch(t *testing.T) {
	s, db, actor := emailCenterFixture(t)
	if err := s.InitializeEmailCenter(actor); err != nil {
		t.Fatal(err)
	}
	doc, _, _ := s.emailCenterDocument("registration")
	if err := s.TestEmailCenter(actor, "registration", EmailCenterEditRequest{Document: doc, To: "unapproved@example.com"}); err == nil {
		t.Fatal("unapproved test recipient accepted")
	}
	t.Setenv("CANVAS_EMAIL_TEST_RECIPIENTS", "approved@example.com")
	setting, _ := json.Marshal(auth.EmailSettingValue{Enabled: false, Host: "127.0.0.1", Port: 1, FromEmail: "support@example.com"})
	db.Create(&model.SystemSetting{Key: "email", ValueJSON: string(setting)})
	if err := s.TestEmailCenter(actor, "registration", EmailCenterEditRequest{Document: doc, To: "approved@example.com"}); err == nil {
		t.Fatal("test bypassed account email switch")
	}
}

func TestEmailCenterConsentAndSuppressionAreIndependentOfRegistration(t *testing.T) {
	s, _, actor := emailCenterFixture(t)
	if err := s.SetEmailCenterPreference(actor, true); err == nil {
		t.Fatal("unverified email subscribed")
	}
	if subscribed, err := s.EmailCenterPreference(actor); err != nil || subscribed {
		t.Fatal("registration implied marketing consent")
	}
	now := time.Now()
	actor.EmailVerifiedAt = &now
	if err := s.SetEmailCenterPreference(actor, true); err != nil {
		t.Fatal(err)
	}
	row, _ := s.repo.EmailContact(actor.Email)
	if row.Source != "authenticated_preference" || row.ConsentedAt == nil || row.Scope != "marketing" {
		t.Fatal("consent provenance missing")
	}
	row.Suppression = "hard_bounce"
	if err := s.repo.SaveEmailContact(row); err != nil {
		t.Fatal(err)
	}
	if err := s.SetEmailCenterPreference(actor, false); err != nil {
		t.Fatal(err)
	}
	row, _ = s.repo.EmailContact(actor.Email)
	if row.Suppression != "hard_bounce" || row.Marketing {
		t.Fatal("unsubscribe erased suppression")
	}
	if err := s.SetEmailCenterPreference(actor, true); err == nil {
		t.Fatal("permanent suppression was bypassed")
	}
}
func TestEmailCenterSafeModeAndEventRollout(t *testing.T) {
	t.Setenv("CANVAS_EMAIL_CENTER_ROLLOUT_EVENTS", "registration,password_reset")
	if !emailCenterUsesPublished("registration") || emailCenterUsesPublished("verification") {
		t.Fatal("event rollout ignored")
	}
	t.Setenv("CANVAS_EMAIL_CENTER_SAFE_MODE", "true")
	if emailCenterUsesPublished("registration") {
		t.Fatal("safe mode failed to select the validated fallback")
	}
}

func TestEmailCenterPreviewVariablesCannotOverrideCredentials(t *testing.T) {
	s, _, actor := emailCenterFixture(t)
	e, _ := emailcenter.FindEvent("registration")
	if _, err := s.PreviewEmailCenter(actor, e.Key, EmailCenterEditRequest{Document: emailcenter.DefaultDocument(e), PreviewVariables: map[string]string{"code": "123456"}}); err == nil {
		t.Fatal("preview accepted credential override")
	}
	e, _ = emailcenter.FindEvent("welcome")
	name := strings.Repeat("Preview name ", 60)
	mail, err := s.PreviewEmailCenter(actor, e.Key, EmailCenterEditRequest{Document: emailcenter.DefaultDocument(e), PreviewVariables: map[string]string{"name": name}})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(mail.Text, name) {
		t.Fatal("preview variable not rendered")
	}
}
