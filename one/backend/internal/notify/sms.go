package notify

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"one/backend/internal/outbound"
)

type outboundClient struct {
	Client *http.Client
}

func (s *Service) httpClient() *http.Client {
	if s != nil && s.HTTPClient != nil && s.HTTPClient.Client != nil {
		return s.HTTPClient.Client
	}
	return outbound.NewSafeHTTPClient(10*time.Second, s.Config.AllowedPrivateHosts...)
}

type smsConfig struct {
	PrimaryChina  string
	FallbackChina string
	Tencent       tencentSMSConfig
	Aliyun        aliyunSMSConfig
}

type tencentSMSConfig struct {
	Enabled    bool
	SecretID   string
	SecretKey  string
	SDKAppID   string
	SignName   string
	TemplateID string
	Endpoint   string
}

type aliyunSMSConfig struct {
	Enabled         bool
	AccessKeyID     string
	AccessKeySecret string
	SignName        string
	TemplateCode    string
	Endpoint        string
}

func (s *Service) readSMSConfig(ctx context.Context) smsConfig {
	cfg := smsConfig{
		PrimaryChina:  firstStr(os.Getenv("SMS_CHINA_PRIMARY"), "tencent_sms"),
		FallbackChina: firstStr(os.Getenv("SMS_CHINA_FALLBACK"), "aliyun_sms"),
		Tencent: tencentSMSConfig{
			Enabled:    true,
			SecretID:   os.Getenv("TENCENT_SMS_SECRET_ID"),
			SecretKey:  os.Getenv("TENCENT_SMS_SECRET_KEY"),
			SDKAppID:   os.Getenv("TENCENT_SMS_SDK_APP_ID"),
			SignName:   os.Getenv("TENCENT_SMS_SIGN_NAME"),
			TemplateID: os.Getenv("TENCENT_SMS_TEMPLATE_ID"),
			Endpoint:   firstStr(os.Getenv("TENCENT_SMS_ENDPOINT"), "https://sms.tencentcloudapi.com"),
		},
		Aliyun: aliyunSMSConfig{
			Enabled:         true,
			AccessKeyID:     os.Getenv("ALIYUN_SMS_ACCESS_KEY_ID"),
			AccessKeySecret: os.Getenv("ALIYUN_SMS_ACCESS_KEY_SECRET"),
			SignName:        os.Getenv("ALIYUN_SMS_SIGN_NAME"),
			TemplateCode:    os.Getenv("ALIYUN_SMS_TEMPLATE_CODE"),
			Endpoint:        firstStr(os.Getenv("ALIYUN_SMS_ENDPOINT"), "https://dysmsapi.aliyuncs.com"),
		},
	}

	if s != nil && s.Pool != nil {
		var raw []byte
		if err := s.Pool.QueryRow(ctx, `SELECT value_json FROM ops_bill.system_settings WHERE key = 'sms_routing'`).Scan(&raw); err == nil && len(raw) > 0 {
			var m map[string]any
			if json.Unmarshal(raw, &m) == nil {
				if routing, ok := m["routing"].(map[string]any); ok {
					if cn, ok := routing["china"].(map[string]any); ok {
						if p := strVal(cn["primary"]); p != "" {
							cfg.PrimaryChina = p
						}
						if fb, exists := cn["fallback"]; exists {
							cfg.FallbackChina = strVal(fb)
						}
					}
				}
				if provs, ok := m["providers"].(map[string]any); ok {
					if tc, ok := provs["tencent_sms"].(map[string]any); ok {
						if en, ok := tc["enabled"].(bool); ok {
							cfg.Tencent.Enabled = en
						}
						cfg.Tencent.SDKAppID = firstStr(strVal(tc["sdkAppId"]), cfg.Tencent.SDKAppID)
						cfg.Tencent.SignName = firstStr(strVal(tc["signName"]), cfg.Tencent.SignName)
						cfg.Tencent.TemplateID = firstStr(strVal(tc["templateId"]), cfg.Tencent.TemplateID)
					}
					if al, ok := provs["aliyun_sms"].(map[string]any); ok {
						if en, ok := al["enabled"].(bool); ok {
							cfg.Aliyun.Enabled = en
						}
						cfg.Aliyun.SignName = firstStr(strVal(al["signName"]), cfg.Aliyun.SignName)
						cfg.Aliyun.TemplateCode = firstStr(strVal(al["templateId"]), strVal(al["templateCode"]), cfg.Aliyun.TemplateCode)
					}
				}
			}
		}

		cfg.Tencent.SecretID = firstStr(s.readProviderSecret(ctx, "tencent_sms", "secret_id"), cfg.Tencent.SecretID)
		cfg.Tencent.SecretKey = firstStr(s.readProviderSecret(ctx, "tencent_sms", "secret_key"), cfg.Tencent.SecretKey)
		cfg.Aliyun.AccessKeyID = firstStr(s.readProviderSecret(ctx, "aliyun_sms", "access_key_id"), cfg.Aliyun.AccessKeyID)
		cfg.Aliyun.AccessKeySecret = firstStr(s.readProviderSecret(ctx, "aliyun_sms", "access_key_secret"), cfg.Aliyun.AccessKeySecret)
	}
	return cfg
}

