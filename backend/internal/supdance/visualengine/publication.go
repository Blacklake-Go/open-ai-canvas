package visualengine

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

var ErrSnapshotNotFound = errors.New("未找到目标回滚版本")

func readSetting(repo *repository.Repository, key string, target any) (bool, error) {
	if repo == nil {
		return false, errors.New("视觉配置存储不可用")
	}
	setting, err := repo.SystemSettingOptional(key)
	if err != nil {
		return false, err
	}
	if setting == nil {
		return false, nil
	}
	if err := json.Unmarshal([]byte(setting.ValueJSON), target); err != nil {
		return false, fmt.Errorf("视觉配置存储损坏：%s", key)
	}
	return true, nil
}

func ReadConfig(repo *repository.Repository) (Config, error) {
	var raw json.RawMessage
	found, err := readSetting(repo, ConfigSettingKey, &raw)
	if err != nil {
		return Config{}, err
	}
	if !found {
		return DefaultConfig(), nil
	}
	return DecodeConfig(raw)
}

func ReadSnapshots(repo *repository.Repository) ([]Snapshot, error) {
	snapshots := []Snapshot{}
	_, err := readSetting(repo, SnapshotsSettingKey, &snapshots)
	return snapshots, err
}

func ReadAudit(repo *repository.Repository) ([]AuditEntry, error) {
	entries := []AuditEntry{}
	_, err := readSetting(repo, AuditSettingKey, &entries)
	return entries, err
}

func Publish(repo *repository.Repository, actor string, config Config, comment string, rollbackVersion string) error {
	if repo == nil || strings.TrimSpace(actor) == "" {
		return errors.New("视觉配置存储或操作人不可用")
	}
	if len(comment) > 2000 {
		return errors.New("发布说明不能超过 2000 字节")
	}
	if rollbackVersion == "" {
		if err := ValidateConfig(config); err != nil {
			return err
		}
	}
	return repo.Transaction(func(transaction *repository.Repository) error {
		initial, err := json.Marshal(DefaultConfig())
		if err != nil {
			return err
		}
		if err := transaction.LockSystemSetting(ConfigSettingKey, string(initial)); err != nil {
			return err
		}
		previous, err := ReadConfig(transaction)
		if err != nil {
			return err
		}
		snapshots, err := ReadSnapshots(transaction)
		if err != nil {
			return err
		}
		if len(snapshots) == 0 {
			snapshots = append(snapshots, Snapshot{Version: previous.PublishedVersion, Timestamp: previous.UpdatedAt, Actor: previous.UpdatedBy, Summary: "首次发布前的生效配置", Config: previous})
		}
		action := "config.publish"
		if rollbackVersion != "" {
			found := false
			for _, snapshot := range snapshots {
				if snapshot.Version == rollbackVersion {
					config = snapshot.Config
					found = true
					break
				}
			}
			if !found {
				return ErrSnapshotNotFound
			}
			comment = "回滚至历史版本 " + rollbackVersion
			action = "config.rollback"
		}
		if err := ValidateConfig(config); err != nil {
			return err
		}
		config.PublishedVersion = "2.0.0-" + uuid.NewString()
		config.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
		config.UpdatedBy = actor
		snapshot := Snapshot{Version: config.PublishedVersion, Timestamp: config.UpdatedAt, Actor: actor, Summary: comment, Config: config}
		snapshots = append([]Snapshot{snapshot}, snapshots...)
		entries, err := ReadAudit(transaction)
		if err != nil {
			return err
		}
		entries = append([]AuditEntry{{ID: uuid.NewString(), Timestamp: config.UpdatedAt, Actor: actor, Module: "VisualEngine", Action: action, Details: comment, Version: config.PublishedVersion, Success: true}}, entries...)
		for _, setting := range []struct {
			key   string
			value any
		}{{ConfigSettingKey, config}, {SnapshotsSettingKey, snapshots}, {AuditSettingKey, entries}} {
			raw, err := json.Marshal(setting.value)
			if err != nil {
				return err
			}
			if err := transaction.SaveSystemSetting(&model.SystemSetting{Key: setting.key, ValueJSON: string(raw), UpdatedAt: time.Now()}); err != nil {
				return err
			}
		}
		return nil
	})
}
