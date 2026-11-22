// Package notify implements production SMTP email delivery (TLS/STARTTLS, failover, circuit breaker)
// and Tencent/Aliyun SMS HTTP v3/OpenAPI adapters with DB-backed encrypted credentials and audit logs.
package notify

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/smtp"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/config"
	"one/backend/internal/outbound"
	"one/backend/internal/pkg/seckey"
)

type ServiceError struct {
	Status  int
	Code    string
	Message string
}

func (e *ServiceError) Error() string { return e.Message }

var reBasicEmail = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type Service struct {
	Pool       *pgxpool.Pool
	Config     config.Config
	HTTPClient *outboundClient
	DialSMTP   func(ctx context.Context, host string, port int, secure bool) (net.Conn, error)

	cbMu          sync.Mutex
	cbState       string
	cbFailures    int
	cbLastFailure time.Time
	cbOpenedAt    time.Time
	cbLastErr     string
}

type smtpChannelConfig struct {
	Provider string
	Enabled  bool
	Host     string
	Port     int
	Secure   bool
	Username string
	Password string
	FromName string
}

type smtpSettings struct {
	Enabled         bool
	ActiveProvider  string
	BackupProvider  string
	FailoverEnabled bool
	FailureThresh   int
	CoolingPeriod   time.Duration
	Channels        map[string]smtpChannelConfig
}

var defaultSMTPDefs = map[string]smtpChannelConfig{
	"qq":     {Provider: "qq", Enabled: true, Host: "smtp.exmail.qq.com", Port: 465, Secure: true, FromName: "SupDance"},
	"aliyun": {Provider: "aliyun", Enabled: false, Host: "smtpdm.aliyun.com", Port: 465, Secure: true, FromName: "SupDance"},
	"resend": {Provider: "resend", Enabled: false, Host: "smtp.resend.com", Port: 465, Secure: true, FromName: "SupDance"},
	"custom": {Provider: "custom", Enabled: false, Host: "", Port: 465, Secure: true, FromName: "SupDance"},
}

func randomHexID(prefix string) string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

