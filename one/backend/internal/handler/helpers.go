package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"

	"one/backend/internal/domain/auth"
	"one/backend/internal/domain/billing"
	"one/backend/internal/domain/finance"
	"one/backend/internal/domain/user"
	"one/backend/internal/pkg/envelope"
)

func clientIP(r *http.Request) string {
	if r == nil {
		return "127.0.0.1"
	}
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		if idx := strings.IndexByte(xff, ','); idx >= 0 {
			xff = strings.TrimSpace(xff[:idx])
		}
		if xff != "" {
			return xff
		}
	}
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		return xri
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "127.0.0.1"
}

func requestOrigin(r *http.Request) string {
	if r == nil {
		return ""
	}
	if o := strings.TrimSpace(r.Header.Get("Origin")); o != "" {
		return o
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	if r.Host != "" {
		return scheme + "://" + r.Host
	}
	return ""
}

func readBodyLimit(r *http.Request, maxBytes int64) ([]byte, error) {
	if r == nil || r.Body == nil {
		return nil, nil
	}
	defer r.Body.Close()
	return io.ReadAll(io.LimitReader(r.Body, maxBytes+1))
}

func decodeJSONBody(w http.ResponseWriter, r *http.Request, maxBytes int64, dst any) bool {
	if maxBytes <= 0 {
		maxBytes = 64 * 1024
	}
	raw, err := readBodyLimit(r, maxBytes)
	if err != nil {
		envelope.DomainError(w, http.StatusBadRequest, "请求体读取失败", "INVALID_BODY")
		return false
	}
	if int64(len(raw)) > maxBytes {
		envelope.DomainError(w, http.StatusRequestEntityTooLarge, "请求体过大", "PAYLOAD_TOO_LARGE")
		return false
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return true
	}
	if err := json.Unmarshal(raw, dst); err != nil {
		envelope.DomainError(w, http.StatusBadRequest, "无效的 JSON 请求格式", "INVALID_JSON")
		return false
	}
	return true
}

func writeDomainError(w http.ResponseWriter, err error, fallbackMsg string) {
	if err == nil {
		return
	}
	var ae *auth.ServiceError
	if errors.As(err, &ae) {
		if ae.RetryAfter > 0 {
			w.Header().Set("Retry-After", strconv.Itoa(ae.RetryAfter))
		}
		envelope.DomainError(w, ae.Status, ae.Message, ae.Code)
		return
	}
	var ue *user.ServiceError
	if errors.As(err, &ue) {
		if ue.RetryAfter > 0 {
			w.Header().Set("Retry-After", strconv.Itoa(ue.RetryAfter))
		}
		envelope.DomainError(w, ue.Status, ue.Message, ue.Code)
		return
	}
	var fe *finance.ServiceError
	if errors.As(err, &fe) {
		if fe.RetryAfter > 0 {
			w.Header().Set("Retry-After", strconv.Itoa(fe.RetryAfter))
		}
		envelope.DomainError(w, fe.Status, fe.Message, fe.Code)
		return
	}
	var be *billing.ServiceError
	if errors.As(err, &be) {
		if be.RetryAfter > 0 {
			w.Header().Set("Retry-After", strconv.Itoa(be.RetryAfter))
		}
		envelope.DomainError(w, be.Status, be.Message, be.Code)
		return
	}
	envelope.DomainError(w, http.StatusInternalServerError, fallbackMsg, "INTERNAL_ERROR")
}

func strPtrVal(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
