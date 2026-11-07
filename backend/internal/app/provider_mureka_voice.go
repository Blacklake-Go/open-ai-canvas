package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

// A reusable upstream voice belongs to the account behind one channel key and one owned recording.
type murekaVoiceRecord struct {
	Encrypted string    `json:"vocal,omitempty"`
	Lease     string    `json:"lease,omitempty"`
	Until     time.Time `json:"until,omitempty"`
}

func (s *Service) murekaVocalID(ctx context.Context, user, channel, source, accountKey string, create func() (string, error)) (string, error) {
	if user == "" || channel == "" || source == "" || accountKey == "" {
		return "", errors.New("incomplete Mureka vocal scope")
	}
	digest := sha256.Sum256([]byte(strings.Join([]string{user, channel, source, accountKey}, "\x00")))
	key := "mureka.voice." + hex.EncodeToString(digest[:])
	token := uuid.NewString()
	var record murekaVoiceRecord
	// Claim creation in a short DB transaction. Uploading the clip takes place outside the lock.
	err := s.repo.WithContext(ctx).Transaction(func(tx *repository.Repository) error {
		if err := tx.LockSystemSetting(key, "{}"); err != nil {
			return err
		}
		row, err := tx.SystemSetting(key)
		if err != nil {
			return err
		}
		if err = json.Unmarshal([]byte(row.ValueJSON), &record); err != nil {
			return err
		}
		if record.Encrypted != "" {
			return nil
		}
		if record.Lease != "" {
			if time.Now().Before(record.Until) {
				return errors.New("this vocal profile is being prepared; try again after the current task")
			}
			return errors.New("the previous vocal upload has no confirmed receipt; verify it with Mureka before creating another profile")
		}
		record.Lease, record.Until = token, time.Now().Add(10*time.Minute)
		b, err := json.Marshal(record)
		if err != nil {
			return err
		}
		row.ValueJSON = string(b)
		row.UpdatedBy = user
		return tx.SaveSystemSetting(row)
	})
	if err != nil {
		return "", err
	}
	if record.Encrypted != "" {
		id, err := s.decryptSettingSecret(record.Encrypted)
		if err != nil || !murekaID(id) {
			return "", errors.New("stored vocal profile is invalid")
		}
		return id, nil
	}
	id, err := create()
	if err != nil {
		// Only a definitive client rejection is safe to retry. A lost success response could have created a billable voice.
		var failed providerHTTPError
		if errors.As(err, &failed) && (failed.StatusCode == 400 || failed.StatusCode == 401 || failed.StatusCode == 403 || failed.StatusCode == 429) {
			if releaseErr := s.repo.WithContext(ctx).DeleteSystemSetting(key); releaseErr != nil {
				return "", errors.Join(err, releaseErr)
			}
		}
		return "", err
	}
	if !murekaID(id) {
		return "", errors.New("invalid vocal profile ID")
	}
	encrypted, err := s.encryptSettingSecret(id)
	if err != nil {
		return "", err
	}
	err = s.repo.WithContext(ctx).Transaction(func(tx *repository.Repository) error {
		if err := tx.LockSystemSetting(key, "{}"); err != nil {
			return err
		}
		row, err := tx.SystemSetting(key)
		if err != nil {
			return err
		}
		var current murekaVoiceRecord
		if err = json.Unmarshal([]byte(row.ValueJSON), &current); err != nil {
			return err
		}
		if current.Lease != token {
			return errors.New("vocal profile creation lease expired")
		}
		b, err := json.Marshal(murekaVoiceRecord{Encrypted: encrypted})
		if err != nil {
			return err
		}
		return tx.SaveSystemSetting(&model.SystemSetting{Key: key, ValueJSON: string(b), UpdatedBy: user, CreatedAt: row.CreatedAt})
	})
	if err != nil {
		return "", err
	}
	return id, nil
}
