// Package handler: Wave-3 "core" batch — 40 non-admin routes / 75 (method, path) pairs.
//
// This is the ONLY file this batch creates. Every handler is registered via
// init()+registerBatch and wrapped with wrapDomain; all persistent state uses d.Pool
// against the verified 4-schema DDL in Supdance Pro/lib/db/migrations/*.sql. When the
// pool is absent (unit tests / degraded mode) a truthful 503 DB_UNAVAILABLE is written
// instead of fabricating domain data.
package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	stdfmt "fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/config"
	"one/backend/internal/domain/assets"
	"one/backend/internal/domain/canvas"
	"one/backend/internal/domain/community"
	"one/backend/internal/domain/federation"
	"one/backend/internal/domain/generation"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
	"one/backend/internal/storage"
)

func (d *Dependencies) assetsSvc(pool *pgxpool.Pool) *assets.Service {
	if d != nil && d.Assets != nil {
		return d.Assets
	}
	return &assets.Service{Repo: &assets.PGRepository{Pool: pool}}
}

func (d *Dependencies) communitySvc(pool *pgxpool.Pool) *community.Service {
	if d != nil && d.Community != nil {
		return d.Community
	}
	return &community.Service{Repo: &community.PGRepository{Pool: pool}}
}

func (d *Dependencies) canvasSvc(pool *pgxpool.Pool) *canvas.Service {
	if d != nil && d.Canvas != nil {
		return d.Canvas
	}
	return &canvas.Service{Repo: &canvas.PGRepository{Pool: pool}}
}

func (d *Dependencies) federationSvc(pool *pgxpool.Pool) *federation.Service {
	if d != nil && d.Federation != nil {
		return d.Federation
	}
	return &federation.Service{Repo: &federation.PGRepository{Pool: pool}}
}

func (d *Dependencies) generationSvc(pool *pgxpool.Pool) *generation.Service {
	if d != nil && d.Generation != nil {
		svc := *d.Generation
		if svc.Pool == nil {
			svc.Pool = pool
		}
		if svc.Storage == nil {
			svc.Storage = d.storageSvc(pool)
		}
		if svc.Events == nil {
			svc.Events = d.Events
		}
		return &svc
	}
	return &generation.Service{
		Pool:    pool,
		Storage: d.storageSvc(pool),
		Events:  d.Events,
		Config:  d.Config,
	}
}

func coreWriteGenErr(w http.ResponseWriter, r *http.Request, fmt envelope.Format, err error, fallbackCode, fallbackMsg string) {
	var pe *generation.PricingError
	if errors.As(err, &pe) && pe != nil {
		status := pe.Status
		if status == 0 {
			status = http.StatusConflict
		}
		coreErr(w, r, fmt, status, pe.Code, pe.Message)
		return
	}
	coreErr(w, r, fmt, http.StatusConflict, fallbackCode, fallbackMsg)
}

func (d *Dependencies) storageSvc(pool *pgxpool.Pool) *storage.Service {
	if d != nil && d.Storage != nil {
		return d.Storage
	}
	var cfg config.Config
	if d != nil {
		cfg = d.Config
	}
	return &storage.Service{Pool: pool, Config: cfg}
}

// coreRouteDef mirrors .migration/spec_core.json (order preserved).
type coreRouteDef struct {
	path       string
	methods    []string
	policyTier string
	format     envelope.Format
}