func (s *Service) readSMTPSettings(ctx context.Context) (smtpSettings, error) {
	st := smtpSettings{
		ActiveProvider:  "qq",
		FailoverEnabled: true,
		FailureThresh:   5,
		CoolingPeriod:   60 * time.Second,
		Channels:        make(map[string]smtpChannelConfig),
	}
	for k, v := range defaultSMTPDefs {
		st.Channels[k] = v
	}

	var rawMap map[string]any
	if s != nil && s.Pool != nil {
		var raw []byte
		err := s.Pool.QueryRow(ctx, `SELECT value FROM ops_bill.system_settings WHERE key = 'email_smtp'`).Scan(&raw)
		if err == nil && len(raw) > 0 {
			_ = json.Unmarshal(raw, &rawMap)
		}
	}

	if rawMap != nil {
		if b, ok := rawMap["enabled"].(bool); ok {
			st.Enabled = b
		}
		if p := strings.ToLower(strings.TrimSpace(strVal(rawMap["activeProvider"]))); p != "" {
			st.ActiveProvider = p
		}
		if bp := strings.ToLower(strings.TrimSpace(strVal(rawMap["backupProvider"]))); bp != "" {
			st.BackupProvider = bp
		}
		if b, ok := rawMap["failoverEnabled"].(bool); ok {
			st.FailoverEnabled = b
		}
		if cb, ok := rawMap["circuitBreaker"].(map[string]any); ok {
			if ft := intVal(cb["failureThreshold"]); ft > 0 {
				st.FailureThresh = ft
			}
			if cp := intVal(cb["coolingPeriodSec"]); cp > 0 {
				st.CoolingPeriod = time.Duration(cp) * time.Second
			}
		}
		if provMap, ok := rawMap["providers"].(map[string]any); ok {
			for k, item := range provMap {
				ch := st.Channels[k]
				ch.Provider = k
				if m, ok := item.(map[string]any); ok {
					if b, ok := m["enabled"].(bool); ok {
						ch.Enabled = b
					}
					if h := strings.TrimSpace(strVal(m["host"])); h != "" {
						ch.Host = h
					}
					if p := intVal(m["port"]); p > 0 {
						ch.Port = p
					}
					if sec, ok := m["secure"].(bool); ok {
						ch.Secure = sec
					}
					if u := strings.TrimSpace(strVal(m["username"])); u != "" {
						ch.Username = u
					}
					if fn := strings.TrimSpace(strVal(m["fromName"])); fn != "" {
						ch.FromName = fn
					}
				}
				st.Channels[k] = ch
			}
		}
		// Top-level overrides for active channel
		activeCh := st.Channels[st.ActiveProvider]
		activeCh.Provider = st.ActiveProvider
		if h := strings.TrimSpace(strVal(rawMap["host"])); h != "" && activeCh.Host == "" {
			activeCh.Host = h
		}
		if p := intVal(rawMap["port"]); p > 0 && activeCh.Port == 0 {
			activeCh.Port = p
		}
		if u := strings.TrimSpace(strVal(rawMap["username"])); u != "" && activeCh.Username == "" {
			activeCh.Username = u
		}
		if fn := strings.TrimSpace(strVal(rawMap["fromName"])); fn != "" && activeCh.FromName == "" {
			activeCh.FromName = fn
		}
		st.Channels[st.ActiveProvider] = activeCh
	}

	// Env fallback on active channel
	envUser := strings.TrimSpace(firstStr(getenv("EMAIL_SMTP_USER"), getenv("SMTP_USERNAME")))
	envPass := strings.TrimSpace(firstStr(getenv("EMAIL_SMTP_PASSWORD"), getenv("SMTP_PASSWORD")))
	envHost := strings.TrimSpace(firstStr(getenv("EMAIL_SMTP_HOST"), getenv("SMTP_HOST")))
	envPort := intVal(firstStr(getenv("EMAIL_SMTP_PORT"), getenv("SMTP_PORT")))
	envFrom := strings.TrimSpace(firstStr(getenv("EMAIL_SMTP_FROM_NAME"), "SupDance"))

	ch := st.Channels[st.ActiveProvider]
	ch.Provider = st.ActiveProvider
	if rawMap == nil && envHost != "" {
		ch.Host = envHost
		if envPort > 0 {
			ch.Port = envPort
			ch.Secure = envPort == 465
		}
	} else {
		if ch.Host == "" {
			ch.Host = envHost
		}
		if ch.Port == 0 {
			if envPort > 0 {
				ch.Port = envPort
			} else {
				ch.Port = 465
			}
		}
	}
	if ch.Username == "" {
		ch.Username = envUser
	}
	if ch.FromName == "" {
		ch.FromName = envFrom
	}
	st.Channels[st.ActiveProvider] = ch

	// Resolve passwords per channel from DB secrets then env
	for name, cfgCh := range st.Channels {
		secretKeyName := "smtp_password"
		if name != "qq" && name != st.ActiveProvider {
			secretKeyName = "smtp_password_" + name
		}
		if sec := s.readProviderSecret(ctx, "email_smtp", secretKeyName); sec != "" {
			cfgCh.Password = sec
		} else if name != "qq" {
			if sec2 := s.readProviderSecret(ctx, "email_smtp", "smtp_password_"+name); sec2 != "" {
				cfgCh.Password = sec2
			}
		}
		if cfgCh.Password == "" && (name == "qq" || name == st.ActiveProvider) {
			cfgCh.Password = envPass
		}
		if cfgCh.Username != "" && cfgCh.Password != "" && !st.Enabled && envUser != "" && envPass != "" {
			st.Enabled = true
		}
		st.Channels[name] = cfgCh
	}

	return st, nil
}

func (s *Service) readProviderSecret(ctx context.Context, provider, keyName string) string {
	if s == nil || s.Pool == nil {
		return ""
	}
	plain, err := seckey.ReadProviderSecret(ctx, s.Pool.QueryRow, s.Config.ProviderSecretKey(), provider, keyName)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(plain)
}

