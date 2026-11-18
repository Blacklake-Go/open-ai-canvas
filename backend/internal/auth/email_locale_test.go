package auth

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"regexp"
	"strings"
	"testing"
	"time"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/maillocale"
)

func TestRecipientLanguageReachesActualSMTPAndSafeReceipt(t *testing.T) {
	for _, locale := range maillocale.Supported() {
		t.Run(locale, func(t *testing.T) {
			svc, db := newPasswordResetTestService(t)
			user := model.User{ID: "locale-owner", Username: "owner", Email: "owner@example.com", PreferredLocale: locale, Status: model.UserStatusActive, PasswordHash: "existing-password-account"}
			if err := db.Create(&user).Error; err != nil {
				t.Fatal(err)
			}
			setting, captured := captureSMTP(t, true)
			encoded, _ := json.Marshal(setting)
			if err := db.Model(&model.SystemSetting{}).Where("key = ?", emailSettingKey).Update("value_json", string(encoded)).Error; err != nil {
				t.Fatal(err)
			}
			if err := svc.SendPasswordResetEmailCode(user.Email, "de-DE"); err != nil {
				t.Fatal(err)
			}
			var raw []byte
			select {
			case raw = <-captured:
			case <-time.After(3 * time.Second):
				t.Fatal("missing local MIME")
			}
			message, err := mail.ReadMessage(bytes.NewReader(raw))
			if err != nil {
				t.Fatal(err)
			}
			subject, err := new(mime.WordDecoder).DecodeHeader(message.Header.Get("Subject"))
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(subject, maillocale.Text(locale, "password_reset")) {
				t.Fatal("request hint overrode recipient language")
			}
			_, params, err := mime.ParseMediaType(message.Header.Get("Content-Type"))
			if err != nil {
				t.Fatal(err)
			}
			reader := multipart.NewReader(message.Body, params["boundary"])
			parts := map[string]string{}
			for {
				part, err := reader.NextPart()
				if err == io.EOF {
					break
				}
				if err != nil {
					t.Fatal(err)
				}
				content, err := io.ReadAll(base64.NewDecoder(base64.StdEncoding, part))
				if err != nil {
					t.Fatal(err)
				}
				parts[part.Header.Get("Content-Type")] = string(content)
			}
			plain := parts["text/plain; charset=UTF-8"]
			html := parts["text/html; charset=UTF-8"]
			if !strings.Contains(html, `lang="`+locale+`"`) || !strings.Contains(plain, maillocale.Text(locale, "security_footer")) {
				t.Fatal("incomplete localization")
			}
			code := regexp.MustCompile(`[0-9]{6}`).FindString(plain)
			if code == "" || strings.Contains(subject, code) || strings.Contains(message.Header.Get("List-Unsubscribe"), code) {
				t.Fatal("missing protected code or leaked credential")
			}
			var receipt model.SupDanceEmailReceipt
			if err := db.First(&receipt).Error; err != nil {
				t.Fatal(err)
			}
			metadata, _ := json.Marshal(receipt)
			if receipt.Locale != locale || receipt.Status != "smtp_accepted" || strings.Contains(string(metadata), `"`+code+`"`) {
				t.Fatal("receipt locale/result or secrecy failed")
			}
		})
	}
}

func TestChangingLanguageDoesNotCreateAnotherSendingIntent(t *testing.T) {
	svc, _ := newPasswordResetTestService(t)
	_, setting, _ := svc.readEmailSetting()
	sent := 0
	svc.SetMailSender(func(EmailSettingValue, string, string, string) error { sent++; return nil })
	delivery := EmailDelivery{Purpose: EmailPurposeRegistration, EventID: "one-event", Recipient: "owner@example.com", Locale: "en-US", Code: "012345", ExpiresAt: time.Now().Add(time.Minute)}
	if err := svc.deliverEmail(setting, delivery); err != nil {
		t.Fatal(err)
	}
	delivery.Locale = "fr-FR"
	if err := svc.deliverEmail(setting, delivery); err == nil || sent != 1 {
		t.Fatal("locale change replayed an intent")
	}
}

func TestAnonymousVerificationAndOnboardingUseRequestedLanguage(t *testing.T) {
	svc, db := newPasswordResetTestService(t)
	svc.host = profileTestHost{}
	if err := db.AutoMigrate(&model.AuthVerification{}, &model.NotificationQuota{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.SystemSetting{Key: registrationSettingKey, ValueJSON: `{"enabled":true}`}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.User{ID: "existing-admin", Username: "admin", Status: model.UserStatusActive}).Error; err != nil {
		t.Fatal(err)
	}
	var body string
	svc.SetMailSender(func(_ EmailSettingValue, _, _ string, text string) error { body = text; return nil })
	if _, err := svc.StartVerification(context.Background(), nil, VerificationRequest{Purpose: "register", Method: "email", Email: "new@example.com", Locale: "ja-JP"}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(body, maillocale.Text("ja-JP", "code_label")) {
		t.Fatal("unified registration ignored interface language")
	}
	if _, err := svc.StartSocialOnboardingEmail(context.Background(), "social@example.com", HashToken("browser-proof"), "es-ES"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(body, maillocale.Text("es-ES", "code_label")) {
		t.Fatal("social onboarding ignored interface language")
	}
}
