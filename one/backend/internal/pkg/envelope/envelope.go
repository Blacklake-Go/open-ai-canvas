package envelope

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
)

type Format string

const (
	FormatAdminOKMeta          Format = "admin_ok_meta_envelope"
	FormatDirectDomainJSON     Format = "direct_domain_json"
	FormatSuccessFlaggedJSON   Format = "success_flagged_json"
	FormatUpstreamProxy        Format = "upstream_proxy_passthrough"
	FormatSSEEventStream       Format = "sse_event_stream"
	FormatBinaryRedirectOrText Format = "binary_redirect_xml_or_callback"
)

var AllFormats = []Format{
	FormatAdminOKMeta,
	FormatDirectDomainJSON,
	FormatSuccessFlaggedJSON,
	FormatUpstreamProxy,
	FormatSSEEventStream,
	FormatBinaryRedirectOrText,
}

func IsValidFormat(f Format) bool {
	for _, valid := range AllFormats {
		if f == valid {
			return true
		}
	}
	return false
}

func NewRequestID(r *http.Request) string {
	if r != nil {
		if id := r.Header.Get("X-Request-Id"); id != "" {
			return id
		}
	}
	var b [8]byte
	_, _ = rand.Read(b[:])
	return "req_" + hex.EncodeToString(b[:])
}

func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// AdminOK writes `{ ok: true, data, meta: { requestId, ... } }`.
func AdminOK(w http.ResponseWriter, status int, data any, requestID string, extraMeta map[string]any) {
	if requestID == "" {
		requestID = NewRequestID(nil)
	}
	meta := map[string]any{"requestId": requestID}
	for k, v := range extraMeta {
		meta[k] = v
	}
	WriteJSON(w, status, map[string]any{
		"ok":   true,
		"data": data,
		"meta": meta,
	})
}

// AdminError writes `{ ok: false, error: { code, message }, meta: { requestId } }`.
func AdminError(w http.ResponseWriter, status int, code, message, requestID string) {
	if requestID == "" {
		requestID = NewRequestID(nil)
	}
	WriteJSON(w, status, map[string]any{
		"ok": false,
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
		"meta": map[string]any{
			"requestId": requestID,
		},
	})
}

// DomainJSON writes direct domain JSON without an outer wrapper envelope.
func DomainJSON(w http.ResponseWriter, status int, payload any) {
	WriteJSON(w, status, payload)
}

// DomainError writes `{ error, code? }` matching Supdance Pro non-admin API routes.
func DomainError(w http.ResponseWriter, status int, errMsg string, code string) {
	body := map[string]any{"error": errMsg}
	if code != "" {
		body["code"] = code
	}
	WriteJSON(w, status, body)
}

// SuccessJSON writes `{ success: true, ...fields }`.
func SuccessJSON(w http.ResponseWriter, status int, fields map[string]any) {
	out := make(map[string]any, len(fields)+1)
	for k, v := range fields {
		out[k] = v
	}
	out["success"] = true
	WriteJSON(w, status, out)
}

// SetSSEHeaders sets exact SSE headers from app/api/generations/events/route.js.
func SetSSEHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
}

// WriteErrorByFormat formats a boundary/stub error according to the route's contract.
func WriteErrorByFormat(w http.ResponseWriter, r *http.Request, format Format, status int, code, message string) {
	switch format {
	case FormatAdminOKMeta:
		AdminError(w, status, code, message, NewRequestID(r))
	case FormatSSEEventStream:
		http.Error(w, message, status)
	case FormatBinaryRedirectOrText:
		http.Error(w, message, status)
	default:
		DomainError(w, status, message, code)
	}
}