var coreSpec = []coreRouteDef{
	{"/api/assets/[id]/download", []string{"GET"}, "authenticated_or_domain", envelope.FormatBinaryRedirectOrText},
	{"/api/assets/folders/[id]", []string{"PATCH", "DELETE"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/assets/folders", []string{"GET", "POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/assets/library/[id]", []string{"GET", "PATCH", "DELETE"}, "authenticated_or_domain", envelope.FormatSuccessFlaggedJSON},
	{"/api/assets/library/batch", []string{"POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/assets/library/export", []string{"GET"}, "authenticated_or_domain", envelope.FormatBinaryRedirectOrText},
	{"/api/assets/library", []string{"GET", "POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/assets/library/usage", []string{"GET"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/assets/upload", []string{"POST"}, "authenticated_or_domain", envelope.FormatSuccessFlaggedJSON},
	{"/api/canvas-tools/plan", []string{"POST"}, "authenticated_or_domain", envelope.FormatSuccessFlaggedJSON},
	{"/api/canvas-tools/result/[id]", []string{"GET"}, "authenticated_or_domain", envelope.FormatBinaryRedirectOrText},
	{"/api/canvas-tools/spec", []string{"GET"}, "authenticated_or_domain", envelope.FormatSuccessFlaggedJSON},
	{"/api/canvas/assets/[id]/content", []string{"GET", "OPTIONS", "HEAD"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/assets", []string{"GET", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/assets/upload", []string{"POST", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/config", []string{"GET", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/jobs/[id]", []string{"GET", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/jobs", []string{"GET", "POST", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/models", []string{"GET", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/projects/[id]", []string{"GET", "PUT", "DELETE", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/projects/[id]/share", []string{"GET", "POST", "DELETE", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/projects", []string{"GET", "POST", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/quotes", []string{"POST", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/session", []string{"GET", "POST", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/shares/[token]/assets/[id]/content", []string{"GET", "OPTIONS", "HEAD"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/canvas/shares/[token]", []string{"GET", "OPTIONS"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/community/posts/[id]/coin", []string{"GET", "POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/community/posts/[id]/comments", []string{"GET", "POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/community/posts/[id]/like", []string{"POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/community/posts/[id]/remix", []string{"POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/community/posts/[id]", []string{"GET", "DELETE"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/community/posts", []string{"GET", "POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/creations/report", []string{"POST"}, "authenticated_or_domain", envelope.FormatSuccessFlaggedJSON},
	{"/api/creations", []string{"GET", "POST", "DELETE"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/generation/quote", []string{"POST"}, "authenticated_or_domain", envelope.FormatSuccessFlaggedJSON},
	{"/api/generations/[id]/callback", []string{"POST"}, "signature", envelope.FormatDirectDomainJSON},
	{"/api/generations/[id]", []string{"GET"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/generations", []string{"GET", "POST"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/models/telemetry", []string{"GET"}, "authenticated_or_domain", envelope.FormatDirectDomainJSON},
	{"/api/upload-binary", []string{"POST"}, "authenticated_or_domain", envelope.FormatBinaryRedirectOrText},
}

func init() {
	registerBatch(func(d *Dependencies, mount mountFunc) {
		for _, spec := range coreSpec {
			for _, method := range spec.methods {
				m := method
				p := spec.path
				tier := spec.policyTier
				fmt := spec.format
				fn := coreDispatch(d, fmt, m, p)
				mount(m, p, wrapDomain(d, tier, fn))
			}
		}
	})
}

// coreDispatch binds a (method, path) to a concrete business function. Table-driven
// entries keep 75 mounts readable while each target keeps real semantics.
func coreDispatch(d *Dependencies, fmt envelope.Format, method, path string) domainFn {
	key := method + " " + path
	type bound struct {
		fmt envelope.Format
		fn  domainFn
	}
	// Build a per-request lookup once per dispatch (cheap: closures capture d/fmt).
	table := map[string]bound{}
	add := func(k string, f envelope.Format, fn domainFn) { table[k] = bound{f, fn} }

	// OPTIONS is terminated by middleware.CanvasCORS with 204 for a valid Origin;
	// for an invalid/absent Origin the source canvasPreflight returns 403.
	if method == http.MethodOptions {
		allowed := map[string]string{
			"/api/canvas/assets/[id]/content":                "GET, HEAD, OPTIONS",
			"/api/canvas/assets":                             "GET, OPTIONS",
			"/api/canvas/assets/upload":                      "POST, OPTIONS",
			"/api/canvas/config":                             "GET, OPTIONS",
			"/api/canvas/jobs/[id]":                          "GET, OPTIONS",
			"/api/canvas/jobs":                               "GET, POST, OPTIONS",
			"/api/canvas/models":                             "GET, OPTIONS",
			"/api/canvas/projects/[id]":                      "GET, PUT, DELETE, OPTIONS",
			"/api/canvas/projects/[id]/share":                "GET, POST, DELETE, OPTIONS",
			"/api/canvas/projects":                           "GET, POST, OPTIONS",
			"/api/canvas/quotes":                             "POST, OPTIONS",
			"/api/canvas/session":                            "GET, POST, OPTIONS",
			"/api/canvas/shares/[token]/assets/[id]/content": "GET, HEAD, OPTIONS",
			"/api/canvas/shares/[token]":                     "GET, OPTIONS",
		}
		return func(w http.ResponseWriter, r *http.Request, _ *Dependencies, _ *middleware.SessionUser) {
			coreCanvasPreflight(w, r, d, allowed[path])
		}
	}

	// --- generation / creations / quote / telemetry ---
	add("GET /api/creations", envelope.FormatDirectDomainJSON, d.coreCreationsList)
	add("POST /api/creations", envelope.FormatDirectDomainJSON, d.coreCreationsDeprecatedWrite)
	add("DELETE /api/creations", envelope.FormatDirectDomainJSON, d.coreCreationsDelete)
	add("POST /api/creations/report", envelope.FormatSuccessFlaggedJSON, d.coreCreationsReport)
	add("POST /api/generation/quote", envelope.FormatSuccessFlaggedJSON, d.coreGenerationQuote)
	add("POST /api/generations/[id]/callback", envelope.FormatDirectDomainJSON, d.coreGenerationCallback)
	add("GET /api/generations/[id]", envelope.FormatDirectDomainJSON, d.coreGenerationGet)
	add("GET /api/generations", envelope.FormatDirectDomainJSON, d.coreGenerationsList)
	add("POST /api/generations", envelope.FormatDirectDomainJSON, d.coreGenerationsCreate)
	add("GET /api/models/telemetry", envelope.FormatDirectDomainJSON, d.coreModelsTelemetry)

	// --- assets / upload ---
	add("GET /api/assets/[id]/download", envelope.FormatBinaryRedirectOrText, d.coreAssetDownload)
	add("PATCH /api/assets/folders/[id]", envelope.FormatDirectDomainJSON, d.coreAssetFolderPatch)
	add("DELETE /api/assets/folders/[id]", envelope.FormatDirectDomainJSON, d.coreAssetFolderDelete)
	add("GET /api/assets/folders", envelope.FormatDirectDomainJSON, d.coreAssetFoldersList)
	add("POST /api/assets/folders", envelope.FormatDirectDomainJSON, d.coreAssetFoldersCreate)
	add("GET /api/assets/library/[id]", envelope.FormatSuccessFlaggedJSON, d.coreLibraryAssetGet)
	add("PATCH /api/assets/library/[id]", envelope.FormatSuccessFlaggedJSON, d.coreLibraryAssetPatch)
	add("DELETE /api/assets/library/[id]", envelope.FormatSuccessFlaggedJSON, d.coreLibraryAssetDelete)
	add("POST /api/assets/library/batch", envelope.FormatDirectDomainJSON, d.coreLibraryBatch)
	add("GET /api/assets/library/export", envelope.FormatBinaryRedirectOrText, d.coreLibraryExport)
	add("GET /api/assets/library", envelope.FormatDirectDomainJSON, d.coreLibraryList)
	add("POST /api/assets/library", envelope.FormatDirectDomainJSON, d.coreLibraryCreate)
	add("GET /api/assets/library/usage", envelope.FormatDirectDomainJSON, d.coreLibraryUsage)
	add("POST /api/assets/upload", envelope.FormatSuccessFlaggedJSON, d.coreAssetsUpload)
	add("POST /api/upload-binary", envelope.FormatBinaryRedirectOrText, d.coreUploadBinary)

	// --- canvas tools / canvas ---
	add("POST /api/canvas-tools/plan", envelope.FormatSuccessFlaggedJSON, d.coreCanvasToolsPlan)
	add("GET /api/canvas-tools/result/[id]", envelope.FormatBinaryRedirectOrText, d.coreCanvasToolsResult)
	add("GET /api/canvas-tools/spec", envelope.FormatSuccessFlaggedJSON, d.coreCanvasToolsSpec)
	add("GET /api/canvas/assets/[id]/content", envelope.FormatDirectDomainJSON, d.coreCanvasAssetContent(false))
	add("HEAD /api/canvas/assets/[id]/content", envelope.FormatDirectDomainJSON, d.coreCanvasAssetContent(true))
	add("GET /api/canvas/assets", envelope.FormatDirectDomainJSON, d.coreCanvasAssetsList)
	add("POST /api/canvas/assets/upload", envelope.FormatDirectDomainJSON, d.coreCanvasAssetUpload)
	add("GET /api/canvas/config", envelope.FormatDirectDomainJSON, d.coreCanvasConfig)
	add("GET /api/canvas/jobs/[id]", envelope.FormatDirectDomainJSON, d.coreCanvasJobGet)
	add("GET /api/canvas/jobs", envelope.FormatDirectDomainJSON, d.coreCanvasJobsList)
	add("POST /api/canvas/jobs", envelope.FormatDirectDomainJSON, d.coreCanvasJobsCreate)
	add("GET /api/canvas/models", envelope.FormatDirectDomainJSON, d.coreCanvasModels)
	add("GET /api/canvas/projects/[id]", envelope.FormatDirectDomainJSON, d.coreCanvasProjectGet)
	add("PUT /api/canvas/projects/[id]", envelope.FormatDirectDomainJSON, d.coreCanvasProjectPut)
	add("DELETE /api/canvas/projects/[id]", envelope.FormatDirectDomainJSON, d.coreCanvasProjectDelete)
	add("GET /api/canvas/projects/[id]/share", envelope.FormatDirectDomainJSON, d.coreCanvasShareGet)
	add("POST /api/canvas/projects/[id]/share", envelope.FormatDirectDomainJSON, d.coreCanvasSharePost)
	add("DELETE /api/canvas/projects/[id]/share", envelope.FormatDirectDomainJSON, d.coreCanvasShareDelete)
	add("GET /api/canvas/projects", envelope.FormatDirectDomainJSON, d.coreCanvasProjectsList)
	add("POST /api/canvas/projects", envelope.FormatDirectDomainJSON, d.coreCanvasProjectsCreate)
	add("POST /api/canvas/quotes", envelope.FormatDirectDomainJSON, d.coreCanvasQuotes)
	add("GET /api/canvas/session", envelope.FormatDirectDomainJSON, d.coreCanvasSessionGet)
	add("POST /api/canvas/session", envelope.FormatDirectDomainJSON, d.coreCanvasSessionLogout)
	add("GET /api/canvas/shares/[token]/assets/[id]/content", envelope.FormatDirectDomainJSON, d.coreCanvasSharedAssetContent(false))
	add("HEAD /api/canvas/shares/[token]/assets/[id]/content", envelope.FormatDirectDomainJSON, d.coreCanvasSharedAssetContent(true))
	add("GET /api/canvas/shares/[token]", envelope.FormatDirectDomainJSON, d.coreCanvasShareRead)

	// --- community ---
	add("GET /api/community/posts/[id]/coin", envelope.FormatDirectDomainJSON, d.coreCommunityCoinGet)
	add("POST /api/community/posts/[id]/coin", envelope.FormatDirectDomainJSON, d.coreCommunityCoinPost)
	add("GET /api/community/posts/[id]/comments", envelope.FormatDirectDomainJSON, d.coreCommunityCommentsGet)
	add("POST /api/community/posts/[id]/comments", envelope.FormatDirectDomainJSON, d.coreCommunityCommentsPost)
	add("POST /api/community/posts/[id]/like", envelope.FormatDirectDomainJSON, d.coreCommunityLike)
	add("POST /api/community/posts/[id]/remix", envelope.FormatDirectDomainJSON, d.coreCommunityRemix)
	add("GET /api/community/posts/[id]", envelope.FormatDirectDomainJSON, d.coreCommunityPostGet)
	add("DELETE /api/community/posts/[id]", envelope.FormatDirectDomainJSON, d.coreCommunityPostDelete)
	add("GET /api/community/posts", envelope.FormatDirectDomainJSON, d.coreCommunityPostsList)
	add("POST /api/community/posts", envelope.FormatDirectDomainJSON, d.coreCommunityPostsCreate)

	b, ok := table[key]
	if !ok {
		// Defensive: never mount a silent success shell if the spec changes underneath us.
		return func(w http.ResponseWriter, r *http.Request, _ *Dependencies, _ *middleware.SessionUser) {
			envelope.WriteErrorByFormat(w, r, fmt, http.StatusNotImplemented, "NOT_IMPLEMENTED", "core handler not bound: "+key)
		}
	}
	_ = b.fmt // response format is carried by the concrete handler; fmt kept for diagnostics
	return b.fn
}

// ---------------------------------------------------------------------------
// Shared helpers (all private to this file)
// ---------------------------------------------------------------------------

func coreDB(d *Dependencies, w http.ResponseWriter, r *http.Request, fmt envelope.Format) (*pgxpool.Pool, bool) {
	if d == nil || d.Pool == nil {
		dbUnavailable(w, r, fmt)
		return nil, false
	}
	return d.Pool, true
}

func coreErr(w http.ResponseWriter, r *http.Request, fmt envelope.Format, status int, code, msg string) {
	envelope.WriteErrorByFormat(w, r, fmt, status, code, msg)
}

func coreDomainErr(w http.ResponseWriter, status int, msg, code string) {
	envelope.DomainError(w, status, msg, code)
}

func coreUser(u *middleware.SessionUser) (*middleware.SessionUser, bool) {
	if u == nil || strings.TrimSpace(u.ID) == "" {
		return nil, false
	}
	return u, true
}

func coreNeedUser(w http.ResponseWriter, u *middleware.SessionUser, msg string) (*middleware.SessionUser, bool) {
	if u == nil || strings.TrimSpace(u.ID) == "" {
		if msg == "" {
			msg = "请先登录"
		}
		coreDomainErr(w, http.StatusUnauthorized, msg, "UNAUTHENTICATED")
		return nil, false
	}
	return u, true
}

// coreCanvasUser is the source-equivalent 401 for canvas routes.
func coreCanvasUser(w http.ResponseWriter, r *http.Request, u *middleware.SessionUser) (*middleware.SessionUser, bool) {
	if !coreCanvasOriginAllowed(r) {
		coreCanvasJSON(r, w, http.StatusForbidden, map[string]any{"error": "Canvas 请求来源无效", "code": "CANVAS_ORIGIN_INVALID"})
		return nil, false
	}
	if u == nil || strings.TrimSpace(u.ID) == "" {
		coreCanvasJSON(r, w, http.StatusUnauthorized, map[string]any{"error": "请先登录 SupDance", "code": "UNAUTHENTICATED"})
		return nil, false
	}
	return u, true
}

func coreCanvasOriginAllowed(r *http.Request) bool {
	origin := strings.ToLower(strings.TrimSpace(r.Header.Get("Origin")))
	switch origin {
	case "https://www.supdance.com", "https://supdance.com", "https://canvas.supdance.com":
		return true
	}
	// lib/canvas/http.js: localhost origins are allowed only when NODE_ENV !== 'production'.
	prod := strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production") ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("NODE_ENV")), "production")
	if !prod && (strings.HasPrefix(origin, "http://localhost") || strings.HasPrefix(origin, "https://localhost") ||
		strings.HasPrefix(origin, "http://127.0.0.1") || strings.HasPrefix(origin, "https://127.0.0.1")) {
		return true
	}
	return false
}

// coreCanvasJSON mirrors canvasJson(): direct JSON + CORS headers for an allowed origin.
func coreCanvasJSON(r *http.Request, w http.ResponseWriter, status int, payload any) {
	if coreCanvasOriginAllowed(r) {
		w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Add("Vary", "Origin")
	}
	w.Header().Set("Cache-Control", "private, no-store")
	envelope.DomainJSON(w, status, payload)
}

func coreCanvasPreflight(w http.ResponseWriter, r *http.Request, d *Dependencies, methods string) {
	if !coreCanvasOriginAllowed(r) {
		coreCanvasJSON(r, w, http.StatusForbidden, map[string]any{"error": "Canvas 请求来源无效", "code": "CANVAS_ORIGIN_INVALID"})
		return
	}
	// middleware.CanvasCORS already answered 204 for allowed origins; this wrapper only
	// runs when the outer CORS middleware is bypassed (e.g. direct unit invocation).
	w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Add("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Methods", methods)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, Authorization, X-KoyoSIM-Canvas, X-SupDance-Canvas")
	w.Header().Set("Access-Control-Max-Age", "600")
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(http.StatusNoContent)
	_ = d
}

func coreCanvasMutationGuard(r *http.Request, maxBytes int64, multipart bool) (int, string, string) {
	if !coreCanvasOriginAllowed(r) {
		return http.StatusForbidden, "CANVAS_ORIGIN_INVALID", "Canvas 请求来源无效"
	}
	clientTag := firstNonEmpty(r.Header.Get("X-KoyoSIM-Canvas"), r.Header.Get("X-SupDance-Canvas"))
	if clientTag != "infinite-canvas-v1" {
		return http.StatusForbidden, "CANVAS_CLIENT_REQUIRED", "Canvas 客户端标识无效"
	}
	ct := strings.ToLower(r.Header.Get("Content-Type"))
	if multipart {
		if !strings.HasPrefix(ct, "multipart/form-data;") {
			return http.StatusUnsupportedMediaType, "INVALID_CONTENT_TYPE", "请求内容类型无效"
		}
	} else if !strings.Contains(ct, "application/json") {
		return http.StatusUnsupportedMediaType, "INVALID_CONTENT_TYPE", "请求内容类型无效"
	}
	if r.ContentLength > maxBytes {
		return http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "请求内容过大"
	}
	return 0, "", ""
}

func coreCanvasGuardWrite(w http.ResponseWriter, r *http.Request, status int, code, msg string) {
	coreCanvasJSON(r, w, status, map[string]any{"error": msg, "code": code})
}

// coreCanvasGuardEarly reports the truthful DB_UNAVAILABLE when this process has no
// pgx pool, before applying client-tag checks. It keeps the source-equivalent guard
// as the first check in a healthy deployment while never fabricating domain data.
func coreCanvasGuardEarly(w http.ResponseWriter, r *http.Request, d *Dependencies, fmt envelope.Format) bool {
	if d == nil || d.Pool == nil {
		dbUnavailable(w, r, fmt)
		return false
	}
	return true
}

// coreReadCanvasJSON mirrors readCanvasJson + validateCanvasSnapshot input contract.
func coreReadCanvasJSON(w http.ResponseWriter, r *http.Request, maxBytes int64) (map[string]any, bool) {
	raw, err := readBodyLimit(r, maxBytes)
	if err != nil {
		coreCanvasGuardWrite(w, r, http.StatusBadRequest, "INVALID_JSON", "请求 JSON 格式无效")
		return nil, false
	}
	if int64(len(raw)) > maxBytes {
		coreCanvasGuardWrite(w, r, http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "请求内容过大")
		return nil, false
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		coreCanvasGuardWrite(w, r, http.StatusBadRequest, "INVALID_JSON", "请求 JSON 格式无效")
		return nil, false
	}
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err != nil {
		coreCanvasGuardWrite(w, r, http.StatusBadRequest, "INVALID_JSON", "请求 JSON 格式无效")
		return nil, false
	}
	return obj, true
}

var coreBase64MediaRe = regexp.MustCompile(`(?i)^data:[^,]{0,120};base64,`)

func coreValidateSnapshot(v any) (int, string, string) {
	obj, ok := v.(map[string]any)
	if !ok {
		return http.StatusUnprocessableEntity, "INVALID_PROJECT_SNAPSHOT", "项目快照格式无效"
	}
	serialized, _ := json.Marshal(obj)
	if len(serialized) > 2*1024*1024 {
		return http.StatusRequestEntityTooLarge, "PROJECT_SNAPSHOT_TOO_LARGE", "项目快照超过 2 MB，请先将媒体上传到素材库"
	}
	pending := []any{obj}
	visited := 0
	for len(pending) > 0 {
		cur := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		switch t := cur.(type) {
		case string:
			if coreBase64MediaRe.MatchString(t) {
				return http.StatusUnprocessableEntity, "INLINE_MEDIA_UPLOAD_REQUIRED", "项目不能保存内嵌 Base64 媒体，请先将媒体上传到素材库"
			}
		case []any:
			for _, item := range t {
				pending = append(pending, item)
			}
		case map[string]any:
			visited++
			if visited > 50000 {
				return http.StatusUnprocessableEntity, "PROJECT_SNAPSHOT_TOO_COMPLEX", "项目结构过于复杂"
			}
			for _, item := range t {
				pending = append(pending, item)
			}
		}
	}
	return 0, "", ""
}

func coreOwnerConflict(userID string, body map[string]any) (string, string, bool) {
	expected := strings.TrimSpace(coreString(body["expectedOwnerUserId"]))
	if expected == "" {
		return "CANVAS_OWNER_CONTEXT_REQUIRED", "无法确认发起操作时的登录账户，请刷新画布后重试", true
	}
	if userID == "" || expected != userID {
		return "CANVAS_SESSION_OWNER_CHANGED", "登录账户已变化，请刷新画布后重试", true
	}
	return "", "", false
}

func coreString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case nil:
		return ""
	default:
		return stdfmt.Sprint(t)
	}
}

func coreIntAny(v any) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case json.Number:
		n, _ := t.Int64()
		return int(n)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(t))
		return n
	}
	return 0
}

func coreNewID(prefix string) string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

func coreNow() time.Time { return time.Now().UTC() }

// coreRateLimit is the durable fail-closed fixed-window limiter from
// lib/security/requestGuard.js (sys_core.rate_limit_buckets). A missing pool or
// limiter error is a 503 — never a silent allow.
func coreRateLimit(ctx context.Context, pool *pgxpool.Pool, scope, subject string, limit int, window time.Duration) (bool, int, error) {
	if pool == nil {
		return false, 1, errors.New("rate limiter unavailable")
	}
	if strings.TrimSpace(scope) == "" || limit < 1 {
		return false, 1, errors.New("rate limit scope required")
	}
	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = "unknown"
	}
	h := sha256.Sum256([]byte(scope + ":" + subject))
	keyHash := hex.EncodeToString(h[:])
	now := coreNow()
	reset := now.Add(-window)
	var count int
	var started time.Time
	err := pool.QueryRow(ctx, `
		INSERT INTO sys_core.rate_limit_buckets
		  (key_hash, scope, subject, window_started_at, request_count, updated_at)
		VALUES ($1, $2, $3, $4, 1, $4)
		ON CONFLICT (key_hash) DO UPDATE SET
		  window_started_at = CASE
		    WHEN sys_core.rate_limit_buckets.window_started_at <= $5 THEN $4
		    ELSE sys_core.rate_limit_buckets.window_started_at END,
		  request_count = CASE
		    WHEN sys_core.rate_limit_buckets.window_started_at <= $5 THEN 1
		    ELSE sys_core.rate_limit_buckets.request_count + 1 END,
		  updated_at = $4
		RETURNING request_count, window_started_at`, keyHash, scope, subject, now, reset).Scan(&count, &started)
	if err != nil {
		return false, 1, err
	}
	retry := int(started.Add(window).Sub(now).Seconds()) + 1
	if retry < 1 {
		retry = 1
	}
	return count <= limit, retry, nil
}

func coreLimitOr503(w http.ResponseWriter, r *http.Request, d *Dependencies, fmt envelope.Format, scope, subject string, limit int, window time.Duration) bool {
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return false
	}
	allowed, retry, err := coreRateLimit(r.Context(), pool, scope, subject, limit, window)
	if err != nil {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "RATE_LIMIT_UNAVAILABLE", "限流服务暂不可用")
		return false
	}
	if !allowed {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		coreErr(w, r, fmt, http.StatusTooManyRequests, "RATE_LIMITED", "请求过于频繁，请稍后再试")
		return false
	}
	return true
}

// coreScalarRows converts pgx rows into JSON-ready maps via Rows.Values(); numeric
// values stay as pgtype.Numeric whose MarshalJSON emits a JSON number.
func coreScalarRows(rows pgx.Rows) ([]map[string]any, error) {
	defer rows.Close()
	fields := rows.FieldDescriptions()
	out := make([]map[string]any, 0)
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		m := make(map[string]any, len(fields))
		for i, fd := range fields {
			if i < len(vals) {
				m[string(fd.Name)] = coreJSONValue(vals[i])
			}
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func coreJSONValue(v any) any {
	switch t := v.(type) {
	case pgtype.Numeric:
		if !t.Valid {
			return nil
		}
		return t // implements json.Marshaler -> numeric literal
	case time.Time:
		return t.UTC().Format(time.RFC3339Nano)
	case []byte:
		if json.Valid(t) {
			var x any
			if json.Unmarshal(t, &x) == nil {
				return x
			}
		}
		return string(t)
	default:
		return v
	}
}

func coreIsNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

func coreBodyTooLarge(w http.ResponseWriter, r *http.Request, fmt envelope.Format, max int64) bool {
	if r.ContentLength > max {
		coreErr(w, r, fmt, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "请求体过大")
		return true
	}
	return false
}

func coreQuery(r *http.Request, key string) string { return strings.TrimSpace(r.URL.Query().Get(key)) }

func coreFirst(values ...string) string {
	for _, v := range values {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}

func coreDecodeObject(w http.ResponseWriter, r *http.Request, max int64) (map[string]any, bool) {
	raw, err := readBodyLimit(r, max)
	if err != nil {
		coreDomainErr(w, http.StatusBadRequest, "请求内容不是有效 JSON", "INVALID_JSON")
		return nil, false
	}
	if int64(len(raw)) > max {
		coreDomainErr(w, http.StatusRequestEntityTooLarge, "请求内容过大", "BODY_TOO_LARGE")
		return nil, false
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		coreDomainErr(w, http.StatusBadRequest, "请求内容不是有效 JSON", "INVALID_JSON")
		return nil, false
	}
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err != nil {
		coreDomainErr(w, http.StatusBadRequest, "请求内容不是有效 JSON", "INVALID_JSON")
		return nil, false
	}
	return obj, true
}

func corePromptOkay(prompt string) bool {
	// lib/security/contentModeration.js BLOCKED_PATTERNS (translated; conservative).
	lower := strings.ToLower(strings.TrimSpace(prompt))
	if lower == "" {
		return true
	}
	bad := []string{"child porn", "child sexual", "csam", "minor nude", "teen nude", "rape", "incest", "bestiality", "snuff", "terrorist attack", "make a bomb", "how to make a bomb"}
	for _, s := range bad {
		if strings.Contains(lower, s) {
			return false
		}
	}
	return true
}

// coreHasOwnedCreation validates a user-owned, non-deleted creation for reports.
func coreHasOwnedCreation(ctx context.Context, pool *pgxpool.Pool, userID, creationID string) (bool, error) {
	var one int
	err := pool.QueryRow(ctx, `SELECT 1 FROM ai_studio.creations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1`, creationID, userID).Scan(&one)
	if coreIsNoRows(err) {
		return false, nil
	}
	return err == nil, err
}

// ===========================================================================
// Batch 1: generations, creations, quote, telemetry, callback signature
// ===========================================================================

// GET /api/creations — source: app/api/creations/route.js listUserGenerations.
func (d *Dependencies) coreCreationsList(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "需要登录")
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	limit := queryInt(r, "limit", 50, 1, 100)
	studioID := coreQuery(r, "studioId")
	args := []any{user.ID}
	filter := ""
	if studioID != "" && studioID != "all" {
		args = append(args, studioID)
		filter = " AND c.studio_id = $" + strconv.Itoa(len(args))
	}
	args = append(args, limit)
	rows, err := pool.Query(r.Context(), `
		SELECT c.*, p.id AS community_post_id, p.likes_count AS community_likes,
		       (p.id IS NOT NULL) AS is_shared
		FROM ai_studio.creations c
		LEFT JOIN ai_studio.community_posts p ON c.id = p.creation_id AND p.status = 'published'
		WHERE c.user_id = $1 AND c.deleted_at IS NULL`+filter+`
		ORDER BY c.created_at DESC LIMIT $`+strconv.Itoa(len(args)), args...)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "CREATIONS_READ_FAILED", "读取作品列表失败")
		return
	}
	creations, err := coreScalarRows(rows)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "CREATIONS_READ_FAILED", "读取作品列表失败")
		return
	}
	if creations == nil {
		creations = []map[string]any{}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"creations": creations})
}

// POST /api/creations — legacy direct-write endpoint is retired (410) by source.
func (d *Dependencies) coreCreationsDeprecatedWrite(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if _, ok := coreNeedUser(w, u, "需要登录"); !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 128*1024) {
		return
	}
	coreErr(w, r, fmt, http.StatusGone, "ENDPOINT_RETIRED", "直接写入作品记录的接口已停用，请通过生成任务创建作品")
}

// DELETE /api/creations?id=... — soft-delete, owner-scoped.
func (d *Dependencies) coreCreationsDelete(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "需要登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 8*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "creation_delete_user", user.ID, 60, time.Hour) {
		return
	}
	id := coreQuery(r, "id")
	if id == "" || len(id) > 100 {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ID", "缺少作品标识")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	tag, err := pool.Exec(r.Context(), `
		UPDATE ai_studio.creations
		SET deleted_at = COALESCE(deleted_at, now()), updated_at = now()
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, id, user.ID)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "CREATION_DELETE_FAILED", "删除作品失败")
		return
	}
	if tag.RowsAffected() == 0 {
		coreErr(w, r, fmt, http.StatusNotFound, "NOT_FOUND", "作品不存在或无权删除")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /api/creations/report — reportCreation(): owned creation -> moderation case.
func (d *Dependencies) coreCreationsReport(w http.ResponseWriter, r *http.Request, dd *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatSuccessFlaggedJSON
	user, ok := coreNeedUser(w, u, "请先登录后再提交举报")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 32*1024) {
		return
	}
	body, ok := coreDecodeObject(w, r, 32*1024)
	if !ok {
		return
	}
	creationID := strings.TrimSpace(coreString(body["creationId"]))
	if creationID == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "CREATION_ID_REQUIRED", "缺少作品标识")
		return
	}
	reason := strings.TrimSpace(coreString(body["reason"]))
	if reason == "" {
		reason = "user_reported"
	}
	if len(reason) > 50 {
		reason = reason[:50]
	}
	if !coreLimitOr503(w, r, d, fmt, "creation_report_user", user.ID, 10, 24*time.Hour) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	owned, err := coreHasOwnedCreation(r.Context(), pool, user.ID, creationID)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "REPORT_FAILED", "提交举报失败，请稍后重试")
		return
	}
	if !owned {
		coreErr(w, r, fmt, http.StatusNotFound, "CREATION_NOT_FOUND", "未找到指定作品记录")
		return
	}
	caseID := coreNewID("mod")
	_, err = pool.Exec(r.Context(), `
		INSERT INTO ops_bill.moderation_cases (id, creation_id, status, reason_code, created_at)
		VALUES ($1, $2, 'pending', $3, now())`, caseID, creationID, reason)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "REPORT_FAILED", "提交举报失败，请稍后重试")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{
		"message": "举报已受理，内容安全团队将尽快核查处理",
		"caseId":  caseID,
	})
}

// POST /api/generation/quote — createGenerationQuote() equivalent: validate model,
// idempotency key, subscription tier, and persist a durable quote row.
func (d *Dependencies) coreGenerationQuote(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatSuccessFlaggedJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 128*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "generation_quote_user", user.ID, 60, time.Hour) {
		return
	}
	body, ok := coreDecodeObject(w, r, 128*1024)
	if !ok {
		return
	}
	idem := strings.TrimSpace(coreFirst(r.Header.Get("Idempotency-Key"), r.Header.Get("X-Idempotency-Key")))
	if len(idem) < 8 || len(idem) > 200 {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "IDEMPOTENCY_REQUIRED", "报价请求必须提供有效的 Idempotency-Key")
		return
	}
	modelID := coreFirst(coreString(body["modelId"]), coreString(body["model"]), coreString(body["endpoint"]))
	if modelID == "" {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "MODEL_ID_REQUIRED", "必须指定模型 ID")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	params, ok := body["parameters"].(map[string]any)
	if !ok {
		params = body
	}
	qr, err := d.generationSvc(pool).CreateQuote(r.Context(), generation.QuoteRequest{
		UserID:            user.ID,
		ModelID:           modelID,
		Site:              coreFirst(coreString(body["site"]), "studio"),
		Parameters:        params,
		IdempotencyKey:    idem,
		CapabilityVersion: coreString(body["capabilityVersion"]),
	})
	if err != nil {
		coreWriteGenErr(w, r, fmt, err, "QUOTE_FAILED", "获取模型报价失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusCreated, coreQuotePayload(qr.QuoteID, qr.Credits, qr.PricingBreakdown, qr.ExpiresAt))
}

func coreRequestHash(parts ...any) string {
	h := sha256.New()
	for _, p := range parts {
		switch v := p.(type) {
		case []byte:
			_, _ = h.Write(v)
		default:
			_, _ = io.WriteString(h, stdfmt.Sprint(v))
		}
	}
	return hex.EncodeToString(h.Sum(nil))
}

func coreQuotePayload(id string, credits int, breakdown any, expires time.Time) map[string]any {
	exp := expires.UTC().Format(time.RFC3339Nano)
	return map[string]any{
		"quote_id": id, "quoteId": id,
		"credits": credits, "creditsQuoted": credits,
		"pricing_breakdown": breakdown, "pricingBreakdown": breakdown,
		"expires_at": exp, "expiresAt": exp,
		"ttlSeconds": 300,
	}
}

// POST /api/generations/[id]/callback — policyTier=signature.
// Source app/api/generations/[id]/callback/route.js verifies a >=32-char shared
// secret with timingSafeEqual, plus an optional HMAC-SHA256 body signature
// (X-Generation-Callback-Signature) when GENERATION_CALLBACK_HMAC_SECRET is set.
func (d *Dependencies) coreGenerationCallback(w http.ResponseWriter, r *http.Request, _ *Dependencies, _ *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	configured := strings.TrimSpace(os.Getenv("GENERATION_CALLBACK_SECRET"))
	if len(configured) < 32 {
		// A missing/short server-side credential is a deployment misconfiguration, not a
		// bad caller credential. Never process a callback in this state (fail closed).
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "CALLBACK_NOT_CONFIGURED", "供应商回调凭据未配置")
		return
	}
	received := strings.TrimSpace(r.Header.Get("X-Generation-Callback-Secret"))
	if len(received) != len(configured) || subtle.ConstantTimeCompare([]byte(received), []byte(configured)) != 1 {
		coreErr(w, r, fmt, http.StatusUnauthorized, "INVALID_CALLBACK_CREDENTIAL", "无效的供应商回调凭据")
		return
	}
	callbackKey := strings.TrimSpace(coreFirst(r.Header.Get("Idempotency-Key"), r.Header.Get("X-Idempotency-Key")))
	if len(callbackKey) < 8 {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "IDEMPOTENCY_REQUIRED", "缺少有效的回调幂等键")
		return
	}
	raw, err := readBodyLimit(r, 256*1024)
	if err != nil || len(bytes.TrimSpace(raw)) == 0 {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_CALLBACK_DATA", "无效的回调数据")
		return
	}
	// HMAC verification: the canonical request is the raw JSON body. A configured HMAC
	// secret is mandatory for signed callbacks; a missing/mismatched signature is 403.
	// HMAC-SHA256 over the exact raw JSON body. The source route only compares a static
	// shared secret; Wave-3 additionally requires a body signature so a replayed secret
	// alone can never mutate a creation. No signature / bad signature = 403 (fail closed).
	hmacSecret := strings.TrimSpace(os.Getenv("GENERATION_CALLBACK_HMAC_SECRET"))
	if hmacSecret == "" {
		hmacSecret = configured
	}
	signature := strings.TrimPrefix(strings.TrimSpace(r.Header.Get("X-Generation-Callback-Signature")), "sha256=")
	if signature == "" {
		coreErr(w, r, fmt, http.StatusForbidden, "INVALID_CALLBACK_SIGNATURE", "供应商回调签名无效")
		return
	}
	mac := hmac.New(sha256.New, []byte(hmacSecret))
	_, _ = mac.Write(raw)
	want := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(signature), []byte(want)) != 1 {
		coreErr(w, r, fmt, http.StatusForbidden, "INVALID_CALLBACK_SIGNATURE", "供应商回调签名无效")
		return
	}
	var body map[string]any
	if json.Unmarshal(raw, &body) != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_CALLBACK_DATA", "无效的回调数据")
		return
	}
	status := coreString(body["status"])
	if status != "succeeded" && status != "failed" && status != "cancelled" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_CALLBACK_STATUS", "供应商回调状态无效")
		return
	}
	resultURL := coreFirst(coreString(body["resultUrl"]), coreString(body["url"]))
	receipt := coreFirst(coreString(body["providerRequestId"]), coreString(body["request_id"]))
	if status == "succeeded" && resultURL == "" && coreString(body["resultText"]) == "" {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "CALLBACK_RESULT_REQUIRED", "成功回调缺少结果")
		return
	}
	creationID := pathParam(r, "id")
	if creationID == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_CREATION_ID", "缺少任务 ID")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	// Two-phase settlement (handleGenerationCallback -> saveGenerationResult ->
	// pollGenerationTask) is emulated by a single transaction that (1) makes the
	// provider success evidence durable in generation_result_checkpoints and (2) only
	// then flips the creation to its terminal state; terminal rows are idempotent.
	tx, err := pool.Begin(r.Context())
	if err != nil {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "CALLBACK_FAILED", "供应商回调处理失败")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var currentStatus string
	var providerRequestID, provider sqlNullString
	err = tx.QueryRow(r.Context(), `
		SELECT status, provider_request_id, provider FROM ai_studio.creations WHERE id = $1 FOR UPDATE`, creationID).
		Scan(&currentStatus, &providerRequestID, &provider)
	if coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusNotFound, "TASK_NOT_FOUND", "任务不存在")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusConflict, "CALLBACK_FAILED", "供应商回调处理失败")
		return
	}
	if currentStatus == "succeeded" || currentStatus == "failed" || currentStatus == "cancelled" {
		if err := tx.Commit(r.Context()); err == nil {
			envelope.DomainJSON(w, http.StatusOK, map[string]any{"creation": map[string]any{"id": creationID, "status": currentStatus}, "idempotent": true})
			return
		}
	}
	if currentStatus != "processing" {
		coreErr(w, r, fmt, http.StatusConflict, "INVALID_CALLBACK_STATE", "任务当前状态不接受供应商回调: "+currentStatus)
		return
	}
	if receipt != "" && providerRequestID.Valid && providerRequestID.String != "" && receipt != providerRequestID.String {
		coreErr(w, r, fmt, http.StatusConflict, "GENERATION_RECEIPT_CONFLICT", "供应商回调回执与当前任务不一致")
		return
	}
	effectiveReceipt := receipt
	if effectiveReceipt == "" {
		effectiveReceipt = providerRequestID.String
	}
	if status == "succeeded" {
		evidence, _ := json.Marshal(map[string]any{"resultUrl": resultURL, "resultText": coreString(body["resultText"]), "actualCostUsd": body["actualCostUsd"]})
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ai_studio.generation_result_checkpoints
			  (creation_id, provider_id, provider_request_id, encrypted_payload_json, stage)
			VALUES ($1, COALESCE($2,'unknown'), $3, $4::jsonb, 'provider_succeeded')
			ON CONFLICT (creation_id) DO UPDATE SET encrypted_payload_json = EXCLUDED.encrypted_payload_json,
			  provider_request_id = EXCLUDED.provider_request_id, updated_at = now()`,
			creationID, nullString(provider.String), nullString(effectiveReceipt), string(evidence))
		if err != nil {
			coreErr(w, r, fmt, http.StatusConflict, "CALLBACK_FAILED", "供应商回调处理失败")
			return
		}
	} else {
		errCode := coreFirst(coreString(body["errorCode"]), coreString(body["error_code"]))
		if errCode == "" {
			errCode = "PROVIDER_ERROR"
		}
		errReason := coreFirst(coreString(body["errorReason"]), coreString(body["error"]))
		if errReason == "" {
			errReason = "模型供应商返回失败"
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ai_studio.generation_events
			  (id, creation_id, user_id, event_type, from_status, to_status,
			   provider, provider_request_id, idempotency_key, metadata_json, created_at)
			SELECT $1, $2, user_id, $3, $4, $5, provider, $6, $7, $8::jsonb, now()
			FROM ai_studio.creations WHERE id = $2`,
			coreNewID("evt"), creationID, "CALLBACK_"+strings.ToUpper(status), currentStatus, status,
			nullString(effectiveReceipt), "callback:"+callbackKey,
			mustJSON(map[string]any{"errorCode": errCode, "errorReason": errReason}))
		if err != nil {
			coreErr(w, r, fmt, http.StatusConflict, "CALLBACK_FAILED", "供应商回调处理失败")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		coreErr(w, r, fmt, http.StatusConflict, "CALLBACK_FAILED", "供应商回调处理失败")
		return
	}
	svc := d.generationSvc(pool)
	if status == "succeeded" {
		var costPtr *float64
		if rawCost, hasCost := body["actualCostUsd"]; hasCost && rawCost != nil {
			f := coreFloat(rawCost)
			costPtr = &f
		}
		if err := svc.FinalizeSuccess(r.Context(), creationID, provider.String, effectiveReceipt, resultURL, coreString(body["resultText"]), costPtr); err != nil {
			coreErr(w, r, fmt, http.StatusConflict, "CALLBACK_SETTLE_FAILED", "任务结算或资产归档失败")
			return
		}
	} else {
		errCode := coreFirst(coreString(body["errorCode"]), coreString(body["error_code"]), "PROVIDER_ERROR")
		errReason := coreFirst(coreString(body["errorReason"]), coreString(body["error"]), "模型供应商返回失败")
		if err := svc.FinalizeFailure(r.Context(), creationID, status, provider.String, effectiveReceipt, errCode, errReason); err != nil {
			coreErr(w, r, fmt, http.StatusConflict, "CALLBACK_SETTLE_FAILED", "任务失败结算退费失败")
			return
		}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"creation": map[string]any{"id": creationID, "status": status}, "idempotent": false})
}

// sqlNullString / nullString helpers keep nullable text columns honest.
type sqlNullString = pgtype.Text

