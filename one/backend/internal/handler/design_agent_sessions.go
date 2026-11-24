package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"one/backend/internal/domain/designagent"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

var designSessionUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func init() {
	registerBatch(func(d *Dependencies, mount mountFunc) {
		store := designagent.Sessions{Pool: d.Pool}
		protect := func(requireID bool, next func(http.ResponseWriter, *http.Request, string, string)) http.Handler {
			return middleware.RequireAuth(d.SessionAuth)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Cache-Control", "private, no-store")
				user, _ := middleware.UserFromContext(r.Context())
				if expected := r.Header.Get("X-ONE-Expected-User"); expected != "" && expected != user.ID {
					envelope.DomainError(w, http.StatusConflict, "Active account changed", "DESIGN_AGENT_ACCOUNT_CHANGED")
					return
				}
				if store.Pool == nil {
					envelope.DomainError(w, http.StatusServiceUnavailable, "Design Agent sessions are unavailable", "DESIGN_AGENT_UNAVAILABLE")
					return
				}
				id := r.PathValue("id")
				if requireID && !designSessionUUID.MatchString(id) {
					writeDesignSession(w, http.StatusOK, nil, pgx.ErrNoRows)
					return
				}
				if r.Method != http.MethodGet &&
					!coreLimitOr503(w, r, d, envelope.FormatDirectDomainJSON, "design_agent_session_write", user.ID, 120, time.Minute) {
					return
				}
				next(w, r, user.ID, id)
			}))
		}

		const sessions = "/api/v1/creative-agent/sessions"
		mount("GET", sessions, protect(false, func(w http.ResponseWriter, r *http.Request, owner, _ string) {
			list, err := store.List(r.Context(), owner)
			writeDesignSession(w, http.StatusOK, list, err)
		}))
		mount("POST", sessions, protect(false, func(w http.ResponseWriter, r *http.Request, owner, _ string) {
			var input struct {
				Name        string `json:"name"`
				CreationKey string `json:"creationKey"`
			}
			if !decodeDesignSession(w, r, &input, 4096) || !designSessionUUID.MatchString(input.CreationKey) {
				writeDesignSessionInputError(w)
				return
			}
			name := strings.TrimSpace(input.Name)
			if name == "" || utf8.RuneCountInString(name) > 120 {
				writeDesignSessionInputError(w)
				return
			}
			session, err := store.Create(r.Context(), owner, input.CreationKey, name)
			writeDesignSession(w, http.StatusCreated, session, err)
		}))
		mount("PATCH", sessions+"/[id]", protect(true, func(w http.ResponseWriter, r *http.Request, owner, id string) {
			var input struct {
				Name string `json:"name"`
			}
			if !decodeDesignSession(w, r, &input, 4096) {
				writeDesignSessionInputError(w)
				return
			}
			name := strings.TrimSpace(input.Name)
			if name == "" || utf8.RuneCountInString(name) > 120 {
				writeDesignSessionInputError(w)
				return
			}
			session, err := store.Rename(r.Context(), owner, id, name)
			writeDesignSession(w, http.StatusOK, session, err)
		}))
		mount("DELETE", sessions+"/[id]", protect(true, func(w http.ResponseWriter, r *http.Request, owner, id string) {
			err := store.Delete(r.Context(), owner, id)
			writeDesignSession(w, http.StatusOK, map[string]string{"id": id}, err)
		}))
		mount("GET", sessions+"/[id]/messages", protect(true, func(w http.ResponseWriter, r *http.Request, owner, id string) {
			history, err := store.GetHistory(r.Context(), owner, id)
			writeDesignSession(w, http.StatusOK, history, err)
		}))
		mount("PATCH", sessions+"/[id]/messages", protect(true, func(w http.ResponseWriter, r *http.Request, owner, id string) {
			var input designagent.History
			if !decodeDesignSession(w, r, &input, 1<<20) || input.Revision < 1 || input.Revision >= 1<<31-1 ||
				!validDesignSessionMessages(input.Messages) {
				writeDesignSessionInputError(w)
				return
			}
			history, err := store.SaveHistory(r.Context(), owner, id, input.Revision, input.Messages)
			writeDesignSession(w, http.StatusOK, history, err)
		}))
		mount("GET", sessions+"/[id]/assets", protect(true, func(w http.ResponseWriter, r *http.Request, owner, id string) {
			items, err := store.ListAssets(r.Context(), owner, id)
			writeDesignSession(w, http.StatusOK, items, err)
		}))
		mount("GET", sessions+"/[id]/jobs", protect(true, func(w http.ResponseWriter, r *http.Request, owner, id string) {
			jobs, err := store.ListJobs(r.Context(), owner, id)
			writeDesignSession(w, http.StatusOK, jobs, err)
		}))
	})
}

func decodeDesignSession(w http.ResponseWriter, r *http.Request, value any, maxBytes int64) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBytes))
	decoder.DisallowUnknownFields()
	return decoder.Decode(value) == nil && decoder.Decode(new(any)) == io.EOF
}

func validDesignSessionMessages(raw json.RawMessage) bool {
	var messages []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(raw, &messages); err != nil || messages == nil || len(messages) > 300 {
		return false
	}
	for _, message := range messages {
		if message.Role != "user" && message.Role != "assistant" {
			return false
		}
	}
	return true
}

func writeDesignSessionInputError(w http.ResponseWriter) {
	envelope.DomainError(w, http.StatusBadRequest, "Design Agent session input is invalid", "DESIGN_AGENT_INVALID_INPUT")
}

func writeDesignSession(w http.ResponseWriter, status int, value any, err error) {
	switch {
	case err == nil:
		envelope.DomainJSON(w, status, value)
	case errors.Is(err, pgx.ErrNoRows):
		envelope.DomainError(w, http.StatusNotFound, "Design Agent session was not found", "DESIGN_AGENT_SESSION_NOT_FOUND")
	case errors.Is(err, designagent.ErrHistoryConflict):
		envelope.DomainError(w, http.StatusConflict, "Session changed in another tab. Refresh before editing.", "DESIGN_AGENT_HISTORY_CONFLICT")
	case errors.Is(err, designagent.ErrTurnPending):
		envelope.DomainError(w, http.StatusConflict, "Wait for the active turn before deleting the session.", "DESIGN_AGENT_TURN_PENDING")
	default:
		slog.Error("design agent session operation failed", "error", err)
		envelope.DomainError(w, http.StatusInternalServerError, "Design Agent sessions are unavailable", "DESIGN_AGENT_UNAVAILABLE")
	}
}
