package federation

import (
	"context"
	"errors"
	"testing"
)

type stubRepo struct {
	sessions map[string]*FederationSession
}

func (s *stubRepo) VerifyFederationToken(_ context.Context, token string) (*FederationSession, error) {
	sess, ok := s.sessions[token]
	if !ok {
		return nil, ErrNotImplemented
	}
	return sess, nil
}

func TestServiceVerifyToken(t *testing.T) {
	unwired := &Service{}
	if _, err := unwired.VerifyToken(context.Background(), "tok"); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected ErrNotImplemented, got %v", err)
	}

	if _, err := (&PGRepository{}).VerifyFederationToken(context.Background(), "tok"); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected PGRepository nil pool ErrNotImplemented, got %v", err)
	}

	svc := &Service{Repo: &stubRepo{
		sessions: map[string]*FederationSession{
			"tok_123": {ClientID: "cli_1", UserID: "u1", Status: "active"},
		},
	}}
	got, err := svc.VerifyToken(context.Background(), "tok_123")
	if err != nil || got.ClientID != "cli_1" {
		t.Fatalf("unexpected VerifyToken result: got=%+v err=%v", got, err)
	}
}
