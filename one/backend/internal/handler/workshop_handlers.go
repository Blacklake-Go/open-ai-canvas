package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"

	"github.com/jackc/pgx/v5"
	"one/backend/internal/domain/workshop"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

var workshopUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func init() {
	registerBatch(func(d *Dependencies, mount mountFunc) {
		projects := workshop.Projects{Pool: d.Pool}
		protect := func(next func(http.ResponseWriter, *http.Request, string)) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Cache-Control", "private, no-store")
				middleware.RequireAuth(d.SessionAuth)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					user, _ := middleware.UserFromContext(r.Context())
					if expected := r.Header.Get("X-ONE-Expected-User"); expected != "" && expected != user.ID {
						envelope.DomainError(w, http.StatusConflict, "登录账户已更改", "WORKSHOP_ACCOUNT_CHANGED")
						return
					}
					if projects.Pool == nil {
						envelope.DomainError(w, http.StatusServiceUnavailable, "工作坊暂不可用", "WORKSHOP_UNAVAILABLE")
						return
					}
					next(w, r, user.ID)
				})).ServeHTTP(w, r)
			})
		}
		const path = "/api/workshop/projects"
		mount("GET", path, protect(func(w http.ResponseWriter, r *http.Request, owner string) {
			offset := 0
			if raw := r.URL.Query().Get("offset"); raw != "" {
				var err error
				offset, err = strconv.Atoi(raw)
				if err != nil || offset < 0 {
					writeWorkshopError(w, workshop.ErrInvalidProject)
					return
				}
			}
			items, err := projects.List(r.Context(), owner, offset)
			if err != nil {
				writeWorkshopError(w, err)
				return
			}
			hasMore := len(items) > workshop.PageSize
			if hasMore {
				items = items[:workshop.PageSize]
			}
			if items == nil {
				items = []workshop.ProjectSummary{}
			}
			envelope.DomainJSON(w, http.StatusOK, map[string]any{"projects": items, "pageSize": workshop.PageSize, "hasMore": hasMore})
		}))
		mount("GET", path+"/[id]", protect(func(w http.ResponseWriter, r *http.Request, owner string) {
			id := r.PathValue("id")
			if !workshopUUID.MatchString(id) {
				writeWorkshopError(w, pgx.ErrNoRows)
				return
			}
			project, err := projects.Get(r.Context(), owner, id)
			writeWorkshopProject(w, project, err)
		}))
		mount("POST", path, protect(func(w http.ResponseWriter, r *http.Request, owner string) {
			var input struct {
				workshop.Draft
				CreationKey string `json:"creationKey"`
			}
			if !decodeWorkshopDraft(w, r, &input) || !workshopUUID.MatchString(input.CreationKey) {
				writeWorkshopError(w, workshop.ErrInvalidProject)
				return
			}
			project, err := projects.Create(r.Context(), owner, input.CreationKey, input.Draft)
			writeWorkshopProject(w, project, err)
		}))
		mount("PUT", path+"/[id]", protect(func(w http.ResponseWriter, r *http.Request, owner string) {
			id := r.PathValue("id")
			if !workshopUUID.MatchString(id) {
				writeWorkshopError(w, pgx.ErrNoRows)
				return
			}
			var input struct {
				workshop.Draft
				Revision int `json:"revision"`
			}
			if !decodeWorkshopDraft(w, r, &input) || input.Revision < 1 || input.Revision >= 1<<31-1 {
				writeWorkshopError(w, workshop.ErrInvalidProject)
				return
			}
			project, err := projects.Update(r.Context(), owner, id, input.Revision, input.Draft)
			writeWorkshopProject(w, project, err)
		}))
	})
}

func decodeWorkshopDraft(w http.ResponseWriter, r *http.Request, value any) bool {
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256<<10))
	d.DisallowUnknownFields()
	return d.Decode(value) == nil && d.Decode(new(any)) == io.EOF
}

func writeWorkshopProject(w http.ResponseWriter, project workshop.Project, err error) {
	if err != nil {
		writeWorkshopError(w, err)
		return
	}
	envelope.DomainJSON(w, http.StatusOK, project)
}

func writeWorkshopError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		envelope.DomainError(w, http.StatusNotFound, "未找到项目", "WORKSHOP_NOT_FOUND")
	case errors.Is(err, workshop.ErrInvalidProject):
		envelope.DomainError(w, http.StatusBadRequest, "项目内容无效", "WORKSHOP_INVALID_PROJECT")
	case errors.Is(err, workshop.ErrConflict):
		envelope.DomainError(w, http.StatusConflict, "项目已更新", "WORKSHOP_CONFLICT")
	default:
		slog.Error("workshop project request failed", "error", err)
		envelope.DomainError(w, http.StatusInternalServerError, "工作坊暂不可用", "WORKSHOP_UNAVAILABLE")
	}
}
