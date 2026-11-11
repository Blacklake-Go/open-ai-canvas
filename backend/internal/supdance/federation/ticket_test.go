package federation

import (
	"crypto/ed25519"
	"crypto/rand"
	"strings"
	"testing"
	"time"
)

func TestTicketsBindIssuerAudiencePurposeAndLifetime(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Unix(1800000000, 0)
	ticket := Ticket{Version: 1, Issuer: "one", Audience: "main", Purpose: "link-request", Nonce: strings.Repeat("n", 43), OneUserID: "one-user", IssuedAt: now.Unix(), ExpiresAt: now.Add(5 * time.Minute).Unix()}
	encoded, err := Sign(privateKey, ticket, now)
	if err != nil {
		t.Fatal(err)
	}
	if got, err := Verify(publicKey, encoded, "one", "main", "link-request", now); err != nil || got.OneUserID != ticket.OneUserID {
		t.Fatalf("round trip: %+v %v", got, err)
	}
	for _, input := range []struct {
		value, issuer, audience, purpose string
		at                               time.Time
	}{
		{encoded, "main", "main", "link-request", now},
		{encoded, "one", "one", "link-request", now},
		{encoded, "one", "main", "wallet-read", now},
		{encoded, "one", "main", "link-request", now.Add(5 * time.Minute)},
		{encoded + "x", "one", "main", "link-request", now},
	} {
		if _, err := Verify(publicKey, input.value, input.issuer, input.audience, input.purpose, input.at); err == nil {
			t.Errorf("accepted invalid ticket: %s %s %s", input.issuer, input.audience, input.purpose)
		}
	}
	if _, err := Verify([]byte("short"), encoded, "one", "main", "link-request", now); err == nil {
		t.Fatal("accepted missing/weak server key")
	}
	ticket.ExpiresAt++
	if _, err := Sign(privateKey, ticket, now); err == nil {
		t.Fatal("accepted overlong link lifetime")
	}
	ticket.ExpiresAt--
	ticket.MainUserID = "client-cannot-choose-main"
	if _, err := Sign(privateKey, ticket, now); err == nil {
		t.Fatal("accepted client-selected main identity in link request")
	}
}