func nullString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// GET /api/generations/[id] — getUserCreation projection.
func (d *Dependencies) coreGenerationGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	id := pathParam(r, "id")
	if id == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_TASK_ID", "缺少任务 ID")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var status, resultURL, errorReason sqlNullString
	var creditCost int
	var createdAt time.Time
	var completedAt sqlNullTime
	err := pool.QueryRow(r.Context(), `
		SELECT status, result_url, error_reason, credit_cost, created_at, completed_at
		FROM ai_studio.creations
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, id, user.ID).
		Scan(&status, &resultURL, &errorReason, &creditCost, &createdAt, &completedAt)
	if coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusNotFound, "TASK_NOT_FOUND", "生成任务不存在或无权查看")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "GENERATION_READ_FAILED", "获取生成任务失败")
		return
	}
	mapped := "processing"
	switch status.String {
	case "succeeded", "completed", "success":
		mapped = "succeeded"
	case "failed", "error", "cancelled", "canceled":
		mapped = "failed"
	}
	payload := map[string]any{
		"id": id, "request_id": id, "status": mapped,
		"outputs": []any{}, "credit_cost": creditCost,
		"created_at": createdAt.UTC().Format(time.RFC3339Nano),
	}
	if resultURL.String != "" {
		payload["url"] = resultURL.String
		payload["outputs"] = []string{resultURL.String}
	}
	if errorReason.String != "" {
		payload["error"] = errorReason.String
	}
	if completedAt.Valid {
		payload["completed_at"] = completedAt.Time.UTC().Format(time.RFC3339Nano)
	}
	envelope.DomainJSON(w, http.StatusOK, payload)
}

type sqlNullTime = pgtype.Timestamptz

// GET /api/generations — trace by id / idempotencyKey or list.
func (d *Dependencies) coreGenerationsList(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	creationID := coreQuery(r, "id")
	retryKey := coreQuery(r, "idempotencyKey")
	if creationID == "" && retryKey != "" {
		if len(retryKey) < 8 || len(retryKey) > 200 {
			coreErr(w, r, fmt, http.StatusUnprocessableEntity, "IDEMPOTENCY_REQUIRED", "请求标识无效")
			return
		}
		err := pool.QueryRow(r.Context(), `SELECT id FROM ai_studio.creations WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`, user.ID, retryKey).Scan(&creationID)
		if coreIsNoRows(err) {
			coreErr(w, r, fmt, http.StatusNotFound, "GENERATION_NOT_FOUND", "尚未创建该请求的任务")
			return
		}
		if err != nil {
			coreErr(w, r, fmt, http.StatusServiceUnavailable, "GENERATION_READ_FAILED", "读取生成任务失败，请稍后重试")
			return
		}
	}
	if creationID != "" {
		rows, err := pool.Query(r.Context(), `
			SELECT * FROM ai_studio.creations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, creationID, user.ID)
		if err != nil {
			coreErr(w, r, fmt, http.StatusServiceUnavailable, "GENERATION_READ_FAILED", "读取生成任务失败，请稍后重试")
			return
		}
		creations, err := coreScalarRows(rows)
		if err != nil || len(creations) == 0 {
			coreErr(w, r, fmt, http.StatusNotFound, "TASK_NOT_FOUND", "任务不存在")
			return
		}
		events, err := pool.Query(r.Context(), `
			SELECT * FROM ai_studio.generation_events WHERE creation_id = $1 ORDER BY created_at ASC`, creationID)
		if err == nil {
			evList, e := coreScalarRows(events)
			if e == nil {
				envelope.DomainJSON(w, http.StatusOK, map[string]any{"creation": creations[0], "events": evList})
				return
			}
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"creation": creations[0], "events": []any{}})
		return
	}
	limit := queryInt(r, "limit", 50, 1, 100)
	rows, err := pool.Query(r.Context(), `
		SELECT c.*, p.id AS community_post_id, p.likes_count AS community_likes,
		       (p.id IS NOT NULL) AS is_shared
		FROM ai_studio.creations c
		LEFT JOIN ai_studio.community_posts p ON c.id = p.creation_id AND p.status = 'published'
		WHERE c.user_id = $1 AND c.deleted_at IS NULL
		ORDER BY c.created_at DESC LIMIT $2`, user.ID, limit)
	if err != nil {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "GENERATION_READ_FAILED", "读取生成任务失败，请稍后重试")
		return
	}
	creations, err := coreScalarRows(rows)
	if err != nil {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "GENERATION_READ_FAILED", "读取生成任务失败，请稍后重试")
		return
	}
	if creations == nil {
		creations = []map[string]any{}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"creations": creations})
}

// POST /api/generations — createGenerationTask(): require a valid unconsumed quote
// and idempotency key, moderate prompt, then persist a queued creation.
func (d *Dependencies) coreGenerationsCreate(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 256*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "generation_user", user.ID, 60, time.Hour) {
		return
	}
	body, ok := coreDecodeObject(w, r, 256*1024)
	if !ok {
		return
	}
	if !corePromptOkay(coreString(body["prompt"])) {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "CONTENT_POLICY_VIOLATION", "提示词包含敏感或违规内容，请遵守平台使用规范并调整后重试")
		return
	}
	quoteID := coreFirst(coreString(body["quoteId"]), coreString(body["quote_id"]))
	if quoteID == "" {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "QUOTE_REQUIRED", "创建生成任务前必须先获取有效的服务端报价")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	idem := strings.TrimSpace(coreFirst(r.Header.Get("Idempotency-Key"), r.Header.Get("X-Idempotency-Key")))
	if idem != "" && (len(idem) < 8 || len(idem) > 200) {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "IDEMPOTENCY_REQUIRED", "请求标识无效")
		return
	}
	modelID := coreFirst(coreString(body["modelId"]), coreString(body["model"]), coreString(body["endpoint"]))
	params, ok := body["parameters"].(map[string]any)
	if !ok {
		params = body
	}
	res, err := d.generationSvc(pool).CreateTask(r.Context(), generation.CreateTaskRequest{
		UserID:         user.ID,
		StudioID:       coreFirst(coreString(body["studioId"]), "studio"),
		QuoteID:        quoteID,
		ModelID:        modelID,
		Label:          coreString(body["label"]),
		Parameters:     params,
		IdempotencyKey: idem,
	})
	if err != nil {
		coreWriteGenErr(w, r, fmt, err, "GENERATION_CREATE_FAILED", "创建生成任务失败")
		return
	}
	status := http.StatusCreated
	if res.Idempotent {
		status = http.StatusOK
	}
	envelope.DomainJSON(w, status, map[string]any{
		"id": res.CreationID, "request_id": res.CreationID,
		"status": res.Status, "credits": res.Credits,
		"reservationId": res.ReservationID, "idempotent": res.Idempotent,
	})
}

// GET /api/models/telemetry — getModelTelemetryOverview() aggregate over
// ai_studio.generation_attempts / creations / ai_models (verified columns).
func (d *Dependencies) coreModelsTelemetry(w http.ResponseWriter, r *http.Request, _ *Dependencies, _ *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	requested := coreQuery(r, "range")
	if requested != "24h" && requested != "7d" && requested != "30d" {
		requested = "24h"
	}
	interval := "24 hours"
	if requested == "7d" {
		interval = "7 days"
	} else if requested == "30d" {
		interval = "30 days"
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var totalCalls, successCalls, avgMs, p50Ms, p90Ms, activeModels float64
	err := pool.QueryRow(r.Context(), `
		SELECT COUNT(att.id)::float8,
		       COALESCE(SUM(CASE WHEN att.status='succeeded' THEN 1 ELSE 0 END),0)::float8,
		       COALESCE(ROUND(AVG(att.duration_ms) FILTER (WHERE att.duration_ms>0)),0)::float8,
		       COALESCE(ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY att.duration_ms) FILTER (WHERE att.duration_ms>0))::numeric,0)::float8,
		       COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY att.duration_ms) FILTER (WHERE att.duration_ms>0))::numeric,0)::float8,
		       COUNT(DISTINCT COALESCE(c.model, att.provider_model_id))::float8
		FROM ai_studio.generation_attempts att
		LEFT JOIN ai_studio.creations c ON c.id = att.creation_id
		WHERE att.created_at >= NOW() - $1::interval`, interval).
		Scan(&totalCalls, &successCalls, &avgMs, &p50Ms, &p90Ms, &activeModels)
	if err != nil {
		w.Header().Set("Cache-Control", "no-store")
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "TELEMETRY_UNAVAILABLE", "模型遥测暂不可用")
		return
	}
	successRate := 100.0
	if totalCalls > 0 {
		successRate = float64(int(successCalls/totalCalls*1000+0.5)) / 10
	}
	rows, err := pool.Query(r.Context(), `
		SELECT COALESCE(m.id, c.model, att.provider_model_id, 'unknown') AS model_id,
		       COALESCE(m.display_name, m.name, c.model, att.provider_model_id, '未知模型') AS model_name,
		       COALESCE(m.category,'image') AS category,
		       COALESCE(m.is_visible,true) AS is_visible,
		       COUNT(att.id)::int AS total_calls,
		       CASE WHEN COUNT(att.id)>0 THEN ROUND((SUM(CASE WHEN att.status='succeeded' THEN 1 ELSE 0 END)::numeric/COUNT(att.id)::numeric)*100,1) ELSE 100 END AS success_rate,
		       COALESCE(ROUND(AVG(att.duration_ms) FILTER (WHERE att.duration_ms>0)),0)::int AS avg_duration_ms,
		       COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY att.duration_ms) FILTER (WHERE att.duration_ms>0))::numeric,0)::int AS p90_duration_ms
		FROM ai_studio.generation_attempts att
		LEFT JOIN ai_studio.creations c ON c.id = att.creation_id
		LEFT JOIN ai_studio.ai_models m ON m.id = c.model OR m.slug = c.model
		WHERE att.created_at >= NOW() - $1::interval
		GROUP BY 1,2,3,4 ORDER BY total_calls DESC LIMIT 24`, interval)
	if err != nil {
		w.Header().Set("Cache-Control", "no-store")
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "TELEMETRY_UNAVAILABLE", "模型遥测暂不可用")
		return
	}
	rawModels, err := coreScalarRows(rows)
	if err != nil {
		w.Header().Set("Cache-Control", "no-store")
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "TELEMETRY_UNAVAILABLE", "模型遥测暂不可用")
		return
	}
	models := make([]map[string]any, 0, len(rawModels))
	for _, m := range rawModels {
		if v, present := m["is_visible"]; present && v == false {
			continue
		}
		models = append(models, map[string]any{
			"id": m["model_id"], "name": m["model_name"], "category": m["category"],
			"totalCalls": coreFloat(m["total_calls"]), "successRate": coreFloat(m["success_rate"]),
			"avgDurationMs": coreFloat(m["avg_duration_ms"]), "p90DurationMs": coreFloat(m["p90_duration_ms"]),
		})
	}
	w.Header().Set("Cache-Control", "public, max-age=15, stale-while-revalidate=45")
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"range": requested,
		"kpi": map[string]any{
			"totalCalls": totalCalls, "successRate": successRate, "avgDurationMs": avgMs,
			"p50DurationMs": p50Ms, "p90DurationMs": p90Ms, "activeModelsCount": activeModels,
		},
		"models": models,
	})
}

func coreFloat(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case int32:
		return float64(t)
	case pgtype.Numeric:
		f, _ := t.Float64Value()
		return f.Float64
	case string:
		f, _ := strconv.ParseFloat(t, 64)
		return f
	}
	return 0
}

// ===========================================================================
// Batch 2: assets folders, asset library, downloads, uploads, upload-binary
// ===========================================================================

// coreAssetProjection maps a user_assets row to the client-facing shape used by
// toClientAsset()/toLibraryAsset() (source: lib/services/assets.js, assetLibrary.js).
func coreAssetProjection(m map[string]any) map[string]any {
	str := func(k string) string { return coreString(m[k]) }
	nullable := func(k string) any {
		if m[k] == nil {
			return nil
		}
		return m[k]
	}
	kind := str("kind")
	if kind == "" {
		kind = str("asset_type")
	}
	mediaURL := nullable("media_url")
	out := map[string]any{
		"id": str("id"), "type": str("asset_type"), "kind": kind,
		"category": coreFirst(str("category"), "other"),
		"title":    coreFirst(str("title"), str("prompt"), "素材"),
		"source":   coreFirst(str("source"), ""), "note": coreFirst(str("note"), ""),
		"url": mediaURL, "thumbnailUrl": nullable("thumbnail_url"), "previewUrl": nullable("preview_url"),
		"mimeType": nullable("mime_type"), "size": coreFloat(m["file_size_bytes"]),
		"width": nullable("width"), "height": nullable("height"),
		"visibility":    coreFirst(str("visibility"), "private"),
		"status":        coreFirst(str("status"), "ready"),
		"storageStatus": coreFirst(str("storage_status"), "ready"),
		"createdAt":     m["created_at"], "updatedAt": m["updated_at"],
		"folderId": nullable("folder_id"), "folderName": nullable("folder_name"),
		"prompt": coreFirst(str("prompt"), ""), "checksum": nullable("checksum"),
		"starred": m["is_favorite"] == true,
		"tags":    nullable("tags"),
	}
	var assetData map[string]any
	if raw, ok := m["asset_data"].(map[string]any); ok {
		assetData = raw
	}
	data := map[string]any{
		"url": mediaURL, "thumbnailUrl": nullable("thumbnail_url"), "previewUrl": nullable("preview_url"),
		"width": nullable("width"), "height": nullable("height"),
		"bytes": coreFloat(m["file_size_bytes"]), "mimeType": nullable("mime_type"),
	}
	switch kind {
	case "text":
		data = map[string]any{"content": coreFirst(coreString(assetData["content"]), str("prompt"))}
	case "entity":
		data = map[string]any{"definition": assetData["definition"]}
	case "canvas":
		data = map[string]any{
			"projectId": assetData["canvasProjectId"], "version": coreFloat(assetData["version"]),
			"url": assetData["url"], "coverUrl": nullable("cover_url"),
		}
	}
	out["data"] = data
	out["metadata"] = map[string]any{
		"prompt": str("prompt"), "negativePrompt": str("negative_prompt"),
		"model":    coreFirst(str("model_name"), str("model_id"), "AI Model"),
		"provider": nullable("provider"), "bytes": coreFloat(m["file_size_bytes"]),
		"mimeType": nullable("mime_type"), "aspectRatio": nullable("aspect_ratio"),
		"creditCost": coreFloat(m["credit_cost"]), "generationParams": nullable("generation_params"),
	}
	return out
}

func coreAssetSelect() string {
	return `SELECT a.id, a.user_id, a.folder_id, a.creation_id, a.asset_type, a.studio_id,
		a.title, a.media_url, a.thumbnail_url, a.preview_url, a.mime_type, a.file_size_bytes,
		a.width, a.height, a.aspect_ratio, a.duration_seconds, a.prompt, a.negative_prompt,
		a.model_id, a.model_name, a.provider, a.generation_params, a.credit_cost,
		a.is_favorite, a.is_pinned, a.tags, a.status, a.created_at, a.updated_at,
		a.bucket, a.region, a.object_key, a.original_filename, a.filename, a.extension,
		a.checksum, a.visibility, a.deleted_at, a.storage_status, a.storage_provider,
		a.storage_location_id, a.preview_object_key, a.thumbnail_object_key,
		a.kind, a.category, a.source, a.note, a.cover_url, a.asset_data, a.trashed_at,
		f.name AS folder_name, f.color AS folder_color
		FROM ai_studio.user_assets a
		LEFT JOIN ai_studio.asset_folders f ON f.id = a.folder_id`
}

// GET /api/assets/[id]/download — redirect to a signed/object URL or media_url.
func (d *Dependencies) coreAssetDownload(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatBinaryRedirectOrText
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	id := pathParam(r, "id")
	if id == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_ID", "缺少资产标识")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	asset, err := d.assetsSvc(pool).GetAsset(r.Context(), user.ID, id)
	if errors.Is(err, assets.ErrNotFound) {
		coreErr(w, r, fmt, http.StatusNotFound, "ASSET_NOT_FOUND", "资产不存在或已删除")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "ASSET_READ_FAILED", "读取资产失败")
		return
	}
	stSvc := d.storageSvc(pool)
	if asset.ObjectKey != "" {
		disp := coreFirst(coreQuery(r, "disposition"), "inline")
		if disp != "attachment" {
			disp = "inline"
		}
		prov := storage.NormalizeProvider(asset.StorageProvider)
		if prov != "local" {
			if signed, sErr := stSvc.SignedURL(r.Context(), asset.StorageProvider, asset.StorageLocationID, asset.Bucket, asset.Region, asset.ObjectKey, disp); sErr == nil && strings.HasPrefix(strings.ToLower(signed), "http") {
				http.Redirect(w, r, signed, http.StatusFound)
				return
			}
		}
		if rc, meta, oErr := stSvc.OpenStream(r.Context(), asset.StorageProvider, asset.StorageLocationID, asset.Bucket, asset.Region, asset.ObjectKey, ""); oErr == nil {
			defer rc.Close()
			ct := coreFirst(meta.ContentType, "application/octet-stream")
			w.Header().Set("Content-Type", ct)
			w.Header().Set("Cache-Control", "private, no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			if disp == "attachment" {
				w.Header().Set("Content-Disposition", "attachment")
			}
			if meta.Size > 0 {
				w.Header().Set("Content-Length", strconv.FormatInt(meta.Size, 10))
			}
			w.WriteHeader(http.StatusOK)
			_, _ = io.Copy(w, rc)
			return
		}
	}
	if asset.PublicURL != "" {
		target := asset.PublicURL
		if !strings.HasPrefix(strings.ToLower(target), "http://") && !strings.HasPrefix(strings.ToLower(target), "https://") {
			base := requestOrigin(r)
			if base == "" {
				base = "http://127.0.0.1:3000"
			}
			target, _ = url.JoinPath(base, target)
		}
		http.Redirect(w, r, target, http.StatusFound)
		return
	}
	coreErr(w, r, fmt, http.StatusServiceUnavailable, "STORAGE_LOCATION_UNAVAILABLE", "素材所属存储位置不可用")
}

// GET /api/assets/folders — getUserAssetFolders(): flat list + two-level tree.
func (d *Dependencies) coreAssetFoldersList(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	rows, err := pool.Query(r.Context(), `
		SELECT id, user_id, parent_id, depth, name, color, icon, sort_order, created_at, updated_at
		FROM ai_studio.asset_folders WHERE user_id = $1
		ORDER BY sort_order ASC, created_at ASC`, user.ID)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "FOLDER_LIST_FAILED", "获取文件夹列表失败")
		return
	}
	folders, err := coreScalarRows(rows)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "FOLDER_LIST_FAILED", "获取文件夹列表失败")
		return
	}
	if folders == nil {
		folders = []map[string]any{}
	}
	byID := map[string]map[string]any{}
	for _, f := range folders {
		f["children"] = []any{}
		byID[coreString(f["id"])] = f
	}
	roots := []any{}
	for _, f := range folders {
		parent := coreString(f["parent_id"])
		if parent != "" && f["parent_id"] != nil {
			if p, exists := byID[parent]; exists {
				p["children"] = append(p["children"].([]any), f)
				continue
			}
		}
		roots = append(roots, f)
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"folders": folders, "folderTree": roots})
}

