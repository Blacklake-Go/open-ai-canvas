package seckey

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"

	"github.com/jackc/pgx/v5"
)

var (
	ErrKeyRequired   = errors.New("encryption wrapping key is not configured")
	ErrSecretMissing = errors.New("provider secret not found")
)

// ProviderSecretBox matches ops_bill.provider_secrets (Supdance Pro/lib/repositories/providers.js).
type ProviderSecretBox struct {
	CiphertextHex string
	NonceHex      string
	AuthTagHex    string
	KeyVersion    int
}

// StorageSecretEnvelope matches Supdance Pro/lib/storage/storageCrypto.js JSON object.
type StorageSecretEnvelope struct {
	V    int    `json:"v"`
	IV   string `json:"iv"`
	Tag  string `json:"tag"`
	Data string `json:"data"`
}

// WrappingKey derives the 32-byte AES-256 key as SHA-256(secret), matching Node crypto.createHash('sha256').
func WrappingKey(secret string) ([]byte, error) {
	if secret == "" {
		return nil, ErrKeyRequired
	}
	sum := sha256.Sum256([]byte(secret))
	return sum[:], nil
}

func encryptGCM(secret, plaintext string) (ciphertext, iv, tag []byte, err error) {
	key, err := WrappingKey(secret)
	if err != nil {
		return nil, nil, nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, nil, err
	}
	iv = make([]byte, gcm.NonceSize()) // 12 bytes
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, nil, nil, err
	}
	sealed := gcm.Seal(nil, iv, []byte(plaintext), nil)
	tagSize := gcm.Overhead()
	ciphertext = sealed[:len(sealed)-tagSize]
	tag = sealed[len(sealed)-tagSize:]
	return ciphertext, iv, tag, nil
}

func decryptGCM(secret string, ciphertext, iv, tag []byte) (string, error) {
	key, err := WrappingKey(secret)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(iv) != gcm.NonceSize() {
		return "", fmt.Errorf("invalid GCM nonce length %d", len(iv))
	}
	combined := make([]byte, 0, len(ciphertext)+len(tag))
	combined = append(combined, ciphertext...)
	combined = append(combined, tag...)
	plain, err := gcm.Open(nil, iv, combined, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

// EncryptProviderSecret encrypts plaintext into hex-encoded AES-256-GCM columns.
func EncryptProviderSecret(secret, plaintext string) (ProviderSecretBox, error) {
	ct, iv, tag, err := encryptGCM(secret, plaintext)
	if err != nil {
		return ProviderSecretBox{}, err
	}
	return ProviderSecretBox{
		CiphertextHex: hex.EncodeToString(ct),
		NonceHex:      hex.EncodeToString(iv),
		AuthTagHex:    hex.EncodeToString(tag),
		KeyVersion:    1,
	}, nil
}

// DecryptProviderSecret decrypts hex-encoded AES-256-GCM columns from ops_bill.provider_secrets.
func DecryptProviderSecret(secret, ciphertextHex, nonceHex, authTagHex string) (string, error) {
	ct, err := hex.DecodeString(ciphertextHex)
	if err != nil {
		return "", err
	}
	iv, err := hex.DecodeString(nonceHex)
	if err != nil {
		return "", err
	}
	tag, err := hex.DecodeString(authTagHex)
	if err != nil {
		return "", err
	}
	return decryptGCM(secret, ct, iv, tag)
}

// EncryptStorageEnvelope produces the {v:1, iv, tag, data} envelope used by storage_config_v2.
func EncryptStorageEnvelope(secret, plaintext string) (*StorageSecretEnvelope, error) {
	if plaintext == "" {
		return nil, nil
	}
	ct, iv, tag, err := encryptGCM(secret, plaintext)
	if err != nil {
		return nil, err
	}
	return &StorageSecretEnvelope{
		V:    1,
		IV:   hex.EncodeToString(iv),
		Tag:  hex.EncodeToString(tag),
		Data: hex.EncodeToString(ct),
	}, nil
}

// DecryptStorageEnvelope decrypts a storageCrypto.js v1 object (or accepts plaintext string for legacy compat).
func DecryptStorageEnvelope(secret string, raw any) (string, error) {
	if raw == nil {
		return "", nil
	}
	if s, ok := raw.(string); ok {
		return s, nil
	}
	m, ok := raw.(map[string]any)
	if !ok {
		return "", errors.New("invalid encrypted storage secret payload")
	}
	vNum, _ := m["v"].(float64)
	vInt, _ := m["v"].(int)
	if vNum != 1 && vInt != 1 {
		return "", errors.New("unsupported storage secret version")
	}
	ivHex, _ := m["iv"].(string)
	tagHex, _ := m["tag"].(string)
	dataHex, _ := m["data"].(string)
	if ivHex == "" || tagHex == "" || dataHex == "" {
		return "", errors.New("incomplete storage secret envelope")
	}
	return DecryptProviderSecret(secret, dataHex, ivHex, tagHex)
}

// MaskSecret masks sensitive strings while keeping short/empty edge behavior consistent.
func MaskSecret(raw string) string {
	if raw == "" {
		return ""
	}
	if len(raw) <= 8 {
		if len(raw) <= 2 {
			return "****"
		}
		return raw[:2] + "****"
	}
	return raw[:4] + "****" + raw[len(raw)-4:]
}

// DBExecer captures pgxpool.Pool and pgx.Tx Exec/QueryRow.
type DBExecer interface {
	Exec(ctx context.Context, sql string, arguments ...any) (any, error)
}

// SaveProviderSecret encrypts plaintext and upserts ops_bill.provider_secrets.
func SaveProviderSecret(ctx context.Context, execFn func(context.Context, string, ...any) error, secretKey, provider, name, plaintext string) error {
	box, err := EncryptProviderSecret(secretKey, plaintext)
	if err != nil {
		return err
	}
	const q = `
		INSERT INTO ops_bill.provider_secrets
			(provider, name, ciphertext, nonce, auth_tag, key_version, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, now())
		ON CONFLICT (provider, name) DO UPDATE SET
			ciphertext = EXCLUDED.ciphertext,
			nonce = EXCLUDED.nonce,
			auth_tag = EXCLUDED.auth_tag,
			key_version = EXCLUDED.key_version,
			updated_at = now()`
	return execFn(ctx, q, provider, name, box.CiphertextHex, box.NonceHex, box.AuthTagHex, box.KeyVersion)
}

// ReadProviderSecret loads and decrypts a secret from ops_bill.provider_secrets.
func ReadProviderSecret(ctx context.Context, queryRowFn func(context.Context, string, ...any) pgx.Row, secretKey, provider, name string) (string, error) {
	var ciphertextHex, nonceHex, authTagHex string
	err := queryRowFn(ctx, `
		SELECT ciphertext, nonce, auth_tag
		FROM ops_bill.provider_secrets
		WHERE provider = $1 AND name = $2`, provider, name).Scan(&ciphertextHex, &nonceHex, &authTagHex)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrSecretMissing
		}
		return "", err
	}
	return DecryptProviderSecret(secretKey, ciphertextHex, nonceHex, authTagHex)
}
