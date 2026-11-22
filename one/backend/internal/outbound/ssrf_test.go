package outbound

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestValidateExternalURLBlocksPrivateTargets(t *testing.T) {
	blocked := []string{
		"",
		"file:///etc/passwd",
		"ftp://example.com/a",
		"http://localhost:8080/health",
		"http://127.0.0.1:8080/",
		"http://169.254.169.254/latest/meta-data/",
		"https://10.0.0.5/api",
		"https://192.168.1.10/api",
		"https://172.16.0.1/api",
		"https://redis.internal:6379",
		"http://[::1]:8080/",
	}
	for _, raw := range blocked {
		if _, err := ValidateExternalURL(raw); err == nil {
			t.Fatalf("expected %q to be blocked", raw)
		}
	}
	if _, err := ValidateExternalURL("https://api.muapi.ai/v1/models"); err != nil {
		t.Fatalf("expected public https url to pass, got %v", err)
	}
}

func TestSafeHTTPClientBlocksLoopbackDialUnlessAllowlisted(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := NewSafeHTTPClient(2 * time.Second)
	req, _ := http.NewRequest(http.MethodGet, srv.URL, nil)
	if _, err := SafeRequest(context.Background(), client, req); err == nil {
		t.Fatal("expected loopback httptest server to be blocked by default")
	}

	allowClient := NewSafeHTTPClient(2*time.Second, "127.0.0.1")
	resp, err := SafeRequest(context.Background(), allowClient, req, "127.0.0.1")
	if err != nil {
		t.Fatalf("expected allowlisted loopback test server to succeed, got %v", err)
	}
	_ = resp.Body.Close()
}
