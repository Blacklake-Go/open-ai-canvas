package assets

import (
	"context"
	"errors"
	"testing"
)

type stubRepo struct {
	items map[string]*Asset
}

func (s *stubRepo) GetAsset(_ context.Context, userID, assetID string) (*Asset, error) {
	a, ok := s.items[userID+":"+assetID]
	if !ok {
		return nil, ErrNotImplemented
	}
	return a, nil
}

func TestServiceGetAsset(t *testing.T) {
	unwired := &Service{}
	if _, err := unwired.GetAsset(context.Background(), "u1", "a1"); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected ErrNotImplemented, got %v", err)
	}

	if _, err := (&PGRepository{}).GetAsset(context.Background(), "u1", "a1"); !errors.Is(err, ErrNotImplemented) {
		t.Fatalf("expected PGRepository nil pool ErrNotImplemented, got %v", err)
	}

	svc := &Service{Repo: &stubRepo{
		items: map[string]*Asset{
			"u1:a1": {ID: "a1", UserID: "u1", Kind: "image", StorageKey: "uploads/u1/a1.png"},
		},
	}}
	got, err := svc.GetAsset(context.Background(), "u1", "a1")
	if err != nil || got.StorageKey != "uploads/u1/a1.png" {
		t.Fatalf("unexpected GetAsset result: got=%+v err=%v", got, err)
	}
}
