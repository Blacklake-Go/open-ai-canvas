package handler

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"one/backend/internal/outbound"
)

type seoPushAttempt struct {
	Engine       string         `json:"engine"`
	Status       string         `json:"status"` // succeeded | failed | skipped
	StatusCode   int            `json:"statusCode,omitempty"`
	LatencyMs    int64          `json:"latencyMs"`
	ResponseBody map[string]any `json:"responseBody,omitempty"`
	ErrorMessage string         `json:"errorMessage,omitempty"`
}

func seoBool(v any) bool {
	b, _ := v.(bool)
	return b
}

func executeSEOPushHTTP(ctx context.Context, requestedEngine string, urls []string, pushCfg map[string]any, envIndexNowKey string, allowedPrivateHosts []string) []seoPushAttempt {
	client := outbound.NewSafeHTTPClient(15*time.Second, allowedPrivateHosts...)
	engine := strings.ToLower(strings.TrimSpace(requestedEngine))
	if engine == "" {
		engine = "all"
	}

	var attempts []seoPushAttempt

	if engine == "all" || engine == "indexnow" {
		inCfg := adminBJSON(firstAny(pushCfg["indexNow"], pushCfg["indexnow"]))
		host := firstNonEmpty(adminBStr(inCfg["host"]), strings.TrimSpace(os.Getenv("INDEXNOW_HOST")))
		key := firstNonEmpty(adminBStr(inCfg["key"]), strings.TrimSpace(envIndexNowKey), strings.TrimSpace(os.Getenv("INDEXNOW_KEY")))
		enabled := len(inCfg) == 0 || inCfg["enabled"] == nil || seoBool(inCfg["enabled"])
		if !enabled && engine == "all" {
			attempts = append(attempts, seoPushAttempt{Engine: "indexnow", Status: "skipped", ErrorMessage: "IndexNow disabled"})
		} else {
			keyLoc := adminBStr(inCfg["keyLocation"])
			if keyLoc == "" && host != "" {
				keyLoc = "https://" + strings.TrimPrefix(strings.TrimPrefix(host, "https://"), "http://") + "/api/seo/indexnow-key"
			}
			attempts = append(attempts, submitIndexNow(ctx, client, host, key, keyLoc, urls, allowedPrivateHosts))
		}
	}

	if engine == "all" || engine == "baidu" {
		bdCfg := adminBJSON(firstAny(pushCfg["baiduPush"], pushCfg["baidu"]))
		site := firstNonEmpty(adminBStr(bdCfg["site"]), strings.TrimSpace(os.Getenv("BAIDU_PUSH_SITE")))
		token := firstNonEmpty(adminBStr(bdCfg["token"]), strings.TrimSpace(os.Getenv("BAIDU_PUSH_TOKEN")))
		enabled := seoBool(bdCfg["enabled"]) || (site != "" && token != "")
		if !enabled && engine == "all" {
			attempts = append(attempts, seoPushAttempt{Engine: "baidu", Status: "skipped", ErrorMessage: "Baidu push disabled or unconfigured"})
		} else {
			attempts = append(attempts, submitBaiduPush(ctx, client, site, token, urls, allowedPrivateHosts))
		}
	}

	return attempts
}

func firstAny(vals ...any) any {
	for _, v := range vals {
		if v != nil {
			return v
		}
	}
	return nil
}