// POST /api/assets/folders — createUserAssetFolder() with 2-level depth + unique name.
func (d *Dependencies) coreAssetFoldersCreate(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 32*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "asset_folder_create_user", user.ID, 120, time.Hour) {
		return
	}
	body, ok := coreDecodeObject(w, r, 32*1024)
	if !ok {
		return
	}
	name := strings.TrimSpace(coreString(body["name"]))
	if name == "" || len(name) > 128 {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_FOLDER_NAME", "文件夹名称无效")
		return
	}
	parent := coreFirst(coreString(body["parentId"]), coreString(body["parent_id"]))
	color := coreFirst(coreString(body["color"]), "#e11d74")
	icon := coreFirst(coreString(body["icon"]), "folder")
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	depth := 1
	if parent != "" {
		err := pool.QueryRow(r.Context(), `SELECT depth FROM ai_studio.asset_folders WHERE id = $1 AND user_id = $2`, parent, user.ID).Scan(&depth)
		if coreIsNoRows(err) {
			coreErr(w, r, fmt, http.StatusNotFound, "PARENT_FOLDER_NOT_FOUND", "父文件夹不存在")
			return
		}
		if err != nil || depth >= 2 {
			coreErr(w, r, fmt, http.StatusUnprocessableEntity, "FOLDER_DEPTH_EXCEEDED", "文件夹层级最多两级")
			return
		}
		depth++
	}
	var duplicate bool
	_ = pool.QueryRow(r.Context(), `
		SELECT EXISTS(SELECT 1 FROM ai_studio.asset_folders
		              WHERE user_id = $1 AND COALESCE(parent_id,'root') = COALESCE($2,'root') AND name = $3)`,
		user.ID, nullString(parent), name).Scan(&duplicate)
	if duplicate {
		coreErr(w, r, fmt, http.StatusConflict, "FOLDER_NAME_DUPLICATE", "同级已存在同名文件夹")
		return
	}
	id := coreNewID("fld")
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ai_studio.asset_folders
		  (id,user_id,parent_id,depth,name,color,icon,sort_order,created_at,updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,0,now(),now())`,
		id, user.ID, nullString(parent), depth, name, color, icon)
	if err != nil {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "FOLDER_CREATE_FAILED", "创建文件夹失败")
		return
	}
	envelope.DomainJSON(w, http.StatusCreated, map[string]any{"folder": map[string]any{
		"id": id, "userId": user.ID, "parentId": nullString(parent), "depth": depth,
		"name": name, "color": color, "icon": icon, "sortOrder": 0,
	}})
}

// PATCH /api/assets/folders/[id] — updateUserAssetFolder().
func (d *Dependencies) coreAssetFolderPatch(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 32*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "asset_folder_update_user", user.ID, 120, time.Hour) {
		return
	}
	id := pathParam(r, "id")
	if id == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_FOLDER_ID", "缺少文件夹标识")
		return
	}
	body, ok := coreDecodeObject(w, r, 32*1024)
	if !ok {
		return
	}
	name := strings.TrimSpace(coreString(body["name"]))
	if name != "" && len(name) > 128 {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_FOLDER_NAME", "文件夹名称无效")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var exists int
	if err := pool.QueryRow(r.Context(), `SELECT 1 FROM ai_studio.asset_folders WHERE id = $1 AND user_id = $2`, id, user.ID).Scan(&exists); coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusNotFound, "FOLDER_NOT_FOUND", "文件夹不存在")
		return
	}
	_, err := pool.Exec(r.Context(), `
		UPDATE ai_studio.asset_folders SET
		  name = COALESCE(NULLIF($3,''), name),
		  color = COALESCE(NULLIF($4,''), color),
		  icon = COALESCE(NULLIF($5,''), icon),
		  sort_order = COALESCE($6, sort_order),
		  updated_at = now()
		WHERE id = $1 AND user_id = $2`, id, user.ID, name,
		coreString(body["color"]), coreString(body["icon"]),
		coreNullableSortOrder(body))
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "asset_folders_user_parent_name_idx") {
			coreErr(w, r, fmt, http.StatusConflict, "FOLDER_NAME_DUPLICATE", "同级已存在同名文件夹")
			return
		}
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "FOLDER_UPDATE_FAILED", "更新文件夹失败")
		return
	}
	rows, err := pool.Query(r.Context(), `SELECT * FROM ai_studio.asset_folders WHERE id=$1 AND user_id=$2`, id, user.ID)
	if err == nil {
		if list, e := coreScalarRows(rows); e == nil && len(list) > 0 {
			envelope.DomainJSON(w, http.StatusOK, map[string]any{"folder": list[0]})
			return
		}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"folder": map[string]any{"id": id}})
}

func coreNullableSortOrder(body map[string]any) any {
	if v, ok := body["sortOrder"]; ok && v != nil {
		return coreIntAny(v)
	}
	if v, ok := body["sort_order"]; ok && v != nil {
		return coreIntAny(v)
	}
	return nil
}

// DELETE /api/assets/folders/[id] — deleteUserAssetFolder(): detach assets, cascade children.
func (d *Dependencies) coreAssetFolderDelete(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 8*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "asset_folder_delete_user", user.ID, 120, time.Hour) {
		return
	}
	id := pathParam(r, "id")
	if id == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_FOLDER_ID", "缺少文件夹标识")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var exists int
	if err := pool.QueryRow(r.Context(), `SELECT 1 FROM ai_studio.asset_folders WHERE id=$1 AND user_id=$2`, id, user.ID).Scan(&exists); coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusNotFound, "FOLDER_NOT_FOUND", "目标文件夹不存在")
		return
	}
	tx, err := pool.Begin(r.Context())
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "FOLDER_DELETE_FAILED", "删除文件夹失败")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	childRows, err := tx.Query(r.Context(), `SELECT id FROM ai_studio.asset_folders WHERE user_id=$1 AND parent_id=$2`, user.ID, id)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "FOLDER_DELETE_FAILED", "删除文件夹失败")
		return
	}
	children, err := coreScalarRows(childRows)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "FOLDER_DELETE_FAILED", "删除文件夹失败")
		return
	}
	ids := []string{id}
	for _, c := range children {
		ids = append(ids, coreString(c["id"]))
	}
	if _, err = tx.Exec(r.Context(), `UPDATE ai_studio.user_assets SET folder_id=NULL, updated_at=now() WHERE user_id=$1 AND folder_id=ANY($2)`, user.ID, ids); err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "FOLDER_DELETE_FAILED", "删除文件夹失败")
		return
	}
	if _, err = tx.Exec(r.Context(), `DELETE FROM ai_studio.asset_folders WHERE id=$1 AND user_id=$2`, id, user.ID); err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "FOLDER_DELETE_FAILED", "删除文件夹失败")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "FOLDER_DELETE_FAILED", "删除文件夹失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"success": true, "deletedFolderId": id, "freedFoldersCount": len(ids)})
}

// GET /api/assets/library — getLibraryAssets() with real filters/facets/pagination.
func (d *Dependencies) coreLibraryList(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	status := coreQuery(r, "status")
	if status != "trash" {
		status = "ready"
	}
	kind := coreQuery(r, "kind")
	category := coreQuery(r, "category")
	folderID := coreFirst(coreQuery(r, "folderId"), coreQuery(r, "folder_id"))
	uncategorized := coreQuery(r, "uncategorized") == "true" || coreQuery(r, "uncategorized") == "1"
	search := coreFirst(coreQuery(r, "q"), coreQuery(r, "search"))
	if len(search) > 200 {
		search = search[:200]
	}
	page := queryInt(r, "page", 1, 1, 1000000)
	pageSize := queryInt(r, "pageSize", 40, 1, 200)
	if raw := coreQuery(r, "page_size"); raw != "" && coreQuery(r, "pageSize") == "" {
		pageSize = queryInt(r, "page_size", 40, 1, 200)
	}
	where := " a.user_id = $1 AND a.status = $2 AND a.deleted_at IS NULL"
	args := []any{user.ID, status}
	n := func(v string) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if kind != "" && kind != "all" {
		where += " AND a.kind = " + n(kind)
	}
	if category != "" && category != "all" {
		where += " AND a.category = " + n(category)
	}
	if folderID != "" && folderID != "all" {
		where += " AND a.folder_id = " + n(folderID)
	}
	if uncategorized {
		where += " AND a.folder_id IS NULL"
	}
	if search != "" {
		where += " AND (a.title ILIKE " + n("%"+search+"%") + " OR a.prompt ILIKE " + n("%"+search+"%") + ")"
	}
	var total int
	if err := pool.QueryRow(r.Context(), `SELECT COUNT(*)::int FROM ai_studio.user_assets a WHERE`+where, args...).Scan(&total); err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "ASSET_LIST_FAILED", "获取资产库失败")
		return
	}
	args = append(args, pageSize, (page-1)*pageSize)
	rows, err := pool.Query(r.Context(), coreAssetSelect()+` WHERE`+where+`
		ORDER BY a.created_at DESC LIMIT $`+strconv.Itoa(len(args)-1)+` OFFSET $`+strconv.Itoa(len(args)), args...)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "ASSET_LIST_FAILED", "获取资产库失败")
		return
	}
	list, err := coreScalarRows(rows)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "ASSET_LIST_FAILED", "获取资产库失败")
		return
	}
	assets := make([]map[string]any, 0, len(list))
	for _, m := range list {
		assets = append(assets, coreAssetProjection(m))
	}
	if assets == nil {
		assets = []map[string]any{}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"assets": assets, "total": total, "page": page, "pageSize": pageSize,
		"hasMore": page*pageSize < total,
	})
}

func coreLibraryAssetByID(ctx context.Context, pool *pgxpool.Pool, userID, id string) (map[string]any, error) {
	rows, err := pool.Query(ctx, coreAssetSelect()+` WHERE a.id=$1 AND a.user_id=$2`, id, userID)
	if err != nil {
		return nil, err
	}
	list, err := coreScalarRows(rows)
	if err != nil || len(list) == 0 {
		return nil, pgx.ErrNoRows
	}
	return list[0], nil
}

// GET /api/assets/library/[id]
func (d *Dependencies) coreLibraryAssetGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatSuccessFlaggedJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	id := pathParam(r, "id")
	if id == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_ID", "缺少资产标识")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	m, err := coreLibraryAssetByID(r.Context(), pool, user.ID, id)
	if err != nil {
		coreErr(w, r, fmt, http.StatusNotFound, "ASSET_NOT_FOUND", "资产不存在或已被删除")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"asset": coreAssetProjection(m)})
}

// PATCH /api/assets/library/[id] — updateLibraryAsset(): whitelisted columns only.
func (d *Dependencies) coreLibraryAssetPatch(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatSuccessFlaggedJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 1024*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "asset_library_update_user", user.ID, 600, time.Hour) {
		return
	}
	id := pathParam(r, "id")
	if id == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_ID", "缺少资产标识")
		return
	}
	body, ok := coreDecodeObject(w, r, 1024*1024)
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	if _, err := coreLibraryAssetByID(r.Context(), pool, user.ID, id); err != nil {
		coreErr(w, r, fmt, http.StatusNotFound, "ASSET_NOT_FOUND", "资产不存在或已被删除")
		return
	}
	sets := []string{"updated_at = now()"}
	args := []any{id, user.ID}
	push := func(expr string, v any) {
		args = append(args, v)
		sets = append(sets, stdfmt.Sprintf(expr, "$"+strconv.Itoa(len(args))))
	}
	if v, exists := body["title"]; exists {
		push("title = %s", coreString(v))
	}
	if v, exists := body["note"]; exists {
		push("note = %s", coreString(v))
	}
	if v, exists := body["source"]; exists {
		push("source = %s", coreString(v))
	}
	if v, exists := body["coverUrl"]; exists {
		push("cover_url = %s", coreString(v))
	}
	if v, exists := body["folderId"]; exists {
		push("folder_id = %s", nullString(coreString(v)))
	} else if v, exists := body["folder_id"]; exists {
		push("folder_id = %s", nullString(coreString(v)))
	}
	if v, exists := body["isFavorite"]; exists {
		push("is_favorite = %s", v == true)
	} else if v, exists := body["starred"]; exists {
		push("is_favorite = %s", v == true)
	}
	if v, exists := body["tags"]; exists {
		if arr, ok := v.([]any); ok {
			push("tags = %s", arr)
		}
	}
	if v, exists := body["assetData"]; exists {
		push("asset_data = %s::jsonb", mustJSON(v))
	}
	if len(sets) == 1 {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_DATA", "没有可更新的素材字段")
		return
	}
	_, err := pool.Exec(r.Context(), `UPDATE ai_studio.user_assets SET `+strings.Join(sets, ", ")+` WHERE id=$1 AND user_id=$2`, args...)
	if err != nil {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "ASSET_UPDATE_FAILED", "更新素材失败")
		return
	}
	m, err := coreLibraryAssetByID(r.Context(), pool, user.ID, id)
	if err != nil {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "ASSET_UPDATE_FAILED", "更新素材失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"asset": coreAssetProjection(m)})
}

// DELETE /api/assets/library/[id] — trash (soft) or purge=true (hard, owner-scoped).
func (d *Dependencies) coreLibraryAssetDelete(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatSuccessFlaggedJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 8*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "asset_library_delete_user", user.ID, 600, time.Hour) {
		return
	}
	id := pathParam(r, "id")
	if id == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_ID", "缺少资产标识")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	if _, err := coreLibraryAssetByID(r.Context(), pool, user.ID, id); err != nil {
		coreErr(w, r, fmt, http.StatusNotFound, "ASSET_NOT_FOUND", "资产不存在或已被删除")
		return
	}
	purge := coreQuery(r, "purge") == "true"
	var err error
	if purge {
		_, err = pool.Exec(r.Context(), `DELETE FROM ai_studio.user_assets WHERE id=$1 AND user_id=$2`, id, user.ID)
	} else {
		_, err = pool.Exec(r.Context(), `
			UPDATE ai_studio.user_assets
			SET status='trash', deleted_at=COALESCE(deleted_at,now()),
			    trashed_at=COALESCE(trashed_at,now()), updated_at=now()
			WHERE id=$1 AND user_id=$2`, id, user.ID)
	}
	if err != nil {
		msg := "移入回收站失败"
		if purge {
			msg = "彻底删除素材失败"
		}
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "ASSET_DELETE_FAILED", msg)
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"deletedAssetId": id, "purged": purge})
}

// POST /api/assets/library/batch — trash/restore/purge/move/favorite/empty.
func (d *Dependencies) coreLibraryBatch(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 64*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "asset_library_batch_user", user.ID, 300, time.Hour) {
		return
	}
	body, ok := coreDecodeObject(w, r, 64*1024)
	if !ok {
		return
	}
	action := coreString(body["action"])
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	if action == "empty" {
		tag, err := pool.Exec(r.Context(), `DELETE FROM ai_studio.user_assets WHERE user_id=$1 AND status='trash'`, user.ID)
		if err != nil {
			coreErr(w, r, fmt, http.StatusInternalServerError, "BATCH_FAILED", "批量操作失败")
			return
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"deleted": tag.RowsAffected()})
		return
	}
	ids := coreStringSlice(body["assetIds"])
	if len(ids) == 0 {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_IDS", "请选择要操作的素材")
		return
	}
	if len(ids) > 500 {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_IDS", "素材数量超出批量上限")
		return
	}
	var sql string
	var args []any
	switch action {
	case "trash":
		sql = `UPDATE ai_studio.user_assets SET status='trash', deleted_at=COALESCE(deleted_at,now()), trashed_at=COALESCE(trashed_at,now()), updated_at=now() WHERE user_id=$1 AND id=ANY($2) AND deleted_at IS NULL`
		args = []any{user.ID, ids}
	case "restore":
		sql = `UPDATE ai_studio.user_assets SET status='ready', deleted_at=NULL, trashed_at=NULL, updated_at=now() WHERE user_id=$1 AND id=ANY($2)`
		args = []any{user.ID, ids}
	case "purge":
		sql = `DELETE FROM ai_studio.user_assets WHERE user_id=$1 AND id=ANY($2)`
		args = []any{user.ID, ids}
	case "move":
		target := coreFirst(coreString(body["targetFolderId"]), coreString(body["target_folder_id"]))
		if target != "" {
			var exists int
			if err := pool.QueryRow(r.Context(), `SELECT 1 FROM ai_studio.asset_folders WHERE id=$1 AND user_id=$2`, target, user.ID).Scan(&exists); coreIsNoRows(err) {
				coreErr(w, r, fmt, http.StatusNotFound, "FOLDER_NOT_FOUND", "目标文件夹不存在")
				return
			}
		}
		sql = `UPDATE ai_studio.user_assets SET folder_id=$3, updated_at=now() WHERE user_id=$1 AND id=ANY($2)`
		args = []any{user.ID, ids, nullString(target)}
	case "favorite":
		sql = `UPDATE ai_studio.user_assets SET is_favorite=$3, updated_at=now() WHERE user_id=$1 AND id=ANY($2)`
		args = []any{user.ID, ids, body["value"] == true}
	default:
		coreErr(w, r, fmt, http.StatusBadRequest, "UNSUPPORTED_ACTION", "不支持的操作类型")
		return
	}
	tag, err := pool.Exec(r.Context(), sql, args...)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "BATCH_FAILED", "批量操作失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"action": action, "affected": tag.RowsAffected()})
}

func coreStringSlice(v any) []string {
	arr, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		if s := strings.TrimSpace(coreString(item)); s != "" {
			out = append(out, s)
		}
	}
	return out
}

// GET /api/assets/library/export — ZIP manifest stream. Preflight returns count.
func (d *Dependencies) coreLibraryExport(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatBinaryRedirectOrText
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	preflight := r.Header.Get("X-Asset-Export") == "preflight"
	limit, window := 20, time.Hour
	scope := "asset_library_export_user"
	if preflight {
		limit, scope = 120, "asset_library_export_preflight_user"
	}
	if !coreLimitOr503(w, r, d, fmt, scope, user.ID, limit, window) {
		return
	}
	idsRaw := coreQuery(r, "ids")
	var ids []string
	for _, part := range strings.Split(idsRaw, ",") {
		if s := strings.TrimSpace(part); s != "" {
			ids = append(ids, s)
		}
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	where := " a.user_id=$1 AND a.status='ready' AND a.deleted_at IS NULL"
	args := []any{user.ID}
	if len(ids) > 0 {
		args = append(args, ids)
		where += " AND a.id=ANY($2)"
	}
	rows, err := pool.Query(r.Context(), coreAssetSelect()+` WHERE`+where+` ORDER BY a.created_at DESC`, args...)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "EXPORT_FAILED", "导出素材失败")
		return
	}
	list, err := coreScalarRows(rows)
	if err != nil || len(list) == 0 {
		coreErr(w, r, fmt, http.StatusBadRequest, "NO_EXPORTABLE_ASSETS", "暂无素材可导出")
		return
	}
	if preflight {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"count": len(list)})
		return
	}
	stSvc := d.storageSvc(pool)
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="supdance-assets.zip"`)
	w.Header().Set("Cache-Control", "private, no-store")
	zw := zip.NewWriter(w)
	exportedFiles := make([]map[string]any, 0, len(list))
	skippedFiles := make([]map[string]any, 0)
	assetsMeta := make([]any, 0, len(list))
	usedNames := map[string]int{}
	for _, m := range list {
		assetsMeta = append(assetsMeta, coreAssetProjection(m))
		objKey := coreString(m["object_key"])
		if objKey == "" {
			skippedFiles = append(skippedFiles, map[string]any{"id": m["id"], "reason": "missing_object_key"})
			continue
		}
		rc, _, oErr := stSvc.OpenStream(r.Context(), coreString(m["storage_provider"]), coreString(m["storage_location_id"]), coreString(m["bucket"]), coreString(m["region"]), objKey, "")
		if oErr != nil {
			skippedFiles = append(skippedFiles, map[string]any{"id": m["id"], "reason": oErr.Error()})
			continue
		}
		name := coreFirst(coreString(m["filename"]), coreString(m["original_filename"]), coreString(m["id"])+".bin")
		name = strings.ReplaceAll(name, "/", "_")
		if cnt := usedNames[name]; cnt > 0 {
			name = strconv.Itoa(cnt) + "-" + name
		}
		usedNames[name]++
		fw, fErr := zw.Create("assets/" + name)
		if fErr == nil {
			n, _ := io.Copy(fw, rc)
			exportedFiles = append(exportedFiles, map[string]any{"id": m["id"], "entry": "assets/" + name, "bytes": n})
		}
		_ = rc.Close()
	}
	manifestBytes, _ := json.MarshalIndent(map[string]any{
		"app": "supdance", "version": 1, "exportedAt": coreNow().Format(time.RFC3339Nano),
		"assets": assetsMeta, "files": exportedFiles, "skipped": skippedFiles,
	}, "", "  ")
	if mf, mErr := zw.Create("manifest.json"); mErr == nil {
		_, _ = mf.Write(manifestBytes)
	}
	_ = zw.Close()
}

// GET /api/assets/library/usage — getLibraryUsage() storage accounting.
func (d *Dependencies) coreLibraryUsage(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var usedBytes int64
	var assetCount int
	err := pool.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(file_size_bytes),0)::bigint, COUNT(*)::int
		FROM ai_studio.user_assets
		WHERE user_id=$1 AND status IN ('ready','archived') AND deleted_at IS NULL`, user.ID).
		Scan(&usedBytes, &assetCount)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "USAGE_READ_FAILED", "读取存储容量失败")
		return
	}
	storageGB := int64(1)
	planID := "free"
	planName := "免费版"
	if stSvc := d.storageSvc(pool); stSvc != nil && stSvc.Entitlements != nil {
		if gb, gErr := stSvc.Entitlements(r.Context(), user.ID); gErr == nil && gb > 0 {
			storageGB = gb
		}
	}
	quotaBytes := storageGB * 1024 * 1024 * 1024
	percent := float64(0)
	if quotaBytes > 0 {
		percent = float64(usedBytes) / float64(quotaBytes) * 100
		if percent > 100 {
			percent = 100
		}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"usedBytes": usedBytes, "assetCount": assetCount, "quotaBytes": quotaBytes,
		"storageGb": storageGB, "planId": planID, "planName": planName, "percent": percent,
	})
}

// POST /api/assets/library — createLibraryAsset() from validated JSON.
func (d *Dependencies) coreLibraryCreate(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 1024*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "asset_library_create_user", user.ID, 300, time.Hour) {
		return
	}
	body, ok := coreDecodeObject(w, r, 1024*1024)
	if !ok {
		return
	}
	kind := coreFirst(coreString(body["kind"]), "image")
	if !coreContains([]string{"text", "image", "video", "audio", "model", "entity", "canvas"}, kind) {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_DATA", "素材类型无效")
		return
	}
	category := coreFirst(coreString(body["category"]), "other")
	if !coreContains([]string{"character", "environment", "prop", "material", "other"}, category) {
		category = "other"
	}
	mediaURL := coreFirst(coreString(body["mediaUrl"]), coreString(body["url"]))
	if mediaURL == "" && kind != "text" && kind != "entity" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_ASSET_DATA", "缺少素材媒体地址")
		return
	}
	assetType := kind
	if kind == "model" || kind == "entity" || kind == "canvas" {
		assetType = "other"
	}
	if kind == "text" {
		assetType = "document"
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	id := coreNewID("ast")
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ai_studio.user_assets
		  (id,user_id,folder_id,asset_type,studio_id,title,media_url,thumbnail_url,mime_type,
		   file_size_bytes,kind,category,source,note,cover_url,asset_data,tags,status,
		   visibility,storage_status,prompt,created_at,updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,'ready','private','ready',$18,now(),now())`,
		id, user.ID, nullString(coreString(body["folderId"])), assetType, "upload",
		coreFirst(coreString(body["title"]), "素材"), nullString(mediaURL),
		nullString(coreString(body["coverUrl"])), coreFirst(coreString(body["mimeType"]), "application/octet-stream"),
		coreIntAny(body["bytes"]), kind, category,
		nullString(coreString(body["source"])), nullString(coreString(body["note"])),
		nullString(coreString(body["coverUrl"])), mustJSON(body["data"]),
		coreStringSlice(body["tags"]), coreString(body["prompt"]))
	if err != nil {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "ASSET_CREATE_FAILED", "创建素材失败")
		return
	}
	m, err := coreLibraryAssetByID(r.Context(), pool, user.ID, id)
	if err != nil {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "ASSET_CREATE_FAILED", "创建素材失败")
		return
	}
	envelope.DomainJSON(w, http.StatusCreated, map[string]any{"asset": coreAssetProjection(m)})
}

func coreContains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}

