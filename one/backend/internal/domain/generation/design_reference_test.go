package generation

import (
	"encoding/base64"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"one/backend/internal/config"
)

func TestLocalDesignReferenceIsScopedAndExpiring(t *testing.T) {
	cfg := config.Config{
		PublicAppURL:                "https://one.example",
		StorageSecretsEncryptionKey: strings.Repeat("a", 32),
		IsProduction:                true,
	}
	svc := Service{Config: cfg}
	target, err := svc.localDesignReferenceURL("gen_a", "ast_b")
	if err != nil {
		t.Fatal(err)
	}
	link, err := url.Parse(target)
	if err != nil {
		t.Fatal("invalid signed reference URL")
	}
	if link.Path != "/api/generations/references/gen_a/ast_b" {
		t.Fatalf("unexpected reference scope: %s", link.Path)
	}
	expiry := link.Query().Get("expires")
	end, err := strconv.ParseInt(expiry, 10, 64)
	now := time.Now()
	if err != nil || end <= now.Unix() || end > now.Add(designReferenceTTL).Unix() {
		t.Fatalf("expiry outside reference window: %q", expiry)
	}
	signature := link.Query().Get("signature")
	other := base64.RawURLEncoding.EncodeToString(referenceSignature(cfg.StorageSecretKey(), "gen_other", "ast_b", expiry))
	if signature == "" || other == signature || strings.Contains(redactDesignReference(target), signature) {
		t.Fatal("capability was not scoped to the exact task or its signature was not scrubbed")
	}
	for _, origin := range []string{"http://one.example", "https://one.example/base", "https://one.example/?debug=1"} {
		svc.Config.PublicAppURL = origin
		if _, err := svc.localDesignReferenceURL("gen_a", "ast_b"); err == nil {
			t.Fatalf("unexpected provider reference for origin %s", origin)
		}
	}
}