func submitIndexNow(ctx context.Context, client *http.Client, host, key, keyLocation string, urls, allowedHosts []string) seoPushAttempt {
	if host == "" || key == "" {
		return seoPushAttempt{
			Engine:       "indexnow",
			Status:       "failed",
			ErrorMessage: "IndexNow host 或 key 未配置",
		}
	}
	endpoint := firstNonEmpty(strings.TrimSpace(os.Getenv("ONE_INDEXNOW_ENDPOINT")), "https://api.indexnow.org/indexnow")
	if _, err := outbound.ValidateExternalURL(endpoint, allowedHosts...); err != nil {
		return seoPushAttempt{Engine: "indexnow", Status: "failed", ErrorMessage: fmt.Sprintf("IndexNow URL 校验失败: %v", err)}
	}
	payload, _ := json.Marshal(map[string]any{
		"host":        host,
		"key":         key,
		"keyLocation": keyLocation,
		"urlList":     urls,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return seoPushAttempt{Engine: "indexnow", Status: "failed", ErrorMessage: err.Error()}
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	start := time.Now()
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return seoPushAttempt{Engine: "indexnow", Status: "failed", LatencyMs: latency, ErrorMessage: err.Error()}
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	bodyMap := decodeSEOResponseMap(raw)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return seoPushAttempt{Engine: "indexnow", Status: "succeeded", StatusCode: resp.StatusCode, LatencyMs: latency, ResponseBody: bodyMap}
	}
	return seoPushAttempt{
		Engine:       "indexnow",
		Status:       "failed",
		StatusCode:   resp.StatusCode,
		LatencyMs:    latency,
		ResponseBody: bodyMap,
		ErrorMessage: fmt.Sprintf("IndexNow HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw))),
	}
}

func submitBaiduPush(ctx context.Context, client *http.Client, site, token string, urls, allowedHosts []string) seoPushAttempt {
	if site == "" || token == "" {
		return seoPushAttempt{
			Engine:       "baidu",
			Status:       "failed",
			ErrorMessage: "百度推送 site 或 token 未配置",
		}
	}
	base := firstNonEmpty(strings.TrimSpace(os.Getenv("ONE_BAIDU_PUSH_ENDPOINT")), "http://data.zz.baidu.com/urls")
	endpoint := fmt.Sprintf("%s?site=%s&token=%s", strings.TrimRight(base, "/"), url.QueryEscape(site), url.QueryEscape(token))
	if _, err := outbound.ValidateExternalURL(endpoint, allowedHosts...); err != nil {
		return seoPushAttempt{Engine: "baidu", Status: "failed", ErrorMessage: fmt.Sprintf("Baidu URL 校验失败: %v", err)}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(strings.Join(urls, "\n")))
	if err != nil {
		return seoPushAttempt{Engine: "baidu", Status: "failed", ErrorMessage: err.Error()}
	}
	req.Header.Set("Content-Type", "text/plain")

	start := time.Now()
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return seoPushAttempt{Engine: "baidu", Status: "failed", LatencyMs: latency, ErrorMessage: err.Error()}
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	bodyMap := decodeSEOResponseMap(raw)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return seoPushAttempt{Engine: "baidu", Status: "succeeded", StatusCode: resp.StatusCode, LatencyMs: latency, ResponseBody: bodyMap}
	}
	return seoPushAttempt{
		Engine:       "baidu",
		Status:       "failed",
		StatusCode:   resp.StatusCode,
		LatencyMs:    latency,
		ResponseBody: bodyMap,
		ErrorMessage: fmt.Sprintf("Baidu Push HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw))),
	}
}

func decodeSEOResponseMap(raw []byte) map[string]any {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return map[string]any{}
	}
	var m map[string]any
	if json.Unmarshal(raw, &m) == nil && m != nil {
		return m
	}
	return map[string]any{"raw": trimmed}
}

func parseRSAPrivateKeyPEM(rawKey string) (*rsa.PrivateKey, error) {
	normalized := strings.ReplaceAll(strings.TrimSpace(rawKey), `\n`, "\n")
	block, _ := pem.Decode([]byte(normalized))
	if block == nil {
		return nil, errors.New("invalid PEM private key")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
		return nil, errors.New("PKCS8 key is not RSA")
	}
	if rsaKey, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return rsaKey, nil
	}
	return nil, errors.New("unsupported RSA private key format")
}

