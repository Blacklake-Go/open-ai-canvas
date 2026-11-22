package storage

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/config"
	"one/backend/internal/outbound"
	"one/backend/internal/pkg/seckey"
)

const (
	settingsKeyV2     = "storage_config_v2"
	settingsCacheTTL  = 5 * time.Second
	maxMigrationBytes = 512 * 1024 * 1024
)

var mimeToExt = map[string]string{
	"image/jpeg":        "jpg",
	"image/png":         "png",
	"image/webp":        "webp",
	"image/gif":         "gif",
	"image/avif":        "avif",
	"video/mp4":         "mp4",
	"video/quicktime":   "mov",
	"video/webm":        "webm",
	"audio/mpeg":        "mp3",
	"audio/wav":         "wav",
	"audio/x-wav":       "wav",
	"audio/aac":         "aac",
	"audio/mp4":         "m4a",
	"audio/x-m4a":       "m4a",
	"audio/flac":        "flac",
	"audio/x-flac":      "flac",
	"audio/ogg":         "ogg",
	"application/pdf":   "pdf",
	"model/gltf-binary": "glb",
	"model/gltf+json":   "gltf",
}

var extToMIME = map[string]string{
	"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
	"gif": "image/gif", "avif": "image/avif", "mp4": "video/mp4", "mov": "video/quicktime",
	"webm": "video/webm", "mp3": "audio/mpeg", "wav": "audio/wav", "aac": "audio/aac",
	"m4a": "audio/mp4", "flac": "audio/flac", "ogg": "audio/ogg", "pdf": "application/pdf",
	"glb": "model/gltf-binary", "gltf": "model/gltf+json",
}

var maxBytesByType = map[string]int64{
	"image":    50 * 1024 * 1024,
	"avatar":   20 * 1024 * 1024,
	"audio":    500 * 1024 * 1024,
	"video":    2 * 1024 * 1024 * 1024,
	"document": 50 * 1024 * 1024,
	"other":    500 * 1024 * 1024,
}

var safeUserRe = regexp.MustCompile(`[^a-zA-Z0-9_-]`)

// NewAdapter constructs an Adapter from decrypted config.
func NewAdapter(cfg AdapterConfig, client *http.Client) (Adapter, error) {
	switch NormalizeProvider(cfg.Provider) {
	case "local":
		return NewLocalAdapter(cfg)
	case "s3", "qiniu":
		return NewS3Adapter(cfg, client)
	case "oss":
		return NewOSSAdapter(cfg, client)
	case "cos":
		return NewCOSAdapter(cfg, client)
	default:
		return nil, fmt.Errorf("%w: unsupported provider %q", ErrInvalidConfig, cfg.Provider)
	}
}

// Service manages storage adapters, encryption/decryption of location configs,
// object ingestion, streaming, signed URLs, and historical migrations.
type Service struct {
	Pool         *pgxpool.Pool
	Config       config.Config
	Entitlements func(ctx context.Context, userID string) (storageGB int64, err error)
	HTTPClient   *http.Client

	cacheMu        sync.RWMutex
	cachedSettings *AdapterConfig
	cachedAt       time.Time

	migMu    sync.Mutex
	migLocks map[string]*sync.Mutex
}

// InvalidateCache drops cached storage_config_v2 settings.
func (s *Service) InvalidateCache() {
	s.cacheMu.Lock()
	s.cachedSettings = nil
	s.cachedAt = time.Time{}
	s.cacheMu.Unlock()
}

func (s *Service) httpClient() *http.Client {
	if s.HTTPClient != nil {
		return s.HTTPClient
	}
	return outbound.NewSafeHTTPClient(120*time.Second, s.Config.AllowedPrivateHosts...)
}

func (s *Service) defaultLocalConfig() AdapterConfig {
	root := strings.TrimSpace(s.Config.StorageLocalRoot)
	if root == "" {
		root = "./data/storage"
	}
	return AdapterConfig{
		Provider:        "local",
		Enabled:         true,
		PathPrefix:      "supdance",
		SignedURLTTL:    600,
		LocalRoot:       root,
		PublicURLPrefix: "/uploads",
		AllowedHosts:    s.Config.AllowedPrivateHosts,
	}
}

func (s *Service) decodeConfigMap(raw map[string]any) AdapterConfig {
	cfg := s.defaultLocalConfig()
	if raw == nil {
		return cfg
	}
	if p := strAny(raw["provider"]); p != "" {
		cfg.Provider = NormalizeProvider(p)
	}
	if en, ok := raw["enabled"].(bool); ok {
		cfg.Enabled = en
	}
	cfg.Endpoint = strings.TrimRight(strAny(raw["endpoint"]), "/")
	cfg.Region = strAny(raw["region"])
	cfg.Bucket = strAny(raw["bucket"])
	cfg.AccessKeyID = strAny(raw["accessKeyId"])
	cfg.PathPrefix = SanitizePrefix(firstString(strAny(raw["pathPrefix"]), "supdance"))
	cfg.PublicBaseURL = strings.TrimRight(strAny(raw["publicBaseUrl"]), "/")
	cfg.S3Preset = firstString(strings.ToLower(strAny(raw["s3Preset"])), "custom")
	if ps, ok := raw["pathStyle"].(bool); ok {
		cfg.PathStyle = ps
	}
	if ttl := intAny(raw["signedUrlTtl"]); ttl > 0 {
		if ttl < 60 {
			ttl = 60
		}
		if ttl > 86400 {
			ttl = 86400
		}
		cfg.SignedURLTTL = ttl
	}
	cfg.StorageLocationID = strAny(raw["storageLocationId"])

	storageKey := s.Config.StorageSecretKey()
	if sec, err := seckey.DecryptStorageEnvelope(storageKey, raw["accessKeySecret"]); err == nil {
		cfg.AccessKeySecret = sec
	}
	if tok, err := seckey.DecryptStorageEnvelope(storageKey, raw["sessionToken"]); err == nil {
		cfg.SessionToken = tok
	}
	return cfg
}

