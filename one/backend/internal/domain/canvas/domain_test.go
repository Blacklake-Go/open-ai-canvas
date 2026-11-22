package canvas

import (
	"context"
	"errors"
	"testing"
)

type stubTokenRepo struct {
	sessions map[string]*TokenSession
}

func (s *stubTokenRepo) ValidateCanvasToken(_ context.Context, token string) (*TokenSession, error) {
	sess, ok := s.sessions[token]
	if !ok {
		return nil, ErrUnauthorized
	}
	return sess, nil
}

func TestServiceValidateToken(t *testing.T) {
	if _, err := (&Service{}).ValidateToken(context.Background(), "tok"); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected ErrNotImplemented, got %v", err)
	}
	if _, err := (&PGRepository{}).ValidateCanvasToken(context.Background(), "tok"); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected PGRepository nil pool ErrNotImplemented, got %v", err)
	}

	svc := &Service{Repo: &stubTokenRepo{
		sessions: map[string]*TokenSession{
			"tok_c": {UserID: "u1", Scopes: "canvas", IssuedAt: 1700000000},
		},
	}}
	got, err := svc.ValidateToken(context.Background(), "tok_c")
	if err != nil || got.UserID != "u1" {
		t.Fatalf("unexpected ValidateToken result: got=%+v err=%v", got, err)
	}
}
