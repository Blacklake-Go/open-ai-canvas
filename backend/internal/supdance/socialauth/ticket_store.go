package socialauth

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"yingce/backend/internal/kernel"
)

// TicketStore persists onboarding tickets outside the backend process so a
// restart or an additional replica cannot lose or replay a pending ticket.
type TicketStore interface {
	SaveTicket(ctx context.Context, ticket *OnboardingTicket) error
	GetTicket(ctx context.Context, ticketID string) (*OnboardingTicket, error)
	ConsumeTicket(ctx context.Context, ticketID string) (*OnboardingTicket, error)
}

const (
	ticketKeyPrefix    = "supdance:socialauth:onboarding-ticket:"
	ticketStoreTimeout = 5 * time.Second
)

var (
	ticketStoreMu     sync.RWMutex
	activeTicketStore TicketStore
)

// UseTicketStore installs the shared ticket store for every Service instance.
// Passing nil restores the single-process in-memory fallback used by tests.
func UseTicketStore(store TicketStore) {
	ticketStoreMu.Lock()
	defer ticketStoreMu.Unlock()
	activeTicketStore = store
}

func currentTicketStore() TicketStore {
	ticketStoreMu.RLock()
	defer ticketStoreMu.RUnlock()
	return activeTicketStore
}

func ticketStoreContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), ticketStoreTimeout)
}

func ticketExpiredError() error {
	return kernel.BadAuthRequest("授权入站凭证已过期或不存在，请重新发起登录")
}

// redisTicketStore keeps tickets in Redis with their original TTL. Consumption
// is an atomic read-and-delete so concurrent replicas cannot replay a ticket.
type redisTicketStore struct {
	client redis.UniversalClient
}

var ticketConsumeScript = redis.NewScript(`
local value = redis.call('GET', KEYS[1])
if value then
	redis.call('DEL', KEYS[1])
end
return value
`)

// NewRedisTicketStore returns a TicketStore backed by the shared Redis client.
func NewRedisTicketStore(client redis.UniversalClient) TicketStore {
	return &redisTicketStore{client: client}
}

func (s *redisTicketStore) SaveTicket(ctx context.Context, ticket *OnboardingTicket) error {
	if ticket == nil || strings.TrimSpace(ticket.TicketID) == "" {
		return errors.New("入站票据缺少标识")
	}
	payload, err := json.Marshal(ticket)
	if err != nil {
		return err
	}
	ttl := time.Until(ticket.ExpiresAt)
	if ttl <= 0 {
		return ticketExpiredError()
	}
	return s.client.Set(ctx, ticketKeyPrefix+ticket.TicketID, payload, ttl).Err()
}

func (s *redisTicketStore) GetTicket(ctx context.Context, ticketID string) (*OnboardingTicket, error) {
	ticketID = strings.TrimSpace(ticketID)
	if ticketID == "" {
		return nil, ticketExpiredError()
	}
	payload, err := s.client.Get(ctx, ticketKeyPrefix+ticketID).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, ticketExpiredError()
	}
	if err != nil {
		return nil, err
	}
	return decodeStoredTicket(payload)
}

func (s *redisTicketStore) ConsumeTicket(ctx context.Context, ticketID string) (*OnboardingTicket, error) {
	ticketID = strings.TrimSpace(ticketID)
	if ticketID == "" {
		return nil, ticketExpiredError()
	}
	value, err := ticketConsumeScript.Run(ctx, s.client, []string{ticketKeyPrefix + ticketID}).Result()
	if errors.Is(err, redis.Nil) {
		return nil, ticketExpiredError()
	}
	if err != nil {
		return nil, err
	}
	payload, ok := value.(string)
	if !ok || payload == "" {
		return nil, ticketExpiredError()
	}
	return decodeStoredTicket([]byte(payload))
}

func decodeStoredTicket(payload []byte) (*OnboardingTicket, error) {
	var ticket OnboardingTicket
	if err := json.Unmarshal(payload, &ticket); err != nil {
		return nil, ticketExpiredError()
	}
	if strings.TrimSpace(ticket.TicketID) == "" || time.Now().After(ticket.ExpiresAt) {
		return nil, ticketExpiredError()
	}
	return &ticket, nil
}
