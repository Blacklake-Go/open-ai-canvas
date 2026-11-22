package ids

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math/big"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
)

const (
	MinUserIDDigits      = 6
	MaxUserIDDigits      = 64
	UserIDRandomAttempts = 32
)

var (
	userIDPattern          = regexp.MustCompile(`^[1-9][0-9]{5,63}$`)
	prefixedHex24Pattern   = regexp.MustCompile(`^[a-z][a-z0-9_]*_[0-9a-f]{24}$`)
	doublePrefixHexPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*_id_[0-9a-f]{24}$`)
)

// NewPrefixedID mirrors `randomId(prefix)` in Supdance Pro/lib/db/pg.js: `<prefix>_<24hex>`.
func NewPrefixedID(prefix string) (string, error) {
	clean := strings.TrimSpace(prefix)
	if clean == "" {
		clean = "id"
	}
	var buf [12]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", fmt.Errorf("generate prefixed id: %w", err)
	}
	return clean + "_" + hex.EncodeToString(buf[:]), nil
}

// NewDoublePrefixedID mirrors `${prefix}_${randomId()}` in Supdance Pro: `<prefix>_id_<24hex>`.
func NewDoublePrefixedID(prefix string) (string, error) {
	clean := strings.TrimSpace(prefix)
	if clean == "" {
		return "", errors.New("double prefixed id requires a non-empty prefix")
	}
	idPart, err := NewPrefixedID("id")
	if err != nil {
		return "", err
	}
	return clean + "_" + idPart, nil
}

func IsValidPrefixedHex24(id string) bool {
	return prefixedHex24Pattern.MatchString(id)
}

func IsValidDoublePrefixedHex24(id string) bool {
	return doublePrefixHexPattern.MatchString(id)
}

func IsValidUserID(id string) bool {
	return userIDPattern.MatchString(id)
}

func UserIDCapacity(digits int) (*big.Int, error) {
	if digits < MinUserIDDigits || digits > MaxUserIDDigits {
		return nil, fmt.Errorf("user ID length must be between %d and %d", MinUserIDDigits, MaxUserIDDigits)
	}
	pow := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits-1)), nil)
	return new(big.Int).Mul(big.NewInt(9), pow), nil
}

// RandomNumericUserID samples uniformly in [10^(digits-1), 10^digits - 1] without modulo bias.
func RandomNumericUserID(digits int, rng io.Reader) (string, error) {
	if rng == nil {
		rng = rand.Reader
	}
	capInt, err := UserIDCapacity(digits)
	if err != nil {
		return "", err
	}
	offset, err := rand.Int(rng, capInt)
	if err != nil {
		return "", fmt.Errorf("sample numeric user id: %w", err)
	}
	first := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits-1)), nil)
	return new(big.Int).Add(first, offset).String(), nil
}

// UserIDReservationStore abstracts the transactional reservation ledger (auth_usr.user_id_allocations).
type UserIDReservationStore interface {
	Reserve(ctx context.Context, candidate string, digits int) (bool, error)
	FindFirstAvailable(ctx context.Context, digits int) (string, bool, error)
	IsExhausted(ctx context.Context, digits int) (bool, error)
}

type UserIDAllocator struct {
	Store          UserIDReservationStore
	Random         io.Reader
	MinDigits      int
	MaxDigits      int
	RandomAttempts int
}

func (a UserIDAllocator) Allocate(ctx context.Context) (string, error) {
	if a.Store == nil {
		return "", errors.New("user ID reservation store is required")
	}
	minD := a.MinDigits
	if minD == 0 {
		minD = MinUserIDDigits
	}
	maxD := a.MaxDigits
	if maxD == 0 {
		maxD = MaxUserIDDigits
	}
	attempts := a.RandomAttempts
	if attempts <= 0 {
		attempts = UserIDRandomAttempts
	}
	if _, err := UserIDCapacity(minD); err != nil {
		return "", err
	}
	if _, err := UserIDCapacity(maxD); err != nil {
		return "", err
	}
	if minD > maxD {
		return "", errors.New("minimum user ID length exceeds maximum")
	}

	for digits := minD; digits <= maxD; digits++ {
		for {
			for i := 0; i < attempts; i++ {
				candidate, err := RandomNumericUserID(digits, a.Random)
				if err != nil {
					return "", err
				}
				ok, err := a.Store.Reserve(ctx, candidate, digits)
				if err != nil {
					return "", err
				}
				if ok {
					return candidate, nil
				}
			}
			if digits <= 18 {
				avail, found, err := a.Store.FindFirstAvailable(ctx, digits)
				if err != nil {
					return "", err
				}
				if !found {
					break
				}
				if len(avail) != digits || !IsValidUserID(avail) {
					return "", fmt.Errorf("available user ID %q must contain %d digits", avail, digits)
				}
				ok, err := a.Store.Reserve(ctx, avail, digits)
				if err != nil {
					return "", err
				}
				if ok {
					return avail, nil
				}
				continue
			}
			exhausted, err := a.Store.IsExhausted(ctx, digits)
			if err != nil {
				return "", err
			}
			if exhausted {
				break
			}
		}
	}
	return "", fmt.Errorf("no numeric user ID capacity remains up to %d digits", maxD)
}

// PGUserIDStore implements UserIDReservationStore against auth_usr.user_id_allocations inside a tx.
type PGUserIDStore struct {
	Tx pgx.Tx
}

func (s PGUserIDStore) Reserve(ctx context.Context, candidate string, digits int) (bool, error) {
	tag, err := s.Tx.Exec(ctx,
		`INSERT INTO auth_usr.user_id_allocations (user_id, digit_length) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
		candidate, digits,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s PGUserIDStore) FindFirstAvailable(ctx context.Context, digits int) (string, bool, error) {
	first := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits-1)), nil).Int64()
	last := new(big.Int).Sub(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits)), nil), big.NewInt(1)).Int64()
	var candidate string
	err := s.Tx.QueryRow(ctx, `
		SELECT gs::text
		FROM generate_series($1::bigint, $2::bigint) AS gs
		WHERE NOT EXISTS (
			SELECT 1 FROM auth_usr.user_id_allocations a WHERE a.user_id = gs::text
		)
		LIMIT 1
	`, first, last).Scan(&candidate)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return candidate, true, nil
}

func (s PGUserIDStore) IsExhausted(ctx context.Context, digits int) (bool, error) {
	capInt, err := UserIDCapacity(digits)
	if err != nil {
		return false, err
	}
	var countStr string
	err = s.Tx.QueryRow(ctx, `SELECT count(*)::text FROM auth_usr.user_id_allocations WHERE digit_length = $1`, digits).Scan(&countStr)
	if err != nil {
		return false, err
	}
	countInt, ok := new(big.Int).SetString(countStr, 10)
	if !ok {
		return false, fmt.Errorf("invalid count %q", countStr)
	}
	return countInt.Cmp(capInt) >= 0, nil
}