// ReadSettings loads and decrypts the active storage_config_v2 setting.
func (s *Service) ReadSettings(ctx context.Context, fresh bool) (AdapterConfig, error) {
	if !fresh {
		s.cacheMu.RLock()
		if s.cachedSettings != nil && time.Since(s.cachedAt) < settingsCacheTTL {
			cfg := *s.cachedSettings
			s.cacheMu.RUnlock()
			return cfg, nil
		}
		s.cacheMu.RUnlock()
	}
	cfg := s.defaultLocalConfig()
	if s.Pool == nil {
		return cfg, nil
	}
	var rawBytes []byte
	err := s.Pool.QueryRow(ctx, `SELECT value FROM ops_bill.system_settings WHERE key = $1`, settingsKeyV2).Scan(&rawBytes)
	if errors.Is(err, pgx.ErrNoRows) {
		s.cacheMu.Lock()
		cp := cfg
		s.cachedSettings = &cp
		s.cachedAt = time.Now()
		s.cacheMu.Unlock()
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	var parsed map[string]any
	if err := json.Unmarshal(rawBytes, &parsed); err != nil {
		return cfg, err
	}
	cfg = s.decodeConfigMap(parsed)
	s.cacheMu.Lock()
	cp := cfg
	s.cachedSettings = &cp
	s.cachedAt = time.Now()
	s.cacheMu.Unlock()
	return cfg, nil
}

// ActiveAdapter returns the currently configured storage adapter and its config.
func (s *Service) ActiveAdapter(ctx context.Context) (Adapter, AdapterConfig, error) {
	cfg, err := s.ReadSettings(ctx, false)
	if err != nil {
		return nil, cfg, err
	}
	adapter, err := NewAdapter(cfg, s.httpClient())
	return adapter, cfg, err
}

// AdapterForLocation resolves the adapter for a persisted asset/creation/avatar location.
func (s *Service) AdapterForLocation(ctx context.Context, provider, locationID, bucket, region string) (Adapter, AdapterConfig, error) {
	if strings.TrimSpace(locationID) != "" && s.Pool != nil {
		var valBytes []byte
		err := s.Pool.QueryRow(ctx, `SELECT value_json FROM ai_studio.storage_locations WHERE id = $1`, locationID).Scan(&valBytes)
		if err == nil {
			var parsed map[string]any
			if json.Unmarshal(valBytes, &parsed) == nil {
				cfg := s.decodeConfigMap(parsed)
				cfg.StorageLocationID = locationID
				adapter, aErr := NewAdapter(cfg, s.httpClient())
				return adapter, cfg, aErr
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, AdapterConfig{}, err
		}
	}

	active, err := s.ReadSettings(ctx, false)
	if err != nil {
		return nil, AdapterConfig{}, err
	}
	normProv := NormalizeProvider(provider)
	if normProv == "local" && active.Provider != "local" && strings.TrimSpace(locationID) == "" {
		cfg := s.defaultLocalConfig()
		adapter, aErr := NewAdapter(cfg, s.httpClient())
		return adapter, cfg, aErr
	}
	if provider != "" && normProv != active.Provider && strings.TrimSpace(locationID) == "" {
		return nil, AdapterConfig{}, fmt.Errorf("%w: storage location %q/%q is not active", ErrInvalidConfig, provider, bucket)
	}
	if bucket != "" {
		active.Bucket = bucket
	}
	if region != "" {
		active.Region = region
	}
	adapter, aErr := NewAdapter(active, s.httpClient())
	return adapter, active, aErr
}

// ValidateConfig checks required fields for an AdapterConfig.
func ValidateConfig(cfg AdapterConfig) error {
	switch NormalizeProvider(cfg.Provider) {
	case "local":
		return nil
	case "s3", "qiniu", "oss", "cos":
		if strings.TrimSpace(cfg.Bucket) == "" {
			return fmt.Errorf("%w: 请填写 Bucket", ErrInvalidConfig)
		}
		if strings.TrimSpace(cfg.AccessKeyID) == "" {
			return fmt.Errorf("%w: 请填写 Access Key ID", ErrInvalidConfig)
		}
		if strings.TrimSpace(cfg.AccessKeySecret) == "" {
			return fmt.Errorf("%w: 请填写 Access Key Secret", ErrInvalidConfig)
		}
		if (cfg.Provider == "s3" || cfg.Provider == "qiniu") && strings.TrimSpace(cfg.Endpoint) == "" {
			return fmt.Errorf("%w: 请填写 S3 Endpoint", ErrInvalidConfig)
		}
		if cfg.Provider == "cos" && strings.TrimSpace(cfg.Region) == "" {
			return fmt.Errorf("%w: 腾讯云 COS 需要填写 Region", ErrInvalidConfig)
		}
		if cfg.Endpoint != "" {
			if _, err := outbound.ValidateExternalURL(cfg.Endpoint, cfg.AllowedHosts...); err != nil {
				return fmt.Errorf("%w: Endpoint 地址无效或被 SSRF 策略拒绝: %v", ErrInvalidConfig, err)
			}
		}
		return nil
	default:
		return fmt.Errorf("%w: 存储供应商无效", ErrInvalidConfig)
	}
}

func locationDigest(cfg AdapterConfig) string {
	canonical, _ := json.Marshal(map[string]any{
		"provider":    cfg.Provider,
		"endpoint":    cfg.Endpoint,
		"region":      cfg.Region,
		"bucket":      cfg.Bucket,
		"accessKeyId": cfg.AccessKeyID,
		"pathPrefix":  cfg.PathPrefix,
		"pathStyle":   cfg.PathStyle,
		"s3Preset":    cfg.S3Preset,
	})
	return sha256HexBytes(canonical)
}

func (s *Service) buildCandidate(ctx context.Context, raw map[string]any) (AdapterConfig, AdapterConfig, error) {
	current, _ := s.ReadSettings(ctx, true)
	candidate := s.defaultLocalConfig()
	if raw != nil {
		if p := strAny(raw["provider"]); p != "" {
			candidate.Provider = NormalizeProvider(p)
		}
		if en, ok := raw["enabled"].(bool); ok {
			candidate.Enabled = en
		}
		candidate.Endpoint = strings.TrimRight(strAny(raw["endpoint"]), "/")
		candidate.Region = strAny(raw["region"])
		candidate.Bucket = strAny(raw["bucket"])
		candidate.AccessKeyID = strAny(raw["accessKeyId"])
		candidate.AccessKeySecret = strAny(raw["accessKeySecret"])
		candidate.SessionToken = strAny(raw["sessionToken"])
		candidate.PathPrefix = SanitizePrefix(firstString(strAny(raw["pathPrefix"]), "supdance"))
		candidate.PublicBaseURL = strings.TrimRight(strAny(raw["publicBaseUrl"]), "/")
		candidate.S3Preset = firstString(strings.ToLower(strAny(raw["s3Preset"])), "custom")
		if ps, ok := raw["pathStyle"].(bool); ok {
			candidate.PathStyle = ps
		}
		if ttl := intAny(raw["signedUrlTtl"]); ttl > 0 {
			candidate.SignedURLTTL = ttl
		}
		candidate.StorageLocationID = strAny(raw["storageLocationId"])
	}
	if candidate.Provider == current.Provider {
		if candidate.AccessKeyID == "" {
			candidate.AccessKeyID = current.AccessKeyID
		}
		if candidate.AccessKeySecret == "" {
			candidate.AccessKeySecret = current.AccessKeySecret
		}
		if candidate.SessionToken == "" {
			candidate.SessionToken = current.SessionToken
		}
		if candidate.StorageLocationID == "" {
			candidate.StorageLocationID = current.StorageLocationID
		}
	}
	return candidate, current, nil
}

// TestConfig tests live connectivity for candidate admin storage settings.
func (s *Service) TestConfig(ctx context.Context, raw map[string]any) (map[string]any, error) {
	candidate, current, _ := s.buildCandidate(ctx, raw)
	if err := ValidateConfig(candidate); err != nil {
		return nil, err
	}
	adapter, err := NewAdapter(candidate, s.httpClient())
	if err != nil {
		return nil, err
	}
	latencyMS, err := adapter.TestConnection(ctx)
	if err != nil {
		return nil, err
	}
	if s.Pool != nil && candidate.StorageLocationID != "" && candidate.StorageLocationID == current.StorageLocationID && candidate.Provider == current.Provider {
		digest := locationDigest(candidate)
		_, _ = s.Pool.Exec(ctx, `UPDATE ai_studio.storage_locations SET tested_at = now(), tested_digest = $2, updated_at = now() WHERE id = $1`, candidate.StorageLocationID, digest)
	}
	return map[string]any{
		"ok":        true,
		"provider":  candidate.Provider,
		"latencyMs": latencyMS,
		"result":    map[string]any{"ok": true, "provider": candidate.Provider, "latencyMs": latencyMS},
	}, nil
}

// SaveConfig validates, encrypts secrets with seckey, upserts storage_locations, and persists storage_config_v2.
func (s *Service) SaveConfig(ctx context.Context, raw map[string]any, actorEmail string) (map[string]any, error) {
	if s.Pool == nil {
		return nil, errors.New("database unavailable")
	}
	cfg, _, _ := s.buildCandidate(ctx, raw)
	if err := ValidateConfig(cfg); err != nil {
		return nil, err
	}
	var encSecret any = ""
	var encToken any = ""
	if cfg.AccessKeySecret != "" || cfg.SessionToken != "" {
		storageKey := s.Config.StorageSecretKey()
		if storageKey == "" {
			return nil, fmt.Errorf("%w: 未配置 STORAGE_SECRETS_ENCRYPTION_KEY，拒绝明文写入存储凭据", ErrInvalidConfig)
		}
		if cfg.AccessKeySecret != "" {
			env, err := seckey.EncryptStorageEnvelope(storageKey, cfg.AccessKeySecret)
			if err != nil {
				return nil, err
			}
			encSecret = env
		}
		if cfg.SessionToken != "" {
			env, err := seckey.EncryptStorageEnvelope(storageKey, cfg.SessionToken)
			if err != nil {
				return nil, err
			}
			encToken = env
		}
	}
	nowISO := time.Now().UTC().Format(time.RFC3339Nano)
	encoded := map[string]any{
		"provider":        cfg.Provider,
		"enabled":         cfg.Enabled,
		"endpoint":        cfg.Endpoint,
		"region":          cfg.Region,
		"bucket":          cfg.Bucket,
		"accessKeyId":     cfg.AccessKeyID,
		"accessKeySecret": encSecret,
		"sessionToken":    encToken,
		"pathPrefix":      cfg.PathPrefix,
		"publicBaseUrl":   cfg.PublicBaseURL,
		"s3Preset":        cfg.S3Preset,
		"pathStyle":       cfg.PathStyle,
		"signedUrlTtl":    cfg.SignedURLTTL,
		"updatedAt":       nowISO,
	}
	digest := locationDigest(cfg)
	locID := ""
	err := s.Pool.QueryRow(ctx, `
		SELECT id FROM ai_studio.storage_locations
		WHERE scope = 'platform' AND owner_id = '' AND provider = $1 AND location_digest = $2
		LIMIT 1`, cfg.Provider, digest).Scan(&locID)
	encJSON, _ := json.Marshal(encoded)
	if errors.Is(err, pgx.ErrNoRows) {
		locID = newRandomID("sloc")
		_, err = s.Pool.Exec(ctx, `
			INSERT INTO ai_studio.storage_locations
			  (id, scope, owner_id, provider, location_digest, value_json, created_at, updated_at)
			VALUES ($1,'platform','',$2,$3,$4::jsonb,now(),now())
			ON CONFLICT (scope, owner_id, provider, location_digest)
			DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()`,
			locID, cfg.Provider, digest, string(encJSON))
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		_, err = s.Pool.Exec(ctx, `UPDATE ai_studio.storage_locations SET value_json = $2::jsonb, updated_at = now() WHERE id = $1`, locID, string(encJSON))
		if err != nil {
			return nil, err
		}
	}

	encoded["storageLocationId"] = locID
	valJSON, _ := json.Marshal(encoded)
	_, err = s.Pool.Exec(ctx, `
		INSERT INTO ops_bill.system_settings (key, value, visibility, updated_by, updated_at)
		VALUES ($1, $2::jsonb, 'private', $3, now())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, visibility = EXCLUDED.visibility, updated_by = EXCLUDED.updated_by, updated_at = now()`,
		settingsKeyV2, string(valJSON), firstString(actorEmail, "system"))
	if err != nil {
		return nil, err
	}
	s.InvalidateCache()
	return map[string]any{
		"provider":           cfg.Provider,
		"enabled":            cfg.Enabled,
		"endpoint":           cfg.Endpoint,
		"region":             cfg.Region,
		"bucket":             cfg.Bucket,
		"pathPrefix":         cfg.PathPrefix,
		"publicBaseUrl":      cfg.PublicBaseURL,
		"s3Preset":           cfg.S3Preset,
		"pathStyle":          cfg.PathStyle,
		"signedUrlTtl":       cfg.SignedURLTTL,
		"accessKeyIdMasked":  seckey.MaskSecret(cfg.AccessKeyID),
		"hasAccessKeySecret": cfg.AccessKeySecret != "",
		"storageLocationId":  locID,
		"updatedAt":          nowISO,
	}, nil
}

// BuildObjectKey partitions object keys under user/date/type prefixes matching AMH conventions.
func BuildObjectKey(userID, assetType, filename, sourceType, workflowID string) string {
	safeUser := safeUserRe.ReplaceAllString(firstString(userID, "system"), "_")
	ext := cleanExt(filename)
	if ext == "" {
		switch strings.ToLower(assetType) {
		case "video":
			ext = "mp4"
		case "audio", "music":
			ext = "mp3"
		default:
			ext = "webp"
		}
	}
	now := time.Now().UTC()
	id := uuidV4Like()
	normType := normalizeAssetType(assetType)
	if normType == "avatar" {
		return fmt.Sprintf("avatars/%s/%s.%s", safeUser, id, ext)
	}
	if workflowID != "" {
		safeWF := safeUserRe.ReplaceAllString(workflowID, "_")
		return fmt.Sprintf("workflows/%s/%s/%s.%s", safeUser, safeWF, id, ext)
	}
	datePath := now.Format("2006/01/02")
	switch {
	case sourceType == "generation" || normType == "generated":
		return fmt.Sprintf("generated/%s/%s.%s", datePath, id, ext)
	case normType == "image":
		return fmt.Sprintf("images/%s/%s.%s", datePath, id, ext)
	case normType == "video":
		return fmt.Sprintf("videos/%s/%s.%s", datePath, id, ext)
	case normType == "audio":
		return fmt.Sprintf("audio/%s/%s.%s", datePath, id, ext)
	case normType == "temp":
		return fmt.Sprintf("temp/%s.%s", id, ext)
	default:
		return fmt.Sprintf("uploads/%s/%s/%s.%s", safeUser, datePath, id, ext)
	}
}

func normalizeAssetType(t string) string {
	v := strings.ToLower(strings.TrimSpace(t))
	if v == "music" {
		return "audio"
	}
	if v == "" {
		return "other"
	}
	return v
}

func cleanExt(filename string) string {
	ext := strings.TrimPrefix(strings.ToLower(path.Ext(strings.TrimSpace(filename))), ".")
	var out strings.Builder
	for _, r := range ext {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			out.WriteRune(r)
		}
	}
	return out.String()
}

// DetectMIME inspects magic bytes, declared Content-Type, and filename extension.
func DetectMIME(body []byte, declared, filename string) (mimeType, ext string) {
	decl := strings.ToLower(strings.TrimSpace(strings.Split(declared, ";")[0]))
	ext = cleanExt(filename)
	switch {
	case len(body) >= 8 && bytes.Equal(body[:8], []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}):
		mimeType = "image/png"
	case len(body) >= 3 && body[0] == 0xff && body[1] == 0xd8 && body[2] == 0xff:
		mimeType = "image/jpeg"
	case len(body) >= 12 && string(body[0:4]) == "RIFF" && string(body[8:12]) == "WEBP":
		mimeType = "image/webp"
	case len(body) >= 6 && (string(body[:6]) == "GIF87a" || string(body[:6]) == "GIF89a"):
		mimeType = "image/gif"
	case len(body) >= 12 && string(body[4:8]) == "ftyp":
		if ext == "mov" {
			mimeType = "video/quicktime"
		} else {
			mimeType = "video/mp4"
		}
	case decl != "" && (mimeToExt[decl] != "" || strings.HasPrefix(decl, "video/") || strings.HasPrefix(decl, "audio/")):
		mimeType = decl
	case extToMIME[ext] != "":
		mimeType = extToMIME[ext]
	default:
		mimeType = http.DetectContentType(body)
		if i := strings.Index(mimeType, ";"); i > 0 {
			mimeType = strings.TrimSpace(mimeType[:i])
		}
	}
	if e := mimeToExt[mimeType]; e != "" {
		ext = e
	} else if ext == "" {
		ext = "bin"
	}
	return mimeType, ext
}

