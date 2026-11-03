package socialauth

import (
	"context"
	"errors"
	"testing"
	"time"
)

type unavailableTicketStore struct{}

func (unavailableTicketStore) SaveTicket(context.Context, *OnboardingTicket) error {
	return errors.New("unavailable")
}
func (unavailableTicketStore) GetTicket(context.Context, string) (*OnboardingTicket, error) {
	return nil, errors.New("unavailable")
}
func (unavailableTicketStore) ConsumeTicket(context.Context, string) (*OnboardingTicket, error) {
	return nil, errors.New("unavailable")
}

func TestConfiguredTicketStoreFailureDoesNotUseLocalTicket(t *testing.T) {
	previous := currentTicketStore()
	t.Cleanup(func() { UseTicketStore(previous) })
	UseTicketStore(nil)
	svc := NewService(nil, nil)
	ticket := &OnboardingTicket{TicketID: RandomToken(), ExpiresAt: time.Now().Add(time.Minute)}
	if err := svc.saveTicket(ticket); err != nil {
		t.Fatal(err)
	}
	UseTicketStore(unavailableTicketStore{})
	if err := svc.saveTicket(ticket); err == nil {
		t.Fatal("failed shared save accepted")
	}
	if _, err := svc.getTicket(ticket.TicketID); err == nil {
		t.Fatal("shared read fell back to stale local ticket")
	}
	if _, err := svc.consumeTicket(ticket.TicketID); err == nil {
		t.Fatal("shared consume fell back to stale local ticket")
	}
}

func TestBilibiliWithoutExchangeRemainsUnavailable(t *testing.T) {
	if liveExchangeSupported(ProviderBilibili) {
		t.Fatal("provider with no code exchange advertised as available")
	}
	if _, err := redeemCode(t.Context(), ProviderBilibili, ProviderConfig{}, "code", "", ""); err == nil {
		t.Fatal("unimplemented exchange accepted")
	}
}
