package agenttext

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Job struct {
	ID         string    `json:"id"`
	Status     string    `json:"status"`
	Prompt     string    `json:"prompt"`
	ResultText string    `json:"resultText"`
	Error      string    `json:"error"`
	Model      string    `json:"model"`
	AssetID    string    `json:"assetId,omitempty"`
	Mode       string    `json:"mode"`
	Credits    int       `json:"credits"`
	CreatedAt  time.Time `json:"createdAt"`
}

func ListJobs(ctx context.Context, pool *pgxpool.Pool, owner, studioID string) ([]Job, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, status, COALESCE(input_summary_json->>'prompt', '') AS prompt,
		       COALESCE(result_text, '') AS result_text, COALESCE(error_reason, '') AS error,
		       COALESCE(model, '') AS model, COALESCE(asset_id,'') AS asset_id,
		       COALESCE(input_summary_json->>'task_type', '') AS mode, credit_cost AS credits, created_at
		FROM ai_studio.creations WHERE user_id=$1 AND studio_id=$2 AND deleted_at IS NULL
		ORDER BY created_at ASC, id ASC`, owner, studioID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[Job])
}

func Parameters(ctx context.Context, tx pgx.Tx, owner, studioID, systemPrompt, prompt string) (map[string]any, error) {
	rows, err := tx.Query(ctx, `
		SELECT LEFT(input_summary_json->>'prompt', 4000) AS prompt, LEFT(result_text, 4000) AS result_text
		FROM ai_studio.creations
		WHERE user_id=$1 AND studio_id=$2 AND status='succeeded' AND deleted_at IS NULL
		  AND input_summary_json->>'task_type'='t2t' AND NULLIF(result_text,'') IS NOT NULL
		  AND NULLIF(input_summary_json->>'prompt','') IS NOT NULL
		ORDER BY created_at DESC, id DESC LIMIT 8`, owner, studioID)
	if err != nil {
		return nil, err
	}
	type turn struct{ Prompt, ResultText string }
	history, err := pgx.CollectRows(rows, pgx.RowToStructByName[turn])
	if err != nil {
		return nil, err
	}
	messages := []map[string]string{{"role": "system", "content": systemPrompt}}
	for i := len(history) - 1; i >= 0; i-- {
		messages = append(messages,
			map[string]string{"role": "user", "content": history[i].Prompt},
			map[string]string{"role": "assistant", "content": history[i].ResultText})
	}
	messages = append(messages, map[string]string{"role": "user", "content": prompt})
	return map[string]any{"prompt": prompt, "task_type": "t2t", "messages": messages}, nil
}
