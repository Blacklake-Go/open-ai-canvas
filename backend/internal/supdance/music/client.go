package music

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

const (
	// KoyosimAPIBaseURL is the immutable fixed server base URL for all Koyosim requests.
	// Client overrides and admin config mutations are strictly prohibited.
	KoyosimAPIBaseURL = "https://www.koyosim.com"

	// DefaultUserAgent provides identification for upstream Koyosim observability.
	DefaultUserAgent = "SupDance-Music/1.0 (+https://www.koyosim.com)"

	// MaxRedirects caps HTTP redirect depth to prevent redirection loops.
	MaxRedirects = 3

	// DefaultControlTimeout is the timeout for control plane requests (ping, models, task poll).
	DefaultControlTimeout = 15 * time.Second

	// DefaultCreationTimeout is the timeout for task generation and binary downloads.
	DefaultCreationTimeout = 60 * time.Second
)

// Blocked CIDR prefixes for anti-SSRF defense.
var blockedCIDRPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("10.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("127.0.0.0/8"),
	netip.MustParsePrefix("169.254.0.0/16"),
	netip.MustParsePrefix("172.16.0.0/12"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("192.168.0.0/16"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("::1/128"),
	netip.MustParsePrefix("fc00::/7"),
	netip.MustParsePrefix("fe80::/10"),
}

// ClientOption defines functional options for configuring Client.
type ClientOption func(*Client)

// WithTransport configures a custom RoundTripper (primarily for hermetic testing).
func WithTransport(rt http.RoundTripper) ClientOption {
	return func(c *Client) {
		if rt != nil {
			c.controlClient.Transport = rt
			c.createClient.Transport = rt
		}
	}
}

// WithUserAgent overrides the outbound User-Agent header.
func WithUserAgent(ua string) ClientOption {
	return func(c *Client) {
		if strings.TrimSpace(ua) != "" {
			c.userAgent = strings.TrimSpace(ua)
		}
	}
}

// Client is the fixed API client for external Koyosim generation services.
type Client struct {
	apiKey        string
	baseURL       string
	userAgent     string
	controlClient *http.Client
	createClient  *http.Client
}

// NewClient constructs a new fixed Koyosim HTTP client.
func NewClient(apiKey string, opts ...ClientOption) (*Client, error) {
	transport, err := newKoyosimTransport()
	if err != nil {
		return nil, fmt.Errorf("create koyosim transport: %w", err)
	}

	c := &Client{
		apiKey:    strings.TrimSpace(apiKey),
		baseURL:   KoyosimAPIBaseURL,
		userAgent: DefaultUserAgent,
		controlClient: &http.Client{
			Transport:     transport,
			Timeout:       DefaultControlTimeout,
			CheckRedirect: koyosimCheckRedirect,
		},
		createClient: &http.Client{
			Transport:     transport,
			Timeout:       DefaultCreationTimeout,
			CheckRedirect: koyosimCheckRedirect,
		},
	}

	for _, opt := range opts {
		opt(c)
	}

	return c, nil
}

// BaseURL returns the immutable server-side base URL.
func (c *Client) BaseURL() string {
	return c.baseURL
}

// APIKey returns the configured API key.
func (c *Client) APIKey() string {
	return c.apiKey
}

// ControlHTTPClient returns the internal control HTTP client (e.g. for capabilities manager).
func (c *Client) ControlHTTPClient() *http.Client {
	return c.controlClient
}

// Ping performs a lightweight, non-billing probe to /v1/ping.
func (c *Client) Ping(ctx context.Context) (*PingResponse, error) {
	reqURL := c.baseURL + "/v1/ping"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, c.sanitizeErr(err)
	}

	c.applyHeaders(req)
	resp, err := c.controlClient.Do(req)
	if err != nil {
		return nil, c.sanitizeErr(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.errorFromResponse(resp)
	}

	var result PingResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode ping response: %w", err)
	}
	return &result, nil
}

// ProbeConnection performs a zero-billing health check against Koyosim API with latency measurement.
func (c *Client) ProbeConnection(ctx context.Context) (*ConnectionProbeResult, error) {
	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	start := time.Now()
	pingResp, err := c.Ping(probeCtx)
	latencyMs := time.Since(start).Milliseconds()
	if err != nil {
		return nil, err
	}

	// Guarantee zero billing
	if pingResp.Billed || pingResp.CostMicrocredits > 0 {
		return nil, errors.New("upstream violated non-billing contract for /v1/ping probe")
	}

	return &ConnectionProbeResult{
		Status:           pingResp.Status,
		LatencyMs:        latencyMs,
		UpstreamVersion:  pingResp.Version,
		Billed:           pingResp.Billed,
		CostMicrocredits: pingResp.CostMicrocredits,
		Timestamp:        pingResp.Timestamp,
	}, nil
}

// CreateTask submits a new music generation request to POST /v1/audio/music/generate.
func (c *Client) CreateTask(ctx context.Context, payload any) (*GenerateResponse, error) {
	reqURL := c.baseURL + "/v1/audio/music/generate"
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal generate payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, c.sanitizeErr(err)
	}

	c.applyHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.createClient.Do(req)
	if err != nil {
		return nil, c.sanitizeErr(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.errorFromResponse(resp)
	}

	var envelope struct {
		Code int              `json:"code"`
		Data GenerateResponse `json:"data"`
		Msg  string           `json:"msg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, fmt.Errorf("decode generate response: %w", err)
	}
	if envelope.Code != 0 {
		return nil, fmt.Errorf("koyosim error (code %d): %s", envelope.Code, envelope.Msg)
	}
	return &envelope.Data, nil
}

// GetTask queries the status of an asynchronous music generation task.
func (c *Client) GetTask(ctx context.Context, taskID string) (*TaskResponse, error) {
	if strings.TrimSpace(taskID) == "" {
		return nil, errors.New("task id cannot be empty")
	}
	reqURL := fmt.Sprintf("%s/v1/audio/music/tasks/%s", c.baseURL, url.PathEscape(taskID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, c.sanitizeErr(err)
	}

	c.applyHeaders(req)
	resp, err := c.controlClient.Do(req)
	if err != nil {
		return nil, c.sanitizeErr(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.errorFromResponse(resp)
	}

	var envelope struct {
		Code int          `json:"code"`
		Data TaskResponse `json:"data"`
		Msg  string       `json:"msg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, fmt.Errorf("decode task response: %w", err)
	}
	if envelope.Code != 0 {
		return nil, fmt.Errorf("koyosim error (code %d): %s", envelope.Code, envelope.Msg)
	}
	return &envelope.Data, nil
}

// DownloadArtifact downloads binary audio stream from Koyosim with origin verification.
func (c *Client) DownloadArtifact(ctx context.Context, artifactURL string) ([]byte, string, error) {
	// Strict origin verification: artifact URL must belong to Koyosim base URL
	if !strings.HasPrefix(artifactURL, c.baseURL+"/") {
		return nil, "", fmt.Errorf("artifact download rejected: destination %q does not target %s", artifactURL, c.baseURL)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, artifactURL, nil)
	if err != nil {
		return nil, "", c.sanitizeErr(err)
	}

	c.applyHeaders(req)
	resp, err := c.createClient.Do(req)
	if err != nil {
		return nil, "", c.sanitizeErr(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", c.errorFromResponse(resp)
	}

	contentType := resp.Header.Get("Content-Type")
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read artifact response body: %w", err)
	}
	return body, contentType, nil
}

func (c *Client) applyHeaders(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "application/json")
}