func (s *Service) dialSMTPClient(ctx context.Context, ch smtpChannelConfig) (*smtp.Client, error) {
	if ch.Host == "" || ch.Port <= 0 {
		return nil, &ServiceError{Status: 503, Code: "SMTP_NOT_CONFIGURED", Message: "SMTP 服务器尚未配置"}
	}
	if s.DialSMTP == nil {
		if _, err := outbound.ValidateExternalURL(fmt.Sprintf("https://%s", ch.Host), s.Config.AllowedPrivateHosts...); err != nil {
			return nil, &ServiceError{Status: 422, Code: "SMTP_UNSAFE_HOST", Message: "SMTP 主机地址不受允许: " + err.Error()}
		}
	}

	var conn net.Conn
	var err error
	if s.DialSMTP != nil {
		conn, err = s.DialSMTP(ctx, ch.Host, ch.Port, ch.Secure || ch.Port == 465)
	} else {
		dialer := &net.Dialer{Timeout: 10 * time.Second}
		addr := net.JoinHostPort(ch.Host, strconv.Itoa(ch.Port))
		if ch.Secure || ch.Port == 465 {
			tlsCfg := &tls.Config{ServerName: ch.Host, MinVersion: tls.VersionTLS12}
			conn, err = tls.DialWithDialer(dialer, "tcp", addr, tlsCfg)
		} else {
			conn, err = dialer.DialContext(ctx, "tcp", addr)
		}
	}
	if err != nil {
		return nil, classifySMTPError(err)
	}

	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	} else {
		_ = conn.SetDeadline(time.Now().Add(20 * time.Second))
	}

	client, err := smtp.NewClient(conn, ch.Host)
	if err != nil {
		_ = conn.Close()
		return nil, classifySMTPError(err)
	}

	if !ch.Secure && ch.Port != 465 && s.DialSMTP == nil {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{ServerName: ch.Host, MinVersion: tls.VersionTLS12}); err != nil {
				_ = client.Close()
				return nil, classifySMTPError(err)
			}
		}
	}

	if ch.Username != "" && ch.Password != "" {
		if ok, _ := client.Extension("AUTH"); ok {
			if err := client.Auth(smtp.PlainAuth("", ch.Username, ch.Password, ch.Host)); err != nil {
				_ = client.Close()
				return nil, &ServiceError{Status: 502, Code: "SMTP_AUTH_FAILED", Message: "SMTP 身份验证失败"}
			}
		}
	}
	return client, nil
}

func classifySMTPError(err error) *ServiceError {
	if err == nil {
		return nil
	}
	var se *ServiceError
	if errors.As(err, &se) {
		return se
	}
	msg := err.Error()
	low := strings.ToLower(msg)
	switch {
	case strings.Contains(low, "535") || strings.Contains(low, "534") || strings.Contains(low, "auth"):
		return &ServiceError{Status: 502, Code: "SMTP_AUTH_FAILED", Message: "SMTP 认证失败"}
	case strings.Contains(low, "timeout"):
		return &ServiceError{Status: 504, Code: "SMTP_TIMEOUT", Message: "SMTP 连接超时"}
	default:
		return &ServiceError{Status: 503, Code: "SMTP_UNAVAILABLE", Message: "SMTP 服务不可用: " + msg}
	}
}

// SendEmailCode delivers verification / recovery codes via SMTP (implements auth.OutboundCodeSender).
func (s *Service) SendEmailCode(ctx context.Context, email, code, purpose string) error {
	clean := strings.TrimSpace(strings.ToLower(email))
	if !reBasicEmail.MatchString(clean) {
		return &ServiceError{Status: 400, Code: "EMAIL_INVALID_RECIPIENT", Message: "请输入有效的收件邮箱"}
	}
	subject, text, html := buildVerificationEmail(code, purpose)
	return s.DeliverEmail(ctx, DeliverEmailInput{
		To:             clean,
		Subject:        subject,
		Text:           text,
		HTML:           html,
		Purpose:        "verification",
		RequireEnabled: true,
	})
}

type DeliverEmailInput struct {
	To             string
	Subject        string
	Text           string
	HTML           string
	Purpose        string
	RequireEnabled bool
	Channel        string
	UserID         string
	ActorID        string
}

