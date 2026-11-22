package community

import (
	"context"
	"errors"
	"testing"
)

type stubRepo struct {
	works map[string]*Work
}

func (s *stubRepo) GetWork(_ context.Context, workID string) (*Work, error) {
	w, ok := s.works[workID]
	if !ok {
		return nil, ErrNotImplemented
	}
	return w, nil
}

func (s *stubRepo) DeleteWork(_ context.Context, workID, actorUserID string, isAdmin bool) error {
	w, ok := s.works[workID]
	if !ok || (!isAdmin && w.AuthorID != actorUserID) {
		return ErrForbidden
	}
	delete(s.works, workID)
	return nil
}

func TestServiceGetWork(t *testing.T) {
	unwired := &Service{}
	if _, err := unwired.GetWork(context.Background(), "w1"); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected ErrNotImplemented, got %v", err)
	}

	if _, err := (&PGRepository{}).GetWork(context.Background(), "w1"); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected PGRepository nil pool ErrNotImplemented, got %v", err)
	}

	svc := &Service{Repo: &stubRepo{
		works: map[string]*Work{
			"w1": {ID: "w1", AuthorID: "u1", Title: "Neon Cut", Status: "published"},
		},
	}}
	got, err := svc.GetWork(context.Background(), "w1")
	if err != nil || got.Title != "Neon Cut" {
		t.Fatalf("unexpected GetWork result: got=%+v err=%v", got, err)
	}
	if err := svc.DeleteWork(context.Background(), "w1", "other", false); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden for non-owner delete, got %v", err)
	}
	if err := svc.DeleteWork(context.Background(), "w1", "u1", false); err != nil {
		t.Fatalf("expected owner DeleteWork ok, got %v", err)
	}
}