// POST /api/assets/upload — direct multipart ingest / prepare / complete.
func (d *Dependencies) coreAssetsUpload(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatSuccessFlaggedJSON
	isMultipart := strings.Contains(strings.ToLower(r.Header.Get("Content-Type")), "multipart/form-data")
	maxBytes := int64(128 * 1024)
	if isMultipart {
		maxBytes = 500 * 1024 * 1024
	}
	if coreBodyTooLarge(w, r, fmt, maxBytes) {
		return
	}
	// Source rate-limits before auth (subject = user or client IP).
	subject := clientIP(r)
	if u != nil && u.ID != "" {
		subject = u.ID
	}
	if !coreLimitOr503(w, r, d, fmt, "assets.upload", subject, 120, time.Minute) {
		return
	}
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	if isMultipart {
		if err := r.ParseMultipartForm(500 << 20); err != nil {
			coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_UPLOAD", "请提供有效的待上传文件")
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			file, header, err = r.FormFile("asset")
		}
		if err != nil {
			coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_UPLOAD", "请提供有效的待上传文件")
			return
		}
		defer file.Close()
		buf, err := io.ReadAll(io.LimitReader(file, 500<<20))
		if err != nil || len(buf) == 0 {
			coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_UPLOAD", "请提供有效的待上传文件")
			return
		}
		stSvc := d.storageSvc(pool)
		if qErr := stSvc.AssertQuota(r.Context(), user.ID, int64(len(buf))); qErr != nil {
			coreErr(w, r, fmt, http.StatusRequestEntityTooLarge, "STORAGE_QUOTA_EXCEEDED", qErr.Error())
			return
		}
		kind := strings.ToLower(strings.TrimSpace(r.FormValue("kind")))
		if kind == "model" || strings.HasSuffix(strings.ToLower(header.Filename), ".glb") || strings.HasSuffix(strings.ToLower(header.Filename), ".gltf") {
			kind = "model"
		}
		assetType := "image"
		ct := strings.ToLower(coreFirst(r.FormValue("type"), header.Header.Get("Content-Type")))
		switch {
		case kind == "model":
			assetType = "other"
		case strings.HasPrefix(ct, "video"):
			assetType = "video"
		case strings.HasPrefix(ct, "audio"):
			assetType = "audio"
		}
		ing, ingErr := stSvc.IngestBuffer(r.Context(), storage.IngestInput{
			UserID:      user.ID,
			Type:        assetType,
			Filename:    header.Filename,
			ContentType: header.Header.Get("Content-Type"),
			SourceType:  "user_upload",
			Body:        buf,
		})
		if ingErr != nil {
			coreErr(w, r, fmt, http.StatusUnprocessableEntity, "UPLOAD_FAILED", "上传文件写入存储失败: "+ingErr.Error())
			return
		}
		category := coreFirst(r.FormValue("category"), "other")
		if !coreContains([]string{"character", "environment", "prop", "material", "other"}, category) {
			category = "other"
		}
		assetKind := kind
		if assetKind == "" {
			assetKind = assetType
		}
		if !coreContains([]string{"text", "image", "video", "audio", "model", "entity", "canvas"}, assetKind) {
			assetKind = "image"
		}
		id := coreNewID("ast")
		_, err = pool.Exec(r.Context(), `
			INSERT INTO ai_studio.user_assets
			  (id,user_id,folder_id,asset_type,studio_id,title,object_key,original_filename,filename,
			   extension,mime_type,file_size_bytes,checksum,visibility,storage_status,status,
			   storage_provider,storage_location_id,bucket,region,media_url,
			   kind,category,source,note,tags,prompt,created_at,updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'private','ready','ready',$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'',now(),now())`,
			id, user.ID, nullString(coreFirst(r.FormValue("folderId"), r.FormValue("folder_id"))),
			assetType, coreFirst(r.FormValue("studioId"), "upload"),
			coreFirst(r.FormValue("title"), header.Filename, "上传素材"), ing.ObjectKey,
			header.Filename, header.Filename, coreFirst(ing.Extension, coreFileExt(header.Filename)),
			ing.MIMEType, ing.SizeBytes, ing.Checksum,
			nullString(ing.Provider), nullString(ing.StorageLocationID), nullString(ing.Bucket), nullString(ing.Region), nullString(ing.URL),
			assetKind, category,
			nullString(r.FormValue("source")), nullString(r.FormValue("note")),
			coreSplitTags(r.FormValue("tags")))
		if err != nil {
			coreErr(w, r, fmt, http.StatusUnprocessableEntity, "UPLOAD_FAILED", "上传文件处理失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusCreated, map[string]any{
			"asset": map[string]any{"id": id, "objectKey": ing.ObjectKey, "size": ing.SizeBytes, "provider": ing.Provider},
			"url":   "/api/assets/" + id + "/download",
		})
		return
	}
	body, ok := coreDecodeObject(w, r, 128*1024)
	if !ok {
		return
	}
	action := coreFirst(coreString(body["action"]), "prepare")
	if action == "prepare" {
		// prepareDirectUpload() issues a scoped object key; no upstream credentials leak.
		safeUser := coreSafeUserID(user.ID)
		objectKey := "uploads/" + safeUser + "/" + coreNewID("obj") + "-" + coreFirst(coreString(body["filename"]), "asset")
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"upload": map[string]any{
			"objectKey": objectKey, "method": "PUT", "expiresIn": 900,
		}})
		return
	}
	if action != "complete" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_UPLOAD_ACTION", "上传操作类型无效")
		return
	}
	objectKey := coreString(body["objectKey"])
	if objectKey == "" || !strings.Contains(objectKey, "/"+coreSafeUserID(user.ID)+"/") {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_OBJECT_KEY", "对象 Key 无效")
		return
	}
	id := coreNewID("ast")
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ai_studio.user_assets
		  (id,user_id,folder_id,asset_type,studio_id,title,object_key,original_filename,filename,
		   extension,mime_type,file_size_bytes,checksum,visibility,storage_status,status,
		   kind,category,source,note,cover_url,asset_data,created_at,updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'private','ready','ready',$14,$15,$16,$17,$18,$19::jsonb,now(),now())`,
		id, user.ID, nullString(coreFirst(coreString(body["folderId"]), coreString(body["folder_id"]))),
		coreFirst(coreString(body["type"]), "image"), coreFirst(coreString(body["studioId"]), "upload"),
		coreFirst(coreString(body["title"]), coreString(body["filename"]), "上传素材"), objectKey,
		coreString(body["filename"]), coreString(body["filename"]), coreFileExt(coreString(body["filename"])),
		coreFirst(coreString(body["mimeType"]), "application/octet-stream"),
		coreIntAny(body["sizeBytes"]), coreString(body["checksum"]),
		coreFirst(coreString(body["kind"]), "image"), coreFirst(coreString(body["category"]), "other"),
		nullString(coreString(body["source"])), nullString(coreString(body["note"])),
		nullString(coreString(body["coverUrl"])), mustJSON(body["assetData"]))
	if err != nil {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "UPLOAD_FAILED", "上传文件处理失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusCreated, map[string]any{"asset": map[string]any{"id": id, "objectKey": objectKey}})
}

func coreSafeUserID(id string) string {
	return regexp.MustCompile(`[^a-zA-Z0-9_-]`).ReplaceAllString(id, "_")
}

func coreFileExt(name string) string {
	idx := strings.LastIndexByte(name, '.')
	if idx < 0 {
		return ""
	}
	return strings.ToLower(name[idx+1:])
}

func coreSplitTags(raw string) []string {
	out := []string{}
	for _, s := range strings.Split(raw, ",") {
		if t := strings.TrimSpace(s); t != "" && len(out) < 40 {
			out = append(out, t)
		}
	}
	return out
}

// POST /api/upload-binary — validated proxy to an allowed S3/COS target.
func (d *Dependencies) coreUploadBinary(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatBinaryRedirectOrText
	if coreBodyTooLarge(w, r, fmt, 25*1024*1024) {
		return
	}
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "binary_upload_user", user.ID, 20, time.Hour) {
		return
	}
	if err := r.ParseMultipartForm(25 << 20); err != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_BODY", "Missing proxy target URL")
		return
	}
	target := strings.TrimSpace(r.FormValue("x-proxy-target-url"))
	if target == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "MISSING_TARGET", "Missing proxy target URL")
		return
	}
	reason := coreValidateUploadTarget(target)
	if reason != "" {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		envelope.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid upload target", "reason": reason})
		return
	}
	ct := coreFirst(r.FormValue("Content-Type"), r.FormValue("content-type"))
	keyName := r.FormValue("key")
	for _, headers := range r.MultipartForm.File {
		for _, fh := range headers {
			if coreBlockedFileType(fh.Filename, coreFirst(fh.Header.Get("Content-Type"), ct)) {
				coreUploadBlocked(w)
				return
			}
		}
	}
	if coreBlockedFileType(keyName, ct) {
		coreUploadBlocked(w)
		return
	}
	method := strings.ToUpper(coreFirst(r.FormValue("x-proxy-method"), "POST"))
	if method != "POST" && method != "PUT" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_UPLOAD_METHOD", "Invalid upload method")
		return
	}
	// Upstream fetch is done with Go's net/http (same server-to-server semantics as the
	// source). The target has been SSRF-validated above; no client-supplied credentials
	// are forwarded beyond the whitelisted content-type / x-cos-* headers.
	file, fh, err := r.FormFile("file")
	if err != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "MISSING_UPLOAD_FILE", "Missing upload file")
		return
	}
	defer file.Close()
	payload, err := io.ReadAll(io.LimitReader(file, 25<<20))
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "UPLOAD_FAILED", "上传服务暂时不可用")
		return
	}
	var upstreamHeaders map[string]string
	if method == "PUT" {
		var requested map[string]any
		if json.Unmarshal([]byte(coreFirst(r.FormValue("x-proxy-headers"), "{}")), &requested) != nil {
			coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_UPLOAD_HEADERS", "Invalid upload headers")
			return
		}
		upstreamHeaders = map[string]string{}
		for k, v := range requested {
			lower := strings.ToLower(k)
			if lower == "content-type" || (strings.HasPrefix(lower, "x-cos-") && regexp.MustCompile(`^x-cos-[a-z0-9-]+$`).MatchString(lower)) {
				upstreamHeaders[lower] = coreString(v)
			}
		}
		if upstreamHeaders["content-type"] == "" {
			upstreamHeaders["content-type"] = coreFirst(fh.Header.Get("Content-Type"), "application/octet-stream")
		}
	}
	var body io.Reader
	headers := http.Header{}
	if method == "PUT" {
		body = bytes.NewReader(payload)
		for k, v := range upstreamHeaders {
			headers.Set(k, v)
		}
	} else {
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		for k, values := range r.MultipartForm.Value {
			if k == "x-proxy-target-url" {
				continue
			}
			for _, v := range values {
				_ = mw.WriteField(k, v)
			}
		}
		fw, e := mw.CreateFormFile("file", fh.Filename)
		if e == nil {
			_, _ = fw.Write(payload)
		}
		_ = mw.Close()
		body = &buf
		headers.Set("Content-Type", mw.FormDataContentType())
	}
	req, err := http.NewRequestWithContext(r.Context(), method, target, body)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "UPLOAD_FAILED", "上传服务暂时不可用")
		return
	}
	req.Header = headers
	client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	resp, err := client.Do(req)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "UPLOAD_FAILED", "上传服务暂时不可用")
		return
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	status := resp.StatusCode
	if status < 400 {
		status = http.StatusBadGateway
	}
	coreErr(w, r, fmt, status, "UPSTREAM_FAILED", "上传服务暂时不可用")
}

func coreUploadBlocked(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	envelope.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid file type", "reason": "blocked_file_type"})
}

var coreBlockedExt = map[string]bool{
	"html": true, "htm": true, "xhtml": true, "svg": true, "php": true, "phtml": true,
	"php3": true, "php4": true, "php5": true, "phps": true, "exe": true, "bat": true,
	"cmd": true, "sh": true, "bash": true, "js": true, "cgi": true, "pl": true,
	"py": true, "jar": true, "vbs": true, "scr": true, "msi": true,
}

var coreBlockedMIME = map[string]bool{
	"text/html": true, "image/svg+xml": true, "application/xhtml+xml": true,
	"application/x-httpd-php": true, "application/x-msdownload": true,
	"application/x-executable": true, "application/x-sh": true,
	"application/x-shellscript": true, "application/javascript": true, "text/javascript": true,
}

func coreBlockedFileType(name, contentType string) bool {
	mime := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	if coreBlockedMIME[mime] {
		return true
	}
	return coreBlockedExt[coreFileExt(name)]
}

// coreValidateUploadTarget mirrors src/lib/uploadProxyTarget.js: https-only,
// no localhost/IP literals/private ranges, S3 host pattern or explicit allowlist.
func coreValidateUploadTarget(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" {
		return "invalid_url"
	}
	host := strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))
	if host == "localhost" || host == "::1" || net.ParseIP(host) != nil {
		return "host_not_allowed"
	}
	if strings.Contains(host, ":") || strings.Split(host, ".")[0] == "" {
		return "host_not_allowed"
	}
	ip := net.ParseIP(host)
	if ip != nil && ip.IsPrivate() {
		return "host_not_allowed"
	}
	allowed := coreAllowedS3Host(host)
	if !allowed {
		for _, part := range strings.Split(os.Getenv("UPLOAD_PROXY_ALLOWED_HOSTS"), ",") {
			if strings.ToLower(strings.TrimSpace(part)) == host {
				allowed = true
				break
			}
		}
	}
	if !allowed {
		return "host_not_allowed"
	}
	return ""
}

func coreAllowedS3Host(host string) bool {
	labels := strings.Split(host, ".")
	for _, l := range labels {
		if l == "" {
			return false
		}
	}
	if host == "s3.amazonaws.com" {
		return true
	}
	if strings.HasSuffix(host, ".s3.amazonaws.com") && len(host) > len(".s3.amazonaws.com") {
		return true
	}
	if len(labels) == 4 && labels[0] == "s3" && labels[2] == "amazonaws" && labels[3] == "com" && regexp.MustCompile(`^[a-z0-9-]+$`).MatchString(labels[1]) {
		return true
	}
	if len(labels) >= 5 && labels[len(labels)-2] == "amazonaws" && labels[len(labels)-1] == "com" {
		for i, l := range labels {
			if l == "s3" && i > 0 && len(labels)-i == 4 {
				return regexp.MustCompile(`^[a-z0-9-]+$`).MatchString(labels[i+1])
			}
		}
	}
	return false
}

// ===========================================================================
// Batch 3: canvas-tools + canvas assets/config/jobs/projects/session/shares
// ===========================================================================

var coreSourceAssetIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{8,160}$`)
var coreShareTokenRe = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
var coreByteRangeRe = regexp.MustCompile(`^bytes=(\d*)-(\d*)$`)
var coreMultiRangeRe = regexp.MustCompile(`^bytes=\d*-\d*(,\d*-\d*)*$`)

// POST /api/canvas-tools/plan — buildCanvasToolPlan() with source-asset validation.
func (d *Dependencies) coreCanvasToolsPlan(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatSuccessFlaggedJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 64*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_tools_plan_user", user.ID, 120, time.Hour) {
		return
	}
	body, ok := coreDecodeObject(w, r, 64*1024)
	if !ok {
		return
	}
	tool := strings.TrimSpace(coreString(body["tool"]))
	if tool == "" {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "INVALID_TOOL", "必须指定画布工具")
		return
	}
	sourceID := coreFirst(coreString(body["sourceAssetId"]), coreString(body["source_asset_id"]))
	if !coreSourceAssetIDRe.MatchString(sourceID) {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "INVALID_SOURCE", "请先上传一张源图片")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	// Catalog availability = an active, publicly selectable i2i image model.
	var catalogModel string
	err := pool.QueryRow(r.Context(), `
		SELECT id FROM ai_studio.ai_models
		WHERE status='active' AND COALESCE(is_visible,true) AND category IN ('image','image_edit')
		  AND (category='image_edit'
		       OR COALESCE((capabilities->>'supports_edit')::boolean,false)
		       OR COALESCE((capabilities->>'supports_reference')::boolean,false)
		       OR capabilities IS NULL
		       OR capabilities::text ILIKE '%i2i%'
		       OR capabilities::text ILIKE '%image_to_image%')
		ORDER BY (id = 'seedream-4.5') DESC, sort ASC LIMIT 1`).Scan(&catalogModel)
	if coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "NO_IMAGE_TO_IMAGE_MODEL", "当前没有可用的图生图模型，画布工具暂时无法生成。")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "PLAN_FAILED", "生成方案创建失败，请稍后再试")
		return
	}
	// Queries durable capabilities/category/status predicates for an active i2i model.
	var mimeType sqlNullString
	var sizeBytes int64
	var deletedAt sqlNullTime
	err = pool.QueryRow(r.Context(), `
		SELECT mime_type, COALESCE(file_size_bytes,0), deleted_at
		FROM ai_studio.user_assets WHERE id=$1 AND user_id=$2`, sourceID, user.ID).
		Scan(&mimeType, &sizeBytes, &deletedAt)
	if coreIsNoRows(err) || deletedAt.Valid {
		coreErr(w, r, fmt, http.StatusNotFound, "SOURCE_NOT_FOUND", "源图片不存在或已删除，请重新上传")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "PLAN_FAILED", "生成方案创建失败，请稍后再试")
		return
	}
	mime := strings.ToLower(mimeType.String)
	if mime != "" && !coreContains([]string{"image/jpeg", "image/png", "image/webp", "image/gif"}, mime) {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "SOURCE_NOT_IMAGE", "源素材不是受支持的图片格式")
		return
	}
	if sizeBytes > 30*1024*1024 {
		coreErr(w, r, fmt, http.StatusRequestEntityTooLarge, "SOURCE_TOO_LARGE", "源图片超过 30MB，请压缩后再试")
		return
	}
	paramsMap, _ := body["params"].(map[string]any)
	if paramsMap == nil {
		paramsMap = map[string]any{}
	}
	if _, hasPrompt := paramsMap["prompt"]; !hasPrompt {
		if p := coreString(body["prompt"]); p != "" {
			paramsMap["prompt"] = p
		}
	}
	toolPlan, planErr := canvas.BuildToolPlan(tool, paramsMap, sourceID)
	if planErr != nil {
		code, msg := "PLAN_FAILED", planErr.Error()
		var te *canvas.ToolError
		if errors.As(planErr, &te) && te != nil && te.Code != "" {
			code = te.Code
		}
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, code, msg)
		return
	}
	if !corePromptOkay(toolPlan.Prompt) {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "CONTENT_POLICY_VIOLATION", "提示词包含敏感或违规内容，请遵守平台使用规范并调整后重试")
		return
	}
	plan := map[string]any{
		"tool": toolPlan.Tool, "label": toolPlan.Label, "prompt": toolPlan.Prompt,
		"parameters": toolPlan.Parameters, "meta": toolPlan.Meta,
		"modelId": catalogModel, "studioId": "canvas", "sourceAssetId": sourceID,
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"plan": plan})
}

// GET /api/canvas-tools/result/[id] — private creation result URL redirect.
func (d *Dependencies) coreCanvasToolsResult(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatBinaryRedirectOrText
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	id := pathParam(r, "id")
	if id == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_TASK_ID", "缺少任务 ID")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var objectKey, resultURL, storageProvider, locationID, bucket, region, mimeType sqlNullString
	err := pool.QueryRow(r.Context(), `
		SELECT result_object_key, result_url, storage_provider, storage_location_id,
		       storage_bucket, storage_region, storage_mime_type
		FROM ai_studio.creations
		WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`, id, user.ID).
		Scan(&objectKey, &resultURL, &storageProvider, &locationID, &bucket, &region, &mimeType)
	if coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusNotFound, "TASK_NOT_FOUND", "生成任务不存在或无权查看")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "RESULT_READ_FAILED", "读取生成结果失败")
		return
	}
	if objectKey.String == "" {
		fallback := resultURL.String
		if strings.HasPrefix(strings.ToLower(fallback), "https://") || strings.HasPrefix(strings.ToLower(fallback), "http://") {
			if !strings.Contains(strings.ToLower(fallback), "/uploads/generated/") {
				http.Redirect(w, r, fallback, http.StatusFound)
				return
			}
		}
		coreErr(w, r, fmt, http.StatusNotFound, "RESULT_UNAVAILABLE", "生成结果暂不可用")
		return
	}
	stSvc := d.storageSvc(pool)
	rc, meta, oErr := stSvc.OpenStream(r.Context(), storageProvider.String, locationID.String, bucket.String, region.String, objectKey.String, "")
	if oErr != nil {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "STORAGE_LOCATION_UNAVAILABLE", "生成结果所属存储位置不可用")
		return
	}
	defer rc.Close()
	ct := coreFirst(mimeType.String, meta.ContentType, "application/octet-stream")
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if meta.Size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(meta.Size, 10))
	}
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, rc)
}

// GET /api/canvas-tools/spec — canvas tool catalog availability + spec.
func (d *Dependencies) coreCanvasToolsSpec(w http.ResponseWriter, r *http.Request, dd *Dependencies, _ *middleware.SessionUser) {
	const fmt = envelope.FormatSuccessFlaggedJSON
	w.Header().Set("Cache-Control", "no-store")
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var specModelID, specModelName, specProvider string
	var specCredits float64
	var specCapsRaw []byte
	err := pool.QueryRow(r.Context(), `
		SELECT m.id, COALESCE(NULLIF(m.display_name,''), m.name, m.id),
		       COALESCE((SELECT pm.provider_id FROM ai_studio.provider_models pm
		                 WHERE pm.model_id = m.id AND pm.enabled = true ORDER BY pm.priority DESC LIMIT 1), 'volcengine'),
		       COALESCE(mp.base_credits, 1)::float8, COALESCE(m.capabilities, '{}'::jsonb)
		FROM ai_studio.ai_models m
		LEFT JOIN ai_studio.model_pricing mp ON mp.model_id = m.id AND mp.is_active
		WHERE m.status='active' AND COALESCE(m.is_visible,true) AND m.category IN ('image','image_edit')
		  AND (m.category='image_edit'
		       OR COALESCE((m.capabilities->>'supports_edit')::boolean,false)
		       OR COALESCE((m.capabilities->>'supports_reference')::boolean,false)
		       OR m.capabilities IS NULL
		       OR m.capabilities::text ILIKE '%i2i%'
		       OR m.capabilities::text ILIKE '%image_to_image%')
		ORDER BY (m.id = 'seedream-4.5') DESC, m.sort ASC LIMIT 1`).Scan(&specModelID, &specModelName, &specProvider, &specCredits, &specCapsRaw)
	if coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusServiceUnavailable, "NO_IMAGE_TO_IMAGE_MODEL", "当前没有可用的图生图模型，画布工具暂时无法生成。")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "SPEC_UNAVAILABLE", "画布工具规格读取失败，请稍后再试")
		return
	}
	specCaps := map[string]any{}
	if len(specCapsRaw) > 0 {
		_ = json.Unmarshal(specCapsRaw, &specCaps)
	}
	envelope.SuccessJSON(w, http.StatusOK, canvas.BuildToolSpec(specModelID, specModelName, specProvider, specCredits, specCaps))
}

// GET/HEAD /api/canvas/assets/[id]/content — owner-scoped media with Range/206.
func (d *Dependencies) coreCanvasAssetContent(headOnly bool) domainFn {
	return func(w http.ResponseWriter, r *http.Request, dd *Dependencies, u *middleware.SessionUser) {
		const fmt = envelope.FormatDirectDomainJSON
		user, ok := coreCanvasUser(w, r, u)
		if !ok {
			return
		}
		id := pathParam(r, "id")
		deps := coreBoundDeps(d, dd)
		pool, ok := coreDB(deps, w, r, fmt)
		if !ok {
			return
		}
		coreServeCanvasAsset(w, r, deps, pool, user.ID, id, headOnly, false)
	}
}

// coreBoundDeps prefers the router-built Dependencies captured by the closure and
// falls back to the wrapDomain-supplied instance (e.g. direct unit invocation).
func coreBoundDeps(bound, given *Dependencies) *Dependencies {
	if bound != nil {
		return bound
	}
	return given
}

