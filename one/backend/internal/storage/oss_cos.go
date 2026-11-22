package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
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

// OSSAdapter implements Aliyun OSS REST signing.
type OSSAdapter struct {
	provider        string
	endpoint        *url.URL
	endpointRaw     string
	region          string
	bucket          string
	accessKeyID     string
	accessKeySecret string
	pathPrefix      string
	publicBaseURL   string
	pathStyle       bool
	signedURLTTL    int
	client          *http.Client
	allowedHosts    []string
	nowFn           func() time.Time
}

// NewOSSAdapter constructs an Aliyun OSS storage adapter.
func NewOSSAdapter(cfg AdapterConfig, client *http.Client) (*OSSAdapter, error) {
	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = "cn-hangzhou"
	}
	epRaw := strings.TrimRight(strings.TrimSpace(cfg.Endpoint), "/")
	if epRaw == "" {
		epRaw = "https://oss-" + region + ".aliyuncs.com"
	}
	if strings.TrimSpace(cfg.Bucket) == "" || strings.TrimSpace(cfg.AccessKeyID) == "" || strings.TrimSpace(cfg.AccessKeySecret) == "" {
		return nil, fmt.Errorf("%w: oss requires bucket, accessKeyId, and accessKeySecret", ErrInvalidConfig)
	}
	parsedEP, err := outbound.ValidateExternalURL(epRaw, cfg.AllowedHosts...)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid endpoint: %v", ErrInvalidConfig, err)
	}
	ttl := cfg.SignedURLTTL
	if ttl <= 0 {
		ttl = 600
	}
	if client == nil {
		client = outbound.NewSafeHTTPClient(60*time.Second, cfg.AllowedHosts...)
	}
	return &OSSAdapter{
		provider:        "oss",
		endpoint:        parsedEP,
		endpointRaw:     epRaw,
		region:          region,
		bucket:          strings.TrimSpace(cfg.Bucket),
		accessKeyID:     strings.TrimSpace(cfg.AccessKeyID),
		accessKeySecret: cfg.AccessKeySecret,
		pathPrefix:      SanitizePrefix(cfg.PathPrefix),
		publicBaseURL:   strings.TrimRight(strings.TrimSpace(cfg.PublicBaseURL), "/"),
		pathStyle:       cfg.PathStyle,
		signedURLTTL:    ttl,
		client:          client,
		allowedHosts:    cfg.AllowedHosts,
		nowFn:           time.Now,
	}, nil
}

func (a *OSSAdapter) Provider() string { return a.provider }
func (a *OSSAdapter) Bucket() string   { return a.bucket }
func (a *OSSAdapter) Region() string   { return a.region }
func (a *OSSAdapter) Endpoint() string { return a.endpointRaw }

func (a *OSSAdapter) buildTarget(key string) (scheme, host, reqPath, resource, normalized string, err error) {
	normalized, err = NormalizeObjectKey(key, a.pathPrefix)
	if err != nil {
		return "", "", "", "", "", err
	}
	basePath := strings.TrimRight(a.endpoint.Path, "/")
	res := "/" + a.bucket + "/" + normalized
	if a.pathStyle {
		return a.endpoint.Scheme, a.endpoint.Host, basePath + "/" + url.PathEscape(a.bucket) + "/" + encodeObjectPath(normalized), res, normalized, nil
	}
	return a.endpoint.Scheme, a.bucket + "." + a.endpoint.Host, basePath + "/" + encodeObjectPath(normalized), res, normalized, nil
}

func (a *OSSAdapter) doRequest(ctx context.Context, method, key string, extraHeaders map[string]string, body []byte) (*http.Response, string, error) {
	scheme, host, reqPath, resource, normalized, err := a.buildTarget(key)
	if err != nil {
		return nil, "", err
	}
	date := a.nowFn().UTC().Format(http.TimeFormat)
	ct := extraHeaders["Content-Type"]
	stringToSign := fmt.Sprintf("%s\n\n%s\n%s\n%s", method, ct, date, resource)
	sig := hmacSHA1Base64(a.accessKeySecret, stringToSign)

	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, scheme+"://"+host+reqPath, reader)
	if err != nil {
		return nil, "", err
	}
	for k, v := range extraHeaders {
		if v != "" {
			req.Header.Set(k, v)
		}
	}
	req.Header.Set("Date", date)
	req.Header.Set("Authorization", "OSS "+a.accessKeyID+":"+sig)
	if body != nil {
		req.ContentLength = int64(len(body))
	}
	resp, err := outbound.SafeRequest(ctx, a.client, req, a.allowedHosts...)
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrUpstreamFailed, err)
	}
	return resp, normalized, nil
}

