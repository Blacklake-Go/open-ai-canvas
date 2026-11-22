package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"one/backend/internal/outbound"
)

const s3UnsignedPayload = "UNSIGNED-PAYLOAD"

// S3Adapter implements AWS S3 / R2 / MinIO / Qiniu Kodo compatible object storage using SigV4.
type S3Adapter struct {
	provider        string
	endpoint        *url.URL
	endpointRaw     string
	region          string
	bucket          string
	accessKeyID     string
	accessKeySecret string
	sessionToken    string
	pathPrefix      string
	publicBaseURL   string
	pathStyle       bool
	signedURLTTL    int
	client          *http.Client
	allowedHosts    []string
	nowFn           func() time.Time
}

// NewS3Adapter validates config and constructs an S3-compatible adapter.
func NewS3Adapter(cfg AdapterConfig, client *http.Client) (*S3Adapter, error) {
	provider := NormalizeProvider(cfg.Provider)
	epRaw := strings.TrimRight(strings.TrimSpace(cfg.Endpoint), "/")
	if epRaw == "" || strings.TrimSpace(cfg.Bucket) == "" || strings.TrimSpace(cfg.AccessKeyID) == "" || strings.TrimSpace(cfg.AccessKeySecret) == "" {
		return nil, fmt.Errorf("%w: s3 requires endpoint, bucket, accessKeyId, and accessKeySecret", ErrInvalidConfig)
	}
	parsedEP, err := outbound.ValidateExternalURL(epRaw, cfg.AllowedHosts...)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid endpoint: %v", ErrInvalidConfig, err)
	}
	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = "us-east-1"
	}
	pathStyle := cfg.PathStyle || !isStandardAWSEndpoint(parsedEP.Hostname())
	ttl := cfg.SignedURLTTL
	if ttl <= 0 {
		ttl = 600
	}
	if client == nil {
		client = outbound.NewSafeHTTPClient(60*time.Second, cfg.AllowedHosts...)
	}
	return &S3Adapter{
		provider:        provider,
		endpoint:        parsedEP,
		endpointRaw:     epRaw,
		region:          region,
		bucket:          strings.TrimSpace(cfg.Bucket),
		accessKeyID:     strings.TrimSpace(cfg.AccessKeyID),
		accessKeySecret: cfg.AccessKeySecret,
		sessionToken:    cfg.SessionToken,
		pathPrefix:      SanitizePrefix(cfg.PathPrefix),
		publicBaseURL:   strings.TrimRight(strings.TrimSpace(cfg.PublicBaseURL), "/"),
		pathStyle:       pathStyle,
		signedURLTTL:    ttl,
		client:          client,
		allowedHosts:    cfg.AllowedHosts,
		nowFn:           time.Now,
	}, nil
}

func isStandardAWSEndpoint(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	if h == "s3.amazonaws.com" {
		return true
	}
	if strings.HasPrefix(h, "s3.") && (strings.HasSuffix(h, ".amazonaws.com") || strings.HasSuffix(h, ".amazonaws.com.cn")) {
		return true
	}
	return strings.HasPrefix(h, "s3-") && strings.HasSuffix(h, ".amazonaws.com")
}

func (a *S3Adapter) Provider() string { return a.provider }
func (a *S3Adapter) Bucket() string   { return a.bucket }
func (a *S3Adapter) Region() string   { return a.region }
func (a *S3Adapter) Endpoint() string { return a.endpointRaw }

func (a *S3Adapter) buildTarget(key string) (scheme, host, reqPath, normalized string, err error) {
	normalized, err = NormalizeObjectKey(key, a.pathPrefix)
	if err != nil {
		return "", "", "", "", err
	}
	basePath := strings.TrimRight(a.endpoint.Path, "/")
	encodedKey := encodeObjectPath(normalized)
	if a.pathStyle {
		return a.endpoint.Scheme, a.endpoint.Host, basePath + "/" + encodeObjectPath(a.bucket) + "/" + encodedKey, normalized, nil
	}
	return a.endpoint.Scheme, a.bucket + "." + a.endpoint.Host, basePath + "/" + encodedKey, normalized, nil
}

