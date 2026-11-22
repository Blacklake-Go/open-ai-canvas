package admin

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotImplemented = errors.New("admin domain repository not initialized")

type AuditLogEntry struct {
	ID         string `json:"id"`
	ActorID    string `json:"actor_id"`
	ActorEmail string `json:"actor_email,omitempty"`
	Permission string `json:"permission"`
	TargetType string `json:"target_type"`
	TargetID   string `json:"target_id"`
	RiskLevel  string `json:"risk_level,omitempty"`
	BeforeJSON any    `json:"before_json,omitempty"`
	AfterJSON  any    `json:"after_json,omitempty"`
	RequestID  string `json:"request_id"`
}

type Repository interface {
	RecordAudit(ctx context.Context, entry AuditLogEntry) error
}

type PGRepository struct {
	Pool *pgxpool.Pool
}

func marshalNullableJSON(v any) any {
	if v == nil {
		return nil
	}
	if s, ok := v.(string); ok {
		if s == "" {
			return nil
		}
		return s
	}
	if b, ok := v.([]byte); ok {
		if len(b) == 0 {
			return nil
		}
		return string(b)
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return string(raw)
}

func (r *PGRepository) RecordAudit(ctx context.Context, entry AuditLogEntry) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	id := entry.ID
	if id == "" {
		var b [8]byte
		if _, err := rand.Read(b[:]); err == nil {
			id = "aud_" + hex.EncodeToString(b[:])
		} else {
			id = fmt.Sprintf("aud_%d", time.Now().UnixNano())
		}
	}
	actorID := entry.ActorID
	if actorID == "" {
		actorID = "system"
	}
	risk := entry.RiskLevel
	if risk == "" {
		risk = "low"
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO ops_bill.admin_audit_logs
			(id, actor_id, actor_email, action, target_type, target_id, risk_level,
			 before_json, after_json, request_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, now())`,
		id, actorID, entry.ActorEmail, entry.Permission, entry.TargetType, entry.TargetID,
		risk, marshalNullableJSON(entry.BeforeJSON), marshalNullableJSON(entry.AfterJSON), entry.RequestID)
	return err
}

type Service struct {
	Repo Repository
}

func (s *Service) RecordAudit(ctx context.Context, entry AuditLogEntry) error {
	if s.Repo == nil {
		return ErrNotImplemented
	}
	return s.Repo.RecordAudit(ctx, entry)
}
