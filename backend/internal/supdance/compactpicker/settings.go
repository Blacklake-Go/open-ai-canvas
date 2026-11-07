package compactpicker

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

const PluginID = "supdance-compact-model-picker"
const settingKey = "plugin." + PluginID + ".display"

type Display struct {
	ShowDescription bool `json:"showDescription"`
	ShowPrice       bool `json:"showPrice"`
}

type Settings struct {
	Enabled bool `json:"enabled"`
	Display
}

func Available(repo *repository.Repository) (bool, error) {
	if repo == nil {
		return false, errors.New("模型选择器配置存储未初始化")
	}
	state, err := repo.PluginPlatformState(PluginID)
	if err != nil {
		return false, err
	}
	return state == nil || state.Available, nil
}

func Read(repo *repository.Repository) (Settings, error) {
	enabled, err := Available(repo)
	if err != nil {
		return Settings{}, err
	}
	display := &Display{ShowDescription: true, ShowPrice: true}
	stored, err := repo.SystemSettingOptional(settingKey)
	if err != nil {
		return Settings{}, err
	}
	if stored != nil {
		if err := json.Unmarshal([]byte(stored.ValueJSON), &display); err != nil {
			return Settings{}, fmt.Errorf("解析模型选择器配置失败：%w", err)
		}
		if display == nil {
			return Settings{}, errors.New("模型选择器配置为空")
		}
	}
	return Settings{Enabled: enabled, Display: *display}, nil
}

// Keep the system switch in the platform's plugin state. Only presentation
// preferences belong in this plugin's setting, even when the plugin is off.
func Save(repo *repository.Repository, settings Settings, audit *model.AdminAuditEvent) error {
	if repo == nil {
		return errors.New("模型选择器配置存储未初始化")
	}
	value, err := json.Marshal(settings.Display)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	return repo.Transaction(func(tx *repository.Repository) error {
		if err := tx.SavePluginPlatformState(&model.PluginPlatformState{
			PluginID: PluginID, Available: settings.Enabled, UpdatedBy: audit.ActorUserID, CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return err
		}
		if err := tx.SaveSystemSetting(&model.SystemSetting{
			Key: settingKey, ValueJSON: string(value), UpdatedBy: audit.ActorUserID, CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return err
		}
		return tx.AppendAdminAudit(audit)
	})
}
