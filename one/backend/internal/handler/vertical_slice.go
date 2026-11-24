package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/config"
	"one/backend/internal/domain/admin"
	"one/backend/internal/domain/assets"
	"one/backend/internal/domain/auth"
	"one/backend/internal/domain/billing"
	"one/backend/internal/domain/canvas"
	"one/backend/internal/domain/community"
	"one/backend/internal/domain/federation"
	"one/backend/internal/domain/finance"
	"one/backend/internal/domain/generation"
	"one/backend/internal/domain/site"
	"one/backend/internal/domain/user"
	"one/backend/internal/middleware"
	"one/backend/internal/notify"
	"one/backend/internal/pkg/envelope"
	"one/backend/internal/platform/coordination"
	"one/backend/internal/platform/runtimelog"
	"one/backend/internal/queue"
	"one/backend/internal/storage"
)

type HealthChecker func(ctx context.Context) error

type Dependencies struct {
	Config      config.Config
	SessionAuth middleware.SessionLookup
	// Pool is the shared pgx pool (nil in unit tests). Wave 2/3 batches use it for the 4-schema
	// queries; handlers must degrade with an explicit DB_UNAVAILABLE error when it is nil rather
	// than fabricating data.
	Pool             *pgxpool.Pool
	Coord            *coordination.Coordinator
	Admin            *admin.Service
	Assets           *assets.Service
	Canvas           *canvas.Service
	Community        *community.Service
	Federation       *federation.Service
	Site             *site.Service
	Auth             *auth.Service
	User             *user.Service
	Finance          *finance.Service
	Billing          *billing.Service
	Generation       *generation.Service
	Storage          *storage.Service
	Notify           *notify.Service
	Events           *queue.EventHub
	DBCheck          HealthChecker
	RuntimeLog       *runtimelog.Buffer
	AgentModelCaller func(ctx context.Context, payload map[string]json.RawMessage) (any, error)
}

func writeSSEFrame(w http.ResponseWriter, eventName string, data []byte) {
	if eventName != "" {
		_, _ = fmt.Fprintf(w, "event: %s\n", eventName)
	}
	_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}

func (d *Dependencies) handleHealth(w http.ResponseWriter, r *http.Request) {
	dbOK := false
	if d.DBCheck != nil {
		dbOK = d.DBCheck(r.Context()) == nil
	}
	healthy := dbOK
	status := http.StatusOK
	overall := "healthy"
	depStatus := "healthy"
	if !healthy {
		status = http.StatusServiceUnavailable
		overall = "degraded"
		depStatus = "degraded"
	}
	w.Header().Set("Cache-Control", "no-store")
	envelope.DomainJSON(w, status, map[string]any{
		"status":     overall,
		"database":   map[string]any{"ok": dbOK},
		"migrations": map[string]any{"ok": dbOK},
		"worker":     map[string]any{"status": depStatus},
		"storage":    map[string]any{"status": depStatus},
		"email":      map[string]any{"status": depStatus},
		"providers":  map[string]any{"status": depStatus},
		"checkedAt":  time.Now().UTC().Format(time.RFC3339),
	})
}

func (d *Dependencies) handleLive(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"status":    "live",
		"checkedAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func (d *Dependencies) handleReady(w http.ResponseWriter, r *http.Request) {
	dbOK := false
	if d.DBCheck != nil {
		dbOK = d.DBCheck(r.Context()) == nil
	}
	ready := dbOK
	status := http.StatusOK
	readyStatus := "ready"
	depStatus := "healthy"
	if !ready {
		status = http.StatusServiceUnavailable
		readyStatus = "not_ready"
		depStatus = "degraded"
	}
	w.Header().Set("Cache-Control", "no-store")
	envelope.DomainJSON(w, status, map[string]any{
		"status":     readyStatus,
		"database":   map[string]any{"ok": dbOK},
		"migrations": map[string]any{"ok": dbOK},
		"worker":     map[string]any{"status": depStatus},
		"storage":    map[string]any{"status": depStatus},
		"email":      map[string]any{"status": depStatus},
		"providers":  map[string]any{"status": depStatus},
		"checkedAt":  time.Now().UTC().Format(time.RFC3339),
	})
}

func (d *Dependencies) handleSiteBranding(w http.ResponseWriter, r *http.Request) {
	svc := d.Site
	if svc == nil {
		svc = &site.Service{}
	}
	w.Header().Set("Cache-Control", "private, no-store, max-age=0")
	envelope.DomainJSON(w, http.StatusOK, svc.GetBranding(r.Context()))
}