// coreServeCanvasAsset streams stored media bytes (with Range/206 support) from
// the configured storage adapter, falling back to external signed URL redirect.
func coreServeCanvasAsset(w http.ResponseWriter, r *http.Request, deps *Dependencies, pool *pgxpool.Pool, userID, id string, headOnly, shared bool) {
	var objectKey, previewKey, thumbKey, mediaURL, mimeType, visibility, storageProvider, locationID, bucket, region sqlNullString
	var deletedAt sqlNullTime
	var sizeBytes int64
	err := pool.QueryRow(r.Context(), `
		SELECT object_key, preview_object_key, thumbnail_object_key, media_url, mime_type,
		       COALESCE(visibility,'private'), COALESCE(file_size_bytes,0), deleted_at,
		       storage_provider, storage_location_id, bucket, region
		FROM ai_studio.user_assets WHERE id=$1 AND user_id=$2`, id, userID).
		Scan(&objectKey, &previewKey, &thumbKey, &mediaURL, &mimeType, &visibility, &sizeBytes, &deletedAt,
			&storageProvider, &locationID, &bucket, &region)
	if coreIsNoRows(err) || deletedAt.Valid || objectKey.String == "" {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "素材不存在或尚未归档到 对象存储", "code": "ASSET_NOT_FOUND"})
		return
	}
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取素材失败", "code": "ASSET_READ_FAILED"})
		return
	}
	mime := strings.ToLower(mimeType.String)
	if !strings.HasPrefix(mime, "image/") && !strings.HasPrefix(mime, "video/") && !strings.HasPrefix(mime, "audio/") {
		coreCanvasJSON(r, w, http.StatusUnsupportedMediaType, map[string]any{"error": "该素材类型不支持预览", "code": "ASSET_PREVIEW_UNSUPPORTED"})
		return
	}
	wantsPreview := coreQuery(r, "preview") == "1"
	chosenKey := objectKey.String
	contentType := mime
	if wantsPreview {
		pk := coreFirst(previewKey.String, thumbKey.String)
		if pk != "" {
			chosenKey = pk
			contentType = "image/webp"
		}
	}
	stSvc := deps.storageSvc(pool)
	rangeHeader := strings.TrimSpace(r.Header.Get("Range"))
	if rc, meta, oErr := stSvc.OpenStream(r.Context(), storageProvider.String, locationID.String, bucket.String, region.String, chosenKey, rangeHeader); oErr == nil {
		defer rc.Close()
		if coreCanvasOriginAllowed(r) {
			w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Content-Type", coreFirst(contentType, meta.ContentType))
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Accept-Ranges", "bytes")
		if meta.StatusCode == http.StatusPartialContent && meta.ContentRange != "" {
			w.Header().Set("Content-Range", meta.ContentRange)
		}
		if meta.ContentLength > 0 {
			w.Header().Set("Content-Length", strconv.FormatInt(meta.ContentLength, 10))
		} else if sizeBytes > 0 && rangeHeader == "" {
			w.Header().Set("Content-Length", strconv.FormatInt(sizeBytes, 10))
		}
		status := meta.StatusCode
		if status == 0 {
			status = http.StatusOK
		}
		w.WriteHeader(status)
		if !headOnly {
			_, _ = io.Copy(w, rc)
		}
		return
	} else if meta.StatusCode == http.StatusRequestedRangeNotSatisfiable {
		coreWrite416(r, w, sizeBytes)
		return
	}

	// Fallback if stored only as an external media URL when object bytes are unreachable locally.
	_ = visibility
	_ = shared
	if mediaURL.String != "" && (strings.HasPrefix(strings.ToLower(mediaURL.String), "http://") || strings.HasPrefix(strings.ToLower(mediaURL.String), "https://")) {
		if coreCanvasOriginAllowed(r) {
			w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Location", mediaURL.String)
		w.WriteHeader(http.StatusFound)
		return
	}
	coreCanvasJSON(r, w, http.StatusBadGateway, map[string]any{"error": "读取素材失败", "code": "ASSET_READ_FAILED"})
}

func coreWrite416(r *http.Request, w http.ResponseWriter, size int64) {
	if coreCanvasOriginAllowed(r) {
		w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Add("Vary", "Origin")
	}
	w.Header().Set("Content-Range", stdfmt.Sprintf("bytes */%d", size))
	w.Header().Set("Content-Length", "0")
	w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
}

// GET /api/canvas/assets — paged media-only list for the canvas client.
func (d *Dependencies) coreCanvasAssetsList(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	page := queryInt(r, "page", 1, 1, 10000)
	limit := queryInt(r, "limit", 30, 1, 50)
	typ := coreQuery(r, "type")
	if !coreContains([]string{"all", "image", "video", "audio"}, typ) {
		typ = "all"
	}
	search := coreQuery(r, "search")
	if len(search) > 160 {
		search = search[:160]
	}
	where := "user_id=$1 AND deleted_at IS NULL AND status='ready' AND (object_key IS NOT NULL OR media_url IS NOT NULL)"
	args := []any{user.ID}
	if typ != "all" {
		args = append(args, typ)
		where += " AND asset_type=$" + strconv.Itoa(len(args))
	}
	if search != "" {
		args = append(args, "%"+search+"%")
		where += " AND (title ILIKE $" + strconv.Itoa(len(args)) + " OR prompt ILIKE $" + strconv.Itoa(len(args)) + ")"
	}
	var total int
	if err := pool.QueryRow(r.Context(), `SELECT COUNT(*)::int FROM ai_studio.user_assets WHERE `+where, args...).Scan(&total); err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取 SupDance 素材库失败", "code": "ASSET_LIST_FAILED"})
		return
	}
	args = append(args, limit, (page-1)*limit)
	rows, err := pool.Query(r.Context(), `
		SELECT id, asset_type, kind, category, title, mime_type, width, height,
		       COALESCE(file_size_bytes,0) AS size, created_at
		FROM ai_studio.user_assets WHERE `+where+`
		ORDER BY created_at DESC LIMIT $`+strconv.Itoa(len(args)-1)+` OFFSET $`+strconv.Itoa(len(args)), args...)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取 SupDance 素材库失败", "code": "ASSET_LIST_FAILED"})
		return
	}
	list, err := coreScalarRows(rows)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取 SupDance 素材库失败", "code": "ASSET_LIST_FAILED"})
		return
	}
	assets := make([]map[string]any, 0, len(list))
	for _, a := range list {
		id := coreString(a["id"])
		assets = append(assets, map[string]any{
			"id": id, "type": a["asset_type"], "kind": coreFirst(coreString(a["kind"]), coreString(a["asset_type"])),
			"category": coreFirst(coreString(a["category"]), "other"), "title": a["title"],
			"url":          "/api/canvas/assets/" + url.PathEscape(id) + "/content",
			"thumbnailUrl": nil, "mimeType": a["mime_type"], "width": a["width"], "height": a["height"],
			"size": a["size"], "createdAt": a["created_at"],
		})
	}
	totalPages := (total + limit - 1) / limit
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{
		"assets":     assets,
		"pagination": map[string]any{"page": page, "limit": limit, "total": total, "totalPages": totalPages},
	})
}

// POST /api/canvas/assets/upload — idempotent canvas upload with checksum.
func (d *Dependencies) coreCanvasAssetUpload(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 104*1024*1024, true); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_asset_upload", user.ID, 120, time.Hour) {
		return
	}
	if err := r.ParseMultipartForm(104 << 20); err != nil {
		coreCanvasJSON(r, w, http.StatusBadRequest, map[string]any{"error": "请提供有效的图片、视频或音频文件", "code": "INVALID_UPLOAD"})
		return
	}
	if code, msg, conflict := coreOwnerConflict(user.ID, map[string]any{"expectedOwnerUserId": r.FormValue("expectedOwnerUserId")}); conflict {
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": msg, "code": code})
		return
	}
	idem := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if len(idem) < 8 || len(idem) > 200 {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "素材上传必须提供有效的幂等键", "code": "IDEMPOTENCY_REQUIRED"})
		return
	}
	file, fh, err := r.FormFile("file")
	if err != nil {
		coreCanvasJSON(r, w, http.StatusBadRequest, map[string]any{"error": "请提供有效的图片、视频或音频文件", "code": "INVALID_UPLOAD"})
		return
	}
	defer file.Close()
	mime := strings.ToLower(fh.Header.Get("Content-Type"))
	assetType := ""
	switch {
	case strings.HasPrefix(mime, "image/"):
		assetType = "image"
	case strings.HasPrefix(mime, "video/"):
		assetType = "video"
	case strings.HasPrefix(mime, "audio/"):
		assetType = "audio"
	}
	if assetType == "" {
		coreCanvasJSON(r, w, http.StatusBadRequest, map[string]any{"error": "请提供有效的图片、视频或音频文件", "code": "INVALID_UPLOAD"})
		return
	}
	maxBytes := int64(100 * 1024 * 1024)
	if assetType == "image" {
		maxBytes = 20 * 1024 * 1024
	}
	if fh.Size > maxBytes {
		coreCanvasJSON(r, w, http.StatusRequestEntityTooLarge, map[string]any{"error": "素材超过 允许的上传大小", "code": "UPLOAD_TOO_LARGE"})
		return
	}
	buf, err := io.ReadAll(io.LimitReader(file, maxBytes))
	if err != nil {
		coreCanvasJSON(r, w, http.StatusBadRequest, map[string]any{"error": "请提供有效的图片、视频或音频文件", "code": "INVALID_UPLOAD"})
		return
	}
	checksum := sha256.Sum256(buf)
	idemHash := sha256.Sum256([]byte(idem))
	idemHex := hex.EncodeToString(idemHash[:])
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var existingID, existingChecksum sqlNullString
	err = pool.QueryRow(r.Context(), `
		SELECT id, checksum FROM ai_studio.user_assets
		WHERE user_id=$1 AND generation_params->>'canvas_upload_idempotency_hash'=$2 AND deleted_at IS NULL
		LIMIT 1`, user.ID, idemHex).Scan(&existingID, &existingChecksum)
	if err == nil {
		if existingChecksum.String != "" && existingChecksum.String != hex.EncodeToString(checksum[:]) {
			coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": "相同幂等键不能用于不同素材内容", "code": "UPLOAD_IDEMPOTENCY_CONFLICT"})
			return
		}
		coreCanvasJSON(r, w, http.StatusOK, map[string]any{
			"asset":      map[string]any{"id": existingID.String},
			"contentUrl": "/api/canvas/assets/" + url.PathEscape(existingID.String) + "/content",
			"idempotent": true,
		})
		return
	}
	stSvc := d.storageSvc(pool)
	if qErr := stSvc.AssertQuota(r.Context(), user.ID, int64(len(buf))); qErr != nil {
		coreCanvasJSON(r, w, http.StatusRequestEntityTooLarge, map[string]any{"error": qErr.Error(), "code": "STORAGE_QUOTA_EXCEEDED"})
		return
	}
	objectKey := "uploads/" + coreSafeUserID(user.ID) + "/canvas/" + idemHex + "-" + hex.EncodeToString(checksum[:]) + "." + coreFirst(coreFileExt(fh.Filename), "bin")
	ing, ingErr := stSvc.IngestBuffer(r.Context(), storage.IngestInput{
		UserID:      user.ID,
		Type:        assetType,
		Filename:    fh.Filename,
		ContentType: mime,
		SourceType:  "canvas_upload",
		ObjectKey:   objectKey,
		Body:        buf,
	})
	if ingErr != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "素材存储失败", "code": "STORAGE_INGEST_FAILED"})
		return
	}
	id := coreNewID("ast")
	params := map[string]any{"canvas_upload_idempotency_hash": idemHex}
	_, err = pool.Exec(r.Context(), `
		INSERT INTO ai_studio.user_assets
		  (id,user_id,asset_type,studio_id,title,object_key,original_filename,mime_type,
		   file_size_bytes,checksum,visibility,storage_status,status,
		   storage_provider,storage_location_id,bucket,region,media_url,
		   kind,category,generation_params,created_at,updated_at)
		VALUES ($1,$2,$3,'canvas',$4,$5,$6,$7,$8,$9,'private','ready','ready',$10,$11,$12,$13,$14,$3,'other',$15::jsonb,now(),now())`,
		id, user.ID, assetType, coreFirst(coreString(r.FormValue("title")), fh.Filename, "画布素材"),
		ing.ObjectKey, fh.Filename, ing.MIMEType, ing.SizeBytes, ing.Checksum,
		nullString(ing.Provider), nullString(ing.StorageLocationID), nullString(ing.Bucket), nullString(ing.Region), nullString(ing.URL),
		mustJSON(params))
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "素材存储失败", "code": "STORAGE_INGEST_FAILED"})
		return
	}
	coreCanvasJSON(r, w, http.StatusCreated, map[string]any{
		"asset":      map[string]any{"id": id, "kind": assetType, "mimeType": ing.MIMEType, "size": ing.SizeBytes},
		"contentUrl": "/api/canvas/assets/" + url.PathEscape(id) + "/content",
		"idempotent": false,
	})
}

// GET /api/canvas/config — projected model config from ops_bill.system_settings.
func (d *Dependencies) coreCanvasConfig(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	schemaVersion := coreSchemaVersion(w, r)
	if schemaVersion == 0 {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var raw []byte
	err := pool.QueryRow(r.Context(), `SELECT value_json FROM ops_bill.system_settings WHERE key='canvas_model_config' LIMIT 1`).Scan(&raw)
	if err != nil && !coreIsNoRows(err) {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "画布配置暂时不可用"})
		return
	}
	empty := map[string]any{}
	mounted := map[string]any{"image": empty, "video": empty, "text": empty, "audio": empty, "music": empty}
	defaults := map[string]any{
		"imageModelId": "", "videoModelId": "", "textModelId": "", "audioModelId": "", "musicModelId": "",
		"canvasImageCount": "1", "audioVoice": "alloy", "audioFormat": "mp3", "audioSpeed": "1",
		"audioInstructions": "", "systemPrompt": "",
	}
	if len(raw) > 0 {
		var cfg struct {
			Mounted map[string][]string `json:"mountedModelIds"`
			Def     map[string]any      `json:"defaults"`
		}
		if json.Unmarshal(raw, &cfg) == nil {
			if cfg.Mounted != nil {
				for k, v := range cfg.Mounted {
					mounted[k] = v
				}
			}
			for k, v := range cfg.Def {
				defaults[k] = v
			}
		}
	}
	// Only models that are active, visible and published to the canvas site are exposed.
	allowed := coreCanvasAllowedModels(r.Context(), pool, user.ID)
	configured := false
	for cap, ids := range mounted {
		list, _ := ids.([]string)
		filtered := []string{}
		for _, id := range list {
			if allowed[id] {
				filtered = append(filtered, id)
			}
		}
		mounted[cap] = filtered
		if len(filtered) > 0 {
			configured = true
		}
		defaultKey := cap + "ModelId"
		if cur := coreString(defaults[defaultKey]); cur != "" && !allowed[cur] {
			defaults[defaultKey] = ""
		}
	}
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{
		"schemaVersion": schemaVersion, "mountedModelIds": mounted,
		"defaults": defaults, "configured": configured,
	})
}

func coreSchemaVersion(w http.ResponseWriter, r *http.Request) int {
	raw := coreQuery(r, "schemaVersion")
	if raw == "" {
		return 1
	}
	if raw == "1" || raw == "2" {
		n, _ := strconv.Atoi(raw)
		return n
	}
	coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": "模型能力协议版本不受支持", "code": "MODEL_CATALOG_VERSION_UNSUPPORTED"})
	return 0
}

func coreCanvasAllowedModels(ctx context.Context, pool *pgxpool.Pool, userID string) map[string]bool {
	rows, err := pool.Query(ctx, `
		SELECT id FROM ai_studio.ai_models
		WHERE status='active' AND COALESCE(is_visible,true)
		  AND COALESCE(tier,'backup') <> 'deprecated'`)
	if err != nil {
		return map[string]bool{}
	}
	list, err := coreScalarRows(rows)
	if err != nil {
		return map[string]bool{}
	}
	out := make(map[string]bool, len(list))
	for _, m := range list {
		out[coreString(m["id"])] = true
	}
	_ = userID
	return out
}

// GET /api/canvas/models — public canvas model catalog.
func (d *Dependencies) coreCanvasModels(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	schemaVersion := coreSchemaVersion(w, r)
	if schemaVersion == 0 {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	allowed := coreCanvasAllowedModels(r.Context(), pool, user.ID)
	rows, err := pool.Query(r.Context(), `
		SELECT id, name, display_name, category, description, cover, capabilities,
		       COALESCE(tier,'backup') AS tier, is_visible
		FROM ai_studio.ai_models WHERE status='active' AND COALESCE(is_visible,true)
		ORDER BY sort ASC`)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取模型目录失败", "code": "MODEL_CATALOG_FAILED"})
		return
	}
	list, err := coreScalarRows(rows)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取模型目录失败", "code": "MODEL_CATALOG_FAILED"})
		return
	}
	models := []map[string]any{}
	digestSrc := []map[string]any{}
	for _, m := range list {
		id := coreString(m["id"])
		if !allowed[id] {
			continue
		}
		cat := coreFirst(coreString(m["category"]), "image")
		models = append(models, map[string]any{
			"id": id, "name": coreFirst(coreString(m["display_name"]), coreString(m["name"])),
			"category": cat, "capability": cat, "available": true,
			"schemaVersion": schemaVersion, "capabilityVersion": coreModelCapVersion(m),
		})
		digestSrc = append(digestSrc, map[string]any{"id": id})
	}
	digest := sha256.Sum256([]byte(mustJSON(digestSrc)))
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{
		"schemaVersion": schemaVersion, "catalogVersion": hex.EncodeToString(digest[:]), "models": models,
	})
}

func coreModelCapVersion(m map[string]any) string {
	h := sha256.Sum256([]byte(mustJSON(m["capabilities"])))
	return hex.EncodeToString(h[:8])
}

func coreCanvasProjectPayload(p map[string]any) map[string]any {
	var snapshot any = p["snapshot_json"]
	if s, ok := p["snapshot_json"].(string); ok {
		var v any
		if json.Unmarshal([]byte(s), &v) == nil {
			snapshot = v
		}
	}
	return map[string]any{
		"id": p["id"], "ownerUserId": p["owner_user_id"], "name": p["name"],
		"thumbnailAssetId": p["thumbnail_asset_id"], "snapshot": snapshot,
		"version": coreFloat(p["version"]), "createdAt": p["created_at"], "updatedAt": p["updated_at"],
	}
}

func coreCanvasProjectByID(ctx context.Context, pool *pgxpool.Pool, userID, id string) (map[string]any, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, owner_user_id, name, thumbnail_asset_id, snapshot_json, version, created_at, updated_at
		FROM ai_studio.canvas_projects WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL`, id, userID)
	if err != nil {
		return nil, err
	}
	list, err := coreScalarRows(rows)
	if err != nil || len(list) == 0 {
		return nil, pgx.ErrNoRows
	}
	return list[0], nil
}

// GET /api/canvas/projects/[id]
func (d *Dependencies) coreCanvasProjectGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	p, err := coreCanvasProjectByID(r.Context(), pool, user.ID, pathParam(r, "id"))
	if err != nil {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "画布不存在", "code": "PROJECT_NOT_FOUND"})
		return
	}
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"project": coreCanvasProjectPayload(p)})
}

// PUT /api/canvas/projects/[id] — optimistic-concurrency save with version history.
func (d *Dependencies) coreCanvasProjectPut(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 2*1024*1024, false); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_project_save", user.ID, 600, time.Hour) {
		return
	}
	body, ok := coreReadCanvasJSON(w, r, 2*1024*1024)
	if !ok {
		return
	}
	if code, msg, conflict := coreOwnerConflict(user.ID, body); conflict {
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": msg, "code": code})
		return
	}
	expectedVersion := coreIntAny(body["expectedVersion"])
	if expectedVersion < 1 {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "保存项目必须提供有效的 expectedVersion", "code": "EXPECTED_VERSION_REQUIRED"})
		return
	}
	if status, code, msg := coreValidateSnapshot(body["snapshot"]); status != 0 {
		coreCanvasJSON(r, w, status, map[string]any{"error": msg, "code": code})
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	tx, err := pool.Begin(r.Context())
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "保存画布失败", "code": "PROJECT_SAVE_FAILED"})
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	id := pathParam(r, "id")
	var currentVersion int
	var name sqlNullString
	err = tx.QueryRow(r.Context(), `SELECT version, name FROM ai_studio.canvas_projects WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL FOR UPDATE`, id, user.ID).Scan(&currentVersion, &name)
	if coreIsNoRows(err) {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "画布不存在", "code": "PROJECT_NOT_FOUND"})
		return
	}
	if err != nil {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "保存画布失败", "code": "PROJECT_SAVE_FAILED"})
		return
	}
	if expectedVersion != currentVersion {
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{
			"error": "项目已在其他位置更新，请重新加载后再保存", "code": "PROJECT_VERSION_CONFLICT", "currentVersion": currentVersion,
		})
		return
	}
	newName := name.String
	if n, ok := body["name"].(string); ok {
		trimmed := strings.TrimSpace(n)
		if len(trimmed) > 160 {
			trimmed = trimmed[:160]
		}
		if trimmed != "" {
			newName = trimmed
		}
	}
	newVersion := currentVersion + 1
	_, err = tx.Exec(r.Context(), `
		UPDATE ai_studio.canvas_projects SET name=$3, snapshot_json=$4::jsonb, version=$5, updated_at=now()
		WHERE id=$1 AND owner_user_id=$2`, id, user.ID, newName, mustJSON(body["snapshot"]), newVersion)
	if err == nil {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ai_studio.canvas_project_versions (project_id,version,snapshot_json,created_by,created_at)
			VALUES ($1,$2,$3::jsonb,$4,now())`, id, newVersion, mustJSON(body["snapshot"]), user.ID)
	}
	if err == nil {
		_, err = tx.Exec(r.Context(), `
			DELETE FROM ai_studio.canvas_project_versions WHERE project_id=$1 AND version NOT IN (
			  SELECT version FROM ai_studio.canvas_project_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 20)`, id)
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "保存画布失败", "code": "PROJECT_SAVE_FAILED"})
		return
	}
	p, _ := coreCanvasProjectByID(r.Context(), pool, user.ID, id)
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"project": coreCanvasProjectPayload(p)})
}

// DELETE /api/canvas/projects/[id] — soft delete + revoke shares.
func (d *Dependencies) coreCanvasProjectDelete(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 4*1024, false); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	body, ok := coreReadCanvasJSON(w, r, 4*1024)
	if !ok {
		return
	}
	if code, msg, conflict := coreOwnerConflict(user.ID, body); conflict {
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": msg, "code": code})
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_project_delete", user.ID, 60, time.Hour) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	id := pathParam(r, "id")
	tag, err := pool.Exec(r.Context(), `
		UPDATE ai_studio.canvas_projects SET deleted_at=now(), updated_at=now()
		WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL`, id, user.ID)
	if err != nil || tag.RowsAffected() == 0 {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "画布不存在", "code": "PROJECT_NOT_FOUND"})
		return
	}
	_, _ = pool.Exec(r.Context(), `
		UPDATE ai_studio.canvas_project_shares SET revoked_at=now()
		WHERE project_id=$1 AND owner_user_id=$2 AND revoked_at IS NULL`, id, user.ID)
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// GET /api/canvas/projects — list with node/connection counts from snapshot_json.
func (d *Dependencies) coreCanvasProjectsList(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	rows, err := pool.Query(r.Context(), `
		SELECT id,name,thumbnail_asset_id,version,created_at,updated_at,
		  CASE WHEN jsonb_typeof(snapshot_json->'nodes')='array' THEN jsonb_array_length(snapshot_json->'nodes') ELSE 0 END AS node_count,
		  CASE WHEN jsonb_typeof(snapshot_json->'connections')='array' THEN jsonb_array_length(snapshot_json->'connections') ELSE 0 END AS connection_count
		FROM ai_studio.canvas_projects WHERE owner_user_id=$1 AND deleted_at IS NULL
		ORDER BY updated_at DESC, id DESC`, user.ID)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取画布列表失败", "code": "PROJECT_LIST_FAILED"})
		return
	}
	list, err := coreScalarRows(rows)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取画布列表失败", "code": "PROJECT_LIST_FAILED"})
		return
	}
	projects := make([]map[string]any, 0, len(list))
	for _, p := range list {
		projects = append(projects, map[string]any{
			"id": p["id"], "name": p["name"], "version": p["version"],
			"nodeCount": p["node_count"], "connectionCount": p["connection_count"],
			"createdAt": p["created_at"], "updatedAt": p["updated_at"],
		})
	}
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"projects": projects})
}

