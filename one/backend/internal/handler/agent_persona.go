package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"one/backend/internal/domain/agentpersona"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

var personaSlug = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,79}$`)

func init() {
	registerBatch(mountAgentPersonaRoutes)
}

func mountAgentPersonaRoutes(d *Dependencies, mount mountFunc) {
	store := agentpersona.Store{Pool: d.Pool}
	guard := func(required bool, next func(http.ResponseWriter, *http.Request, string)) http.Handler {
		inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "private, no-store")
			user, _ := middleware.UserFromContext(r.Context())
			owner := ""
			if user != nil {
				owner = user.ID
			}
			if expected := r.Header.Get("X-ONE-Expected-User"); expected != "" && expected != owner {
				envelope.DomainError(w, http.StatusConflict, "登录账户已更改", "AGENT_ACCOUNT_CHANGED")
				return
			}
			if store.Pool == nil {
				envelope.DomainError(w, http.StatusServiceUnavailable, "智能体暂不可用", "AGENT_UNAVAILABLE")
				return
			}
			if slug := r.PathValue("slug"); slug != "" && !personaSlug.MatchString(slug) {
				writePersonaResult(w, http.StatusOK, nil, pgx.ErrNoRows)
				return
			}
			if r.Method != http.MethodGet &&
				!coreLimitOr503(w, r, d, envelope.FormatDirectDomainJSON, "agent_profile_write", owner, 90, time.Minute) {
				return
			}
			next(w, r, owner)
		})
		if required {
			return middleware.RequireAuth(d.SessionAuth)(inner)
		}
		return middleware.OptionalAuth(d.SessionAuth)(inner)
	}

	const root = "/api/one/agents"
	mount("GET", root+"/templates", guard(false, func(w http.ResponseWriter, r *http.Request, owner string) {
		profiles, err := store.List(r.Context(), owner, true)
		writePersonaResult(w, http.StatusOK, profiles, err)
	}))
	mount("GET", root, guard(true, func(w http.ResponseWriter, r *http.Request, owner string) {
		profiles, err := store.List(r.Context(), owner, false)
		writePersonaResult(w, http.StatusOK, profiles, err)
	}))
	mount("GET", root+"/conversations", guard(true, func(w http.ResponseWriter, r *http.Request, owner string) {
		conversations, err := store.Conversations(r.Context(), owner)
		writePersonaResult(w, http.StatusOK, conversations, err)
	}))
	mount("GET", root+"/[slug]", guard(false, func(w http.ResponseWriter, r *http.Request, owner string) {
		profile, err := store.Get(r.Context(), owner, r.PathValue("slug"))
		writePersonaResult(w, http.StatusOK, profile, err)
	}))
	mount("POST", root, guard(true, func(w http.ResponseWriter, r *http.Request, owner string) {
		var input struct {
			agentpersona.Draft
			CreationKey string `json:"creationKey"`
		}
		if !decodeDesignSession(w, r, &input, 80<<10) || !designSessionUUID.MatchString(input.CreationKey) || !validPersonaDraft(&input.Draft) {
			writePersonaInputError(w)
			return
		}
		profile, err := store.Create(r.Context(), owner, input.CreationKey, input.Draft)
		writePersonaResult(w, http.StatusCreated, profile, err)
	}))
	mount("PUT", root+"/[slug]", guard(true, func(w http.ResponseWriter, r *http.Request, owner string) {
		var input struct {
			agentpersona.Draft
			Revision int `json:"revision"`
		}
		if !decodeDesignSession(w, r, &input, 80<<10) || input.Revision < 1 || input.Revision >= 1<<31-1 || !validPersonaDraft(&input.Draft) {
			writePersonaInputError(w)
			return
		}
		slug := r.PathValue("slug")
		profile, err := store.Update(r.Context(), owner, slug, input.Revision, input.Draft)
		if errors.Is(err, pgx.ErrNoRows) {
			current, readErr := store.Get(r.Context(), owner, slug)
			if readErr == nil && !current.Template {
				envelope.DomainError(w, http.StatusConflict, "此智能体已在其他页面更新", "AGENT_REVISION_CONFLICT")
				return
			}
			if readErr != nil {
				err = readErr
			}
		}
		writePersonaResult(w, http.StatusOK, profile, err)
	}))
	mount("POST", root+"/[slug]/conversations", guard(true, func(w http.ResponseWriter, r *http.Request, owner string) {
		var input struct {
			CreationKey string `json:"creationKey"`
			Title       string `json:"title"`
		}
		if !decodeDesignSession(w, r, &input, 4096) || !designSessionUUID.MatchString(input.CreationKey) {
			writePersonaInputError(w)
			return
		}
		title := strings.TrimSpace(input.Title)
		if title == "" || utf8.RuneCountInString(title) > 120 {
			writePersonaInputError(w)
			return
		}
		conversation, err := store.CreateConversation(r.Context(), owner, r.PathValue("slug"), input.CreationKey, title)
		writePersonaResult(w, http.StatusCreated, conversation, err)
	}))
	mount("GET", root+"/[slug]/conversations/[id]/jobs", guard(true, func(w http.ResponseWriter, r *http.Request, owner string) {
		id := r.PathValue("id")
		if !designSessionUUID.MatchString(id) {
			writePersonaResult(w, http.StatusOK, nil, pgx.ErrNoRows)
			return
		}
		jobs, err := store.Jobs(r.Context(), owner, r.PathValue("slug"), id)
		writePersonaResult(w, http.StatusOK, jobs, err)
	}))
}

func validPersonaDraft(draft *agentpersona.Draft) bool {
	draft.Name = strings.TrimSpace(draft.Name)
	draft.Description = strings.TrimSpace(draft.Description)
	draft.SystemPrompt = strings.TrimSpace(draft.SystemPrompt)
	draft.WelcomeMessage = strings.TrimSpace(draft.WelcomeMessage)
	return draft.Name != "" && utf8.RuneCountInString(draft.Name) <= 120 &&
		utf8.RuneCountInString(draft.Description) <= 1000 &&
		utf8.RuneCountInString(draft.WelcomeMessage) <= 1000 &&
		draft.SystemPrompt != "" && utf8.RuneCountInString(draft.SystemPrompt) <= 12000 &&
		corePromptOkay(draft.SystemPrompt)
}

func writePersonaResult(w http.ResponseWriter, status int, value any, err error) {
	switch {
	case err == nil:
		envelope.DomainJSON(w, status, value)
	case errors.Is(err, pgx.ErrNoRows):
		envelope.DomainError(w, http.StatusNotFound, "找不到此智能体或会话", "AGENT_NOT_FOUND")
	default:
		slog.Error("agent persona operation failed", "error", err)
		envelope.DomainError(w, http.StatusServiceUnavailable, "智能体暂不可用", "AGENT_UNAVAILABLE")
	}
}

func writePersonaInputError(w http.ResponseWriter) {
	envelope.DomainError(w, http.StatusBadRequest, "请检查智能体或会话内容", "AGENT_INVALID_INPUT")
}
