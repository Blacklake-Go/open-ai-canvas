package auth

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"github.com/emersion/go-msgauth/dkim"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
	"yingce/backend/internal/model"
)

func TestEmailCenterIdempotencySurvivesServiceRestart(t *testing.T) {
	svc, db := newPasswordResetTestService(t)
	var count atomic.Int32
	sender := func(EmailSettingValue, string, string, string) error { count.Add(1); return nil }
	svc.SetMailSender(sender)
	_, setting, err := svc.readEmailSetting()
	if err != nil {
		t.Fatal(err)
	}
	delivery := EmailDelivery{Purpose: EmailPurposeRegistration, Recipient: "reader@example.com", EventID: "one-challenge", Code: "135790", ExpiresAt: time.Now().Add(time.Minute)}
	if err := svc.deliverEmail(setting, delivery); err != nil {
		t.Fatal(err)
	}
	restarted := New(svc.repo, svc.host, sender)
	if err := restarted.deliverEmail(setting, delivery); err == nil {
		t.Fatal("duplicate intent accepted")
	}
	if count.Load() != 1 {
		t.Fatal("duplicate SMTP submission")
	}
	var receipt model.SupDanceEmailReceipt
	if err := db.First(&receipt).Error; err != nil {
		t.Fatal(err)
	}
	if receipt.Status != "smtp_accepted" {
		t.Fatal(receipt.Status)
	}
	if len(receipt.LogID) > 36 || len(receipt.LogID) == 0 {
		t.Fatal("receipt cannot join the existing email_logs key")
	}
	var log model.EmailLog
	if err := db.First(&log, "id = ?", receipt.LogID).Error; err != nil {
		t.Fatal(err)
	}
	metadata, err := svc.repo.EmailReceipts([]string{log.ID})
	if err != nil || metadata[log.ID].ID != receipt.ID {
		t.Fatal("log metadata join failed", err)
	}
}
func TestSMTPUnknownNeverRetriesAndExplicitRejectionIsKnown(t *testing.T) {
	for _, tc := range []struct {
		err  error
		want string
	}{{&smtpStageError{stage: "finish_data", err: errors.New("timeout")}, "unknown"}, {&smtpStageError{stage: "finish_data", err: &textproto.Error{Code: 550, Msg: "rejected"}}, "failed"}, {&smtpStageError{stage: "rcpt_to", err: &textproto.Error{Code: 451, Msg: "temporary"}}, "retryable"}} {
		got, _ := EmailDeliveryResult(tc.err)
		if got != tc.want {
			t.Fatalf("got %s want %s", got, tc.want)
		}
	}
}
func TestMarketingCannotConsumeSecurityLane(t *testing.T) {
	svc, _ := newPasswordResetTestService(t)
	svc.SetMailSender(func(EmailSettingValue, string, string, string) error { return nil })
	_, setting, _ := svc.readEmailSetting()
	marketingEmailLane <- struct{}{}
	defer func() { <-marketingEmailLane }()
	if err := svc.deliverEmail(setting, EmailDelivery{Purpose: EmailPurposeRegistration, EventID: "security-reserved", Recipient: "reader@example.com", Code: "345678", ExpiresAt: time.Now().Add(time.Minute)}); err != nil {
		t.Fatal(err)
	}
}
func TestMarketingDKIMCoversUnsubscribeHeaders(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(t.TempDir(), "dkim.pem")
	if err := os.WriteFile(file, pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CANVAS_EMAIL_DKIM_SELECTOR", "email-center-test")
	t.Setenv("CANVAS_EMAIL_DKIM_KEY_FILE", file)
	setting := EmailSettingValue{Host: "smtp.example.com", FromEmail: "support@example.com", FromName: "SupDance"}
	mail := OutgoingMail{Subject: "Product update", Text: "Verified text", HTML: "<p>Verified text</p>", UnsubscribeURL: "https://example.com/api/public/email-center/unsubscribe?token=test"}
	raw := buildMIMEMessage(setting, "reader@example.com", mail, time.Now())
	signed, err := SignMarketingMIME(setting.FromEmail, raw)
	if err != nil {
		t.Fatal(err)
	}
	pub, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	options := &dkim.VerifyOptions{LookupTXT: func(domain string) ([]string, error) {
		if domain != "email-center-test._domainkey.example.com" {
			t.Fatal(domain)
		}
		return []string{"v=DKIM1; k=rsa; p=" + base64.StdEncoding.EncodeToString(pub)}, nil
	}}
	verified, err := dkim.VerifyWithOptions(bytes.NewReader(signed), options)
	if err != nil || len(verified) != 1 || verified[0].Err != nil {
		t.Fatalf("DKIM failed: %v %+v", err, verified)
	}
	tampered := strings.Replace(string(signed), "List-Unsubscribe=One-Click", "List-Unsubscribe=Changed", 1)
	verified, err = dkim.VerifyWithOptions(strings.NewReader(tampered), options)
	if err == nil && len(verified) > 0 && verified[0].Err == nil {
		t.Fatal("unsubscribe headers were not covered by DKIM")
	}
}