func (a *S3Adapter) signHeaders(method, key string, extraHeaders map[string]string, query map[string]string, payload []byte) (rawURL string, hdr http.Header, normalized string, err error) {
	scheme, host, reqPath, normalized, err := a.buildTarget(key)
	if err != nil {
		return "", nil, "", err
	}
	now := a.nowFn().UTC()
	amzStamp := now.Format("20060102T150405Z")
	dateStamp := amzStamp[:8]
	payloadHash := sha256HexBytes(payload)

	lower := map[string]string{
		"host":                 host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date":           amzStamp,
	}
	hdr = make(http.Header)
	hdr.Set("x-amz-content-sha256", payloadHash)
	hdr.Set("x-amz-date", amzStamp)
	if a.sessionToken != "" {
		lower["x-amz-security-token"] = a.sessionToken
		hdr.Set("x-amz-security-token", a.sessionToken)
	}
	for k, v := range extraHeaders {
		if strings.TrimSpace(v) == "" {
			continue
		}
		lower[strings.ToLower(k)] = strings.TrimSpace(v)
		hdr.Set(k, strings.TrimSpace(v))
	}

	signedNames := make([]string, 0, len(lower))
	for k := range lower {
		signedNames = append(signedNames, k)
	}
	sort.Strings(signedNames)

	var canonHeaders strings.Builder
	for _, k := range signedNames {
		canonHeaders.WriteString(k)
		canonHeaders.WriteByte(':')
		canonHeaders.WriteString(lower[k])
		canonHeaders.WriteByte('\n')
	}

	canonQuery := canonicalQueryMap(query)
	canonReq := strings.Join([]string{
		method,
		reqPath,
		canonQuery,
		canonHeaders.String(),
		strings.Join(signedNames, ";"),
		payloadHash,
	}, "\n")

	scope := dateStamp + "/" + a.region + "/s3/aws4_request"
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzStamp,
		scope,
		sha256HexBytes([]byte(canonReq)),
	}, "\n")

	signingKey := s3SigningKey(a.accessKeySecret, dateStamp, a.region)
	sig := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))
	hdr.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		a.accessKeyID, scope, strings.Join(signedNames, ";"), sig))

	targetURL := scheme + "://" + host + reqPath
	if canonQuery != "" {
		targetURL += "?" + canonQuery
	}
	return targetURL, hdr, normalized, nil
}

func (a *S3Adapter) doRequest(ctx context.Context, method, key string, extraHeaders map[string]string, body []byte) (*http.Response, string, error) {
	targetURL, hdr, normalized, err := a.signHeaders(method, key, extraHeaders, nil, body)
	if err != nil {
		return nil, "", err
	}
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, targetURL, reader)
	if err != nil {
		return nil, "", err
	}
	req.Header = hdr
	if body != nil {
		req.ContentLength = int64(len(body))
	}
	resp, err := outbound.SafeRequest(ctx, a.client, req, a.allowedHosts...)
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrUpstreamFailed, err)
	}
	return resp, normalized, nil
}

