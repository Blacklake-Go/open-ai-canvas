package music_test

import (
	"fmt"
	"strings"
	"testing"

	"yingce/backend/internal/supdance/music"
)

func TestAPIKeyMaskingAndRedaction(t *testing.T) {
	rawKey := "koyo_sec_live_9988aabbccddee0011223344"
	masked := music.MaskAPIKey(rawKey)

	if !strings.HasPrefix(masked, "koyo_****") {
		t.Errorf("expected masked key to start with 'koyo_****', got %s", masked)
	}
	if strings.Contains(masked, "live_9988aabb") {
		t.Errorf("masked key leaked plaintext substring: %s", masked)
	}
	if !strings.HasSuffix(masked, "3344") {
		t.Errorf("expected masked key to end with '3344', got %s", masked)
	}

	shortKey := "koyo_1"
	if music.MaskAPIKey(shortKey) != "koyo_****" {
		t.Errorf("expected short key to mask to 'koyo_****', got %s", music.MaskAPIKey(shortKey))
	}

	emptyKey := ""
	if music.MaskAPIKey(emptyKey) != "koyo_****" {
		t.Errorf("expected empty key to mask to 'koyo_****', got %s", music.MaskAPIKey(emptyKey))
	}

	errText := fmt.Sprintf("failed calling upstream with key %s: unauthorized", rawKey)
	redacted := music.RedactSecretFromText(errText, rawKey)
	if strings.Contains(redacted, rawKey) {
		t.Errorf("redacted text still contains raw key: %s", redacted)
	}
	if !strings.Contains(redacted, "koyo_****3344") {
		t.Errorf("expected redacted text to contain masked key, got %s", redacted)
	}

	// Test redaction when raw key is empty
	unchanged := music.RedactSecretFromText(errText, "")
	if unchanged != errText {
		t.Errorf("expected unchanged text when rawKey is empty, got %s", unchanged)
	}
}

func TestAESGCMVaultEncryptionAndDecryption(t *testing.T) {
	// Test invalid key lengths
	if _, err := music.NewAESGCMVault([]byte("too-short")); err == nil {
		t.Error("expected error for short key, got nil")
	}

	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}

	vault, err := music.NewAESGCMVault(key)
	if err != nil {
		t.Fatalf("failed to create vault: %v", err)
	}

	secret := "koyo_sec_live_9988aabbccddee0011223344"
	encrypted, err := vault.Encrypt(secret)
	if err != nil {
		t.Fatalf("failed to encrypt: %v", err)
	}

	if !strings.HasPrefix(encrypted, "enc:v1:") {
		t.Errorf("expected encrypted secret to have 'enc:v1:' prefix, got: %s", encrypted)
	}

	decrypted, err := vault.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("failed to decrypt: %v", err)
	}

	if decrypted != secret {
		t.Errorf("decrypted secret mismatch: expected %s, got %s", secret, decrypted)
	}

	// Empty string passthrough
	encEmpty, err := vault.Encrypt("")
	if err != nil || encEmpty != "" {
		t.Errorf("expected empty string result for empty input, got %q, %v", encEmpty, err)
	}

	// Plaintext passthrough (not prefixed with enc:v1:)
	plainPass, err := vault.Decrypt("plaintext-secret")
	if err != nil || plainPass != "plaintext-secret" {
		t.Errorf("expected plaintext passthrough, got %q, %v", plainPass, err)
	}

	// Corrupted ciphertext should fail
	if _, err := vault.Decrypt("enc:v1:corrupted-base64-payload!!"); err == nil {
		t.Error("expected error for corrupted base64, got nil")
	}

	// Wrong key should fail decryption
	otherKey := make([]byte, 32)
	copy(otherKey, key)
	otherKey[0] ^= 0xFF
	otherVault, _ := music.NewAESGCMVault(otherKey)
	if _, err := otherVault.Decrypt(encrypted); err == nil {
		t.Error("expected error decrypting with wrong key, got nil")
	}
}