func mintGoogleServiceAccountJWT(email string, privKey *rsa.PrivateKey, scope, audience string, now time.Time) (string, error) {
	headerBytes, _ := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT"})
	claimsBytes, _ := json.Marshal(map[string]any{
		"iss":   email,
		"scope": scope,
		"aud":   audience,
		"iat":   now.Unix(),
		"exp":   now.Add(55 * time.Minute).Unix(),
	})
	signingInput := base64.RawURLEncoding.EncodeToString(headerBytes) + "." + base64.RawURLEncoding.EncodeToString(claimsBytes)
	digest := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, privKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

func fetchGA4AnalyticsReport(ctx context.Context, cfg map[string]any, allowedPrivateHosts []string) (map[string]any, error) {
	propertyID := strings.TrimPrefix(strings.TrimSpace(adminBStr(cfg["propertyId"])), "properties/")
	email := strings.TrimSpace(adminBStr(cfg["serviceAccountEmail"]))
	privPEM := strings.TrimSpace(adminBStr(cfg["serviceAccountPrivateKey"]))
	if propertyID == "" || email == "" || privPEM == "" {
		return nil, errors.New("GA4 Property ID、serviceAccountEmail 或私钥未完整配置")
	}
	privKey, err := parseRSAPrivateKeyPEM(privPEM)
	if err != nil {
		return nil, fmt.Errorf("解析 GA4 Service Account 私钥失败: %w", err)
	}

	tokenURL := firstNonEmpty(strings.TrimSpace(os.Getenv("ONE_GA4_TOKEN_URL")), "https://oauth2.googleapis.com/token")
	if _, err := outbound.ValidateExternalURL(tokenURL, allowedPrivateHosts...); err != nil {
		return nil, fmt.Errorf("GA4 token URL 校验失败: %w", err)
	}
	apiBase := firstNonEmpty(strings.TrimSpace(os.Getenv("ONE_GA4_API_BASE")), "https://analyticsdata.googleapis.com/v1beta")
	if _, err := outbound.ValidateExternalURL(apiBase, allowedPrivateHosts...); err != nil {
		return nil, fmt.Errorf("GA4 API URL 校验失败: %w", err)
	}

	assertion, err := mintGoogleServiceAccountJWT(email, privKey, "https://www.googleapis.com/auth/analytics.readonly", tokenURL, time.Now().UTC())
	if err != nil {
		return nil, fmt.Errorf("生成 GA4 OAuth2 JWT 失败: %w", err)
	}

	client := outbound.NewSafeHTTPClient(15*time.Second, allowedPrivateHosts...)
	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	form.Set("assertion", assertion)
	tokReq, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	tokReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	tokResp, err := client.Do(tokReq)
	if err != nil {
		return nil, fmt.Errorf("请求 GA4 OAuth2 Token 失败: %w", err)
	}
	defer tokResp.Body.Close()
	tokRaw, _ := io.ReadAll(io.LimitReader(tokResp.Body, 128*1024))
	if tokResp.StatusCode < 200 || tokResp.StatusCode >= 300 {
		return nil, fmt.Errorf("GA4 OAuth2 Token HTTP %d: %s", tokResp.StatusCode, strings.TrimSpace(string(tokRaw)))
	}
	var tokJSON struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(tokRaw, &tokJSON); err != nil || tokJSON.AccessToken == "" {
		return nil, errors.New("GA4 OAuth2 响应缺少 access_token")
	}

	realtimeEndpoint := fmt.Sprintf("%s/properties/%s:runRealtimeReport", strings.TrimRight(apiBase, "/"), url.PathEscape(propertyID))
	realtimeData, err := postGA4JSON(ctx, client, realtimeEndpoint, tokJSON.AccessToken, map[string]any{
		"metrics": []map[string]string{{"name": "activeUsers"}},
	})
	if err != nil {
		return nil, fmt.Errorf("GA4 Realtime API 调用失败: %w", err)
	}

	reportEndpoint := fmt.Sprintf("%s/properties/%s:runReport", strings.TrimRight(apiBase, "/"), url.PathEscape(propertyID))
	summaryData, err := postGA4JSON(ctx, client, reportEndpoint, tokJSON.AccessToken, map[string]any{
		"dateRanges": []map[string]string{{"startDate": "7daysAgo", "endDate": "today"}},
		"metrics": []map[string]string{
			{"name": "activeUsers"},
			{"name": "sessions"},
			{"name": "screenPageViews"},
			{"name": "eventCount"},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("GA4 Report API 调用失败: %w", err)
	}

	return map[string]any{
		"configured":    true,
		"propertyId":    propertyID,
		"measurementId": adminBStr(cfg["measurementId"]),
		"realtime":      realtimeData,
		"summary":       summaryData,
		"fetchedAt":     time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func postGA4JSON(ctx context.Context, client *http.Client, endpoint, bearerToken string, payload map[string]any) (map[string]any, error) {
	rawReq, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(rawReq))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+bearerToken)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}