func (a *OSSAdapter) Put(ctx context.Context, key string, body []byte, contentType string) (PutResult, error) {
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}
	resp, normalized, err := a.doRequest(ctx, http.MethodPut, key, map[string]string{"Content-Type": contentType}, body)
	if err != nil {
		return PutResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return PutResult{}, fmt.Errorf("%w: oss put HTTP %d: %s", ErrUpstreamFailed, resp.StatusCode, strings.TrimSpace(string(msg)))
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

func (a *OSSAdapter) OpenStream(ctx context.Context, key string, rangeHeader string) (io.ReadCloser, ObjectMeta, error) {
	hdr := map[string]string{}
	if strings.TrimSpace(rangeHeader) != "" {
		hdr["Range"] = strings.TrimSpace(rangeHeader)
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
		return nil, ObjectMeta{}, fmt.Errorf("%w: oss get HTTP %d: %s", ErrUpstreamFailed, resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	cl, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	return resp.Body, ObjectMeta{
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
	}, nil
}

func (a *OSSAdapter) Head(ctx context.Context, key string) (ObjectMeta, error) {
	resp, normalized, err := a.doRequest(ctx, http.MethodHead, key, nil, nil)
	if err != nil {
		return ObjectMeta{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return ObjectMeta{}, ErrObjectNotFound
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ObjectMeta{}, fmt.Errorf("%w: oss head HTTP %d", ErrUpstreamFailed, resp.StatusCode)
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

func (a *OSSAdapter) Exists(ctx context.Context, key string) (bool, error) {
	_, err := a.Head(ctx, key)
	if err == ErrObjectNotFound {
		return false, nil
	}
	return err == nil, err
}

func (a *OSSAdapter) Delete(ctx context.Context, key string) error {
	resp, _, err := a.doRequest(ctx, http.MethodDelete, key, nil, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || (resp.StatusCode >= 200 && resp.StatusCode < 300) {
		return nil
	}
	return fmt.Errorf("%w: oss delete HTTP %d", ErrUpstreamFailed, resp.StatusCode)
}

func (a *OSSAdapter) PublicURL(key string) string {
	scheme, host, reqPath, _, normalized, err := a.buildTarget(key)
	if err != nil {
		return ""
	}
	if a.publicBaseURL != "" {
		return a.publicBaseURL + "/" + encodeObjectPath(normalized)
	}
	return scheme + "://" + host + reqPath
}

func (a *OSSAdapter) SignedURL(key string, disposition string, ttl time.Duration) (string, error) {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return "", nil
	}
	if strings.HasPrefix(strings.ToLower(trimmed), "http://") || strings.HasPrefix(strings.ToLower(trimmed), "https://") || strings.HasPrefix(trimmed, "data:") {
		return trimmed, nil
	}
	scheme, host, reqPath, resource, normalized, err := a.buildTarget(trimmed)
	if err != nil {
		return "", err
	}
	if a.publicBaseURL != "" {
		return a.publicBaseURL + "/" + encodeObjectPath(normalized), nil
	}
	exp := a.nowFn().Unix() + int64(clampTTL(ttl, a.signedURLTTL).Seconds())
	stringToSign := fmt.Sprintf("GET\n\n\n%d\n%s", exp, resource)
	sig := hmacSHA1Base64(a.accessKeySecret, stringToSign)
	q := url.Values{}
	q.Set("OSSAccessKeyId", a.accessKeyID)
	q.Set("Expires", strconv.FormatInt(exp, 10))
	q.Set("Signature", sig)
	if disposition == "attachment" {
		q.Set("response-content-disposition", "attachment")
	}
	return scheme + "://" + host + reqPath + "?" + q.Encode(), nil
}

func (a *OSSAdapter) TestConnection(ctx context.Context) (int64, error) {
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

// COSAdapter implements Tencent Cloud COS V5 XML/REST signing (q-sign-algorithm=sha1).
type COSAdapter struct {
	provider     string
	scheme       string
	host         string
	endpointRaw  string
	region       string
	bucket       string
	secretID     string
	secretKey    string
	pathPrefix   string
	customDomain string
	signedURLTTL int
	client       *http.Client
	allowedHosts []string
	nowFn        func() time.Time
}

// NewCOSAdapter constructs a Tencent COS storage adapter.
func NewCOSAdapter(cfg AdapterConfig, client *http.Client) (*COSAdapter, error) {
	bucket := strings.TrimSpace(cfg.Bucket)
	secretID := strings.TrimSpace(cfg.AccessKeyID)
	secretKey := cfg.AccessKeySecret
	if bucket == "" || secretID == "" || secretKey == "" {
		return nil, fmt.Errorf("%w: cos requires bucket, accessKeyId, and accessKeySecret", ErrInvalidConfig)
	}
	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = "ap-guangzhou"
	}
	scheme := "https"
	var host string
	custom := strings.TrimRight(strings.TrimSpace(cfg.PublicBaseURL), "/")
	epRaw := strings.TrimRight(strings.TrimSpace(cfg.Endpoint), "/")
	if custom != "" {
		parsed, err := outbound.ValidateExternalURL(custom, cfg.AllowedHosts...)
		if err != nil {
			return nil, fmt.Errorf("%w: invalid publicBaseUrl: %v", ErrInvalidConfig, err)
		}
		scheme = parsed.Scheme
		host = parsed.Host
	} else if epRaw != "" {
		parsed, err := outbound.ValidateExternalURL(epRaw, cfg.AllowedHosts...)
		if err != nil {
			return nil, fmt.Errorf("%w: invalid endpoint: %v", ErrInvalidConfig, err)
		}
		scheme = parsed.Scheme
		host = parsed.Host
		// If the caller specified standard COS service host or IP test server, preserve host when port or localhost.
		if !strings.Contains(host, ":") && !strings.HasPrefix(host, bucket+".") && strings.Contains(host, "myqcloud.com") {
			host = bucket + "." + host
		}
	} else {
		host = bucket + ".cos." + region + ".myqcloud.com"
	}
	ttl := cfg.SignedURLTTL
	if ttl <= 0 {
		ttl = 600
	}
	if client == nil {
		client = outbound.NewSafeHTTPClient(60*time.Second, cfg.AllowedHosts...)
	}
	return &COSAdapter{
		provider:     "cos",
		scheme:       scheme,
		host:         host,
		endpointRaw:  scheme + "://" + host,
		region:       region,
		bucket:       bucket,
		secretID:     secretID,
		secretKey:    secretKey,
		pathPrefix:   SanitizePrefix(cfg.PathPrefix),
		customDomain: custom,
		signedURLTTL: ttl,
		client:       client,
		allowedHosts: cfg.AllowedHosts,
		nowFn:        time.Now,
	}, nil
}

func (a *COSAdapter) Provider() string { return a.provider }
func (a *COSAdapter) Bucket() string   { return a.bucket }
func (a *COSAdapter) Region() string   { return a.region }
func (a *COSAdapter) Endpoint() string { return a.endpointRaw }

func (a *COSAdapter) signCOS(method, pathname string, queryParams, headers map[string]string, ttl time.Duration) string {
	start := a.nowFn().Unix()
	end := start + int64(clampTTL(ttl, a.signedURLTTL).Seconds())
	signTime := fmt.Sprintf("%d;%d", start, end)
	signKey := hmacSHA1Hex(a.secretKey, signTime)

	qKeys, formatParams := formatCOSKeyValues(queryParams)
	hKeys, formatHeaders := formatCOSKeyValues(headers)
	cleanPath := "/" + strings.TrimLeft(pathname, "/")
	formatString := strings.ToLower(method) + "\n" + cleanPath + "\n" + formatParams + "\n" + formatHeaders + "\n"
	sum := sha1.Sum([]byte(formatString))
	stringToSign := "sha1\n" + signTime + "\n" + hex.EncodeToString(sum[:]) + "\n"
	sig := hmacSHA1Hex(signKey, stringToSign)

	return strings.Join([]string{
		"q-sign-algorithm=sha1",
		"q-ak=" + url.QueryEscape(a.secretID),
		"q-sign-time=" + signTime,
		"q-key-time=" + signTime,
		"q-header-list=" + hKeys,
		"q-url-param-list=" + qKeys,
		"q-signature=" + sig,
	}, "&")
}

func (a *COSAdapter) doRequest(ctx context.Context, method, key string, extraHeaders map[string]string, body []byte) (*http.Response, string, error) {
	normalized, err := NormalizeObjectKey(key, a.pathPrefix)
	if err != nil {
		return nil, "", err
	}
	pathname := "/" + normalized
	signHdrs := map[string]string{"host": a.host}
	for k, v := range extraHeaders {
		if v != "" {
			signHdrs[strings.ToLower(k)] = v
		}
	}
	auth := a.signCOS(method, pathname, nil, signHdrs, 10*time.Minute)

	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, a.scheme+"://"+a.host+"/"+encodeObjectPath(normalized), reader)
	if err != nil {
		return nil, "", err
	}
	for k, v := range extraHeaders {
		if v != "" {
			req.Header.Set(k, v)
		}
	}
	req.Header.Set("Authorization", auth)
	if body != nil {
		req.ContentLength = int64(len(body))
	}
	resp, err := outbound.SafeRequest(ctx, a.client, req, a.allowedHosts...)
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrUpstreamFailed, err)
	}
	return resp, normalized, nil
}

func (a *COSAdapter) Put(ctx context.Context, key string, body []byte, contentType string) (PutResult, error) {
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}
	resp, normalized, err := a.doRequest(ctx, http.MethodPut, key, map[string]string{"Content-Type": contentType}, body)
	if err != nil {
		return PutResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return PutResult{}, fmt.Errorf("%w: cos put HTTP %d: %s", ErrUpstreamFailed, resp.StatusCode, strings.TrimSpace(string(msg)))
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

func (a *COSAdapter) OpenStream(ctx context.Context, key string, rangeHeader string) (io.ReadCloser, ObjectMeta, error) {
	hdr := map[string]string{}
	if strings.TrimSpace(rangeHeader) != "" {
		hdr["Range"] = strings.TrimSpace(rangeHeader)
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
		return nil, ObjectMeta{}, fmt.Errorf("%w: cos get HTTP %d: %s", ErrUpstreamFailed, resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	cl, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	return resp.Body, ObjectMeta{
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
	}, nil
}

func (a *COSAdapter) Head(ctx context.Context, key string) (ObjectMeta, error) {
	resp, normalized, err := a.doRequest(ctx, http.MethodHead, key, nil, nil)
	if err != nil {
		return ObjectMeta{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return ObjectMeta{}, ErrObjectNotFound
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ObjectMeta{}, fmt.Errorf("%w: cos head HTTP %d", ErrUpstreamFailed, resp.StatusCode)
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

func (a *COSAdapter) Exists(ctx context.Context, key string) (bool, error) {
	_, err := a.Head(ctx, key)
	if err == ErrObjectNotFound {
		return false, nil
	}
	return err == nil, err
}

func (a *COSAdapter) Delete(ctx context.Context, key string) error {
	resp, _, err := a.doRequest(ctx, http.MethodDelete, key, nil, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || (resp.StatusCode >= 200 && resp.StatusCode < 300) {
		return nil
	}
	return fmt.Errorf("%w: cos delete HTTP %d", ErrUpstreamFailed, resp.StatusCode)
}

func (a *COSAdapter) PublicURL(key string) string {
	normalized, err := NormalizeObjectKey(key, a.pathPrefix)
	if err != nil {
		return ""
	}
	return a.scheme + "://" + a.host + "/" + encodeObjectPath(normalized)
}

func (a *COSAdapter) SignedURL(key string, disposition string, ttl time.Duration) (string, error) {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return "", nil
	}
	if strings.HasPrefix(strings.ToLower(trimmed), "http://") || strings.HasPrefix(strings.ToLower(trimmed), "https://") || strings.HasPrefix(trimmed, "data:") {
		return trimmed, nil
	}
	normalized, err := NormalizeObjectKey(trimmed, a.pathPrefix)
	if err != nil {
		return "", err
	}
	queryParams := map[string]string{}
	if disposition == "attachment" {
		queryParams["response-content-disposition"] = "attachment"
	}
	authQuery := a.signCOS("get", "/"+normalized, queryParams, nil, ttl)
	raw := a.scheme + "://" + a.host + "/" + encodeObjectPath(normalized) + "?" + authQuery
	if disposition == "attachment" {
		raw += "&response-content-disposition=attachment"
	}
	return raw, nil
}

func (a *COSAdapter) TestConnection(ctx context.Context) (int64, error) {
	started := time.Now()
	testKey := fmt.Sprintf(".storage-tests/%d.txt", time.Now().UnixNano())
	payload := []byte("cos-probe")
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

func formatCOSKeyValues(m map[string]string) (keyList, formatted string) {
	if len(m) == 0 {
		return "", ""
	}
	lower := make(map[string]string, len(m))
	keys := make([]string, 0, len(m))
	for k, v := range m {
		lk := strings.ToLower(k)
		if _, exists := lower[lk]; !exists {
			keys = append(keys, lk)
		}
		lower[lk] = v
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+url.QueryEscape(lower[k]))
	}
	return strings.Join(keys, ";"), strings.Join(parts, "&")
}

func hmacSHA1Base64(secret, data string) string {
	mac := hmac.New(sha1.New, []byte(secret))
	_, _ = mac.Write([]byte(data))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func hmacSHA1Hex(secret, data string) string {
	mac := hmac.New(sha1.New, []byte(secret))
	_, _ = mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}
