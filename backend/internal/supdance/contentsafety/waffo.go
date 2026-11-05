// Package contentsafety checks SupDance prompts before generation and keeps merchant
// authentication and vendor responses outside the provider protocols.
package contentsafety

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
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"yingce/backend/internal/outbound"
)

const endpoint = "https://api.waffo.ai/v1/actions/verification/scan-prompt"
const requestPath = "/v1/actions/verification/scan-prompt"

type Screener interface {
	Check(context.Context, string) error
}

// Error contains safe operational metadata, never a prompt, response body or key.
type Error struct {
	Reason     string
	RequestID  string
	RetryAfter time.Duration
}

func (e *Error) Error() string {
	switch e.Reason {
	case "blocked":
		return "This prompt does not meet the content policy."
	case "review":
		return "This prompt requires content review. Please retry later."
	case "invalid_prompt":
		return "Prompt screening requires between 1 and 10000 characters."
	default:
		return "Content screening is temporarily unavailable. Please retry later."
	}
}

type Client struct {
	merchantID string
	key        *rsa.PrivateKey
	http       *http.Client
	now        func() time.Time
	wait       func(context.Context, time.Duration) error
}

func FromEnvironment() (Screener, error) {
	value := strings.TrimSpace(os.Getenv("CANVAS_WAFFO_PROMPT_SCREENING_ENABLED"))
	if value == "" {
		return nil, nil
	}
	enabled, err := strconv.ParseBool(value)
	if err != nil {
		return nil, errors.New("invalid Waffo prompt screening switch")
	}
	if !enabled {
		return nil, nil
	}
	merchantID := strings.TrimSpace(os.Getenv("CANVAS_WAFFO_MERCHANT_ID"))
	path := strings.TrimSpace(os.Getenv("CANVAS_WAFFO_PRIVATE_KEY_FILE"))
	if merchantID == "" || path == "" {
		return nil, errors.New("Waffo merchant ID and private key file are required")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, errors.New("Waffo private key file cannot be read")
	}
	defer file.Close()
	encoded, err := io.ReadAll(io.LimitReader(file, 65537))
	if err != nil || len(encoded) > 65536 {
		return nil, errors.New("invalid Waffo private key file")
	}
	block, rest := pem.Decode(encoded)
	if block == nil || len(bytes.TrimSpace(rest)) != 0 {
		return nil, errors.New("invalid Waffo private key PEM")
	}
	var key *rsa.PrivateKey
	switch block.Type {
	case "RSA PRIVATE KEY":
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		var parsed any
		parsed, err = x509.ParsePKCS8PrivateKey(block.Bytes)
		if err == nil {
			key, _ = parsed.(*rsa.PrivateKey)
		}
	default:
		return nil, errors.New("Waffo private key must be RSA")
	}
	if err != nil {
		return nil, errors.New("invalid Waffo RSA private key")
	}
	return New(merchantID, key)
}

func New(merchantID string, key *rsa.PrivateKey) (*Client, error) {
	if strings.TrimSpace(merchantID) == "" || strings.ContainsAny(merchantID, "\r\n") || key == nil || key.N == nil || key.N.BitLen() < 2048 || key.Validate() != nil {
		return nil, errors.New("invalid Waffo merchant authentication")
	}
	client := outbound.OutboundHTTPClient(10 * time.Second)
	// A signed request must never forward its merchant headers to a redirect.
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return errors.New("Waffo redirects are disabled") }
	return &Client{merchantID: merchantID, key: key, http: client, now: time.Now, wait: wait}, nil
}

func wait(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (c *Client) Check(ctx context.Context, prompt string) error {
	if !utf8.ValidString(prompt) || strings.TrimSpace(prompt) == "" || utf8.RuneCountInString(prompt) > 10000 {
		return &Error{Reason: "invalid_prompt"}
	}
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	body, err := json.Marshal(map[string]string{"prompt": prompt, "semantic": "enforce"})
	if err != nil {
		return &Error{Reason: "unavailable"}
	}
	for attempt := 0; attempt < 4; attempt++ {
		delay, retry, err := c.checkOnce(ctx, body, attempt)
		if !retry || attempt == 3 {
			return err
		}
		if delay > 60*time.Second {
			return &Error{Reason: "unavailable", RetryAfter: delay}
		}
		if err = c.wait(ctx, delay); err != nil {
			return err
		}
	}
	return &Error{Reason: "unavailable"}
}

func (c *Client) checkOnce(ctx context.Context, body []byte, attempt int) (time.Duration, bool, error) {
	timestamp := strconv.FormatInt(c.now().Unix(), 10)
	digest := sha256.Sum256(body)
	canonical := "POST\n" + requestPath + "\n" + timestamp + "\n" + base64.StdEncoding.EncodeToString(digest[:])
	signed := sha256.Sum256([]byte(canonical))
	signature, err := rsa.SignPKCS1v15(rand.Reader, c.key, crypto.SHA256, signed[:])
	if err != nil {
		return 0, false, &Error{Reason: "unavailable"}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return 0, false, &Error{Reason: "unavailable"}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Merchant-Id", c.merchantID)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", base64.StdEncoding.EncodeToString(signature))
	response, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return 0, false, ctx.Err()
		}
		return time.Duration(5<<attempt) * time.Second, true, &Error{Reason: "unavailable"}
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusTooManyRequests {
		delay := retryAfter(response.Header.Get("Retry-After"), c.now())
		return delay, true, &Error{Reason: "unavailable", RetryAfter: delay}
	}
	if response.StatusCode >= 500 {
		return time.Duration(5<<attempt) * time.Second, true, &Error{Reason: "unavailable"}
	}
	if response.StatusCode != http.StatusOK {
		return 0, false, &Error{Reason: "unavailable"}
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, (32<<10)+1))
	if err != nil || len(data) > 32<<10 {
		return 0, false, &Error{Reason: "unavailable"}
	}
	var envelope struct {
		Data struct {
			Action         string `json:"action"`
			ReasonCode     string `json:"reasonCode"`
			RequestID      string `json:"requestId"`
			SemanticStatus string `json:"semanticStatus"`
		} `json:"data"`
	}
	if json.Unmarshal(data, &envelope) != nil {
		return 0, false, &Error{Reason: "unavailable"}
	}
	result := envelope.Data
	switch result.Action {
	case "allow":
		if result.ReasonCode == "service_degraded" || result.SemanticStatus == "provider_error" {
			return 0, false, &Error{Reason: "unavailable", RequestID: result.RequestID}
		}
		return 0, false, nil
	case "block":
		return 0, false, &Error{Reason: "blocked", RequestID: result.RequestID}
	case "review":
		if result.ReasonCode == "service_degraded" {
			return time.Duration(5<<attempt) * time.Second, true, &Error{Reason: "review", RequestID: result.RequestID}
		}
		return 0, false, &Error{Reason: "review", RequestID: result.RequestID}
	default:
		return 0, false, &Error{Reason: "unavailable"}
	}
}

func retryAfter(value string, now time.Time) time.Duration {
	if seconds, err := strconv.ParseInt(value, 10, 32); err == nil && seconds >= 0 {
		return time.Duration(seconds) * time.Second
	}
	if date, err := http.ParseTime(value); err == nil && date.After(now) {
		return date.Sub(now)
	}
	return 5 * time.Second
}