func (a *S3Adapter) Put(ctx context.Context, key string, body []byte, contentType string) (PutResult, error) {
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}
	resp, normalized, err := a.doRequest(ctx, http.MethodPut, key, map[string]string{"content-type": contentType}, body)
	if err != nil {
		return PutResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return PutResult{}, fmt.Errorf("%w: s3 put HTTP %d: %s", ErrUpstreamFailed, resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	return PutResult{
		Provider: a.provider,
		Key:      normalized,
		Bucket:   a.bucket,
		Region:   a.region,
		ETag:     strings.Trim(resp.Header.Get("ETag"), `"`),
		Size:     int64(len(body)),
		Location: a.PublicURL(normalized),
	}, nil
}

func (a *S3Adapter) OpenStream(ctx context.Context, key string, rangeHeader string) (io.ReadCloser, ObjectMeta, error) {
	hdr := map[string]string{}
	if strings.TrimSpace(rangeHeader) != "" {
		hdr["range"] = strings.TrimSpace(rangeHeader)
	}
	resp, normalized, err := a.doRequest(ctx, http.MethodGet, key, hdr, nil)
	if err != nil {
		return nil, ObjectMeta{}, err
	}
	if resp.StatusCode == http.StatusNotFound {
		resp.Body.Close()
		return nil, ObjectMeta{}, ErrObjectNotFound
	}
	if resp.StatusCode == http.StatusRequestedRangeNotSatisfiable {
		resp.Body.Close()
		return nil, ObjectMeta{StatusCode: http.StatusRequestedRangeNotSatisfiable}, fmt.Errorf("%w: range not satisfiable", ErrUpstreamFailed)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		resp.Body.Close()
		return nil, ObjectMeta{}, fmt.Errorf("%w: s3 get HTTP %d: %s", ErrUpstreamFailed, resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	cl, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	meta := ObjectMeta{
		Key:           normalized,
		Provider:      a.provider,
		Bucket:        a.bucket,
		Region:        a.region,
		Size:          cl,
		ContentLength: cl,
		ContentType:   resp.Header.Get("Content-Type"),
		ContentRange:  resp.Header.Get("Content-Range"),
		ETag:          strings.Trim(resp.Header.Get("ETag"), `"`),
		LastModified:  resp.Header.Get("Last-Modified"),
		StatusCode:    resp.StatusCode,
	}
	return resp.Body, meta, nil
}

func (a *S3Adapter) Head(ctx context.Context, key string) (ObjectMeta, error) {
	resp, normalized, err := a.doRequest(ctx, http.MethodHead, key, nil, nil)
	if err != nil {
		return ObjectMeta{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return ObjectMeta{}, ErrObjectNotFound
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ObjectMeta{}, fmt.Errorf("%w: s3 head HTTP %d", ErrUpstreamFailed, resp.StatusCode)
	}
	cl, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	return ObjectMeta{
		Key:          normalized,
		Provider:     a.provider,
		Bucket:       a.bucket,
		Region:       a.region,
		Size:         cl,
		ContentType:  resp.Header.Get("Content-Type"),
		ETag:         strings.Trim(resp.Header.Get("ETag"), `"`),
		LastModified: resp.Header.Get("Last-Modified"),
	}, nil
}

func (a *S3Adapter) Exists(ctx context.Context, key string) (bool, error) {
	_, err := a.Head(ctx, key)
	if err == ErrObjectNotFound {
		return false, nil
	}
	return err == nil, err
}

func (a *S3Adapter) Delete(ctx context.Context, key string) error {
	resp, _, err := a.doRequest(ctx, http.MethodDelete, key, nil, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || (resp.StatusCode >= 200 && resp.StatusCode < 300) {
		return nil
	}
	msg, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
	return fmt.Errorf("%w: s3 delete HTTP %d: %s", ErrUpstreamFailed, resp.StatusCode, strings.TrimSpace(string(msg)))
}

func (a *S3Adapter) PublicURL(key string) string {
	scheme, host, reqPath, normalized, err := a.buildTarget(key)
	if err != nil {
		return ""
	}
	if a.publicBaseURL != "" {
		return a.publicBaseURL + "/" + encodeObjectPath(normalized)
	}
	return scheme + "://" + host + reqPath
}

func (a *S3Adapter) SignedURL(key string, disposition string, ttl time.Duration) (string, error) {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return "", nil
	}
	if strings.HasPrefix(strings.ToLower(trimmed), "http://") || strings.HasPrefix(strings.ToLower(trimmed), "https://") || strings.HasPrefix(trimmed, "data:") {
		return trimmed, nil
	}
	scheme, host, reqPath, normalized, err := a.buildTarget(trimmed)
	if err != nil {
		return "", err
	}
	if a.publicBaseURL != "" {
		return a.publicBaseURL + "/" + encodeObjectPath(normalized), nil
	}
	now := a.nowFn().UTC()
	stamp := now.Format("20060102T150405Z")
	dateStamp := stamp[:8]
	dur := clampTTL(ttl, a.signedURLTTL)
	scope := dateStamp + "/" + a.region + "/s3/aws4_request"
	query := map[string]string{
		"X-Amz-Algorithm":     "AWS4-HMAC-SHA256",
		"X-Amz-Credential":    a.accessKeyID + "/" + scope,
		"X-Amz-Date":          stamp,
		"X-Amz-Expires":       strconv.Itoa(int(dur.Seconds())),
		"X-Amz-SignedHeaders": "host",
	}
	if a.sessionToken != "" {
		query["X-Amz-Security-Token"] = a.sessionToken
	}
	if disposition == "attachment" {
		query["response-content-disposition"] = "attachment"
	}
	canonReq := strings.Join([]string{
		http.MethodGet,
		reqPath,
		canonicalQueryMap(query),
		"host:" + host + "\n",
		"host",
		s3UnsignedPayload,
	}, "\n")
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		stamp,
		scope,
		sha256HexBytes([]byte(canonReq)),
	}, "\n")
	signingKey := s3SigningKey(a.accessKeySecret, dateStamp, a.region)
	query["X-Amz-Signature"] = hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))
	return scheme + "://" + host + reqPath + "?" + canonicalQueryMap(query), nil
}

func (a *S3Adapter) TestConnection(ctx context.Context) (int64, error) {
	started := time.Now()
	testKey := fmt.Sprintf(".storage-tests/%d.txt", time.Now().UnixNano())
	payload := []byte("supdance-storage-test")
	if _, err := a.Put(ctx, testKey, payload, "text/plain"); err != nil {
		return 0, err
	}
	defer func() { _ = a.Delete(context.Background(), testKey) }()
	rc, _, err := a.OpenStream(ctx, testKey, "")
	if err != nil {
		return 0, err
	}
	got, err := io.ReadAll(rc)
	_ = rc.Close()
	if err != nil {
		return 0, err
	}
	if !bytes.Equal(got, payload) {
		return 0, fmt.Errorf("%w: storage read mismatch", ErrUpstreamFailed)
	}
	return time.Since(started).Milliseconds(), nil
}

func canonicalQueryMap(params map[string]string) string {
	if len(params) == 0 {
		return ""
	}
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, rfc3986Escape(k)+"="+rfc3986Escape(params[k]))
	}
	return strings.Join(parts, "&")
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(data)
	return mac.Sum(nil)
}

func s3SigningKey(secret, dateStamp, region string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte("s3"))
	return hmacSHA256(kService, []byte("aws4_request"))
}