// SendSMSCode sends an OTP SMS via primary + fallback gateways (implements auth.OutboundCodeSender).
func (s *Service) SendSMSCode(ctx context.Context, phone, code, purpose string) error {
	_ = purpose
	cleanPhone := strings.TrimSpace(phone)
	if cleanPhone == "" {
		return &ServiceError{Status: 400, Code: "INVALID_PHONE", Message: "请输入有效的手机号"}
	}
	cfg := s.readSMSConfig(ctx)
	providers := []string{cfg.PrimaryChina}
	if cfg.FallbackChina != "" && cfg.FallbackChina != cfg.PrimaryChina {
		providers = append(providers, cfg.FallbackChina)
	}

	var lastErr error
	for _, prov := range providers {
		if prov == "" {
			continue
		}
		err := s.sendSMSViaProvider(ctx, cfg, prov, cleanPhone, code)
		if err == nil {
			return nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return lastErr
	}
	return &ServiceError{Status: 503, Code: "SMS_PROVIDER_NOT_CONFIGURED", Message: "短信网关尚未配置"}
}

// SendTestSMS explicitly tests a named SMS provider ('tencent_sms' | 'aliyun_sms').
func (s *Service) SendTestSMS(ctx context.Context, provider, phone string) error {
	cfg := s.readSMSConfig(ctx)
	return s.sendSMSViaProvider(ctx, cfg, strings.TrimSpace(provider), strings.TrimSpace(phone), "123456")
}

// HealthCheckSMS probes Tencent or Aliyun SMS gateway readiness & connectivity.
func (s *Service) HealthCheckSMS(ctx context.Context, provider string) (string, int64, string) {
	cfg := s.readSMSConfig(ctx)
	started := time.Now()
	switch strings.TrimSpace(provider) {
	case "tencent_sms":
		if !cfg.Tencent.Enabled || cfg.Tencent.SecretID == "" || cfg.Tencent.SecretKey == "" || cfg.Tencent.SDKAppID == "" {
			return "unavailable", 0, "SMS_PROVIDER_NOT_CONFIGURED"
		}
		_, err := s.callTencentSMS(ctx, cfg.Tencent, "DescribeSmsSignList", map[string]any{
			"International": 0, "Limit": 1, "Offset": 0,
		})
		lat := time.Since(started).Milliseconds()
		if err != nil {
			return "degraded", lat, "PROVIDER_HEALTH_CHECK_FAILED"
		}
		return "healthy", lat, ""

	case "aliyun_sms":
		if !cfg.Aliyun.Enabled || cfg.Aliyun.AccessKeyID == "" || cfg.Aliyun.AccessKeySecret == "" || cfg.Aliyun.SignName == "" || cfg.Aliyun.TemplateCode == "" {
			return "unavailable", 0, "SMS_PROVIDER_NOT_CONFIGURED"
		}
		_, err := s.callAliyunSMS(ctx, cfg.Aliyun, "QuerySmsSignList", map[string]string{
			"PageIndex": "1", "PageSize": "1",
		})
		lat := time.Since(started).Milliseconds()
		if err != nil {
			return "degraded", lat, "PROVIDER_HEALTH_CHECK_FAILED"
		}
		return "healthy", lat, ""
	default:
		return "unavailable", 0, "SMS_PROVIDER_NOT_SUPPORTED"
	}
}

func (s *Service) sendSMSViaProvider(ctx context.Context, cfg smsConfig, provider, phone, code string) error {
	started := time.Now()
	masked := maskPhone(phone)
	country := "CN"
	if strings.HasPrefix(phone, "+") && !strings.HasPrefix(phone, "+86") {
		country = "US"
	}

	var sendErr error
	switch provider {
	case "tencent_sms":
		t := cfg.Tencent
		if !t.Enabled || t.SecretID == "" || t.SecretKey == "" || t.SDKAppID == "" || t.SignName == "" || t.TemplateID == "" {
			sendErr = &ServiceError{Status: 503, Code: "SMS_PROVIDER_NOT_CONFIGURED", Message: "腾讯云短信参数或密钥尚未配置"}
			break
		}
		res, err := s.callTencentSMS(ctx, t, "SendSms", map[string]any{
			"PhoneNumberSet":   []string{phone},
			"SmsSdkAppId":      t.SDKAppID,
			"SignName":         t.SignName,
			"TemplateId":       t.TemplateID,
			"TemplateParamSet": []string{code},
		})
		if err != nil {
			sendErr = err
			break
		}
		respObj, _ := res["Response"].(map[string]any)
		if errObj, _ := respObj["Error"].(map[string]any); errObj != nil {
			sendErr = &ServiceError{Status: 502, Code: firstStr(strVal(errObj["Code"]), "SMS_PROVIDER_ERROR"), Message: firstStr(strVal(errObj["Message"]), "腾讯云短信发送失败")}
			break
		}
		statusSet, _ := respObj["SendStatusSet"].([]any)
		if len(statusSet) > 0 {
			if first, ok := statusSet[0].(map[string]any); ok && strVal(first["Code"]) != "Ok" {
				sendErr = &ServiceError{Status: 502, Code: firstStr(strVal(first["Code"]), "SMS_REJECTED"), Message: firstStr(strVal(first["Message"]), "腾讯云短信发送失败")}
			}
		}

	case "aliyun_sms":
		a := cfg.Aliyun
		if !a.Enabled || a.AccessKeyID == "" || a.AccessKeySecret == "" || a.SignName == "" || a.TemplateCode == "" {
			sendErr = &ServiceError{Status: 503, Code: "SMS_PROVIDER_NOT_CONFIGURED", Message: "阿里云短信参数或密钥尚未配置"}
			break
		}
		national := strings.TrimPrefix(phone, "+86")
		paramJSON, _ := json.Marshal(map[string]string{"code": code})
		res, err := s.callAliyunSMS(ctx, a, "SendSms", map[string]string{
			"PhoneNumbers":  national,
			"SignName":      a.SignName,
			"TemplateCode":  a.TemplateCode,
			"TemplateParam": string(paramJSON),
		})
		if err != nil {
			sendErr = err
			break
		}
		if strVal(res["Code"]) != "OK" {
			sendErr = &ServiceError{Status: 502, Code: firstStr(strVal(res["Code"]), "SMS_REJECTED"), Message: firstStr(strVal(res["Message"]), "阿里云短信发送失败")}
		}

	default:
		sendErr = &ServiceError{Status: 503, Code: "SMS_PROVIDER_NOT_CONFIGURED", Message: "不支持或未配置的短信通道: " + provider}
	}

	lat := time.Since(started).Milliseconds()
	if sendErr != nil {
		errCode := "SMS_ERROR"
		var se *ServiceError
		if errors.As(sendErr, &se) {
			errCode = se.Code
		}
		s.logSMSDelivery(ctx, provider, masked, country, "failed", errCode, lat)
		return sendErr
	}
	s.logSMSDelivery(ctx, provider, masked, country, "success", "", lat)
	return nil
}

func (s *Service) logSMSDelivery(ctx context.Context, provider, masked, country, status, errCode string, lat int64) {
	if s == nil || s.Pool == nil {
		return
	}
	_, _ = s.Pool.Exec(ctx, `
		INSERT INTO auth_usr.sms_delivery_logs
			(id, provider, masked_phone, country, status, error_code, latency_ms, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
		randomHexID("smsl"), provider, masked, country, status, nilIfEmpty(errCode), lat)
}

func (s *Service) callTencentSMS(ctx context.Context, cfg tencentSMSConfig, action string, bodyObj map[string]any) (map[string]any, error) {
	payload, _ := json.Marshal(bodyObj)
	ts := time.Now().UTC()
	tsStr := fmt.Sprintf("%d", ts.Unix())
	date := ts.Format("2006-01-02")

	u, err := url.Parse(cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	host := u.Host

	canonicalHeaders := fmt.Sprintf("content-type:application/json; charset=utf-8\nhost:%s\nx-tc-action:%s\n", host, strings.ToLower(action))
	signedHeaders := "content-type;host;x-tc-action"
	hashedPayload := sha256Hex(payload)
	canonicalReq := fmt.Sprintf("POST\n/\n\n%s\n%s\n%s", canonicalHeaders, signedHeaders, hashedPayload)

	credScope := date + "/sms/tc3_request"
	stringToSign := fmt.Sprintf("TC3-HMAC-SHA256\n%s\n%s\n%s", tsStr, credScope, sha256Hex([]byte(canonicalReq)))

	secretDate := hmacSHA256([]byte("TC3"+cfg.SecretKey), date)
	secretService := hmacSHA256(secretDate, "sms")
	secretSigning := hmacSHA256(secretService, "tc3_request")
	signature := hex.EncodeToString(hmacSHA256(secretSigning, stringToSign))
	authHeader := fmt.Sprintf("TC3-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		cfg.SecretID, credScope, signedHeaders, signature)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Host", host)
	req.Header.Set("X-TC-Action", action)
	req.Header.Set("X-TC-Timestamp", tsStr)
	req.Header.Set("X-TC-Version", "2021-01-11")
	req.Header.Set("X-TC-Region", "ap-guangzhou")

	resp, err := s.httpClient().Do(req)
	if err != nil {
		return nil, &ServiceError{Status: 502, Code: "SMS_NETWORK_ERROR", Message: err.Error()}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	var out map[string]any
	if json.Unmarshal(raw, &out) != nil {
		return nil, &ServiceError{Status: 502, Code: "SMS_INVALID_RESPONSE", Message: "腾讯云短信响应解析失败"}
	}
	return out, nil
}

func (s *Service) callAliyunSMS(ctx context.Context, cfg aliyunSMSConfig, action string, params map[string]string) (map[string]any, error) {
	all := map[string]string{
		"AccessKeyId":      cfg.AccessKeyID,
		"Action":           action,
		"Format":           "JSON",
		"RegionId":         "cn-hangzhou",
		"SignatureMethod":  "HMAC-SHA1",
		"SignatureNonce":   randomHexID("n"),
		"SignatureVersion": "1.0",
		"Timestamp":        time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		"Version":          "2017-05-25",
	}
	for k, v := range params {
		all[k] = v
	}
	keys := make([]string, 0, len(all))
	for k := range all {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var parts []string
	for _, k := range keys {
		parts = append(parts, aliyunPercentEncode(k)+"="+aliyunPercentEncode(all[k]))
	}
	canonicalQuery := strings.Join(parts, "&")
	stringToSign := "POST&%2F&" + aliyunPercentEncode(canonicalQuery)

	mac := hmac.New(sha1.New, []byte(cfg.AccessKeySecret+"&"))
	mac.Write([]byte(stringToSign))
	all["Signature"] = base64.StdEncoding.EncodeToString(mac.Sum(nil))

	form := url.Values{}
	for k, v := range all {
		form.Set(k, v)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.Endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient().Do(req)
	if err != nil {
		return nil, &ServiceError{Status: 502, Code: "SMS_NETWORK_ERROR", Message: err.Error()}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	var out map[string]any
	if json.Unmarshal(raw, &out) != nil {
		return nil, &ServiceError{Status: 502, Code: "SMS_INVALID_RESPONSE", Message: "阿里云短信响应解析失败"}
	}
	return out, nil
}

func aliyunPercentEncode(s string) string {
	esc := url.QueryEscape(s)
	esc = strings.ReplaceAll(esc, "+", "%20")
	esc = strings.ReplaceAll(esc, "*", "%2A")
	esc = strings.ReplaceAll(esc, "%7E", "~")
	return esc
}

func hmacSHA256(key []byte, msg string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(msg))
	return mac.Sum(nil)
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func maskPhone(phone string) string {
	n := len(phone)
	if n <= 7 {
		return "***"
	}
	return phone[:3] + "****" + phone[n-4:]
}