func (d *Dependencies) handleSiteContentConfig(w http.ResponseWriter, r *http.Request) {
	svc := d.Site
	if svc == nil {
		svc = &site.Service{}
	}
	w.Header().Del("Pragma")
	w.Header().Set("Cache-Control", "public, max-age=15, stale-while-revalidate=60")
	envelope.DomainJSON(w, http.StatusOK, svc.GetContentConfig(r.Context()))
}

func (d *Dependencies) handleSiteSubscriptionFAQ(w http.ResponseWriter, r *http.Request) {
	locale, key, ok := site.SubscriptionFAQLocale(r.URL.Query().Get("locale"))
	if !ok {
		envelope.DomainError(w, http.StatusBadRequest, "不支持的订阅说明语言", "UNSUPPORTED_LOCALE")
		return
	}
	svc := d.Site
	if svc == nil {
		svc = &site.Service{}
	}
	config, err := svc.GetSubscriptionFAQ(r.Context(), locale, key)
	if err != nil {
		envelope.DomainError(w, http.StatusServiceUnavailable, "订阅说明暂时无法读取", "SUBSCRIPTION_FAQ_UNAVAILABLE")
		return
	}
	w.Header().Del("Pragma")
	w.Header().Set("Cache-Control", "public, no-cache")
	envelope.DomainJSON(w, http.StatusOK, config)
}

func (d *Dependencies) handleGetI18n(w http.ResponseWriter, r *http.Request) {
	svc := d.Site
	if svc == nil {
		svc = &site.Service{}
	}
	locale := r.URL.Query().Get("locale")
	payload, ok := svc.GetI18n(r.Context(), locale)
	if !ok {
		envelope.DomainError(w, http.StatusBadRequest, "Unsupported locale", "INVALID_LOCALE")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	envelope.DomainJSON(w, http.StatusOK, payload)
}

func (d *Dependencies) handlePostI18n(w http.ResponseWriter, r *http.Request) {
	svc := d.Site
	if svc == nil {
		svc = &site.Service{}
	}
	var body struct {
		Locale string `json:"locale"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		envelope.DomainError(w, http.StatusBadRequest, "Invalid JSON payload", "INVALID_JSON")
		return
	}
	payload, ok := svc.GetI18n(r.Context(), body.Locale)
	if !ok {
		envelope.DomainError(w, http.StatusBadRequest, "Unsupported locale", "INVALID_LOCALE")
		return
	}
	auth.SetLocaleCookies(w, payload.Locale, d.Config.IsProduction)
	envelope.DomainJSON(w, http.StatusOK, payload)
}

func (d *Dependencies) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	svc := d.Auth
	if svc == nil {
		svc = &auth.Service{}
	}
	user, _ := middleware.UserFromContext(r.Context())
	envelope.DomainJSON(w, http.StatusOK, svc.GetMe(r.Context(), user))
}

func (d *Dependencies) handleModelsActive(w http.ResponseWriter, r *http.Request) {
	svc := d.Generation
	if svc == nil {
		svc = &generation.Service{}
	}
	userID := ""
	if user, ok := middleware.UserFromContext(r.Context()); ok {
		userID = user.ID
	}
	resp, err := svc.GetActiveModels(r.Context(), r.URL.Query().Get("schemaVersion"), userID)
	if err != nil {
		if errors.Is(err, generation.ErrUnsupportedSchemaVersion) {
			envelope.DomainError(w, http.StatusConflict, "Unsupported canvas schemaVersion; expected 1 or 2", "UNSUPPORTED_SCHEMA_VERSION")
			return
		}
		envelope.DomainError(w, http.StatusInternalServerError, "Failed to load active models", "MODELS_LOAD_FAILED")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Add("Vary", "Cookie")
	envelope.DomainJSON(w, http.StatusOK, resp)
}

func (d *Dependencies) handleGenerationsEvents(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok || user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if d.Events == nil {
		d.Events = queue.NewEventHub()
	}

	taskID := r.URL.Query().Get("taskId")
	envelope.SetSSEHeaders(w)
	w.WriteHeader(http.StatusOK)

	_, _ = fmt.Fprint(w, ": connected\n\n")
	writeSSEFrame(w, "connected", []byte(`{"ok":true}`))

	ch, unsubscribe := d.Events.Subscribe(user.ID, taskID)
	defer unsubscribe()

	keepalive := time.NewTicker(15 * time.Second)
	defer keepalive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepalive.C:
			_, _ = fmt.Fprint(w, ": keepalive\n\n")
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		case evt, open := <-ch:
			if !open {
				return
			}
			payload, err := json.Marshal(evt)
			if err != nil {
				continue
			}
			writeSSEFrame(w, evt.Type, payload)
		}
	}
}
