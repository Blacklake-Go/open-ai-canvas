package agentpersona

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"one/backend/internal/domain/agenttext"
)

type Store struct{ Pool *pgxpool.Pool }

type Draft struct {
	Name           string `json:"name"`
	Description    string `json:"description"`
	SystemPrompt   string `json:"system_prompt"`
	WelcomeMessage string `json:"welcome_message"`
}

type Profile struct {
	Draft
	Slug     string `json:"agent_id"`
	Revision int    `json:"revision"`
	Template bool   `json:"is_template"`
}

type Conversation struct {
	ID           string    `json:"id"`
	AgentSlug    string    `json:"agent_slug"`
	AgentName    string    `json:"agent_name"`
	Title        string    `json:"title"`
	UpdatedAt    time.Time `json:"updated_at"`
	MessageCount int       `json:"message_count"`
}

const profileFields = `slug, name, description, CASE WHEN user_id=$1 THEN system_prompt ELSE '' END AS system_prompt,
	welcome_message, revision, (user_id IS NULL) AS template`

func scanProfile(row pgx.Row) (Profile, error) {
	var value Profile
	err := row.Scan(&value.Slug, &value.Name, &value.Description, &value.SystemPrompt, &value.WelcomeMessage, &value.Revision, &value.Template)
	return value, err
}

func (s Store) List(ctx context.Context, user string, templates bool) ([]Profile, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+profileFields+`
		FROM ai_studio.agent_profiles WHERE ($2 AND user_id IS NULL) OR (NOT $2 AND user_id=$1)
		ORDER BY updated_at DESC, slug`, user, templates)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Profile, error) { return scanProfile(row) })
}

func (s Store) Get(ctx context.Context, user, slug string) (Profile, error) {
	return scanProfile(s.Pool.QueryRow(ctx, `SELECT `+profileFields+`
		FROM ai_studio.agent_profiles WHERE slug=$2 AND (user_id=$1 OR user_id IS NULL)`, user, slug))
}

func (s Store) Create(ctx context.Context, user, key string, draft Draft) (Profile, error) {
	return scanProfile(s.Pool.QueryRow(ctx, `INSERT INTO ai_studio.agent_profiles
		(slug, user_id, creation_key, name, description, system_prompt, welcome_message)
		VALUES ('agent-' || gen_random_uuid()::text, $1, $2::uuid, $3, $4, $5, $6)
		ON CONFLICT (user_id, creation_key) DO UPDATE SET creation_key=EXCLUDED.creation_key
		RETURNING `+profileFields, user, key, draft.Name, draft.Description, draft.SystemPrompt, draft.WelcomeMessage))
}

func (s Store) Update(ctx context.Context, user, slug string, revision int, draft Draft) (Profile, error) {
	return scanProfile(s.Pool.QueryRow(ctx, `UPDATE ai_studio.agent_profiles
		SET name=$4, description=$5, system_prompt=$6, welcome_message=$7, revision=revision+1, updated_at=now()
		WHERE user_id=$1 AND slug=$2 AND revision=$3 RETURNING `+profileFields,
		user, slug, revision, draft.Name, draft.Description, draft.SystemPrompt, draft.WelcomeMessage))
}

func (s Store) CreateConversation(ctx context.Context, user, slug, key, title string) (Conversation, error) {
	var value Conversation
	err := s.Pool.QueryRow(ctx, `INSERT INTO ai_studio.agent_conversations (user_id, agent_slug, creation_key, title)
		SELECT $1, p.slug, $3::uuid, $4 FROM ai_studio.agent_profiles p WHERE p.slug=$2 AND (p.user_id IS NULL OR p.user_id=$1)
		ON CONFLICT (user_id, creation_key) DO UPDATE SET creation_key=EXCLUDED.creation_key
		  WHERE agent_conversations.agent_slug=EXCLUDED.agent_slug
		RETURNING id::text, agent_slug, title, created_at`, user, slug, key, title).
		Scan(&value.ID, &value.AgentSlug, &value.Title, &value.UpdatedAt)
	return value, err
}

func (s Store) Conversations(ctx context.Context, user string) ([]Conversation, error) {
	rows, err := s.Pool.Query(ctx, `SELECT c.id::text AS id, c.agent_slug, p.name AS agent_name, c.title,
		COALESCE(j.updated_at, c.created_at) AS updated_at, COALESCE(j.message_count,0)::int AS message_count
		FROM ai_studio.agent_conversations c JOIN ai_studio.agent_profiles p ON p.slug=c.agent_slug
		LEFT JOIN LATERAL (
			SELECT max(updated_at) AS updated_at, count(*) + count(NULLIF(result_text,'')) AS message_count
			FROM ai_studio.creations WHERE user_id=c.user_id AND studio_id='agent-chat:' || c.id::text AND deleted_at IS NULL
		) j ON true
		WHERE c.user_id=$1 AND (p.user_id IS NULL OR p.user_id=c.user_id) ORDER BY updated_at DESC, c.id DESC`, user)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[Conversation])
}

func (s Store) Jobs(ctx context.Context, user, slug, id string) ([]agenttext.Job, error) {
	var found bool
	err := s.Pool.QueryRow(ctx, `SELECT true FROM ai_studio.agent_conversations WHERE user_id=$1 AND agent_slug=$2 AND id=$3::uuid`, user, slug, id).Scan(&found)
	if err != nil {
		return nil, err
	}
	return agenttext.ListJobs(ctx, s.Pool, user, "agent-chat:"+strings.ToLower(id))
}

func LockConversation(ctx context.Context, tx pgx.Tx, user, id string) (string, error) {
	var systemPrompt string
	err := tx.QueryRow(ctx, `SELECT p.system_prompt FROM ai_studio.agent_conversations c
		JOIN ai_studio.agent_profiles p ON p.slug=c.agent_slug
		WHERE c.user_id=$1 AND c.id=$2::uuid AND (p.user_id IS NULL OR p.user_id=c.user_id)
		FOR UPDATE OF c`, user, id).Scan(&systemPrompt)
	return systemPrompt, err
}