// AssertQuota checks the user's storage allocation when Entitlements is available.
func (s *Service) AssertQuota(ctx context.Context, userID string, incomingBytes int64) error {
	if s.Pool == nil || strings.TrimSpace(userID) == "" || s.Entitlements == nil {
		return nil
	}
	gb, err := s.Entitlements(ctx, userID)
	if err != nil || gb <= 0 {
		return nil
	}
	var usedBytes int64
	if err := s.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(file_size_bytes), 0)::bigint
		FROM ai_studio.user_assets
		WHERE user_id = $1 AND status IN ('ready', 'archived') AND deleted_at IS NULL`, userID).Scan(&usedBytes); err != nil {
		return nil
	}
	quotaBytes := gb * 1024 * 1024 * 1024
	if usedBytes+incomingBytes > quotaBytes {
		rem := quotaBytes - usedBytes
		if rem < 0 {
			rem = 0
		}
		return &QuotaError{
			UsedBytes:      usedBytes,
			QuotaBytes:     quotaBytes,
			StorageGB:      gb,
			IncomingBytes:  incomingBytes,
			RemainingBytes: rem,
		}
	}
	return nil
}

// IngestInput describes a memory buffer to store.
type IngestInput struct {
	UserID      string
	Type        string
	Filename    string
	ContentType string
	SourceType  string
	ObjectKey   string
	Body        []byte
}

// IngestResult describes a stored object and its persistence location.
type IngestResult struct {
	Provider          string
	ObjectKey         string
	URL               string
	MIMEType          string
	Extension         string
	SizeBytes         int64
	Checksum          string
	Bucket            string
	Region            string
	StorageLocationID string
	Endpoint          string
}

// IngestBuffer validates, uploads via the active adapter, and logs telemetry.
func (s *Service) IngestBuffer(ctx context.Context, in IngestInput) (IngestResult, error) {
	if len(in.Body) == 0 {
		return IngestResult{}, fmt.Errorf("%w: empty buffer", ErrFileTooLarge)
	}
	normType := normalizeAssetType(in.Type)
	limit := maxBytesByType[normType]
	if limit <= 0 {
		limit = maxBytesByType["other"]
	}
	if int64(len(in.Body)) > limit {
		return IngestResult{}, fmt.Errorf("%w: exceeds limit %d", ErrFileTooLarge, limit)
	}
	mimeType, ext := DetectMIME(in.Body, in.ContentType, in.Filename)
	key := strings.TrimSpace(in.ObjectKey)
	if key == "" {
		key = BuildObjectKey(in.UserID, normType, firstString(in.Filename, "asset."+ext), in.SourceType, "")
	}
	normKey, err := NormalizeObjectKey(key, "")
	if err != nil {
		return IngestResult{}, err
	}

	adapter, cfg, err := s.ActiveAdapter(ctx)
	if err != nil {
		return IngestResult{}, err
	}
	started := time.Now()
	putRes, putErr := adapter.Put(ctx, normKey, in.Body, mimeType)
	durMS := time.Since(started).Milliseconds()
	status := "success"
	var errCode any
	if putErr != nil {
		status = "failed"
		errCode = "STORAGE_INGEST_FAILED"
	}
	if s.Pool != nil {
		_, _ = s.Pool.Exec(ctx, `
			INSERT INTO ai_studio.storage_operation_logs
			  (id, user_id, provider, object_key, operation, size_bytes, duration_ms, status, error_code)
			VALUES ($1,$2,$3,$4,'ingest',$5,$6,$7,$8)`,
			newRandomID("sop"), nullStr(in.UserID), adapter.Provider(), putRes.Key, len(in.Body), durMS, status, errCode)
	}
	if putErr != nil {
		return IngestResult{}, putErr
	}
	locURL, _ := adapter.SignedURL(putRes.Key, "inline", 0)
	if locURL == "" {
		locURL = adapter.PublicURL(putRes.Key)
	}
	return IngestResult{
		Provider:          adapter.Provider(),
		ObjectKey:         putRes.Key,
		URL:               locURL,
		MIMEType:          mimeType,
		Extension:         ext,
		SizeBytes:         int64(len(in.Body)),
		Checksum:          sha256HexBytes(in.Body),
		Bucket:            cfg.Bucket,
		Region:            cfg.Region,
		StorageLocationID: cfg.StorageLocationID,
		Endpoint:          cfg.Endpoint,
	}, nil
}

// IngestRemoteURL downloads an HTTP(S) or data: result using SSRF checks and stores it.
func (s *Service) IngestRemoteURL(ctx context.Context, rawURL, userID, assetType, filename string) (IngestResult, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return IngestResult{}, fmt.Errorf("%w: empty url", ErrInvalidConfig)
	}
	if strings.HasPrefix(trimmed, "data:") {
		mimeType, payload, err := decodeDataURL(trimmed)
		if err != nil {
			return IngestResult{}, err
		}
		return s.IngestBuffer(ctx, IngestInput{
			UserID:      userID,
			Type:        assetType,
			Filename:    firstString(filename, "provider-result"),
			ContentType: mimeType,
			SourceType:  "generation",
			Body:        payload,
		})
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, trimmed, nil)
	if err != nil {
		return IngestResult{}, fmt.Errorf("%w: %v", ErrUpstreamFailed, err)
	}
	req.Header.Set("User-Agent", "One-Storage/2.0")
	resp, err := outbound.SafeRequest(ctx, s.httpClient(), req, s.Config.AllowedPrivateHosts...)
	if err != nil {
		return IngestResult{}, fmt.Errorf("%w: download remote object: %v", ErrUpstreamFailed, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return IngestResult{}, fmt.Errorf("%w: remote object HTTP %d", ErrUpstreamFailed, resp.StatusCode)
	}
	normType := normalizeAssetType(assetType)
	limit := maxBytesByType[normType]
	if limit <= 0 {
		limit = maxBytesByType["other"]
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return IngestResult{}, fmt.Errorf("%w: read remote body: %v", ErrUpstreamFailed, err)
	}
	if int64(len(body)) > limit {
		return IngestResult{}, ErrFileTooLarge
	}
	return s.IngestBuffer(ctx, IngestInput{
		UserID:      userID,
		Type:        assetType,
		Filename:    firstString(filename, path.Base(req.URL.Path)),
		ContentType: resp.Header.Get("Content-Type"),
		SourceType:  "generation",
		Body:        body,
	})
}

func decodeDataURL(raw string) (string, []byte, error) {
	comma := strings.IndexByte(raw, ',')
	if comma < 5 {
		return "", nil, fmt.Errorf("%w: malformed data url", ErrInvalidConfig)
	}
	header := raw[5:comma]
	data := raw[comma+1:]
	isBase64 := strings.HasSuffix(header, ";base64")
	mimeType := strings.TrimSuffix(header, ";base64")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	if isBase64 {
		b, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			b, err = base64.RawStdEncoding.DecodeString(data)
			if err != nil {
				return "", nil, err
			}
		}
		return mimeType, b, nil
	}
	unescaped, err := url.PathUnescape(data)
	if err != nil {
		return "", nil, err
	}
	return mimeType, []byte(unescaped), nil
}

// SignedURL signs an existing stored object key according to its storage location.
func (s *Service) SignedURL(ctx context.Context, provider, locationID, bucket, region, key, disposition string) (string, error) {
	if strings.TrimSpace(key) == "" {
		return "", nil
	}
	adapter, _, err := s.AdapterForLocation(ctx, provider, locationID, bucket, region)
	if err != nil {
		return "", err
	}
	return adapter.SignedURL(key, disposition, 0)
}

// OpenStream opens an object stream (supporting optional Range header) from its stored location.
func (s *Service) OpenStream(ctx context.Context, provider, locationID, bucket, region, key, rangeHeader string) (io.ReadCloser, ObjectMeta, error) {
	adapter, _, err := s.AdapterForLocation(ctx, provider, locationID, bucket, region)
	if err != nil {
		return nil, ObjectMeta{}, err
	}
	return adapter.OpenStream(ctx, key, rangeHeader)
}

// AdvanceMigration processes a batch of historical assets, creations, and avatars to the target storage location.
func (s *Service) AdvanceMigration(ctx context.Context, runID string, maxItems int) (map[string]any, error) {
	if s.Pool == nil || strings.TrimSpace(runID) == "" {
		return nil, errors.New("missing migration run id")
	}
	if maxItems <= 0 {
		maxItems = 20
	}
	if maxItems > 50 {
		maxItems = 50
	}

	s.migMu.Lock()
	if s.migLocks == nil {
		s.migLocks = map[string]*sync.Mutex{}
	}
	mu := s.migLocks[runID]
	if mu == nil {
		mu = &sync.Mutex{}
		s.migLocks[runID] = mu
	}
	s.migMu.Unlock()

	mu.Lock()
	defer mu.Unlock()

	var targetLocationID, targetProvider, status, phase, cursorID, lastError string
	var scanned, migrated, skipped, failed int
	var cursorCreatedAt *time.Time
	err := s.Pool.QueryRow(ctx, `
		SELECT target_location_id, target_provider, status, COALESCE(phase,'assets'),
		       cursor_created_at, COALESCE(cursor_id,''), COALESCE(scanned,0),
		       COALESCE(migrated,0), COALESCE(skipped,0), COALESCE(failed,0), COALESCE(last_error,'')
		FROM ai_studio.storage_migration_runs WHERE id = $1`, runID).
		Scan(&targetLocationID, &targetProvider, &status, &phase, &cursorCreatedAt, &cursorID, &scanned, &migrated, &skipped, &failed, &lastError)
	if err != nil {
		return nil, err
	}
	if status != "running" {
		return s.loadMigrationRunMap(ctx, runID)
	}
	targetAdapter, targetCfg, err := s.AdapterForLocation(ctx, targetProvider, targetLocationID, "", "")
	if err != nil {
		return nil, err
	}

	processed := 0
	for processed < maxItems && phase != "completed" {
		rem := maxItems - processed
		if rem > 50 {
			rem = 50
		}
		movedAny, err := s.stepMigrationPhase(ctx, phase, targetLocationID, targetProvider, targetCfg, targetAdapter, &cursorCreatedAt, &cursorID, rem, &processed, &scanned, &migrated, &skipped, &failed, &lastError)
		if err != nil {
			return nil, err
		}
		if !movedAny {
			switch phase {
			case "assets":
				phase = "creations"
				cursorCreatedAt = nil
				cursorID = ""
			case "creations":
				phase = "avatars"
				cursorCreatedAt = nil
				cursorID = ""
			default:
				phase = "completed"
			}
			continue
		}
		_, _ = s.Pool.Exec(ctx, `
			UPDATE ai_studio.storage_migration_runs
			SET phase=$1, cursor_created_at=$2, cursor_id=$3, scanned=$4, migrated=$5, skipped=$6, failed=$7, last_error=$8, updated_at=now()
			WHERE id=$9`, phase, cursorCreatedAt, nullStr(cursorID), scanned, migrated, skipped, failed, nullStr(lastError), runID)
	}

	nextStatus := "running"
	if phase == "completed" {
		nextStatus = "completed"
	}
	_, err = s.Pool.Exec(ctx, `
		UPDATE ai_studio.storage_migration_runs
		SET phase=$1, cursor_created_at=$2, cursor_id=$3, scanned=$4, migrated=$5, skipped=$6, failed=$7, last_error=$8,
		    status=$9::varchar, finished_at=CASE WHEN $9::varchar='completed' THEN now() ELSE finished_at END, updated_at=now()
		WHERE id=$10`,
		phase, cursorCreatedAt, nullStr(cursorID), scanned, migrated, skipped, failed, nullStr(lastError), nextStatus, runID)
	if err != nil {
		return nil, err
	}
	return s.loadMigrationRunMap(ctx, runID)
}

func (s *Service) stepMigrationPhase(
	ctx context.Context,
	phase, targetLocID, targetProv string,
	targetCfg AdapterConfig,
	targetAdapter Adapter,
	cursorCreatedAt **time.Time,
	cursorID *string,
	limit int,
	processed, scanned, migrated, skipped, failed *int,
	lastError *string,
) (bool, error) {
	type migRow struct {
		id, provider, locID, bucket, region, mime string
		createdAt                                 time.Time
		keys                                      []string
	}
	var query string
	switch phase {
	case "assets":
		query = `SELECT id, created_at, COALESCE(storage_provider,''), COALESCE(storage_location_id,''), COALESCE(bucket,''), COALESCE(region,''), COALESCE(mime_type,''),
		                COALESCE(object_key,''), COALESCE(preview_object_key,''), COALESCE(thumbnail_object_key,'')
		         FROM ai_studio.user_assets
		         WHERE deleted_at IS NULL AND object_key IS NOT NULL AND storage_location_id IS DISTINCT FROM $1
		           AND ($2::timestamptz IS NULL OR (created_at, id) > ($2::timestamptz, $3::varchar))
		         ORDER BY created_at, id LIMIT $4`
	case "creations":
		query = `SELECT id, created_at, COALESCE(storage_provider,''), COALESCE(storage_location_id,''), COALESCE(storage_bucket,''), COALESCE(storage_region,''), COALESCE(storage_mime_type,''),
		                COALESCE(result_object_key,''), COALESCE(storage_preview_object_key,''), COALESCE(storage_thumbnail_object_key,'')
		         FROM ai_studio.creations
		         WHERE result_object_key IS NOT NULL AND storage_location_id IS DISTINCT FROM $1
		           AND ($2::timestamptz IS NULL OR (created_at, id) > ($2::timestamptz, $3::varchar))
		         ORDER BY created_at, id LIMIT $4`
	default:
		query = `SELECT id, created_at, COALESCE(avatar_storage_provider,''), COALESCE(avatar_storage_location_id,''), '', '', '',
		                COALESCE(avatar_object_key,''), '', ''
		         FROM auth_usr.users
		         WHERE avatar_object_key IS NOT NULL AND avatar_storage_location_id IS DISTINCT FROM $1
		           AND ($2::timestamptz IS NULL OR (created_at, id) > ($2::timestamptz, $3::varchar))
		         ORDER BY created_at, id LIMIT $4`
	}
	rows, err := s.Pool.Query(ctx, query, targetLocID, *cursorCreatedAt, *cursorID, limit)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	var items []migRow
	for rows.Next() {
		var r migRow
		var k1, k2, k3 string
		if scanErr := rows.Scan(&r.id, &r.createdAt, &r.provider, &r.locID, &r.bucket, &r.region, &r.mime, &k1, &k2, &k3); scanErr != nil {
			return false, scanErr
		}
		r.keys = []string{k1, k2, k3}
		items = append(items, r)
	}
	if len(items) == 0 {
		return false, nil
	}
	for _, it := range items {
		*processed++
		*scanned++
		ts := it.createdAt
		*cursorCreatedAt = &ts
		*cursorID = it.id
		srcAdapter, _, srcErr := s.AdapterForLocation(ctx, it.provider, it.locID, it.bucket, it.region)
		if srcErr != nil {
			*failed++
			*lastError = srcErr.Error()
			continue
		}
		internal := 0
		var copyErr error
		for _, k := range it.keys {
			outcome, err := copyMigrationObject(ctx, srcAdapter, targetAdapter, k, it.mime)
			if err != nil {
				copyErr = err
				break
			}
			if outcome == "copied" || outcome == "exists" {
				internal++
			}
		}
		if copyErr != nil {
			*failed++
			*lastError = copyErr.Error()
			continue
		}
		if internal == 0 {
			*skipped++
			continue
		}
		switch phase {
		case "assets":
			_, copyErr = s.Pool.Exec(ctx, `UPDATE ai_studio.user_assets SET storage_provider=$1, storage_location_id=$2, bucket=$3, region=$4, updated_at=now() WHERE id=$5`,
				targetProv, targetLocID, nullStr(targetCfg.Bucket), nullStr(targetCfg.Region), it.id)
		case "creations":
			_, copyErr = s.Pool.Exec(ctx, `UPDATE ai_studio.creations SET storage_provider=$1, storage_location_id=$2, storage_bucket=$3, storage_region=$4, updated_at=now() WHERE id=$5`,
				targetProv, targetLocID, nullStr(targetCfg.Bucket), nullStr(targetCfg.Region), it.id)
		default:
			_, copyErr = s.Pool.Exec(ctx, `UPDATE auth_usr.users SET avatar_storage_provider=$1, avatar_storage_location_id=$2, updated_at=now() WHERE id=$3`,
				targetProv, targetLocID, it.id)
		}
		if copyErr != nil {
			*failed++
			*lastError = copyErr.Error()
			continue
		}
		*migrated++
	}
	return true, nil
}

func copyMigrationObject(ctx context.Context, src, dst Adapter, key, mimeHint string) (string, error) {
	k := strings.TrimSpace(key)
	if k == "" {
		return "empty", nil
	}
	lk := strings.ToLower(k)
	if strings.HasPrefix(lk, "http://") || strings.HasPrefix(lk, "https://") || strings.HasPrefix(k, "/") || strings.HasPrefix(k, "data:") {
		return "external", nil
	}
	if ok, _ := dst.Exists(ctx, k); ok {
		return "exists", nil
	}
	meta, err := src.Head(ctx, k)
	if err != nil {
		return "", err
	}
	if meta.Size <= 0 || meta.Size > maxMigrationBytes {
		return "", fmt.Errorf("migration size out of bounds for %s: %d", k, meta.Size)
	}
	rc, dlMeta, err := src.OpenStream(ctx, k, "")
	if err != nil {
		return "", err
	}
	body, readErr := io.ReadAll(io.LimitReader(rc, maxMigrationBytes+1))
	_ = rc.Close()
	if readErr != nil {
		return "", readErr
	}
	if int64(len(body)) != meta.Size {
		return "", fmt.Errorf("migration length mismatch for %s", k)
	}
	ct := firstString(meta.ContentType, dlMeta.ContentType, mimeHint, "application/octet-stream")
	if _, err := dst.Put(ctx, k, body, ct); err != nil {
		return "", err
	}
	verified, err := dst.Head(ctx, k)
	if err != nil || verified.Size != meta.Size {
		return "", fmt.Errorf("migration target verification failed for %s", k)
	}
	return "copied", nil
}

func (s *Service) loadMigrationRunMap(ctx context.Context, runID string) (map[string]any, error) {
	var id, locID, prov, status, phase, cursorID, lastErr string
	var scanned, migrated, skipped, failed int
	var cursorAt, startedAt, finishedAt, updatedAt *time.Time
	err := s.Pool.QueryRow(ctx, `
		SELECT id, target_location_id, target_provider, status, COALESCE(phase,''),
		       cursor_created_at, COALESCE(cursor_id,''), COALESCE(scanned,0),
		       COALESCE(migrated,0), COALESCE(skipped,0), COALESCE(failed,0),
		       COALESCE(last_error,''), started_at, finished_at, updated_at
		FROM ai_studio.storage_migration_runs WHERE id=$1`, runID).
		Scan(&id, &locID, &prov, &status, &phase, &cursorAt, &cursorID, &scanned, &migrated, &skipped, &failed, &lastErr, &startedAt, &finishedAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id":                 id,
		"target_location_id": locID,
		"target_provider":    prov,
		"status":             status,
		"phase":              phase,
		"cursor_created_at":  cursorAt,
		"cursor_id":          cursorID,
		"scanned":            scanned,
		"migrated":           migrated,
		"skipped":            skipped,
		"failed":             failed,
		"last_error":         lastErr,
		"started_at":         startedAt,
		"finished_at":        finishedAt,
		"updated_at":         updatedAt,
	}, nil
}

func strAny(v any) string {
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func intAny(v any) int {
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	case int64:
		return int(x)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(x))
		return n
	default:
		return 0
	}
}

func firstString(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func nullStr(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func newRandomID(prefix string) string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

func uuidV4Like() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
