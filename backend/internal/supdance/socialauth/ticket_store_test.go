package socialauth

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

type fakeTicketStore struct {
	mu          sync.Mutex
	tickets     map[string]*OnboardingTicket
	fail        bool
	failConsume bool
	saved       int
}

func newFakeTicketStore(fail bool) *fakeTicketStore {
	return &fakeTicketStore{tickets: make(map[string]*OnboardingTicket), fail: fail}
}

func (f *fakeTicketStore) SaveTicket(_ context.Context, ticket *OnboardingTicket) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.fail {
		return errors.New("shared store unavailable")
	}
	f.saved++
	f.tickets[ticket.TicketID] = ticket
	return nil
}

func (f *fakeTicketStore) GetTicket(_ context.Context, ticketID string) (*OnboardingTicket, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.fail {
		return nil, errors.New("shared store unavailable")
	}
	ticket, ok := f.tickets[ticketID]
	if !ok {
		return nil, ticketExpiredError()
	}
	return ticket, nil
}

func (f *fakeTicketStore) ConsumeTicket(_ context.Context, ticketID string) (*OnboardingTicket, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.fail || f.failConsume {
		return nil, errors.New("shared store unavailable")
	}
	ticket, ok := f.tickets[ticketID]
	if !ok {
		return nil, ticketExpiredError()
	}
	delete(f.tickets, ticketID)
	return ticket, nil
}

func ticketStoreTestTicket(id string) *OnboardingTicket {
	return &OnboardingTicket{
		TicketID:         id,
		Provider:         ProviderBilibili,
		ProviderName:     "哔哩哔哩",
		Subject:          "bili-store-subject",
		ProviderUsername: "bili_store_user",
		ExpiresAt:        time.Now().Add(10 * time.Minute),
	}
}

func resetTicketStoreState(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		UseTicketStore(nil)
		globalTicketsMu.Lock()
		globalTickets = make(map[string]*OnboardingTicket)
		globalTicketsMu.Unlock()
	})
}

func TestOnboardingTicketSurvivesServiceRestartViaSharedStore(t *testing.T) {
	resetTicketStoreState(t)
	store := newFakeTicketStore(false)
	UseTicketStore(store)

	before := NewService(nil, nil)
	ticket := ticketStoreTestTicket("onboard_store_restart")
	before.saveTicket(ticket)
	if store.saved != 1 {
		t.Fatalf("shared store should receive the ticket, saved=%d", store.saved)
	}

	// A fresh Service instance models a backend restart or a second replica.
	after := NewService(nil, nil)
	got, err := after.getTicket(ticket.TicketID)
	if err != nil {
		t.Fatalf("ticket should survive restart: %v", err)
	}
	if got.Subject != ticket.Subject || got.Provider != ticket.Provider {
		t.Fatalf("ticket payload changed across restart: %+v", got)
	}

	consumed, err := after.consumeTicket(ticket.TicketID)
	if err != nil {
		t.Fatalf("first consume should succeed: %v", err)
	}
	if consumed.TicketID != ticket.TicketID {
		t.Fatalf("consumed wrong ticket: %+v", consumed)
	}
	if _, err := after.consumeTicket(ticket.TicketID); err == nil {
		t.Fatal("ticket replay must fail after consumption")
	}
}

func TestOnboardingTicketRequiresAtomicSharedStoreClaim(t *testing.T) {
	resetTicketStoreState(t)
	store := newFakeTicketStore(false)
	UseTicketStore(store)
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderBilibili, "client_id", "client_secret", false)

	ticket := ticketStoreTestTicket("onboard_store_claim")
	if err := svc.saveTicket(ticket); err != nil {
		t.Fatal(err)
	}
	store.failConsume = true
	req := CompleteOnboardingRequest{TicketID: ticket.TicketID, Username: "claim_test", AcceptedTerms: true}
	if _, _, err := svc.CompleteOnboarding(req); err == nil {
		t.Fatal("onboarding accepted a ticket that could not be atomically consumed")
	}
	var users int64
	if err := repo.db.Model(&model.User{}).Count(&users).Error; err != nil || users != 0 {
		t.Fatalf("account write occurred before ticket consumption: users=%d err=%v", users, err)
	}
	store.failConsume = false
	if _, _, err := svc.CompleteOnboarding(req); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.CompleteOnboarding(req); err == nil {
		t.Fatal("consumed onboarding ticket was accepted a second time")
	}
	store.fail = true
	if err := svc.saveTicket(ticket); err == nil {
		t.Fatal("shared store write failure was ignored")
	}
	if _, err := svc.getTicket(ticket.TicketID); err == nil {
		t.Fatal("ticket lookup fell back to memory during shared store failure")
	}
}

func TestRedisTicketStoreGuardsInvalidPayloads(t *testing.T) {
	store := &redisTicketStore{}

	if _, err := store.GetTicket(context.Background(), "  "); err == nil {
		t.Fatal("empty ticket id must fail without touching Redis")
	}
	if _, err := store.ConsumeTicket(context.Background(), ""); err == nil {
		t.Fatal("empty ticket id must fail without touching Redis")
	}
	if err := store.SaveTicket(context.Background(), &OnboardingTicket{TicketID: "onboard_expired", ExpiresAt: time.Now().Add(-time.Minute)}); err == nil {
		t.Fatal("expired ticket must not be saved")
	}
	if err := store.SaveTicket(context.Background(), &OnboardingTicket{ExpiresAt: time.Now().Add(time.Minute)}); err == nil {
		t.Fatal("ticket without id must be rejected")
	}

	if _, err := decodeStoredTicket([]byte("{invalid")); err == nil {
		t.Fatal("corrupt payload must fail closed")
	}
	expired, _ := json.Marshal(&OnboardingTicket{TicketID: "onboard_x", ExpiresAt: time.Now().Add(-time.Second)})
	if _, err := decodeStoredTicket(expired); err == nil {
		t.Fatal("expired stored ticket must fail closed")
	}
	valid, _ := json.Marshal(ticketStoreTestTicket("onboard_valid"))
	got, err := decodeStoredTicket(valid)
	if err != nil || got.TicketID != "onboard_valid" {
		t.Fatalf("valid payload should decode: %v %+v", err, got)
	}
}
