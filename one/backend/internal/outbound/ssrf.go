package outbound

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"syscall"
	"time"
)

var (
	ErrInvalidURL     = errors.New("invalid outbound url")
	ErrPrivateHost    = errors.New("outbound target points to private or loopback network")
	cgnatPrefix       = netip.MustParsePrefix("100.64.0.0/10")
	linkLocalV4Prefix = netip.MustParsePrefix("169.254.0.0/16")
)

// IsPrivateOrRestrictedIP checks whether ip is loopback, private, link-local,
// CGNAT, multicast, or unspecified.
func IsPrivateOrRestrictedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() ||
		ip.IsInterfaceLocalMulticast() {
		return true
	}
	if v4 := ip.To4(); v4 != nil {
		addr, ok := netip.AddrFromSlice(v4)
		if !ok {
			return true
		}
		return cgnatPrefix.Contains(addr) || linkLocalV4Prefix.Contains(addr)
	}
	return false
}

// ValidateExternalURL enforces https/http schemes and blocks localhost / internal
// domain suffixes / private IP literals unless explicitly present in allowedHosts.
func ValidateExternalURL(raw string, allowedPrivateHosts ...string) (*url.URL, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, ErrInvalidURL
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, ErrInvalidURL
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "https" && scheme != "http" {
		return nil, ErrInvalidURL
	}
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if host == "" {
		return nil, ErrInvalidURL
	}
	for _, allowed := range allowedPrivateHosts {
		if strings.EqualFold(strings.TrimSpace(allowed), host) && host != "" {
			return parsed, nil
		}
	}
	if host == "localhost" || strings.HasSuffix(host, ".localhost") ||
		strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return nil, ErrPrivateHost
	}
	if ip := net.ParseIP(host); ip != nil && IsPrivateOrRestrictedIP(ip) {
		return nil, ErrPrivateHost
	}
	return parsed, nil
}

// NewSafeHTTPClient returns an http.Client whose dialer blocks resolved private,
// loopback, link-local, and metadata IPs at connection time (preventing DNS rebinding),
// unless the host is in allowedPrivateHosts (for local mock testing).
func NewSafeHTTPClient(timeout time.Duration, allowedPrivateHosts ...string) *http.Client {
	allowedSet := make(map[string]bool, len(allowedPrivateHosts))
	for _, h := range allowedPrivateHosts {
		if clean := strings.ToLower(strings.TrimSpace(h)); clean != "" {
			allowedSet[clean] = true
		}
	}
	dialer := &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
		Control: func(network, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				host = address
			}
			if allowedSet[strings.ToLower(host)] {
				return nil
			}
			if ip := net.ParseIP(host); ip != nil && IsPrivateOrRestrictedIP(ip) {
				return ErrPrivateHost
			}
			return nil
		},
	}
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          64,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("stopped after 5 redirects")
			}
			if _, err := ValidateExternalURL(req.URL.String(), allowedPrivateHosts...); err != nil {
				return err
			}
			return nil
		},
	}
}

// SafeRequest creates and sends an outbound request after SSRF validation.
func SafeRequest(ctx context.Context, client *http.Client, req *http.Request, allowedPrivateHosts ...string) (*http.Response, error) {
	if _, err := ValidateExternalURL(req.URL.String(), allowedPrivateHosts...); err != nil {
		return nil, err
	}
	return client.Do(req.WithContext(ctx))
}
