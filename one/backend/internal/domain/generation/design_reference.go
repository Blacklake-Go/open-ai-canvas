package generation

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"net/url"
	"regexp"
	"strconv"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/storage"
)

const designReferenceTTL = 10 * time.Minute

var designReferenceID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,160}$`)
var designReferenceQuery = regexp.MustCompile(`(?i)([?&]signature=)[A-Za-z0-9_-]{43}`)

func redactDesignReference(message string) string {
	return designReferenceQuery.ReplaceAllString(message, "${1}[redacted]")
}

func designReferenceOrigin(cfg config.Config) *url.URL {
	if len(cfg.StorageSecretKey()) < 32 {
		return nil
	}
	origin, err := url.Parse(cfg.PublicAppURL)
	if err != nil || origin.Hostname() == "" || origin.User != nil || origin.RawQuery != "" || origin.Fragment != "" ||
		(origin.Path != "" && origin.Path != "/") {
		return nil
	}
	if origin.Scheme == "https" || (origin.Scheme == "http" && origin.Hostname() == "127.0.0.1" && !cfg.IsProduction) {
		return origin
	}
	return nil
}

func referenceSignature(secret, job, asset, expiry string) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = io.WriteString(mac, "one.design-reference.v1\n"+job+"\n"+asset+"\n"+expiry)
	return mac.Sum(nil)
}

func (s *Service) localDesignReferenceURL(job, asset string) (string, error) {
	origin := designReferenceOrigin(s.Config)
	if origin == nil || !designReferenceID.MatchString(job) || !designReferenceID.MatchString(asset) {
		return "", errAssetReferenceUnavailable
	}
	expiry := strconv.FormatInt(time.Now().Add(designReferenceTTL).Unix(), 10)
	signature := base64.RawURLEncoding.EncodeToString(referenceSignature(s.Config.StorageSecretKey(), job, asset, expiry))
	origin.Path = "/api/generations/references/" + job + "/" + asset
	origin.RawQuery = url.Values{"expires": {expiry}, "signature": {signature}}.Encode()
	return origin.String(), nil
}

// OpenDesignReference makes a local reference available to the selected provider
// only while its exact task is active and its short-lived signature is valid.
func (s *Service) OpenDesignReference(ctx context.Context, job, asset, expiry, signature string) (io.ReadCloser, storage.ObjectMeta, error) {
	var invalid storage.ObjectMeta
	end, parseErr := strconv.ParseInt(expiry, 10, 64)
	now := time.Now()
	sig, decodeErr := base64.RawURLEncoding.DecodeString(signature)
	if s.Pool == nil || s.Storage == nil || designReferenceOrigin(s.Config) == nil ||
		!designReferenceID.MatchString(job) || !designReferenceID.MatchString(asset) ||
		parseErr != nil || decodeErr != nil || end <= now.Unix() || end > now.Add(designReferenceTTL).Unix() ||
		!hmac.Equal(sig, referenceSignature(s.Config.StorageSecretKey(), job, asset, expiry)) {
		return nil, invalid, errAssetReferenceUnavailable
	}
	var key, location, bucket, region, mime string
	err := s.Pool.QueryRow(ctx, `
		SELECT a.object_key, COALESCE(a.storage_location_id,''), COALESCE(a.bucket,''),
		       COALESCE(a.region,''), a.mime_type
		FROM ai_studio.creations c
		JOIN ai_studio.user_assets a ON a.user_id=c.user_id
		WHERE c.id=$1 AND a.id=$2
		  AND c.status IN ('queued','processing') AND c.deleted_at IS NULL
		  AND (
		       (c.studio_id LIKE 'design-agent:%' AND a.studio_id=c.studio_id
		        AND c.input_summary_json->>'task_type' IN ('i2v','i2i')
		        AND c.input_summary_json->>'image_url'='koyo-asset:' || a.id)
		       OR (c.studio_id='workshop' AND c.input_summary_json->>'task_type'='i2i'
		           AND (c.input_summary_json->'image_urls') ? ('koyo-asset:' || a.id))
		  )
		  AND a.status='ready' AND a.storage_status='ready' AND a.deleted_at IS NULL AND a.asset_type='image'
		  AND a.mime_type IN ('image/png','image/jpeg','image/webp','image/gif','image/avif')
		  AND LOWER(BTRIM(COALESCE(a.storage_provider,''))) IN ('','local','amh') AND NULLIF(a.object_key,'') IS NOT NULL`, job, asset).
		Scan(&key, &location, &bucket, &region, &mime)
	if err != nil {
		return nil, invalid, errAssetReferenceUnavailable
	}
	stream, meta, err := s.Storage.OpenStream(ctx, "local", location, bucket, region, key, "")
	if err != nil {
		return nil, invalid, errors.New("could not open local generation reference")
	}
	meta.ContentType = mime
	return stream, meta, nil
}