func (s *Service) DeliverEmail(ctx context.Context, in DeliverEmailInput) error {
	recipient := strings.TrimSpace(in.To)
	if !reBasicEmail.MatchString(recipient) {
		return &ServiceError{Status: 400, Code: "EMAIL_INVALID_RECIPIENT", Message: "请输入有效的收件邮箱"}
	}
	st, err := s.readSMTPSettings(ctx)
	if err != nil {
		return err
	}
	if in.RequireEnabled && !st.Enabled {
		return &ServiceError{Status: 503, Code: "SMTP_NOT_CONFIGURED", Message: "SMTP 邮件服务尚未启用或配置"}
	}

	target := firstStr(strings.ToLower(strings.TrimSpace(in.Channel)), st.ActiveProvider, "qq")
	backup := ""
	if st.FailoverEnabled && st.BackupProvider != "" && st.BackupProvider != target {
		backup = st.BackupProvider
	}

	if !s.allowCircuitAttempt(st) {
		if backup == "" {
			return &ServiceError{Status: 503, Code: "SMTP_CIRCUIT_OPEN", Message: "邮件发送通道处于熔断保护期，请稍后再试"}
		}
		target = backup
	}

	started := time.Now()
	ch := st.Channels[target]
	err = s.sendViaChannel(ctx, ch, recipient, in.Subject, in.Text, in.HTML)
	if err != nil {
		s.recordCircuitFailure(err, st.FailureThresh)
		if backup != "" && backup != target && in.Channel == "" {
			bch := st.Channels[backup]
			if err2 := s.sendViaChannel(ctx, bch, recipient, in.Subject, in.Text, in.HTML); err2 == nil {
				s.recordCircuitSuccess()
				s.logEmailSend(ctx, bch.Provider, in.Purpose, recipient, in.Subject, in.Text, "success", "", time.Since(started).Milliseconds(), in.UserID, in.ActorID)
				return nil
			} else {
				err = err2
				target = backup
			}
		}
		se := classifySMTPError(err)
		s.logEmailSend(ctx, target, in.Purpose, recipient, in.Subject, in.Text, "failed", se.Code, time.Since(started).Milliseconds(), in.UserID, in.ActorID)
		return se
	}

	s.recordCircuitSuccess()
	s.logEmailSend(ctx, ch.Provider, in.Purpose, recipient, in.Subject, in.Text, "success", "", time.Since(started).Milliseconds(), in.UserID, in.ActorID)
	return nil
}

func (s *Service) sendViaChannel(ctx context.Context, ch smtpChannelConfig, to, subject, text, html string) error {
	if ch.Username == "" || ch.Password == "" || ch.Host == "" {
		return &ServiceError{Status: 503, Code: "SMTP_NOT_CONFIGURED", Message: "SMTP 发件凭据尚未配置"}
	}
	client, err := s.dialSMTPClient(ctx, ch)
	if err != nil {
		return err
	}
	defer func() { _ = client.Close() }()

	if err := client.Mail(ch.Username); err != nil {
		return classifySMTPError(err)
	}
	if err := client.Rcpt(to); err != nil {
		return classifySMTPError(err)
	}
	wc, err := client.Data()
	if err != nil {
		return classifySMTPError(err)
	}

	fromName := sanitizeHeader(firstStr(ch.FromName, "SupDance"))
	boundary := randomHexID("bnd")
	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("From: %s <%s>\r\n", fromName, ch.Username))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", sanitizeHeader(to)))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", sanitizeHeader(subject)))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("X-Auto-Response-Suppress: All\r\n")
	if html != "" {
		msg.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n\r\n", boundary))
		msg.WriteString(fmt.Sprintf("--%s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n", boundary, text))
		msg.WriteString(fmt.Sprintf("--%s\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n", boundary, html))
		msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	} else {
		msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
		msg.WriteString(text)
	}
	if _, err := wc.Write([]byte(msg.String())); err != nil {
		_ = wc.Close()
		return classifySMTPError(err)
	}
	if err := wc.Close(); err != nil {
		return classifySMTPError(err)
	}
	return client.Quit()
}

// VerifySMTP performs a live EHLO/AUTH SMTP probe and returns status, latencyMs, and errorCode.
func (s *Service) VerifySMTP(ctx context.Context, channel string) (string, int64, string) {
	st, err := s.readSMTPSettings(ctx)
	if err != nil {
		return "unavailable", 0, "SMTP_CONFIG_ERROR"
	}
	target := firstStr(strings.ToLower(strings.TrimSpace(channel)), st.ActiveProvider, "qq")
	ch := st.Channels[target]
	if ch.Username == "" || ch.Password == "" || ch.Host == "" {
		return "unavailable", 0, "SMTP_NOT_CONFIGURED"
	}
	started := time.Now()
	client, err := s.dialSMTPClient(ctx, ch)
	lat := time.Since(started).Milliseconds()
	if err != nil {
		return "unavailable", lat, classifySMTPError(err).Code
	}
	_ = client.Quit()
	return "healthy", lat, ""
}

