package admin

import (
	"context"
	"errors"
	"testing"
)

type stubRepo struct {
	recorded []AuditLogEntry
}

func (s *stubRepo) RecordAudit(_ context.Context, entry AuditLogEntry) error {
	s.recorded = append(s.recorded, entry)
	return nil
}

func TestServiceRecordAudit(t *testing.T) {
	unwired := &Service{}
	if err := unwired.RecordAudit(context.Background(), AuditLogEntry{ActorID: "u1"}); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected ErrNotImplemented, got %v", err)
	}

	unwiredPG := &PGRepository{}
	if err := unwiredPG.RecordAudit(context.Background(), AuditLogEntry{ActorID: "u1"}); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected PGRepository nil pool ErrNotImplemented, got %v", err)
	}

	repo := &stubRepo{}
	svc := &Service{Repo: repo}
	entry := AuditLogEntry{ID: "aud_1", ActorID: "u1", Permission: "settingsWrite", TargetType: "system_setting", TargetID: "site", RequestID: "req_1"}
	if err := svc.RecordAudit(context.Background(), entry); err != nil {
		t.Fatalf("unexpected RecordAudit error: %v", err)
	}
	if len(repo.recorded) != 1 || repo.recorded[0].RequestID != "req_1" {
		t.Fatalf("unexpected recorded audit entries: %+v", repo.recorded)
	}
}
