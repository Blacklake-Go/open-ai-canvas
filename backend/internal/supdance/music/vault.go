package music

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const (
	// VaultEncryptedPrefix is the standard prefix for AES-256-GCM encrypted secrets in SupDance.
	VaultEncryptedPrefix = "enc:v1:"
)

// SecretVault defines the interface for encrypting and decrypting sensitive credentials.
type SecretVault interface {
	Encrypt(plain string) (string, error)
	Decrypt(cipherText string) (string, error)
}

// AESGCMVault implements SecretVault backed by AES-256-GCM.
type AESGCMVault struct {
	key []byte
}

// DefaultMasterKey is a 32-byte default encryption key for internal plugin vault storage.
var DefaultMasterKey = []byte("supdance-music-aes256-gcm-key-32")

// NewDefaultVault returns an AESGCMVault initialized with the default master key.
func NewDefaultVault() *AESGCMVault {
	v, err := NewAESGCMVault(DefaultMasterKey)
	if err != nil {
		panic(fmt.Sprintf("NewDefaultVault init failed: %v", err))
	}
	return v
}

// NewAESGCMVault initializes an AESGCMVault with a 32-byte (256-bit) encryption key.
func NewAESGCMVault(key []byte) (*AESGCMVault, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("invalid key length %d: AES-256 requires exactly 32 bytes", len(key))
	}
	keyCopy := make([]byte, 32)
	copy(keyCopy, key)
	return &AESGCMVault{key: keyCopy}, nil
}

// Encrypt encrypts a plaintext secret into an authenticated ciphertext string prefixed with "enc:v1:".
func (v *AESGCMVault) Encrypt(plain string) (string, error) {
	if plain == "" {
		return "", nil
	}
	block, err := aes.NewCipher(v.key)
	if err != nil {
		return "", fmt.Errorf("create aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	ciphertext := gcm.Seal(nil, nonce, []byte(plain), nil)
	payload := append(nonce, ciphertext...)
	return VaultEncryptedPrefix + base64.RawStdEncoding.EncodeToString(payload), nil
}

// Decrypt authenticates and decrypts an "enc:v1:" ciphertext string. Unencrypted strings pass through.
func (v *AESGCMVault) Decrypt(cipherText string) (string, error) {
	if !strings.HasPrefix(cipherText, VaultEncryptedPrefix) {
		return cipherText, nil
	}
	encoded := strings.TrimPrefix(cipherText, VaultEncryptedPrefix)
	payload, err := base64.RawStdEncoding.DecodeString(encoded)
	if err != nil {
		return "", errors.New("invalid encrypted payload encoding")
	}
	block, err := aes.NewCipher(v.key)
	if err != nil {
		return "", fmt.Errorf("create aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm: %w", err)
	}
	if len(payload) < gcm.NonceSize() {
		return "", errors.New("ciphertext payload too short")
	}
	nonce := payload[:gcm.NonceSize()]
	ciphertext := payload[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("decryption failed: invalid key or corrupted ciphertext")
	}
	return string(plaintext), nil
}

// MaskAPIKey masks a Koyosim API key into the format koyo_****abcd.
// If the key is empty or shorter than 8 characters, it returns "koyo_****".
// Otherwise, it preserves the last 4 characters and masks the prefix with "koyo_****".
func MaskAPIKey(key string) string {
	trimmed := strings.TrimSpace(key)
	if len(trimmed) < 8 {
		return "koyo_****"
	}
	return "koyo_****" + trimmed[len(trimmed)-4:]
}

// RedactSecretFromText scrubs any occurrence of rawKey from an error message or log string.
func RedactSecretFromText(text string, rawKey string) string {
	trimmed := strings.TrimSpace(rawKey)
	if trimmed == "" || !strings.Contains(text, trimmed) {
		return text
	}
	return strings.ReplaceAll(text, trimmed, MaskAPIKey(trimmed))
}