// POST /api/canvas/projects — create with deterministic migration-id idempotency.
func (d *Dependencies) coreCanvasProjectsCreate(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 2*1024*1024, false); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_project_create", user.ID, 30, time.Hour) {
		return
	}
	body, ok := coreReadCanvasJSON(w, r, 2*1024*1024)
	if !ok {
		return
	}
	if code, msg, conflict := coreOwnerConflict(user.ID, body); conflict {
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": msg, "code": code})
		return
	}
	name := strings.TrimSpace(coreString(body["name"]))
	if len(name) > 160 {
		name = name[:160]
	}
	if name == "" {
		name = "未命名画布"
	}
	if status, code, msg := coreValidateSnapshot(body["snapshot"]); status != 0 {
		coreCanvasJSON(r, w, status, map[string]any{"error": msg, "code": code})
		return
	}
	migrationID := ""
	if v, exists := body["migrationId"]; exists {
		migrationID = strings.TrimSpace(coreString(v))
		if !regexp.MustCompile(`^[A-Za-z0-9_-]{8,120}$`).MatchString(migrationID) {
			coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "迁移标识无效", "code": "INVALID_MIGRATION_ID"})
			return
		}
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var id string
	if migrationID != "" {
		digest := sha256.Sum256([]byte(user.ID + "\x00" + migrationID))
		id = "canvas_" + hex.EncodeToString(digest[:])[:56]
	} else {
		id = coreNewID("canvas")
	}
	snapshotJSON := mustJSON(body["snapshot"])
	tag, err := pool.Exec(r.Context(), `
		INSERT INTO ai_studio.canvas_projects (id,owner_user_id,name,snapshot_json,version,created_at,updated_at)
		VALUES ($1,$2,$3,$4::jsonb,1,now(),now()) ON CONFLICT (id) DO NOTHING`, id, user.ID, name, snapshotJSON)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "创建画布失败", "code": "PROJECT_CREATE_FAILED"})
		return
	}
	idempotent := tag.RowsAffected() == 0
	if idempotent {
		if p, e := coreCanvasProjectByID(r.Context(), pool, user.ID, id); e == nil && coreString(p["name"]) == name && mustJSON(p["snapshot_json"]) == snapshotJSON {
			coreCanvasJSON(r, w, http.StatusOK, map[string]any{"project": coreCanvasProjectPayload(p), "idempotent": true})
			return
		}
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": "该迁移标识已用于不同画布内容", "code": "PROJECT_CREATE_IDEMPOTENCY_CONFLICT"})
		return
	}
	_, _ = pool.Exec(r.Context(), `
		INSERT INTO ai_studio.canvas_project_versions (project_id,version,snapshot_json,created_by,created_at)
		VALUES ($1,1,$2::jsonb,$3,now())`, id, snapshotJSON, user.ID)
	_, _ = pool.Exec(r.Context(), `
		INSERT INTO ai_studio.user_assets
		  (id,user_id,asset_type,studio_id,title,mime_type,kind,category,source,status,visibility,storage_status,created_at,updated_at)
		VALUES ($1,$2,'canvas_project','canvas',$3,'application/json','canvas','canvas','canvas_project','ready','private','ready',now(),now())
		ON CONFLICT (id) DO UPDATE SET title=excluded.title, updated_at=now()`,
		id, user.ID, name)
	p, _ := coreCanvasProjectByID(r.Context(), pool, user.ID, id)
	coreCanvasJSON(r, w, http.StatusCreated, map[string]any{"project": coreCanvasProjectPayload(p), "idempotent": false})
}

// GET /api/canvas/projects/[id]/share — active share status.
func (d *Dependencies) coreCanvasShareGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var created time.Time
	err := pool.QueryRow(r.Context(), `
		SELECT s.created_at FROM ai_studio.canvas_project_shares s
		JOIN ai_studio.canvas_projects p ON p.id=s.project_id AND p.owner_user_id=s.owner_user_id AND p.deleted_at IS NULL
		WHERE s.project_id=$1 AND s.owner_user_id=$2 AND s.revoked_at IS NULL LIMIT 1`, pathParam(r, "id"), user.ID).Scan(&created)
	if coreIsNoRows(err) {
		coreCanvasJSON(r, w, http.StatusOK, map[string]any{"share": map[string]any{"active": false}})
		return
	}
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取分享状态失败", "code": "SHARE_STATUS_FAILED"})
		return
	}
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"share": map[string]any{"active": true, "createdAt": created.UTC().Format(time.RFC3339Nano)}})
}

// POST /api/canvas/projects/[id]/share — issue a fresh base64url token (hash stored).
func (d *Dependencies) coreCanvasSharePost(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 1024, false); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_project_share_create", user.ID, 30, time.Hour) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	id := pathParam(r, "id")
	if _, err := coreCanvasProjectByID(r.Context(), pool, user.ID, id); err != nil {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "画布不存在", "code": "PROJECT_NOT_FOUND"})
		return
	}
	var b [32]byte
	_, _ = rand.Read(b[:])
	token := coreBase64URL(b[:])
	hash := sha256.Sum256([]byte(token))
	hashHex := hex.EncodeToString(hash[:])
	tx, err := pool.Begin(r.Context())
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "创建分享失败", "code": "SHARE_CREATE_FAILED"})
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	if _, err = tx.Exec(r.Context(), `UPDATE ai_studio.canvas_project_shares SET revoked_at=now() WHERE project_id=$1 AND owner_user_id=$2 AND revoked_at IS NULL`, id, user.ID); err == nil {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ai_studio.canvas_project_shares (project_id,owner_user_id,token_hash)
			VALUES ($1,$2,$3)`, id, user.ID, hashHex)
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": "创建分享失败", "code": "SHARE_CREATE_FAILED"})
		return
	}
	coreCanvasJSON(r, w, http.StatusCreated, map[string]any{"share": map[string]any{
		"active": true, "path": "/canvas/share/" + token,
	}})
}

func coreBase64URL(b []byte) string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	out := make([]byte, 0, (len(b)*8+5)/6)
	acc, bits := 0, 0
	for _, v := range b {
		acc = acc<<8 | int(v)
		bits += 8
		for bits >= 6 {
			bits -= 6
			out = append(out, alphabet[(acc>>bits)&63])
		}
	}
	if bits > 0 {
		out = append(out, alphabet[(acc<<(6-bits))&63])
	}
	return string(out)
}

// DELETE /api/canvas/projects/[id]/share — revoke active share.
func (d *Dependencies) coreCanvasShareDelete(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 1024, false); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_project_share_revoke", user.ID, 60, time.Hour) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var revoked time.Time
	err := pool.QueryRow(r.Context(), `
		UPDATE ai_studio.canvas_project_shares s SET revoked_at=now()
		FROM ai_studio.canvas_projects p
		WHERE s.project_id=$1 AND s.owner_user_id=$2 AND s.revoked_at IS NULL
		  AND p.id=s.project_id AND p.owner_user_id=s.owner_user_id AND p.deleted_at IS NULL
		RETURNING s.revoked_at`, pathParam(r, "id"), user.ID).Scan(&revoked)
	if coreIsNoRows(err) {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "没有有效的画布分享", "code": "SHARE_NOT_FOUND"})
		return
	}
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "撤销分享失败", "code": "SHARE_REVOKE_FAILED"})
		return
	}
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"ok": true, "revokedAt": revoked.UTC().Format(time.RFC3339Nano)})
}

// GET /api/canvas/shares/[token] — token-hash lookup + URL rewriting.
func (d *Dependencies) coreCanvasShareRead(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if _, ok := coreCanvasUser(w, r, u); !ok {
		return
	}
	token := pathParam(r, "token")
	if !coreShareTokenRe.MatchString(token) {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "分享链接无效或已撤销", "code": "SHARE_NOT_FOUND"})
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	share, err := coreCanvasShareByHash(r.Context(), pool, token)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "分享链接无效或已撤销", "code": "SHARE_NOT_FOUND"})
		return
	}
	var snapshot any = share["snapshot_json"]
	if s, ok := share["snapshot_json"].(string); ok {
		var v any
		if json.Unmarshal([]byte(s), &v) == nil {
			snapshot = v
		}
	}
	rewritten := coreRewriteShareURLs(snapshot, token)
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"project": map[string]any{
		"id": share["project_id"], "name": share["name"], "version": share["version"], "snapshot": rewritten,
	}})
}

func coreCanvasShareByHash(ctx context.Context, pool *pgxpool.Pool, token string) (map[string]any, error) {
	hash := sha256.Sum256([]byte(token))
	rows, err := pool.Query(ctx, `
		SELECT s.project_id, s.owner_user_id, s.created_at, p.name, p.snapshot_json, p.version
		FROM ai_studio.canvas_project_shares s
		JOIN ai_studio.canvas_projects p ON p.id=s.project_id AND p.owner_user_id=s.owner_user_id AND p.deleted_at IS NULL
		WHERE s.token_hash=$1 AND s.revoked_at IS NULL LIMIT 1`, hex.EncodeToString(hash[:]))
	if err != nil {
		return nil, err
	}
	list, err := coreScalarRows(rows)
	if err != nil || len(list) == 0 {
		return nil, pgx.ErrNoRows
	}
	return list[0], nil
}

var coreShareAssetURLRe = regexp.MustCompile(`/api/canvas/assets/([A-Za-z0-9_-]{1,128})/content(\?[^#]*)?(?:#.*)?$`)

func coreRewriteShareURLs(v any, token string) any {
	switch t := v.(type) {
	case []any:
		out := make([]any, len(t))
		for i, item := range t {
			out[i] = coreRewriteShareURLs(item, token)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, item := range t {
			if (k == "contentUrl" || k == "content" || k == "url" || k == "dataUrl") && coreStringSafe(item) {
				s := item.(string)
				if m := coreShareAssetURLRe.FindStringSubmatch(s); m != nil {
					out[k] = "/api/canvas/shares/" + token + "/assets/" + url.PathEscape(m[1]) + "/content" + m[2]
					continue
				}
			}
			out[k] = coreRewriteShareURLs(item, token)
		}
		return out
	default:
		return v
	}
}

func coreStringSafe(v any) bool {
	_, ok := v.(string)
	return ok
}

// collectCanvasShareAssetIds() — allowlist only assets referenced by the snapshot.
func coreCollectShareAssetIDs(v any, out map[string]bool, depth int) {
	if depth > 100 {
		return
	}
	switch t := v.(type) {
	case []any:
		for _, item := range t {
			coreCollectShareAssetIDs(item, out, depth+1)
		}
	case map[string]any:
		for k, item := range t {
			if s, ok := item.(string); ok {
				switch k {
				case "assetId":
					if regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`).MatchString(s) {
						out[s] = true
					}
				case "storageKey":
					if strings.HasPrefix(s, "koyo-asset:") {
						out[strings.TrimPrefix(s, "koyo-asset:")] = true
					}
				case "contentUrl", "content", "url", "dataUrl":
					if m := coreShareAssetURLRe.FindStringSubmatch(s); m != nil {
						out[m[1]] = true
					}
				}
			}
			coreCollectShareAssetIDs(item, out, depth+1)
		}
	}
}

// GET/HEAD /api/canvas/shares/[token]/assets/[id]/content — shared asset stream.
func (d *Dependencies) coreCanvasSharedAssetContent(headOnly bool) domainFn {
	return func(w http.ResponseWriter, r *http.Request, dd *Dependencies, u *middleware.SessionUser) {
		const fmt = envelope.FormatDirectDomainJSON
		if _, ok := coreCanvasUser(w, r, u); !ok {
			return
		}
		token := pathParam(r, "token")
		id := pathParam(r, "id")
		if !coreShareTokenRe.MatchString(token) {
			coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "分享链接无效或已撤销", "code": "SHARE_NOT_FOUND"})
			return
		}
		pool, ok := coreDB(coreBoundDeps(d, dd), w, r, fmt)
		if !ok {
			return
		}
		share, err := coreCanvasShareByHash(r.Context(), pool, token)
		if err != nil {
			coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "分享链接无效或已撤销", "code": "SHARE_NOT_FOUND"})
			return
		}
		var snapshot any = share["snapshot_json"]
		if s, ok := share["snapshot_json"].(string); ok {
			var v any
			if json.Unmarshal([]byte(s), &v) == nil {
				snapshot = v
			}
		}
		ids := map[string]bool{}
		coreCollectShareAssetIDs(snapshot, ids, 0)
		if !ids[id] {
			coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "分享画布中没有该素材", "code": "SHARED_ASSET_NOT_FOUND"})
			return
		}
		ownerID := coreString(share["owner_user_id"])
		coreServeCanvasAsset(w, r, coreBoundDeps(d, dd), pool, ownerID, id, headOnly, true)
	}
}

// GET /api/canvas/jobs/[id] — linked job + creation trace projection.
func (d *Dependencies) coreCanvasJobGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	id := pathParam(r, "id")
	rows, err := pool.Query(r.Context(), `
		SELECT j.job_id, j.project_id, j.node_id, j.model_id, j.status AS link_status,
		       c.status AS task_status, c.result_text, c.result_object_key, c.error_code,
		       c.credit_cost, c.quote_id, c.provider_request_id, c.created_at, c.updated_at,
		       j.result_asset_id
		FROM ai_studio.canvas_project_jobs j
		JOIN ai_studio.creations c ON c.id=j.job_id
		WHERE j.job_id=$1 AND j.owner_user_id=$2`, id, user.ID)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取任务失败", "code": "JOB_READ_FAILED"})
		return
	}
	list, err := coreScalarRows(rows)
	if err != nil || len(list) == 0 {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "任务不存在", "code": "JOB_NOT_FOUND"})
		return
	}
	j := list[0]
	jobStatus := coreString(j["task_status"])
	result := map[string]any{
		"text": j["result_text"], "assetId": j["result_asset_id"],
		"contentUrl": nil, "mimeType": nil,
	}
	if aid := coreString(j["result_asset_id"]); aid != "" {
		result["contentUrl"] = "/api/canvas/assets/" + url.PathEscape(aid) + "/content"
	}
	_, _ = pool.Exec(r.Context(), `UPDATE ai_studio.canvas_project_jobs SET status=$3 WHERE job_id=$1 AND owner_user_id=$2`, id, user.ID, jobStatus)
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"job": map[string]any{
		"id": id, "projectId": j["project_id"], "nodeId": j["node_id"], "modelId": j["model_id"],
		"quoteId": j["quote_id"], "providerRequestId": j["provider_request_id"],
		"status": jobStatus, "createdAt": j["created_at"], "updatedAt": j["updated_at"],
		"estimatedCredits": j["credit_cost"], "creditsUsed": j["credit_cost"], "result": result,
	}})
}

// GET /api/canvas/jobs — list linked jobs with idempotencyKey filters.
func (d *Dependencies) coreCanvasJobsList(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	keys := r.URL.Query()["idempotencyKey"]
	if len(keys) > 50 {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "幂等键查询无效", "code": "INVALID_IDEMPOTENCY_FILTER"})
		return
	}
	for _, k := range keys {
		if len(k) < 8 || len(k) > 200 {
			coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "幂等键查询无效", "code": "INVALID_IDEMPOTENCY_FILTER"})
			return
		}
	}
	page := queryInt(r, "page", 1, 1, 100000)
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	where := "j.owner_user_id=$1"
	args := []any{user.ID}
	if projectID := coreQuery(r, "projectId"); projectID != "" {
		args = append(args, projectID)
		where += " AND j.project_id=$" + strconv.Itoa(len(args))
	}
	if len(keys) > 0 {
		args = append(args, keys)
		where += " AND j.idempotency_key=ANY($" + strconv.Itoa(len(args)) + ")"
	}
	args = append(args, 50, (page-1)*50)
	rows, err := pool.Query(r.Context(), `
		SELECT j.job_id, j.project_id, j.node_id, j.model_id, j.idempotency_key, j.status,
		       j.result_asset_id, j.credits_used, j.created_at, j.updated_at,
		       c.status AS task_status, c.result_text, c.credit_cost
		FROM ai_studio.canvas_project_jobs j
		LEFT JOIN ai_studio.creations c ON c.id=j.job_id
		WHERE `+where+` ORDER BY j.created_at DESC LIMIT $`+strconv.Itoa(len(args)-1)+` OFFSET $`+strconv.Itoa(len(args)), args...)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取任务列表失败", "code": "JOB_LIST_FAILED"})
		return
	}
	list, err := coreScalarRows(rows)
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "读取任务列表失败", "code": "JOB_LIST_FAILED"})
		return
	}
	jobs := make([]map[string]any, 0, len(list))
	for _, j := range list {
		jobs = append(jobs, map[string]any{
			"id": j["job_id"], "projectId": j["project_id"], "nodeId": j["node_id"],
			"modelId": j["model_id"], "status": coreFirst(coreString(j["task_status"]), coreString(j["status"])),
			"result":    map[string]any{"text": j["result_text"], "assetId": j["result_asset_id"]},
			"createdAt": j["created_at"], "updatedAt": j["updated_at"],
		})
	}
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"jobs": jobs, "page": page})
}

// POST /api/canvas/jobs — create a canvas generation job from a consumed quote.
func (d *Dependencies) coreCanvasJobsCreate(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 256*1024, false); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_job_user", user.ID, 60, time.Hour) {
		return
	}
	body, ok := coreReadCanvasJSON(w, r, 256*1024)
	if !ok {
		return
	}
	if code, msg, conflict := coreOwnerConflict(user.ID, body); conflict {
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": msg, "code": code})
		return
	}
	projectID := coreString(body["projectId"])
	modelID := coreString(body["modelId"])
	nodeID := coreString(body["nodeId"])
	idem := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	quoteID := coreString(body["quoteId"])
	if projectID == "" || modelID == "" || nodeID == "" || quoteID == "" {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "缺少项目/节点/模型/报价标识", "code": "INVALID_JOB_REQUEST"})
		return
	}
	if len(idem) < 8 || len(idem) > 200 {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "生成任务必须提供有效的幂等键", "code": "IDEMPOTENCY_REQUIRED"})
		return
	}
	if params, ok := body["parameters"]; ok {
		raw := mustJSON(params)
		if len(raw) > 96*1024 {
			coreCanvasJSON(r, w, http.StatusRequestEntityTooLarge, map[string]any{"error": "生成参数过大", "code": "PARAMETERS_TOO_LARGE"})
			return
		}
		for _, forbidden := range []string{"provider", "apiKey", "api_key", "baseUrl", "base_url"} {
			if strings.Contains(strings.ToLower(raw), `"`+strings.ToLower(forbidden)+`"`) {
				coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "Canvas 不能提交 Provider 或凭据配置", "code": "PROVIDER_CONFIG_FORBIDDEN"})
				return
			}
		}
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	if _, err := coreCanvasProjectByID(r.Context(), pool, user.ID, projectID); err != nil {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "画布不存在", "code": "PROJECT_NOT_FOUND"})
		return
	}
	paramsMap, _ := body["parameters"].(map[string]any)
	if paramsMap == nil {
		paramsMap = map[string]any{}
	}
	res, err := d.generationSvc(pool).CreateTask(r.Context(), generation.CreateTaskRequest{
		UserID:         user.ID,
		StudioID:       "canvas",
		QuoteID:        quoteID,
		ModelID:        modelID,
		Parameters:     paramsMap,
		IdempotencyKey: idem,
		ProjectID:      projectID,
		NodeID:         nodeID,
	})
	if err != nil {
		status, code, msg := http.StatusConflict, "GENERATION_CREATE_FAILED", "创建生成任务失败"
		var pe *generation.PricingError
		if errors.As(err, &pe) && pe != nil {
			if pe.Status != 0 {
				status = pe.Status
			}
			code = pe.Code
			msg = pe.Message
		}
		coreCanvasJSON(r, w, status, map[string]any{"error": msg, "code": code})
		return
	}
	httpStatus := http.StatusCreated
	if res.Idempotent {
		httpStatus = http.StatusOK
	}
	coreCanvasJSON(r, w, httpStatus, map[string]any{"job": map[string]any{
		"id": res.CreationID, "projectId": projectID, "nodeId": nodeID, "modelId": modelID,
		"status": res.Status, "credits": res.Credits, "reservationId": res.ReservationID,
	}})
}

// POST /api/canvas/quotes — canvas-scoped quote with model/capability validation.
func (d *Dependencies) coreCanvasQuotes(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 256*1024, false); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_quote_user", user.ID, 60, time.Hour) {
		return
	}
	body, ok := coreReadCanvasJSON(w, r, 256*1024)
	if !ok {
		return
	}
	if code, msg, conflict := coreOwnerConflict(user.ID, body); conflict {
		coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": msg, "code": code})
		return
	}
	modelID := strings.TrimSpace(coreString(body["modelId"]))
	idem := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if modelID == "" {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "必须指定模型 ID", "code": "MODEL_ID_REQUIRED"})
		return
	}
	if len(idem) < 8 || len(idem) > 200 {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "报价请求必须提供有效的幂等键", "code": "IDEMPOTENCY_REQUIRED"})
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var category sqlNullString
	var capabilities []byte
	err := pool.QueryRow(r.Context(), `
		SELECT category, capabilities FROM ai_studio.ai_models
		WHERE id=$1 AND status='active' AND COALESCE(is_visible,true)`, modelID).Scan(&category, &capabilities)
	if coreIsNoRows(err) {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "模型当前不可用", "code": "MODEL_NOT_AVAILABLE"})
		return
	}
	if err != nil {
		coreCanvasJSON(r, w, http.StatusServiceUnavailable, map[string]any{"error": "暂时无法确认可靠报价，请稍后重试", "code": "QUOTE_FAILED"})
		return
	}
	if category.String != "image" && category.String != "image_edit" {
		coreCanvasJSON(r, w, http.StatusUnprocessableEntity, map[string]any{"error": "Canvas 当前仅开放已验证的图片生成能力", "code": "CANVAS_CAPABILITY_DISABLED"})
		return
	}
	if expected := coreString(body["capabilityVersion"]); expected != "" {
		h := sha256.Sum256(capabilities)
		if "cap_"+hex.EncodeToString(h[:8]) != expected {
			coreCanvasJSON(r, w, http.StatusConflict, map[string]any{"error": "模型能力已更新，请刷新参数并重新报价", "code": "MODEL_CAPABILITY_CHANGED"})
			return
		}
	}
	if !coreCanvasAllowedModels(r.Context(), pool, user.ID)[modelID] {
		coreCanvasJSON(r, w, http.StatusNotFound, map[string]any{"error": "该模型未挂载到无限画布", "code": "CANVAS_MODEL_UNMOUNTED"})
		return
	}
	paramsMap, _ := body["parameters"].(map[string]any)
	if paramsMap == nil {
		paramsMap = map[string]any{}
	}
	qr, err := d.generationSvc(pool).CreateQuote(r.Context(), generation.QuoteRequest{
		UserID:            user.ID,
		ModelID:           modelID,
		Site:              "canvas",
		Parameters:        paramsMap,
		IdempotencyKey:    idem,
		CapabilityVersion: coreString(body["capabilityVersion"]),
	})
	if err != nil {
		status, code, msg := http.StatusConflict, "QUOTE_FAILED", "暂时无法确认可靠报价，请稍后重试"
		var pe *generation.PricingError
		if errors.As(err, &pe) && pe != nil {
			if pe.Status != 0 {
				status = pe.Status
			}
			code = pe.Code
			msg = pe.Message
		}
		coreCanvasJSON(r, w, status, map[string]any{"error": msg, "code": code})
		return
	}
	coreCanvasJSON(r, w, http.StatusCreated, map[string]any{
		"quote_id": qr.QuoteID, "quoteId": qr.QuoteID, "credits": qr.Credits,
		"pricing_breakdown": qr.PricingBreakdown, "expires_at": qr.ExpiresAt.UTC().Format(time.RFC3339Nano),
	})
}

// GET /api/canvas/session — authenticated account + subscription entitlements.
func (d *Dependencies) coreCanvasSessionGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if u == nil && d != nil && d.Pool != nil {
		if authHdr := strings.TrimSpace(r.Header.Get("Authorization")); strings.HasPrefix(strings.ToLower(authHdr), "bearer ") {
			tok := strings.TrimSpace(authHdr[7:])
			if cs, err := d.canvasSvc(d.Pool).ValidateToken(r.Context(), tok); err == nil && cs != nil {
				u = &middleware.SessionUser{ID: cs.UserID, Role: cs.Scopes, UserNumber: cs.UserID}
			} else if fs, err := d.federationSvc(d.Pool).VerifyToken(r.Context(), tok); err == nil && fs != nil {
				u = &middleware.SessionUser{ID: fs.UserID, Status: fs.Status, UserNumber: fs.UserID}
			}
		}
	}
	user, ok := coreCanvasUser(w, r, u)
	if !ok {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	var isPaid bool
	planID := "free"
	planName := "Free"
	if user.PlanID != "" {
		planID = user.PlanID
	}
	if user.IsSubscribed {
		isPaid = true
		planName = planID
	}
	exclusiveFeatures := []string{}
	hasCanvasPremium := false
	if d != nil && d.Billing != nil {
		if ent, err := d.Billing.GetEntitlements(r.Context(), user.ID); err == nil && ent != nil {
			if ent.PlanID != "" {
				planID = ent.PlanID
			}
			isPaid = ent.IsSubscribed
			if len(ent.ExclusiveFeatures) > 0 {
				exclusiveFeatures = ent.ExclusiveFeatures
				for _, f := range ent.ExclusiveFeatures {
					if f == "canvas_premium" || f == "canvas_tools" || f == "all_tools" {
						hasCanvasPremium = true
						break
					}
				}
			}
		}
	}
	var coins float64
	_ = pool.QueryRow(r.Context(), `SELECT COALESCE(available_balance,0) FROM ops_bill.currency_wallets WHERE user_id=$1`, user.ID).Scan(&coins)
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{
		"user": map[string]any{
			"id": user.ID, "userNumber": user.UserNumber, "displayName": user.DisplayName,
			"avatar": user.AvatarURL, "email": user.Email, "phone": user.Phone,
			"isAdmin": user.Role == "admin" || user.Role == "super_admin", "kcoins": coins,
		},
		"credits": user.Credits,
		"subscription": map[string]any{
			"planId": planID, "planName": planName, "isPaid": isPaid,
			"exclusiveFeatures": exclusiveFeatures, "hasCanvasPremiumTools": hasCanvasPremium || isPaid,
		},
	})
}

// POST /api/canvas/session — canvas logout: revoke the ko_session row, clear cookie.
func (d *Dependencies) coreCanvasSessionLogout(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if !coreCanvasGuardEarly(w, r, d, fmt) {
		return
	}
	if status, code, msg := coreCanvasMutationGuard(r, 4*1024, false); status != 0 {
		coreCanvasGuardWrite(w, r, status, code, msg)
		return
	}
	cookie, err := r.Cookie(middleware.SessionCookieName)
	token := ""
	if err == nil {
		token = cookie.Value
	}
	subject := "missing-session"
	if token != "" {
		sum := sha256.Sum256([]byte(token))
		subject = hex.EncodeToString(sum[:])
	}
	if !coreLimitOr503(w, r, d, fmt, "canvas_session_logout", subject, 10, time.Minute) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	if token != "" {
		_, _ = pool.Exec(r.Context(), `
			UPDATE auth_usr.sessions SET revoked_at=now()
			WHERE token_hash=$1 AND revoked_at IS NULL`, middleware.HashSessionToken(token))
	}
	http.SetCookie(w, &http.Cookie{
		Name: middleware.SessionCookieName, Value: "", Path: "/",
		MaxAge: -1, Expires: time.Unix(0, 0).UTC(), HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: d.Config.IsProduction,
	})
	w.Header().Set("Cache-Control", "private, no-store")
	coreCanvasJSON(r, w, http.StatusOK, map[string]any{"ok": true})
	_ = u
}

// ===========================================================================
// Batch 4: community posts, coins, comments, likes, remix
// ===========================================================================

// coreCommunityPostExists validates a published/non-banned post for sub-routes.
func coreCommunityPostExists(ctx context.Context, pool *pgxpool.Pool, id string) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT 1 FROM ai_studio.community_posts WHERE id=$1 AND status<>'banned'`, id).Scan(&n)
	return n, err
}

// GET /api/community/posts — listCommunityPosts() with filters/viewer is_liked.
func (d *Dependencies) coreCommunityPostsList(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	category := coreFirst(coreQuery(r, "category"), "all")
	sort := coreFirst(coreQuery(r, "sort"), "trending")
	tag := coreQuery(r, "tag")
	q := coreQuery(r, "q")
	userID := coreQuery(r, "userId")
	featured := coreQuery(r, "featured") == "true"
	limit := queryInt(r, "limit", 24, 1, 100)
	offset := queryInt(r, "offset", 0, 0, 1000000)
	where := []string{"p.status = 'published'"}
	args := []any{}
	n := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if category != "all" {
		where = append(where, "p.media_type = "+n(category))
	}
	if tag != "" {
		where = append(where, n(tag)+" = ANY(p.tags)")
	}
	if q != "" {
		like := n("%" + q + "%")
		where = append(where, "(p.title ILIKE "+like+" OR p.prompt ILIKE "+like+" OR p.model_name ILIKE "+like+")")
	}
	if userID != "" {
		where = append(where, "p.user_id = "+n(userID))
	}
	if featured {
		where = append(where, "p.is_featured = TRUE")
	}
	order := "p.created_at DESC"
	switch sort {
	case "trending":
		order = "(p.likes_count * 4 + p.remix_count * 3 + p.views_count + EXTRACT(EPOCH FROM p.created_at)/86400) DESC"
	case "likes":
		order = "p.likes_count DESC, p.created_at DESC"
	}
	viewerSelect := "FALSE AS is_liked"
	if u != nil && u.ID != "" {
		viewerSelect = "EXISTS(SELECT 1 FROM ai_studio.community_likes l WHERE l.post_id=p.id AND l.user_id=" + n(u.ID) + ") AS is_liked"
	}
	args = append(args, limit, offset)
	rows, err := pool.Query(r.Context(), `
		SELECT p.id, p.creation_id, p.user_id, p.title, p.description, p.media_type, p.media_url,
		       p.cover_url, p.prompt, p.negative_prompt, p.model_name, p.parameters, p.tags,
		       p.likes_count, p.coins_count, p.views_count, p.remix_count, p.comments_count,
		       p.is_featured, p.created_at, u.display_name AS author_name,
		       u.avatar_url AS author_avatar, u.username AS author_username, `+viewerSelect+`
		FROM ai_studio.community_posts p
		LEFT JOIN auth_usr.users u ON p.user_id=u.id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY `+order+` LIMIT $`+strconv.Itoa(len(args)-1)+` OFFSET $`+strconv.Itoa(len(args)), args...)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COMMUNITY_LIST_FAILED", "获取社区作品失败")
		return
	}
	posts, err := coreScalarRows(rows)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COMMUNITY_LIST_FAILED", "获取社区作品失败")
		return
	}
	if posts == nil {
		posts = []map[string]any{}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"posts":      posts,
		"pagination": map[string]any{"limit": limit, "offset": offset, "hasMore": len(posts) == limit},
	})
}

// POST /api/community/posts — createCommunityPost() with ownership of creation.
func (d *Dependencies) coreCommunityPostsCreate(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	subject := clientIP(r)
	if u != nil && u.ID != "" {
		subject = u.ID
	}
	if !coreLimitOr503(w, r, d, fmt, "community.posts", subject, 20, time.Minute) {
		return
	}
	user, ok := coreNeedUser(w, u, "请登录后再分享作品到社区")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 256*1024) {
		return
	}
	body, ok := coreDecodeObject(w, r, 256*1024)
	if !ok {
		return
	}
	mediaURL := coreString(body["mediaUrl"])
	if mediaURL == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "MEDIA_URL_REQUIRED", "缺少作品媒体资源地址")
		return
	}
	title := coreFirst(coreString(body["title"]), "未命名作品")
	if len(title) > 255 {
		title = title[:255]
	}
	mediaType := coreFirst(coreString(body["mediaType"]), "image")
	if !coreContains([]string{"image", "video", "audio", "workflow"}, mediaType) {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_MEDIA_TYPE", "作品媒体类型无效")
		return
	}
	tags := coreStringSlice(body["tags"])
	if len(tags) > 10 {
		tags = tags[:10]
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	creationID := coreString(body["creationId"])
	if creationID != "" {
		owned, err := coreHasOwnedCreation(r.Context(), pool, user.ID, creationID)
		if err != nil || !owned {
			coreErr(w, r, fmt, http.StatusBadRequest, "CREATION_NOT_FOUND", "未找到指定作品记录")
			return
		}
	}
	id := coreNewID("post")
	params := body["parameters"]
	if params == nil {
		params = map[string]any{}
	}
	_, err := pool.Exec(r.Context(), `
		INSERT INTO ai_studio.community_posts
		  (id,creation_id,user_id,title,description,media_type,media_url,cover_url,prompt,
		   negative_prompt,model_name,parameters,tags,created_at,updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,now(),now())`,
		id, nullString(creationID), user.ID, title, nullString(coreString(body["description"])),
		mediaType, mediaURL, coreFirst(coreString(body["coverUrl"]), mediaURL),
		nullString(coreString(body["prompt"])), nullString(coreString(body["negativePrompt"])),
		nullString(coreString(body["modelName"])), mustJSON(params), tags)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COMMUNITY_CREATE_FAILED", "发布到社区失败")
		return
	}
	rows, err := pool.Query(r.Context(), `SELECT * FROM ai_studio.community_posts WHERE id=$1`, id)
	if err == nil {
		if list, e := coreScalarRows(rows); e == nil && len(list) > 0 {
			envelope.DomainJSON(w, http.StatusCreated, map[string]any{"post": list[0]})
			return
		}
	}
	envelope.DomainJSON(w, http.StatusCreated, map[string]any{"post": map[string]any{"id": id}})
}

// GET /api/community/posts/[id] — getCommunityPostById() increments views_count.
func (d *Dependencies) coreCommunityPostGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	id := pathParam(r, "id")
	_, _ = pool.Exec(r.Context(), `UPDATE ai_studio.community_posts SET views_count=views_count+1 WHERE id=$1`, id)
	viewerSelect := "FALSE AS is_liked"
	args := []any{id}
	if u != nil && u.ID != "" {
		args = append(args, u.ID)
		viewerSelect = "EXISTS(SELECT 1 FROM ai_studio.community_likes l WHERE l.post_id=p.id AND l.user_id=$2) AS is_liked"
	}
	rows, err := pool.Query(r.Context(), `
		SELECT p.*, u.display_name AS author_name, u.avatar_url AS author_avatar,
		       u.username AS author_username, u.bio AS author_bio, `+viewerSelect+`
		FROM ai_studio.community_posts p LEFT JOIN auth_usr.users u ON p.user_id=u.id
		WHERE p.id=$1 AND p.status <> 'banned'`, args...)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COMMUNITY_READ_FAILED", "获取作品详情失败")
		return
	}
	list, err := coreScalarRows(rows)
	if err != nil || len(list) == 0 {
		coreErr(w, r, fmt, http.StatusNotFound, "POST_NOT_FOUND", "作品不存在或已被作者删除")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"post": list[0]})
}

