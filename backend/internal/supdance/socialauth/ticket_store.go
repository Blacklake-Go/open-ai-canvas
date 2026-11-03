package socialauth

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"yingce/backend/internal/kernel"
)

type TicketStore interface {
	SaveTicket(context.Context, *OnboardingTicket) error
	GetTicket(context.Context, string) (*OnboardingTicket, error)
	ConsumeTicket(context.Context, string) (*OnboardingTicket, error)
}

var ticketStoreState struct {
	sync.RWMutex
	store TicketStore
}

func UseTicketStore(store TicketStore) {
	ticketStoreState.Lock()
	defer ticketStoreState.Unlock()
	ticketStoreState.store = store
}

func currentTicketStore() TicketStore {
	ticketStoreState.RLock()
	defer ticketStoreState.RUnlock()
	return ticketStoreState.store
}

func ticketStoreContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 3*time.Second)
}

func ticketExpiredError() error {
	return kernel.BadAuthRequest("授权资料已过期，请重新登录")
}

type redisTicketStore struct{ client *redis.Client }

func NewRedisTicketStore(client *redis.Client) TicketStore { return &redisTicketStore{client: client} }

func (store *redisTicketStore) SaveTicket(ctx context.Context, ticket *OnboardingTicket) error {
	if store.client == nil {
		return errors.New("共享授权存储不可用")
	}
	ttl := time.Until(ticket.ExpiresAt)
	if ttl <= 0 {
		return ticketExpiredError()
	}
	stored := *ticket
	stored.TicketID = ""
	raw, err := json.Marshal(stored)
	if err != nil {
		return err
	}
	return store.client.Set(ctx, "supdance:onboarding:"+HashToken(ticket.TicketID), raw, ttl).Err()
}

func (store *redisTicketStore) read(ctx context.Context, ticketID string, consume bool) (*OnboardingTicket, error) {
	if store.client == nil {
		return nil, errors.New("共享授权存储不可用")
	}
	key := "supdance:onboarding:" + HashToken(ticketID)
	var raw string
	var err error
	if consume {
		raw, err = store.client.GetDel(ctx, key).Result()
	} else {
		raw, err = store.client.Get(ctx, key).Result()
	}
	if errors.Is(err, redis.Nil) {
		return nil, ticketExpiredError()
	}
	if err != nil {
		return nil, errors.New("共享授权存储暂时不可用")
	}
	var ticket OnboardingTicket
	if err := json.Unmarshal([]byte(raw), &ticket); err != nil {
		return nil, errors.New("授权资料无效，请重新登录")
	}
	if time.Now().After(ticket.ExpiresAt) {
		return nil, ticketExpiredError()
	}
	ticket.TicketID = ticketID
	return &ticket, nil
}

func (store *redisTicketStore) GetTicket(ctx context.Context, ticketID string) (*OnboardingTicket, error) {
	return store.read(ctx, ticketID, false)
}
func (store *redisTicketStore) ConsumeTicket(ctx context.Context, ticketID string) (*OnboardingTicket, error) {
	return store.read(ctx, ticketID, true)
}