func (c *Client) sanitizeErr(err error) error {
	if err == nil {
		return nil
	}
	return errors.New(RedactSecretFromText(err.Error(), c.apiKey))
}

func (c *Client) errorFromResponse(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	msg := string(body)
	if c.apiKey != "" {
		msg = RedactSecretFromText(msg, c.apiKey)
	}
	return fmt.Errorf("koyosim request failed (status %d): %s", resp.StatusCode, msg)
}

// koyosimCheckRedirect enforces anti-SSRF redirect verification.
func koyosimCheckRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= MaxRedirects {
		return fmt.Errorf("koyosim client: redirect limit exceeded (max %d)", MaxRedirects)
	}

	// 1. Enforce HTTPS scheme
	if req.URL.Scheme != "https" {
		return fmt.Errorf("koyosim ssrf guard: insecure redirect scheme %q rejected", req.URL.Scheme)
	}

	// 2. Enforce Koyosim host origin
	host := strings.ToLower(req.URL.Hostname())
	if host != "www.koyosim.com" && host != "koyosim.com" && !strings.HasSuffix(host, ".koyosim.com") {
		return fmt.Errorf("koyosim ssrf guard: redirect to foreign host %q rejected", host)
	}

	// 3. Reject IP address literals
	if ip := net.ParseIP(host); ip != nil {
		return fmt.Errorf("koyosim ssrf guard: redirect to IP address literal %s rejected", host)
	}

	return nil
}