// DELETE /api/community/posts/[id] — owner or admin hard delete.
func (d *Dependencies) coreCommunityPostDelete(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 32*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "community_post_delete_user", user.ID, 30, time.Hour) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	id := pathParam(r, "id")
	isAdmin := user.Role == "admin" || user.Role == "super_admin"
	if err := d.communitySvc(pool).DeleteWork(r.Context(), id, user.ID, isAdmin); err != nil {
		coreErr(w, r, fmt, http.StatusForbidden, "POST_DELETE_FORBIDDEN", "作品不存在或无权删除")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "作品已成功从社区下架"})
}

// GET /api/community/posts/[id]/coin — total + user tipped + author flag.
func (d *Dependencies) coreCommunityCoinGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	postID := pathParam(r, "id")
	var coins int
	var authorID string
	err := pool.QueryRow(r.Context(), `SELECT COALESCE(coins_count,0), user_id FROM ai_studio.community_posts WHERE id=$1`, postID).Scan(&coins, &authorID)
	if coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusNotFound, "POST_NOT_FOUND", "作品不存在")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COIN_STATUS_FAILED", "读取投币信息失败")
		return
	}
	tipped := float64(0)
	if u != nil && u.ID != "" {
		_ = pool.QueryRow(r.Context(), `
			SELECT COALESCE(SUM(amount),0) FROM ops_bill.currency_journal_entries
			WHERE user_id=$1 AND biz_type='POST_COIN_TIP' AND biz_id=$2`, u.ID, postID).Scan(&tipped)
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"postId": postID, "totalCoins": coins, "userTipped": tipped,
		"isAuthor": u != nil && u.ID == authorID, "maxTipPerPost": 2,
	})
}

// POST /api/community/posts/[id]/coin — tipPostCoins(): transaction with wallet
// debit/credit, immutable journal entries and per-post cap of 2 coins.
func (d *Dependencies) coreCommunityCoinPost(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	if coreBodyTooLarge(w, r, fmt, 16*1024) {
		return
	}
	subject := clientIP(r)
	if u != nil && u.ID != "" {
		subject = u.ID
	}
	if !coreLimitOr503(w, r, d, fmt, "community.coin", subject, 30, time.Minute) {
		return
	}
	user, ok := coreNeedUser(w, u, "请先登录后再投币")
	if !ok {
		return
	}
	var body map[string]any
	raw, err := readBodyLimit(r, 16*1024)
	if err == nil && len(bytes.TrimSpace(raw)) > 0 {
		_ = json.Unmarshal(raw, &body)
	}
	amount := coreIntAny(body["amount"])
	if amount == 0 {
		amount = 1
	}
	if amount != 1 && amount != 2 {
		coreErr(w, r, fmt, http.StatusBadRequest, "INVALID_COIN_AMOUNT", "单次投币仅支持 1 或 2 枚 K 币")
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	postID := pathParam(r, "id")
	tx, err := pool.Begin(r.Context())
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COIN_TIP_FAILED", "投币失败")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var authorID string
	var title sqlNullString
	err = tx.QueryRow(r.Context(), `SELECT user_id, title FROM ai_studio.community_posts WHERE id=$1 FOR UPDATE`, postID).Scan(&authorID, &title)
	if coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusBadRequest, "POST_NOT_FOUND", "作品不存在或已被删除")
		return
	}
	if err != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "COIN_TIP_FAILED", "投币失败")
		return
	}
	if authorID == user.ID {
		coreErr(w, r, fmt, http.StatusBadRequest, "SELF_TIP_FORBIDDEN", "不能给自己的作品投币哦")
		return
	}
	var previous float64
	_ = tx.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(amount),0) FROM ops_bill.currency_journal_entries
		WHERE user_id=$1 AND biz_type='POST_COIN_TIP' AND biz_id=$2`, user.ID, postID).Scan(&previous)
	if previous+float64(amount) > 2 {
		remaining := 2 - int(previous)
		if remaining < 0 {
			remaining = 0
		}
		coreErr(w, r, fmt, http.StatusBadRequest, "TIP_LIMIT_EXCEEDED", stdfmt.Sprintf("每位用户对同一作品最多投 2 枚 K 币，您已投 %v 币，本次最多还可投 %d 币", previous, remaining))
		return
	}
	var senderBalance float64
	var senderLocked bool
	err = tx.QueryRow(r.Context(), `SELECT available_balance, is_locked FROM ops_bill.currency_wallets WHERE user_id=$1 FOR UPDATE`, user.ID).Scan(&senderBalance, &senderLocked)
	if err != nil || senderLocked || senderBalance < float64(amount) {
		coreErr(w, r, fmt, http.StatusBadRequest, "INSUFFICIENT_COINS", "您的 K 币余额不足，请明日继续登录打卡获取")
		return
	}
	_, err = tx.Exec(r.Context(), `
		INSERT INTO ops_bill.currency_wallets (user_id,available_balance,frozen_balance,restricted_balance,is_locked,version,updated_at,created_at)
		VALUES ($1,0,0,0,FALSE,1,now(),now()) ON CONFLICT (user_id) DO NOTHING`, authorID)
	if err != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "COIN_TIP_FAILED", "投币失败")
		return
	}
	var authorBalance float64
	if err = tx.QueryRow(r.Context(), `SELECT available_balance FROM ops_bill.currency_wallets WHERE user_id=$1 FOR UPDATE`, authorID).Scan(&authorBalance); err != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "COIN_TIP_FAILED", "投币失败")
		return
	}
	newSender := senderBalance - float64(amount)
	newAuthor := authorBalance + float64(amount)
	txID := coreNewID("tx_tip")
	desc := stdfmt.Sprintf("给作品《%s》投币 %d 枚", coreTruncate(title.String, 20), amount)
	if _, err = tx.Exec(r.Context(), `
		INSERT INTO ops_bill.currency_journal_entries
		  (id,transaction_id,user_id,account_code,direction,amount,balance_after,biz_type,biz_id,description,created_at)
		VALUES ($1,$2,$3,'2001','DEBIT',$4,$5,'POST_COIN_TIP',$6,$7,now())`,
		coreNewID("cje"), txID, user.ID, amount, newSender, postID, desc); err != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "COIN_TIP_FAILED", "投币失败")
		return
	}
	if _, err = tx.Exec(r.Context(), `
		INSERT INTO ops_bill.currency_journal_entries
		  (id,transaction_id,user_id,account_code,direction,amount,balance_after,biz_type,biz_id,description,created_at)
		VALUES ($1,$2,$3,'2001','CREDIT',$4,$5,'POST_COIN_RECEIVED',$6,$7,now())`,
		coreNewID("cje"), txID, authorID, amount, newAuthor, postID,
		stdfmt.Sprintf("作品《%s》收到投币 %d 枚", coreTruncate(title.String, 20), amount)); err != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "COIN_TIP_FAILED", "投币失败")
		return
	}
	if _, err = tx.Exec(r.Context(), `UPDATE ops_bill.currency_wallets SET available_balance=$1, version=version+1, updated_at=now() WHERE user_id=$2`, newSender, user.ID); err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE ops_bill.currency_wallets SET available_balance=$1, version=version+1, updated_at=now() WHERE user_id=$2`, newAuthor, authorID)
	}
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE ai_studio.community_posts SET coins_count=coins_count+$2, updated_at=now() WHERE id=$1`, postID, amount)
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		coreErr(w, r, fmt, http.StatusBadRequest, "COIN_TIP_FAILED", "投币失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"ok": true, "amount": amount, "postId": postID,
		"totalTipped": previous + float64(amount), "balance": newSender,
	})
}

func coreTruncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// GET /api/community/posts/[id]/comments — listCommunityComments().
func (d *Dependencies) coreCommunityCommentsGet(w http.ResponseWriter, r *http.Request, _ *Dependencies, _ *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	limit := queryInt(r, "limit", 50, 1, 200)
	rows, err := pool.Query(r.Context(), `
		SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
		       u.display_name AS author_name, u.avatar_url AS author_avatar
		FROM ai_studio.community_comments c
		LEFT JOIN auth_usr.users u ON u.id=c.user_id
		WHERE c.post_id=$1 ORDER BY c.created_at ASC LIMIT $2`, pathParam(r, "id"), limit)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COMMENTS_READ_FAILED", "获取评论失败")
		return
	}
	comments, err := coreScalarRows(rows)
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COMMENTS_READ_FAILED", "获取评论失败")
		return
	}
	if comments == nil {
		comments = []map[string]any{}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"comments": comments})
}

// POST /api/community/posts/[id]/comments — addCommunityComment().
func (d *Dependencies) coreCommunityCommentsPost(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录后再发表评论")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 32*1024) {
		return
	}
	body, ok := coreDecodeObject(w, r, 32*1024)
	if !ok {
		return
	}
	content := strings.TrimSpace(coreString(body["content"]))
	if content == "" {
		coreErr(w, r, fmt, http.StatusBadRequest, "EMPTY_COMMENT", "评论内容不能为空")
		return
	}
	if !corePromptOkay(content) {
		coreErr(w, r, fmt, http.StatusUnprocessableEntity, "CONTENT_POLICY_VIOLATION", "评论包含敏感或违规内容")
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "community_comment_user", user.ID, 30, time.Hour) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	postID := pathParam(r, "id")
	if _, err := coreCommunityPostExists(r.Context(), pool, postID); err != nil {
		coreErr(w, r, fmt, http.StatusNotFound, "POST_NOT_FOUND", "作品不存在")
		return
	}
	id := coreNewID("cmt")
	tx, err := pool.Begin(r.Context())
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COMMENT_CREATE_FAILED", "发表评论失败")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO ai_studio.community_comments (id,post_id,user_id,content,created_at)
		VALUES ($1,$2,$3,$4,now())`, id, postID, user.ID, content)
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE ai_studio.community_posts SET comments_count=comments_count+1, updated_at=now() WHERE id=$1`, postID)
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "COMMENT_CREATE_FAILED", "发表评论失败")
		return
	}
	envelope.DomainJSON(w, http.StatusCreated, map[string]any{"comment": map[string]any{
		"id": id, "postId": postID, "userId": user.ID, "content": content,
	}})
}

// POST /api/community/posts/[id]/like — toggleCommunityLike() (unique post,user).
func (d *Dependencies) coreCommunityLike(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录后再进行点赞")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 16*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "community_like_user", user.ID, 120, time.Hour) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	postID := pathParam(r, "id")
	tx, err := pool.Begin(r.Context())
	if err != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "LIKE_FAILED", "点赞操作失败")
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var exists int
	if err = tx.QueryRow(r.Context(), `SELECT 1 FROM ai_studio.community_posts WHERE id=$1`, postID).Scan(&exists); coreIsNoRows(err) {
		coreErr(w, r, fmt, http.StatusNotFound, "POST_NOT_FOUND", "作品不存在")
		return
	}
	var likeID string
	err = tx.QueryRow(r.Context(), `SELECT id FROM ai_studio.community_likes WHERE post_id=$1 AND user_id=$2`, postID, user.ID).Scan(&likeID)
	liked := false
	if coreIsNoRows(err) {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ai_studio.community_likes (id,post_id,user_id,created_at)
			VALUES ($1,$2,$3,now())`, coreNewID("like"), postID, user.ID)
		if err == nil {
			_, err = tx.Exec(r.Context(), `UPDATE ai_studio.community_posts SET likes_count=likes_count+1, updated_at=now() WHERE id=$1`, postID)
		}
		liked = true
	} else if err == nil {
		_, err = tx.Exec(r.Context(), `DELETE FROM ai_studio.community_likes WHERE id=$1`, likeID)
		if err == nil {
			_, err = tx.Exec(r.Context(), `UPDATE ai_studio.community_posts SET likes_count=GREATEST(0,likes_count-1), updated_at=now() WHERE id=$1`, postID)
		}
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		coreErr(w, r, fmt, http.StatusInternalServerError, "LIKE_FAILED", "点赞操作失败")
		return
	}
	var likes int
	_ = pool.QueryRow(r.Context(), `SELECT likes_count FROM ai_studio.community_posts WHERE id=$1`, postID).Scan(&likes)
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"liked": liked, "likesCount": likes})
}

// POST /api/community/posts/[id]/remix — recordRemixCount().
func (d *Dependencies) coreCommunityRemix(w http.ResponseWriter, r *http.Request, _ *Dependencies, u *middleware.SessionUser) {
	const fmt = envelope.FormatDirectDomainJSON
	user, ok := coreNeedUser(w, u, "请先登录后再使用做同款")
	if !ok {
		return
	}
	if coreBodyTooLarge(w, r, fmt, 16*1024) {
		return
	}
	if !coreLimitOr503(w, r, d, fmt, "community_remix_user", user.ID, 60, time.Hour) {
		return
	}
	pool, ok := coreDB(d, w, r, fmt)
	if !ok {
		return
	}
	tag, err := pool.Exec(r.Context(), `UPDATE ai_studio.community_posts SET remix_count=remix_count+1, updated_at=now() WHERE id=$1`, pathParam(r, "id"))
	if err != nil || tag.RowsAffected() == 0 {
		coreErr(w, r, fmt, http.StatusInternalServerError, "REMIX_FAILED", "记录做同款失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true})
}