func (s *Service) SendTestEmail(ctx context.Context, to, actorID string) (int64, error) {
	started := time.Now()
	err := s.DeliverEmail(ctx, DeliverEmailInput{
		To:      to,
		Subject: "[SupDance] SMTP 邮件服务配置与连通性测试",
		Text:    "这是一封 SupDance 管理后台发出的 SMTP 连通性测试邮件。\n发送时间：" + time.Now().UTC().Format(time.RFC3339),
		Purpose: "test",
		ActorID: actorID,
	})
	return time.Since(started).Milliseconds(), err
}

func (s *Service) logEmailSend(ctx context.Context, provider, purpose, recipient, subject, text, status, errCode string, latencyMs int64, userID, actorID string) {
	if s == nil || s.Pool == nil {
		return
	}
	switch purpose {
	case "verification", "test", "system", "marketing":
	default:
		purpose = "verification"
	}
	domain := ""
	if at := strings.LastIndex(recipient, "@"); at >= 0 && at+1 < len(recipient) {
		domain = strings.ToLower(recipient[at+1:])
	}
	preview := text
	if len(preview) > 240 {
		preview = preview[:240]
	}
	_, _ = s.Pool.Exec(ctx, `
		INSERT INTO auth_usr.email_send_logs
			(id, provider, purpose, recipient, recipient_domain, subject, body_preview, status, error_code, latency_ms, user_id, actor_id, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`,
		randomHexID("eml"), firstStr(provider, "email_smtp"), purpose, recipient, domain, subject, preview,
		status, nilIfEmpty(errCode), latencyMs, nilIfEmpty(userID), nilIfEmpty(actorID))
}

func (s *Service) allowCircuitAttempt(st smtpSettings) bool {
	s.cbMu.Lock()
	defer s.cbMu.Unlock()
	if s.cbState != "open" {
		return true
	}
	if time.Since(s.cbOpenedAt) >= st.CoolingPeriod {
		s.cbState = "half_open"
		return true
	}
	return false
}

func (s *Service) recordCircuitSuccess() {
	s.cbMu.Lock()
	s.cbState = "closed"
	s.cbFailures = 0
	s.cbLastErr = ""
	s.cbMu.Unlock()
}

func (s *Service) recordCircuitFailure(err error, threshold int) {
	s.cbMu.Lock()
	defer s.cbMu.Unlock()
	s.cbFailures++
	s.cbLastFailure = time.Now()
	if err != nil {
		s.cbLastErr = err.Error()
	}
	if threshold <= 0 {
		threshold = 5
	}
	if s.cbFailures >= threshold {
		s.cbState = "open"
		s.cbOpenedAt = time.Now()
	}
}

func buildVerificationEmail(code, purpose string) (subject, text, html string) {
	title := "验证码"
	switch purpose {
	case "password_reset_email":
		title = "密码重置验证码"
	case "username_recovery_email":
		title = "用户名找回验证码"
	case "email_bind":
		title = "邮箱绑定验证码"
	}
	subject = fmt.Sprintf("[SupDance] %s: %s", title, code)
	text = fmt.Sprintf("您的%s为：%s（10 分钟内有效，请勿泄露给他人）。", title, code)
	html = fmt.Sprintf("<p>您的%s为：<strong style=\"font-size:20px;letter-spacing:2px\">%s</strong></p><p>该验证码 10 分钟内有效，请勿泄露给他人。</p>", title, code)
	return
}

func sanitizeHeader(s string) string {
	return strings.NewReplacer("\r", "", "\n", "").Replace(strings.TrimSpace(s))
}

func strVal(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func intVal(v any) int {
	switch x := v.(type) {
	case int:
		return x
	case int64:
		return int(x)
	case float64:
		return int(x)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(x))
		return n
	default:
		return 0
	}
}

func firstStr(vals ...string) string {
	for _, v := range vals {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}

func nilIfEmpty(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func getenv(k string) string {
	return os.Getenv(k)
}
