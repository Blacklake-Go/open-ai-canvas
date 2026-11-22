package ids

import (
	"context"
	"regexp"
	"testing"
)

func TestPrefixedIDFormats(t *testing.T) {
	for _, prefix := range []string{"order", "gen", "sub", "wh", "pay", "fb", "otp", "acc_em"} {
		id, err := NewPrefixedID(prefix)
		if err != nil {
			t.Fatalf("NewPrefixedID(%q): %v", prefix, err)
		}
		re := regexp.MustCompile(`^` + regexp.QuoteMeta(prefix) + `_[0-9a-f]{24}$`)
		if !re.MatchString(id) {
			t.Fatalf("unexpected format for %q: %s", prefix, id)
		}
	}

	for _, prefix := range []string{"quote", "att", "cje", "tx_tip", "rdl", "pcr", "pm"} {
		id, err := NewDoublePrefixedID(prefix)
		if err != nil {
			t.Fatalf("NewDoublePrefixedID(%q): %v", prefix, err)
		}
		re := regexp.MustCompile(`^` + regexp.QuoteMeta(prefix) + `_id_[0-9a-f]{24}$`)
		if !re.MatchString(id) {
			t.Fatalf("unexpected double prefix format for %q: %s", prefix, id)
		}
	}
}

type fakeReservationStore struct {
	reserved map[string]int
	scanNext map[int]string
}

func (f *fakeReservationStore) Reserve(_ context.Context, candidate string, digits int) (bool, error) {
	if _, exists := f.reserved[candidate]; exists {
		return false, nil
	}
	f.reserved[candidate] = digits
	return true, nil
}

func (f *fakeReservationStore) FindFirstAvailable(_ context.Context, digits int) (string, bool, error) {
	if v, ok := f.scanNext[digits]; ok {
		return v, true, nil
	}
	return "", false, nil
}

func (f *fakeReservationStore) IsExhausted(_ context.Context, _ int) (bool, error) {
	return false, nil
}

func TestUserIDAllocatorHappyAndFallback(t *testing.T) {
	store := &fakeReservationStore{
		reserved: map[string]int{},
		scanNext: map[int]string{7: "1000000"},
	}
	alloc := UserIDAllocator{Store: store}
	id, err := alloc.Allocate(context.Background())
	if err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	if len(id) != 6 || !IsValidUserID(id) {
		t.Fatalf("expected 6-digit valid user id, got %q", id)
	}
}

type alwaysCollide6Store struct {
	reserved map[string]int
}

func (s *alwaysCollide6Store) Reserve(_ context.Context, candidate string, digits int) (bool, error) {
	if digits == 6 {
		return false, nil
	}
	if _, exists := s.reserved[candidate]; exists {
		return false, nil
	}
	s.reserved[candidate] = digits
	return true, nil
}

func (s *alwaysCollide6Store) FindFirstAvailable(_ context.Context, digits int) (string, bool, error) {
	if digits == 6 {
		return "", false, nil
	}
	return "1000000", true, nil
}

func (s *alwaysCollide6Store) IsExhausted(_ context.Context, _ int) (bool, error) {
	return false, nil
}

func TestUserIDAllocatorPromotesTo7DigitsWhen6Exhausted(t *testing.T) {
	alloc := UserIDAllocator{
		Store:          &alwaysCollide6Store{reserved: map[string]int{}},
		RandomAttempts: 4,
	}
	id, err := alloc.Allocate(context.Background())
	if err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	if len(id) != 7 || !IsValidUserID(id) {
		t.Fatalf("expected 7-digit valid user id after 6-digit pool exhausted, got %q", id)
	}
}