// newKoyosimTransport creates an http.Transport with TLS CA verification and DNS SSRF filtering.
func newKoyosimTransport() (*http.Transport, error) {
	rootCAs, err := x509.SystemCertPool()
	if err != nil {
		rootCAs = x509.NewCertPool()
	}

	tlsConfig := &tls.Config{
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: false, // Strict CA validation
		RootCAs:            rootCAs,
		ServerName:         "www.koyosim.com",
	}

	dialer := &net.Dialer{
		Timeout:   15 * time.Second,
		KeepAlive: 30 * time.Second,
	}

	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}

			normHost := strings.ToLower(strings.TrimSpace(host))
			// Verify hostname target
			if normHost != "www.koyosim.com" && normHost != "koyosim.com" && !strings.HasSuffix(normHost, ".koyosim.com") {
				return nil, fmt.Errorf("koyosim ssrf guard: disallowed dial host %q", host)
			}

			// DNS lookup with IP blocklist filtering
			ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
			if err != nil {
				return nil, fmt.Errorf("koyosim dns lookup failed: %w", err)
			}
			if len(ips) == 0 {
				return nil, errors.New("koyosim dns lookup returned no IP addresses")
			}

			for _, ip := range ips {
				if isBlockedIP(ip) {
					return nil, fmt.Errorf("koyosim ssrf guard: target ip %s for host %s is private, loopback, or link-local", ip.String(), host)
				}
			}

			return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
		},
		TLSClientConfig:       tlsConfig,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          50,
		MaxIdleConnsPerHost:   10,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}, nil
}

func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalMulticast() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() || ip.IsMulticast() {
		return true
	}
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return true
	}
	addr = addr.Unmap()
	for _, prefix := range blockedCIDRPrefixes {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

// Client response models
type PingResponse struct {
	Code             int    `json:"code"`
	Status           string `json:"status"`
	Timestamp        int64  `json:"timestamp"`
	Billed           bool   `json:"billed"`
	CostMicrocredits int64  `json:"costMicrocredits"`
	Version          string `json:"version"`
}

type ConnectionProbeResult struct {
	Status           string `json:"status"`
	LatencyMs        int64  `json:"latencyMs"`
	UpstreamVersion  string `json:"upstreamVersion"`
	Billed           bool   `json:"billed"`
	CostMicrocredits int64  `json:"costMicrocredits"`
	Timestamp        int64  `json:"timestamp"`
}

type GenerateResponse struct {
	TaskID                   string `json:"task_id"`
	Status                   string `json:"status"`
	EstimatedDurationSeconds int    `json:"estimated_duration_seconds"`
	Model                    string `json:"model"`
	CreatedAt                int64  `json:"created_at"`
	IdempotentReplay         bool   `json:"idempotent_replay,omitempty"`
}

type TaskResponse struct {
	TaskID             string            `json:"task_id"`
	Model              string            `json:"model"`
	Mode               string            `json:"mode"`
	Stage              string            `json:"stage"`
	PollCount          int               `json:"poll_count"`
	Duration           float64           `json:"duration"`
	AudioURL           string            `json:"audio_url,omitempty"`
	AudioFormats       map[string]string `json:"audio_formats,omitempty"`
	Stems              map[string]string `json:"stems,omitempty"`
	SynthIDWatermarked bool              `json:"synth_id_watermarked"`
	ErrorReason        string            `json:"error_reason,omitempty"`
	UpdatedAt          int64             `json:"updated_at"`
}
