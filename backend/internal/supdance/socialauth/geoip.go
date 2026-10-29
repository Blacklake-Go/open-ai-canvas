package socialauth

import (
	"net"
	"net/http"
	"strings"
)

// IPLocationResult contains resolved geolocation information for an HTTP request.
type IPLocationResult struct {
	ClientIP     string
	SourceHeader string
	Region       string // RegionCN ("cn") or RegionIntl ("intl")
	RegionLabel  string // "中国大陆" or "海外及港澳台"
	IsSimulated  bool
}

// ExtractClientIP extracts the real client IP and the source header from the request.
// It prioritizes CDN visitor IP headers and filters out internal proxy hops from X-Forwarded-For.
func ExtractClientIP(r *http.Request) (string, string) {
	// 1. Cloudflare Visitor IP
	if cfIP := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cfIP != "" {
		if ip := cleanIP(cfIP); ip != "" {
			return ip, "cf-connecting-ip"
		}
	}

	// 2. Alibaba Cloud CDN Visitor IP
	if aliIP := strings.TrimSpace(r.Header.Get("Ali-CDN-Real-IP")); aliIP != "" {
		if ip := cleanIP(aliIP); ip != "" {
			return ip, "ali-cdn-real-ip"
		}
	}

	// 3. X-Real-IP (if not private or loopback)
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		if ip := cleanIP(realIP); ip != "" {
			parsed := net.ParseIP(ip)
			if parsed != nil && !IsPrivateOrLoopbackIP(parsed) {
				return ip, "x-real-ip"
			}
		}
	}

	// 4. X-Forwarded-For chain: iterate and find the first public IP
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		var firstValid string
		for _, part := range parts {
			if ip := cleanIP(part); ip != "" {
				if firstValid == "" {
					firstValid = ip
				}
				parsed := net.ParseIP(ip)
				if parsed != nil && !IsPrivateOrLoopbackIP(parsed) {
					return ip, "x-forwarded-for"
				}
			}
		}
		if firstValid != "" {
			return firstValid, "x-forwarded-for"
		}
	}

	// 5. If X-Real-IP was private but present, use it as fallback before RemoteAddr
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		if ip := cleanIP(realIP); ip != "" {
			return ip, "x-real-ip"
		}
	}

	// 6. Fallback to RemoteAddr
	remoteIP := cleanIP(r.RemoteAddr)
	if remoteIP == "" {
		remoteIP = "127.0.0.1"
	}
	return remoteIP, "remote-addr"
}

func cleanIP(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	// Strip port if present
	if host, _, err := net.SplitHostPort(raw); err == nil {
		raw = host
	}
	parsed := net.ParseIP(raw)
	if parsed == nil {
		return ""
	}
	return parsed.String()
}

// IsPrivateOrLoopbackIP checks if the IP is local/private/RFC1918/RFC4193.
func IsPrivateOrLoopbackIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

// ResolveIPRegion resolves whether an IP belongs to Mainland China ("cn") or International/Overseas ("intl").
// HK, MO, TW are strictly classified as "intl" according to specifications.
func ResolveIPRegion(r *http.Request, defaultFallback string) IPLocationResult {
	if defaultFallback != RegionIntl && defaultFallback != RegionCN {
		defaultFallback = RegionCN
	}

	// 1. Simulation override for admin testing & preview (Header or Query parameter)
	simHeader := strings.ToLower(strings.TrimSpace(r.Header.Get("X-SupDance-Simulate-Region")))
	if simHeader == RegionCN || simHeader == RegionIntl {
		clientIP, src := ExtractClientIP(r)
		return buildLocationResult(clientIP, src, simHeader, true)
	}
	simQuery := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("simulate_region")))
	if simQuery == RegionCN || simQuery == RegionIntl {
		clientIP, src := ExtractClientIP(r)
		return buildLocationResult(clientIP, src, simQuery, true)
	}

	clientIP, srcHeader := ExtractClientIP(r)

	// 2. Check Edge CDN Authoritative Geo Country Headers
	// Cloudflare (CF-IPCountry), AWS CloudFront (CloudFront-Viewer-Country),
	// Nginx GeoIP (X-Country-Code, X-GeoIP-Country-Code), Alibaba Cloud CDN (Ali-CDN-Country, X-Client-Country)
	countryHeaders := []struct {
		header string
		name   string
	}{
		{"CF-IPCountry", "cf-ipcountry"},
		{"CloudFront-Viewer-Country", "cloudfront-country"},
		{"X-Country-Code", "x-country-code"},
		{"X-GeoIP-Country-Code", "x-geoip-country-code"},
		{"Ali-CDN-Country", "ali-cdn-country"},
		{"X-Client-Country", "x-client-country"},
	}

	for _, ch := range countryHeaders {
		val := strings.ToUpper(strings.TrimSpace(r.Header.Get(ch.header)))
		if val != "" && len(val) == 2 {
			if val == "CN" {
				return buildLocationResult(clientIP, ch.name+":cn", RegionCN, false)
			}
			// HK, MO, TW -> RegionIntl
			if val == "HK" || val == "MO" || val == "TW" {
				return buildLocationResult(clientIP, ch.name+":"+strings.ToLower(val), RegionIntl, false)
			}
			// Any other country code (US, JP, KR, etc.) -> RegionIntl
			return buildLocationResult(clientIP, ch.name+":"+strings.ToLower(val), RegionIntl, false)
		}
	}

	// 3. Private / Loopback IPs -> Fallback to defaultFallback
	parsedIP := net.ParseIP(clientIP)
	if parsedIP == nil || IsPrivateOrLoopbackIP(parsedIP) {
		return buildLocationResult(clientIP, srcHeader, defaultFallback, false)
	}

	// 4. High-precision APNIC China (CN) dataset check (IPv4 binary search + IPv6 range matching)
	if IsMainlandChinaIP(parsedIP) {
		return buildLocationResult(clientIP, srcHeader, RegionCN, false)
	}

	// 5. If public IP and not in Mainland China -> RegionIntl (covers HK, MO, TW and rest of world)
	return buildLocationResult(clientIP, srcHeader, RegionIntl, false)
}

func buildLocationResult(ip string, src string, region string, simulated bool) IPLocationResult {
	label := "中国大陆"
	if region == RegionIntl {
		label = "海外及港澳台"
	}
	return IPLocationResult{
		ClientIP:     ip,
		SourceHeader: src,
		Region:       region,
		RegionLabel:  label,
		IsSimulated:  simulated,
	}
}
