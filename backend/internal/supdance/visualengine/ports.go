package visualengine

import (
	"errors"
	"yingce/backend/internal/model"
)

var ErrConflict = errors.New("视觉配置已被其他管理员更新，请重新加载")

type Repository interface {
	PluginPlatformState(string) (*model.PluginPlatformState, error)
	SystemSettingOptional(string) (*model.SystemSetting, error)
	User(string) (*model.User, error)
	VisualEngineAuditEvents() ([]model.AdminAuditEvent, error)
	SaveVisualEngineSettingsWithAudit([]*model.SystemSetting, *model.AdminAuditEvent) error
	SaveVisualEngineRelease(string, *model.SystemSetting, *model.SystemSetting, *model.SystemSetting, *model.AdminAuditEvent) error
	SaveVisualEngineLifecycle([]*model.SystemSetting, *model.PluginPlatformState, bool, *model.AdminAuditEvent) error
}
type Manager struct {
	repo         Repository
	requireAdmin func(*model.User) error
	idGenerator  func() string
}

func NewManager(repo Repository, requireAdmin func(*model.User) error, idGenerator func() string) *Manager {
	return &Manager{repo: repo, requireAdmin: requireAdmin, idGenerator: idGenerator}
}
