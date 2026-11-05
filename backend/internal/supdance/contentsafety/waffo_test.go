package contentsafety

import (
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
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func newClient(t *testing.T, transport transportFunc) *Client {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	client, err := New("MER_test", key)
	if err != nil {
		t.Fatal(err)
	}
	client.http.Transport = transport
	client.now = func() time.Time { return time.Unix(1800000000, 0) }
	return client
}

func response(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}
}

func TestCheckSignsExactUnicodePromptAndOnlySendsRequiredFields(t *testing.T) {
	const prompt = "  测试 <landscape> 🌄\n原文保留  "
	var client *Client
	client = newClient(t, func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]string
		if json.Unmarshal(body, &payload) != nil || len(payload) != 2 || payload["prompt"] != prompt || payload["semantic"] != "enforce" {
			t.Fatalf("unexpected request fields: %v", payload)
		}
		if r.URL.String() != endpoint || r.Method != http.MethodPost || r.Header.Get("X-Merchant-Id") != "MER_test" {
			t.Fatal("invalid request contract")
		}
		digest := sha256.Sum256(body)
		canonical := "POST\n" + requestPath + "\n" + r.Header.Get("X-Timestamp") + "\n" + base64.StdEncoding.EncodeToString(digest[:])
		signed := sha256.Sum256([]byte(canonical))
		signature, err := base64.StdEncoding.DecodeString(r.Header.Get("X-Signature"))
		if err != nil {
			t.Fatal(err)
		}
		if err = rsa.VerifyPKCS1v15(&client.key.PublicKey, crypto.SHA256, signed[:], signature); err != nil {
			t.Fatal(err)
		}
		return response(200, `{"data":{"action":"allow","reasonCode":"allowed","semanticStatus":"scored"}}`), nil
	})
	if err := client.Check(context.Background(), prompt); err != nil {
		t.Fatal(err)
	}
}

func TestOnlyAllowPassesAndErrorsNeverContainPromptOrVendorBody(t *testing.T) {
	for _, body := range []string{
		`{"data":{"action":"block","requestId":"REQ_test"}}`,
		`{"data":{"action":"review"}}`,
		`{"data":{"action":"unknown"}}`,
		`{"data":{"action":"allow","reasonCode":"service_degraded"}}`,
		`{"data":{"action":"allow","semanticStatus":"provider_error"}}`,
		`{"data":null}`, `{"errors":[{"message":"private-marker"}]}`, `private-marker`,
	} {
		t.Run(body, func(t *testing.T) {
			client := newClient(t, func(*http.Request) (*http.Response, error) { return response(200, body), nil })
			err := client.Check(context.Background(), "private-marker")
			if err == nil || strings.Contains(err.Error(), "private-marker") {
				t.Fatalf("unsafe verdict: %v", err)
			}
		})
	}
}

func TestRateLimitAndTransientFailureRetryBeforeGeneration(t *testing.T) {
	attempts := 0
	delays := []time.Duration{}
	client := newClient(t, func(*http.Request) (*http.Response, error) {
		attempts++
		if attempts == 1 {
			r := response(429, "")
			r.Header.Set("Retry-After", "7")
			return r, nil
		}
		if attempts == 2 {
			return response(503, "private-marker"), nil
		}
		return response(200, `{"data":{"action":"allow"}}`), nil
	})
	client.wait = func(_ context.Context, d time.Duration) error { delays = append(delays, d); return nil }
	if err := client.Check(context.Background(), "landscape"); err != nil {
		t.Fatal(err)
	}
	if attempts != 3 || len(delays) != 2 || delays[0] != 7*time.Second || delays[1] != 10*time.Second {
		t.Fatalf("unexpected retry schedule: %d %v", attempts, delays)
	}
}

func TestDegradedReviewRetriesButFourHundredDoesNot(t *testing.T) {
	for _, status := range []int{200, 400, 401, 403} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			attempts := 0
			client := newClient(t, func(*http.Request) (*http.Response, error) {
				attempts++
				return response(status, `{"data":{"action":"review","reasonCode":"service_degraded"}}`), nil
			})
			client.wait = func(context.Context, time.Duration) error { return nil }
			if client.Check(context.Background(), "landscape") == nil {
				t.Fatal("failed screening allowed generation")
			}
			expected := 1
			if status == 200 {
				expected = 4
			}
			if attempts != expected {
				t.Fatalf("attempts=%d want %d", attempts, expected)
			}
		})
	}
}

func TestCancellationAndInputLimitsAvoidNetwork(t *testing.T) {
	calls := 0
	client := newClient(t, func(r *http.Request) (*http.Response, error) { calls++; return nil, r.Context().Err() })
	for _, prompt := range []string{" ", strings.Repeat("界", 10001), string([]byte{0xff})} {
		if client.Check(context.Background(), prompt) == nil {
			t.Fatal("invalid prompt accepted")
		}
	}
	if calls != 0 {
		t.Fatal("invalid input was transmitted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if !errors.Is(client.Check(ctx, "landscape"), context.Canceled) {
		t.Fatal("cancellation was not preserved")
	}
}

func TestEnvironmentRequiresExplicitEnableAndValidCredentials(t *testing.T) {
	t.Setenv("CANVAS_WAFFO_PROMPT_SCREENING_ENABLED", "")
	client, err := FromEnvironment()
	if err != nil || client != nil {
		t.Fatal("screening enabled implicitly")
	}
	t.Setenv("CANVAS_WAFFO_PROMPT_SCREENING_ENABLED", "true")
	t.Setenv("CANVAS_WAFFO_MERCHANT_ID", "")
	t.Setenv("CANVAS_WAFFO_PRIVATE_KEY_FILE", "")
	if _, err = FromEnvironment(); err == nil {
		t.Fatal("missing merchant credentials accepted")
	}
}

func TestEnvironmentLoadsExistingRSAKeyFormats(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	pkcs8, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	for _, block := range []*pem.Block{{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}, {Type: "PRIVATE KEY", Bytes: pkcs8}} {
		t.Run(block.Type, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "merchant.pem")
			if err := os.WriteFile(path, pem.EncodeToMemory(block), 0o600); err != nil {
				t.Fatal(err)
			}
			t.Setenv("CANVAS_WAFFO_PROMPT_SCREENING_ENABLED", "true")
			t.Setenv("CANVAS_WAFFO_MERCHANT_ID", "MER_existing")
			t.Setenv("CANVAS_WAFFO_PRIVATE_KEY_FILE", path)
			screener, err := FromEnvironment()
			if err != nil {
				t.Fatal(err)
			}
			client, ok := screener.(*Client)
			if !ok || client.key.N.Cmp(key.N) != 0 {
				t.Fatal("existing merchant key was not preserved")
			}
		})
	}
}
