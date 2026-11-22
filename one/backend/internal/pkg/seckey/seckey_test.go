package seckey

import (
	"strings"
	"testing"
)

func TestProviderSecretRoundTripAndWrongKeyFails(t *testing.T) {
	key := "test-provider-wrapping-key-32-chars-minimum"
	box, err := EncryptProviderSecret(key, "sk_live_supdance_secret_12345")
	if err != nil {
		t.Fatalf("EncryptProviderSecret: %v", err)
	}
	if box.CiphertextHex == "" || box.NonceHex == "" || box.AuthTagHex == "" {
		t.Fatalf("expected non-empty encrypted box fields: %+v", box)
	}
	if len(box.NonceHex) != 24 || len(box.AuthTagHex) != 32 {
		t.Fatalf("unexpected nonce/tag hex lengths: nonce=%d tag=%d", len(box.NonceHex), len(box.AuthTagHex))
	}
	if strings.Contains(box.CiphertextHex, "supdance") {
		t.Fatal("ciphertext leaked plaintext")
	}

	got, err := DecryptProviderSecret(key, box.CiphertextHex, box.NonceHex, box.AuthTagHex)
	if err != nil {
		t.Fatalf("DecryptProviderSecret: %v", err)
	}
	if got != "sk_live_supdance_secret_12345" {
		t.Fatalf("got %q want original secret", got)
	}

	if _, err := DecryptProviderSecret("wrong-key", box.CiphertextHex, box.NonceHex, box.AuthTagHex); err == nil {
		t.Fatal("expected wrong key decryption to fail")
	}
}

func TestStorageEnvelopeRoundTrip(t *testing.T) {
	key := "storage-secret-key"
	env, err := EncryptStorageEnvelope(key, "AKIA_TEST_SECRET_KEY")
	if err != nil {
		t.Fatalf("EncryptStorageEnvelope: %v", err)
	}
	if env.V != 1 || env.IV == "" || env.Tag == "" || env.Data == "" {
		t.Fatalf("unexpected storage envelope: %+v", env)
	}
	raw := map[string]any{
		"v":    float64(env.V),
		"iv":   env.IV,
		"tag":  env.Tag,
		"data": env.Data,
	}
	got, err := DecryptStorageEnvelope(key, raw)
	if err != nil {
		t.Fatalf("DecryptStorageEnvelope: %v", err)
	}
	if got != "AKIA_TEST_SECRET_KEY" {
		t.Fatalf("got %q", got)
	}
}

func TestEmptyKeyFailsClosed(t *testing.T) {
	if _, err := EncryptProviderSecret("", "secret"); err == nil {
		t.Fatal("expected error for empty wrapping key")
	}
}
