package notify

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
)

func TestDeliverEmailMockSMTPServer(t *testing.T) {
	t.Setenv("EMAIL_SMTP_HOST", "localhost")
	t.Setenv("EMAIL_SMTP_PORT", "587")
	t.Setenv("EMAIL_SMTP_USER", "noreply@example.com")
	t.Setenv("EMAIL_SMTP_PASSWORD", "app-pass-123")

	var mu sync.Mutex
	var captured strings.Builder
	var sawAuth bool

	svc := &Service{
		DialSMTP: func(ctx context.Context, host string, port int, secure bool) (net.Conn, error) {
			if host != "localhost" || port != 587 || secure {
				t.Errorf("unexpected dial args host=%s port=%d secure=%v", host, port, secure)
			}
			cConn, sConn := net.Pipe()
			go func() {
				defer sConn.Close()
				r := bufio.NewReader(sConn)
				w := func(line string) { _, _ = sConn.Write([]byte(line + "\r\n")) }
				w("220 smtp.mock.local ESMTP ready")
				inData := false
				for {
					line, err := r.ReadString('\n')
					if err != nil {
						return
					}
					trimmed := strings.TrimRight(line, "\r\n")
					if inData {
						if trimmed == "." {
							inData = false
							w("250 2.0.0 Ok: queued")
							continue
						}
						mu.Lock()
						captured.WriteString(trimmed + "\n")
						mu.Unlock()
						continue
					}
					upper := strings.ToUpper(trimmed)
					switch {
					case strings.HasPrefix(upper, "EHLO") || strings.HasPrefix(upper, "HELO"):
						w("250-smtp.mock.local")
						w("250 AUTH PLAIN LOGIN")
					case strings.HasPrefix(upper, "AUTH "):
						mu.Lock()
						sawAuth = true
						mu.Unlock()
						w("235 2.7.0 Authentication successful")
					case strings.HasPrefix(upper, "MAIL FROM:"):
						w("250 2.1.0 Ok")
					case strings.HasPrefix(upper, "RCPT TO:"):
						w("250 2.1.5 Ok")
					case upper == "DATA":
						inData = true
						w("354 End data with <CR><LF>.<CR><LF>")
					case upper == "QUIT":
						w("221 2.0.0 Bye")
						return
					default:
						w("250 Ok")
					}
				}
			}()
			return cConn, nil
		},
	}

	status, _, errCode := svc.VerifySMTP(context.Background(), "")
	if status != "healthy" || errCode != "" {
		t.Fatalf("VerifySMTP status=%s errCode=%s", status, errCode)
	}

	if err := svc.SendEmailCode(context.Background(), "alice@example.com", "654321", "login"); err != nil {
		t.Fatalf("SendEmailCode failed: %v", err)
	}

	mu.Lock()
	body := captured.String()
	authed := sawAuth
	mu.Unlock()
	if !authed {
		t.Fatal("expected SMTP AUTH PLAIN to run")
	}
	if !strings.Contains(body, "To: alice@example.com") || !strings.Contains(body, "654321") {
		t.Fatalf("unexpected MIME payload: %s", body)
	}
}

func TestDeliverEmailFailClosedWhenNotConfigured(t *testing.T) {
	t.Setenv("EMAIL_SMTP_HOST", "")
	t.Setenv("SMTP_HOST", "")
	t.Setenv("EMAIL_SMTP_USER", "")
	t.Setenv("SMTP_USERNAME", "")
	t.Setenv("EMAIL_SMTP_PASSWORD", "")
	t.Setenv("SMTP_PASSWORD", "")

	svc := &Service{}
	err := svc.SendEmailCode(context.Background(), "alice@example.com", "123456", "login")
	var se *ServiceError
	if !errors.As(err, &se) || se.Code != "SMTP_NOT_CONFIGURED" {
		t.Fatalf("expected SMTP_NOT_CONFIGURED, got %v", err)
	}
}

func TestSendSMSCodeTencentAndAliyunFailover(t *testing.T) {
	var tencentAuth, tencentAction, tencentBody string
	tencentFail := true
	tencentSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		tencentBody = string(raw)
		tencentAuth = r.Header.Get("Authorization")
		tencentAction = r.Header.Get("X-TC-Action")
		w.Header().Set("Content-Type", "application/json")
		if tencentFail && tencentAction == "SendSms" {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"Response": map[string]any{
					"Error": map[string]any{"Code": "LimitExceeded", "Message": "quota reached"},
				},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"Response": map[string]any{
				"SendStatusSet": []map[string]any{{"Code": "Ok"}},
			},
		})
	}))
	defer tencentSrv.Close()

	var aliyunForm url.Values
	aliyunSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		aliyunForm, _ = url.ParseQuery(string(raw))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"Code": "OK", "Message": "OK"})
	}))
	defer aliyunSrv.Close()

	t.Setenv("SMS_CHINA_PRIMARY", "tencent_sms")
	t.Setenv("SMS_CHINA_FALLBACK", "aliyun_sms")
	t.Setenv("TENCENT_SMS_ENDPOINT", tencentSrv.URL)
	t.Setenv("TENCENT_SMS_SECRET_ID", "tc-id")
	t.Setenv("TENCENT_SMS_SECRET_KEY", "tc-secret")
	t.Setenv("TENCENT_SMS_SDK_APP_ID", "1400000001")
	t.Setenv("TENCENT_SMS_SIGN_NAME", "SupDance")
	t.Setenv("TENCENT_SMS_TEMPLATE_ID", "100001")
	t.Setenv("ALIYUN_SMS_ENDPOINT", aliyunSrv.URL)
	t.Setenv("ALIYUN_SMS_ACCESS_KEY_ID", "ali-id")
	t.Setenv("ALIYUN_SMS_ACCESS_KEY_SECRET", "ali-secret")
	t.Setenv("ALIYUN_SMS_SIGN_NAME", "SupDance")
	t.Setenv("ALIYUN_SMS_TEMPLATE_CODE", "SMS_123456")

	svc := &Service{
		HTTPClient: &outboundClient{Client: tencentSrv.Client()},
	}

	if err := svc.SendSMSCode(context.Background(), "+8613800138000", "998877", "login"); err != nil {
		t.Fatalf("expected failover to aliyun to succeed, got %v", err)
	}
	if !strings.HasPrefix(tencentAuth, "TC3-HMAC-SHA256 ") || tencentAction != "SendSms" {
		t.Fatalf("unexpected tencent headers auth=%q action=%q", tencentAuth, tencentAction)
	}
	if !strings.Contains(tencentBody, "+8613800138000") || !strings.Contains(tencentBody, "998877") {
		t.Fatalf("unexpected tencent body: %s", tencentBody)
	}
	if aliyunForm.Get("Action") != "SendSms" || aliyunForm.Get("SignatureMethod") != "HMAC-SHA1" || aliyunForm.Get("Signature") == "" {
		t.Fatalf("unexpected aliyun form: %+v", aliyunForm)
	}
	if aliyunForm.Get("PhoneNumbers") != "13800138000" {
		t.Fatalf("expected stripped +86 phone for aliyun, got %q", aliyunForm.Get("PhoneNumbers"))
	}

	tencentFail = false
	st1, _, err1 := svc.HealthCheckSMS(context.Background(), "tencent_sms")
	st2, _, err2 := svc.HealthCheckSMS(context.Background(), "aliyun_sms")
	if st1 != "healthy" || err1 != "" || st2 != "healthy" || err2 != "" {
		t.Fatalf("unexpected health checks: tencent=(%s,%s) aliyun=(%s,%s)", st1, err1, st2, err2)
	}
}
