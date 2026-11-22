package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"
)

var (
	ErrObjectNotFound  = errors.New("storage: object not found")
	ErrInvalidKey      = errors.New("storage: invalid object key")
	ErrInvalidConfig   = errors.New("storage: invalid adapter config")
	ErrQuotaExceeded   = errors.New("storage: quota exceeded")
	ErrFileTooLarge    = errors.New("storage: file too large")
	ErrInvalidFileType = errors.New("storage: invalid file type")
	ErrUpstreamFailed  = errors.New("storage: upstream operation failed")
)

// QuotaError wraps ErrQuotaExceeded with structured quota metrics.
type QuotaError struct {
	UsedBytes      int64
	QuotaBytes     int64
	StorageGB      int64
	IncomingBytes  int64
	RemainingBytes int64
}

func (e *QuotaError) Error() string {
	return "存储空间不足，请清理素材或升级套餐后再上传"
}

func (e *QuotaError) Unwrap() error { return ErrQuotaExceeded }

// AdapterConfig holds decrypted provider configuration for a storage location.
type AdapterConfig struct {
	Provider          string   `json:"provider"`
	Enabled           bool     `json:"enabled"`
	Endpoint          string   `json:"endpoint"`
	Region            string   `json:"region"`
	Bucket            string   `json:"bucket"`
	AccessKeyID       string   `json:"accessKeyId"`
	AccessKeySecret   string   `json:"accessKeySecret"`
	SessionToken      string   `json:"sessionToken"`
	PathPrefix        string   `json:"pathPrefix"`
	PublicBaseURL     string   `json:"publicBaseUrl"`
	S3Preset          string   `json:"s3Preset"`
	PathStyle         bool     `json:"pathStyle"`
	SignedURLTTL      int      `json:"signedUrlTtl"`
	StorageLocationID string   `json:"storageLocationId"`
	LocalRoot         string   `json:"-"`
	PublicURLPrefix   string   `json:"-"`
	AllowedHosts      []string `json:"-"`
}

// PutResult describes a completed object upload.
type PutResult struct {
	Provider string
	Key      string
	Bucket   string
	Region   string
	ETag     string
	Size     int64
	Location string
}

// ObjectMeta holds metadata from Head or OpenStream.
type ObjectMeta struct {
	Key           string
	Provider      string
	Bucket        string
	Region        string
	Size          int64
	ContentType   string
	ETag          string
	LastModified  string
	StatusCode    int
	ContentRange  string
	ContentLength int64
}

// Adapter defines provider-neutral object storage operations.
type Adapter interface {
	Provider() string
	Bucket() string
	Region() string
	Endpoint() string
	Put(ctx context.Context, key string, body []byte, contentType string) (PutResult, error)
	OpenStream(ctx context.Context, key string, rangeHeader string) (io.ReadCloser, ObjectMeta, error)
	Head(ctx context.Context, key string) (ObjectMeta, error)
	Exists(ctx context.Context, key string) (bool, error)
	Delete(ctx context.Context, key string) error
	PublicURL(key string) string
	SignedURL(key string, disposition string, ttl time.Duration) (string, error)
	TestConnection(ctx context.Context) (int64, error)
}

// NormalizeProvider maps aliases such as "amh" to canonical provider IDs.
func NormalizeProvider(v string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "", "local", "amh":
		return "local"
	case "s3", "qiniu", "r2", "minio", "aws":
		if strings.ToLower(strings.TrimSpace(v)) == "qiniu" {
			return "qiniu"
		}
		return "s3"
	case "oss":
		return "oss"
	case "cos":
		return "cos"
	default:
		return strings.ToLower(strings.TrimSpace(v))
	}
}

// SanitizePrefix cleans a path prefix without allowing traversal segments.
func SanitizePrefix(prefix string) string {
	raw := strings.ReplaceAll(strings.TrimSpace(prefix), "\\", "/")
	parts := strings.Split(raw, "/")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" || p == "." || p == ".." {
			continue
		}
		out = append(out, p)
	}
	return strings.Join(out, "/")
}

// NormalizeObjectKey validates and optionally prefixes an object key.
func NormalizeObjectKey(key, prefix string) (string, error) {
	cleaned := strings.ReplaceAll(strings.TrimSpace(key), "\\", "/")
	cleaned = strings.TrimLeft(cleaned, "/")
	if cleaned == "" || strings.Contains(cleaned, "\x00") {
		return "", fmt.Errorf("%w: empty or null byte", ErrInvalidKey)
	}
	for _, seg := range strings.Split(cleaned, "/") {
		if seg == ".." || seg == "." || seg == "" {
			return "", fmt.Errorf("%w: forbidden path segment in %q", ErrInvalidKey, key)
		}
	}
	p := SanitizePrefix(prefix)
	if p == "" || cleaned == p || strings.HasPrefix(cleaned, p+"/") {
		return cleaned, nil
	}
	return p + "/" + cleaned, nil
}

func rfc3986Escape(s string) string {
	escaped := url.QueryEscape(s)
	escaped = strings.ReplaceAll(escaped, "+", "%20")
	escaped = strings.ReplaceAll(escaped, "*", "%2A")
	escaped = strings.ReplaceAll(escaped, "%7E", "~")
	return escaped
}

func encodeObjectPath(key string) string {
	parts := strings.Split(key, "/")
	for i, part := range parts {
		parts[i] = rfc3986Escape(part)
	}
	return strings.Join(parts, "/")
}

func sha256HexBytes(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func clampTTL(d time.Duration, def int) time.Duration {
	sec := int(d.Seconds())
	if sec <= 0 {
		sec = def
	}
	if sec <= 0 {
		sec = 600
	}
	if sec < 60 {
		sec = 60
	}
	if sec > 86400 {
		sec = 86400
	}
	return time.Duration(sec) * time.Second
}
