package workshop

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const PageSize = 30

var (
	ErrInvalidProject = errors.New("invalid workshop project")
	ErrConflict       = errors.New("workshop project has changed")
)

type ProjectSummary struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Project struct {
	ProjectSummary
	Story    string `json:"story"`
	Revision int    `json:"revision"`
}

type Draft struct {
	Title string `json:"title"`
	Story string `json:"story"`
}

func (d Draft) normalized() (Draft, error) {
	d.Title = strings.TrimSpace(d.Title)
	if d.Title == "" || utf8.RuneCountInString(d.Title) > 160 || utf8.RuneCountInString(d.Story) > 20000 ||
		strings.ContainsRune(d.Title, 0) || strings.ContainsRune(d.Story, 0) {
		return Draft{}, ErrInvalidProject
	}
	return d, nil
}

type Projects struct {
	Pool *pgxpool.Pool
}

func (s Projects) List(ctx context.Context, owner string, offset int) ([]ProjectSummary, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text, title, updated_at FROM ai_studio.workshop_projects
		WHERE owner_user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`, owner, PageSize+1, offset)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[ProjectSummary])
}

const projectFields = `id::text, title, updated_at, story, revision`

func readProject(row pgx.Row) (Project, error) {
	var p Project
	err := row.Scan(&p.ID, &p.Title, &p.UpdatedAt, &p.Story, &p.Revision)
	return p, err
}

func (s Projects) Get(ctx context.Context, owner, id string) (Project, error) {
	return readProject(s.Pool.QueryRow(ctx, `SELECT `+projectFields+` FROM ai_studio.workshop_projects
		WHERE owner_user_id = $1 AND id = $2`, owner, id))
}

func (s Projects) Create(ctx context.Context, owner, key string, draft Draft) (Project, error) {
	draft, err := draft.normalized()
	if err != nil {
		return Project{}, err
	}
	project, err := readProject(s.Pool.QueryRow(ctx, `INSERT INTO ai_studio.workshop_projects (owner_user_id, creation_key, title, story)
		VALUES ($1, $2, $3, $4) ON CONFLICT (owner_user_id, creation_key) DO NOTHING RETURNING `+projectFields,
		owner, key, draft.Title, draft.Story))
	if !errors.Is(err, pgx.ErrNoRows) {
		return project, err
	}
	project, err = readProject(s.Pool.QueryRow(ctx, `SELECT `+projectFields+` FROM ai_studio.workshop_projects
		WHERE owner_user_id = $1 AND creation_key = $2`, owner, key))
	if err == nil && (project.Title != draft.Title || project.Story != draft.Story) {
		return Project{}, ErrConflict
	}
	return project, err
}

func (s Projects) Update(ctx context.Context, owner, id string, revision int, draft Draft) (Project, error) {
	draft, err := draft.normalized()
	if err != nil {
		return Project{}, err
	}
	project, err := readProject(s.Pool.QueryRow(ctx, `UPDATE ai_studio.workshop_projects
		SET title = $4, story = $5, revision = revision + 1, updated_at = now()
		WHERE owner_user_id = $1 AND id = $2 AND revision = $3 RETURNING `+projectFields,
		owner, id, revision, draft.Title, draft.Story))
	if !errors.Is(err, pgx.ErrNoRows) {
		return project, err
	}
	project, err = s.Get(ctx, owner, id)
	if err == nil && (project.Revision != revision+1 || project.Title != draft.Title || project.Story != draft.Story) {
		return Project{}, ErrConflict
	}
	return project, err
}
