package app

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/music"
)

const (
	PluginSupDanceMusicGeneration = "supdance-music-generation"
	PluginSupDanceMusicAlias      = "music-generation"
	MusicLifecycleSettingKey      = "supdance_music_lifecycle"
)

type MusicPluginLifecycleState string

const (
	MusicLifecycleInstalled   MusicPluginLifecycleState = "installed"
	MusicLifecycleEnabled     MusicPluginLifecycleState = "enabled"
	MusicLifecycleDraining    MusicPluginLifecycleState = "draining"
	MusicLifecycleDisabled    MusicPluginLifecycleState = "disabled"
	MusicLifecycleUpdating    MusicPluginLifecycleState = "updating"
	MusicLifecycleError       MusicPluginLifecycleState = "error"
	MusicLifecycleUninstalled MusicPluginLifecycleState = "uninstalled"
)

type MusicLifecycleInfo struct {
	State       MusicPluginLifecycleState `json:"state"`
	ActiveTasks int64                     `json:"activeTasks"`
	IsDraining  bool                      `json:"isDraining"`
	UpdatedAt   time.Time                 `json:"updatedAt"`
	UpdatedBy   string                    `json:"updatedBy,omitempty"`
}

type MusicPluginLifecycleManager struct {
	mu          sync.RWMutex
	state       MusicPluginLifecycleState
	activeTasks atomic.Int64
}

func newMusicPluginLifecycleManager() *MusicPluginLifecycleManager {
	return &MusicPluginLifecycleManager{
		state: MusicLifecycleInstalled,
	}
}

func (m *MusicPluginLifecycleManager) GetState() MusicPluginLifecycleState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state
}

func (m *MusicPluginLifecycleManager) SetState(state MusicPluginLifecycleState) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state = state
}

func (m *MusicPluginLifecycleManager) ActiveTaskCount() int64 {
	return m.activeTasks.Load()
}

func (m *MusicPluginLifecycleManager) IsDraining() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state == MusicLifecycleDraining
}

func (m *MusicPluginLifecycleManager) IncrementActiveTasks() {
	m.activeTasks.Add(1)
}

// DecrementActiveTasks atomically decrements active task count, clamping at zero to prevent underflow.
func (m *MusicPluginLifecycleManager) DecrementActiveTasks() int64 {
	for {
		curr := m.activeTasks.Load()
		if curr <= 0 {
			return 0
		}
		if m.activeTasks.CompareAndSwap(curr, curr-1) {
			return curr - 1
		}
	}
}

// TransitionToDraining atomically transitions state to draining if active tasks exist,
// or directly to disabled if active task count is already zero or negative, under mutex protection.
func (m *MusicPluginLifecycleManager) TransitionToDraining() (MusicPluginLifecycleState, int64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tasks := m.activeTasks.Load()
	if tasks <= 0 {
		m.state = MusicLifecycleDisabled
		return MusicLifecycleDisabled, tasks
	}
	m.state = MusicLifecycleDraining
	return MusicLifecycleDraining, tasks
}

// Global lifecycle manager singleton attached to app package
var (
	musicLifecycleManagerOnce sync.Once
	globalMusicLifecycleMgr   *MusicPluginLifecycleManager
)

func musicLifecycleManager() *MusicPluginLifecycleManager {
	musicLifecycleManagerOnce.Do(func() {
		globalMusicLifecycleMgr = newMusicPluginLifecycleManager()
	})
	return globalMusicLifecycleMgr
}

// ResetMusicLifecycleManagerForTest resets manager state for hermetic unit testing.
func ResetMusicLifecycleManagerForTest(state MusicPluginLifecycleState) {
	mgr := musicLifecycleManager()
	mgr.SetState(state)
	mgr.activeTasks.Store(0)
}

func init() {
	// Register music plugin policies into supdanceSystemApplicationPolicies
	supdanceSystemApplicationPolicies[PluginSupDanceMusicGeneration] = PluginManagementView{
		Origin:             PluginOriginOfficial,
		Kind:               PluginKindApplication,
		ActivationScope:    PluginScopeUser,
		ConfigurationScope: PluginConfigurationSystem,
	}
	supdanceSystemApplicationPolicies[PluginSupDanceMusicAlias] = PluginManagementView{
		Origin:             PluginOriginOfficial,
		Kind:               PluginKindApplication,
		ActivationScope:    PluginScopeUser,
		ConfigurationScope: PluginConfigurationSystem,
	}
}

// ValidateMusicLifecycleTransition enforces valid state machine transitions.
func ValidateMusicLifecycleTransition(from, to MusicPluginLifecycleState, activeTasks int64) error {
	if from == to {
		return nil
	}

	// Any recognized state can degrade to error on fatal hook/runtime crash
	if to == MusicLifecycleError {
		switch from {
		case MusicLifecycleInstalled, MusicLifecycleEnabled, MusicLifecycleDraining,
			MusicLifecycleDisabled, MusicLifecycleUpdating, MusicLifecycleUninstalled, MusicLifecycleError:
			return nil
		default:
			return fmt.Errorf("无效的生命周期状态跃迁：%q -> %q", from, to)
		}
	}

	switch from {
	case MusicLifecycleInstalled:
		if to == MusicLifecycleEnabled || to == MusicLifecycleUninstalled {
			return nil
		}
	case MusicLifecycleEnabled:
		if to == MusicLifecycleDraining {
			return nil
		}
		if to == MusicLifecycleDisabled {
			if activeTasks > 0 {
				return fmt.Errorf("当前仍有 %d 个任务进行中，无法直接停用，请先进入排空模式", activeTasks)
			}
			return nil
		}
	case MusicLifecycleDraining:
		if to == MusicLifecycleDisabled && activeTasks == 0 {
			return nil
		}
		if to == MusicLifecycleDisabled && activeTasks > 0 {
			return fmt.Errorf("排空未完成：仍有 %d 个生成任务进行中，无法直接停用", activeTasks)
		}
		if to == MusicLifecycleEnabled {
			return nil // 取消排空，恢复启用
		}
	case MusicLifecycleDisabled:
		if to == MusicLifecycleEnabled {
			return nil
		}
		if to == MusicLifecycleUpdating {
			if activeTasks > 0 {
				return fmt.Errorf("仍有 %d 个活动任务，无法进行升级", activeTasks)
			}
			return nil
		}
		if to == MusicLifecycleUninstalled {
			if activeTasks > 0 {
				return fmt.Errorf("仍有 %d 个活动任务，无法卸载插件", activeTasks)
			}
			return nil
		}
	case MusicLifecycleUpdating:
		if to == MusicLifecycleEnabled || to == MusicLifecycleDisabled {
			return nil
		}
	case MusicLifecycleError:
		if to == MusicLifecycleDisabled || to == MusicLifecycleEnabled || to == MusicLifecycleInstalled {
			return nil
		}
		if to == MusicLifecycleUninstalled {
			if activeTasks > 0 {
				return fmt.Errorf("仍有 %d 个活动任务，无法卸载插件", activeTasks)
			}
			return nil
		}
	case MusicLifecycleUninstalled:
		if to == MusicLifecycleInstalled || to == MusicLifecycleEnabled {
			return nil
		}
	}
	return fmt.Errorf("无效的生命周期状态跃迁：%q -> %q", from, to)
}

// MusicPluginPlatformAvailable returns whether the music plugin platform state is enabled.
func (s *Service) MusicPluginPlatformAvailable() (bool, error) {
	if s.repo == nil {
		return true, nil
	}
	state, err := s.repo.PluginPlatformState(PluginSupDanceMusicGeneration)
	if err != nil {
		return false, fmt.Errorf("读取音乐生成插件平台状态：%w", err)
	}
	if state == nil {
		return true, nil
	}
	return state.Available, nil
}

// MusicPluginUserEnabled returns whether the given user has enabled the music plugin.
func (s *Service) MusicPluginUserEnabled(userID string) (bool, error) {
	if strings.TrimSpace(userID) == "" || s.repo == nil {
		return true, nil
	}
	userState, err := s.repo.UserPluginState(strings.TrimSpace(userID), PluginSupDanceMusicGeneration)
	if err != nil {
		return false, fmt.Errorf("读取用户音乐插件状态：%w", err)
	}
	if userState == nil {
		return true, nil // 默认开启
	}
	return userState.Enabled, nil
}

// MusicPluginEffectiveEnabled evaluates the dual-state resolution for a specific user.
func (s *Service) MusicPluginEffectiveEnabled(userID string) (bool, error) {
	platformAvail, err := s.MusicPluginPlatformAvailable()
	if err != nil || !platformAvail {
		return false, err
	}
	if s.IsMusicPluginDraining() || musicLifecycleManager().GetState() == MusicLifecycleError {
		return false, nil
	}
	return s.MusicPluginUserEnabled(userID)
}

// IsMusicPluginDraining reports whether the music plugin is currently in draining mode.
func (s *Service) IsMusicPluginDraining() bool {
	return musicLifecycleManager().IsDraining()
}

// ActiveMusicTaskCount returns the number of active music generation tasks in flight.
func (s *Service) ActiveMusicTaskCount() int64 {
	return musicLifecycleManager().ActiveTaskCount()
}

// syncLifecycleStateFromDB restores the lifecycle state from database after server restart.
func (s *Service) syncLifecycleStateFromDB() {
	if s.repo == nil {
		return
	}
	mgr := musicLifecycleManager()
	if mgr.GetState() == MusicLifecycleInstalled {
		if setting, err := s.repo.SystemSettingOptional(MusicLifecycleSettingKey); err == nil && setting != nil && strings.TrimSpace(setting.ValueJSON) != "" {
			var stateStr string
			if err := json.Unmarshal([]byte(setting.ValueJSON), &stateStr); err == nil && stateStr != "" {
				mgr.SetState(MusicPluginLifecycleState(stateStr))
				return
			}
		}
		if pState, err := s.repo.PluginPlatformState(PluginSupDanceMusicGeneration); err == nil && pState != nil {
			if pState.Available {
				mgr.SetState(MusicLifecycleEnabled)
			} else {
				mgr.SetState(MusicLifecycleDisabled)
			}
		}
	}
}

// CheckMusicTaskAdmission validates that the system, plugin, and user allow a new task.
func (s *Service) CheckMusicTaskAdmission(userID string) error {
	s.syncLifecycleStateFromDB()
	if s.IsDraining() {
		return &AppError{Status: 503, Code: 503, Reason: kernel.ReasonUnavailable, Message: "服务正在维护，暂不接受新的生成任务", Retryable: true}
	}
	if s.IsMusicPluginDraining() {
		return &AppError{Status: 503, Code: 503, Reason: kernel.ReasonUnavailable, Message: "音乐生成插件正在维护排空中，暂不接受新的生成任务", Retryable: true}
	}
	if musicLifecycleManager().GetState() == MusicLifecycleError {
		return Forbidden("AI 音乐生成插件处于异常状态，暂不可用")
	}
	available, err := s.MusicPluginPlatformAvailable()
	if err != nil {
		return fmt.Errorf("校验音乐插件状态：%w", err)
	}
	if !available {
		return Forbidden("管理员已停用 AI 音乐生成插件")
	}
	userEnabled, err := s.MusicPluginUserEnabled(userID)
	if err != nil {
		return fmt.Errorf("校验用户音乐插件激活状态：%w", err)
	}
	if !userEnabled {
		return Forbidden("您未启用音乐生成功能，请在设置中开启后重试")
	}
	return nil
}

// TrackMusicTaskExecution guards an in-flight music generation task.
func (s *Service) TrackMusicTaskExecution() func() {
	mgr := musicLifecycleManager()
	mgr.IncrementActiveTasks()
	var once sync.Once
	return func() {
		once.Do(func() {
			remaining := mgr.DecrementActiveTasks()
			if remaining <= 0 && mgr.GetState() == MusicLifecycleDraining {
				mgr.SetState(MusicLifecycleDisabled)
				if s.repo != nil {
					_ = s.repo.SavePluginPlatformState(&model.PluginPlatformState{
						PluginID:  PluginSupDanceMusicGeneration,
						Available: false,
						UpdatedBy: "system:drain-complete",
						UpdatedAt: time.Now().UTC(),
					})
				}
			}
		})
	}
}

// SetMusicPluginLifecycle transitions the plugin to a new lifecycle state.
func (s *Service) SetMusicPluginLifecycle(actor *model.User, targetState MusicPluginLifecycleState) (*MusicLifecycleInfo, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	mgr := musicLifecycleManager()
	currentState := mgr.GetState()
	activeTasks := mgr.ActiveTaskCount()

	if err := ValidateMusicLifecycleTransition(currentState, targetState, activeTasks); err != nil {
		return nil, &AppError{Status: 400, Code: 400, Message: err.Error()}
	}

	now := time.Now().UTC()
	switch targetState {
	case MusicLifecycleEnabled:
		mgr.SetState(MusicLifecycleEnabled)
		if s.repo != nil {
			_ = s.repo.SavePluginPlatformState(&model.PluginPlatformState{
				PluginID:  PluginSupDanceMusicGeneration,
				Available: true,
				UpdatedBy: actor.ID,
				UpdatedAt: now,
			})
		}
	case MusicLifecycleDraining:
		actualState, currentTasks := mgr.TransitionToDraining()
		targetState = actualState
		activeTasks = currentTasks
		if actualState == MusicLifecycleDisabled && s.repo != nil {
			_ = s.repo.SavePluginPlatformState(&model.PluginPlatformState{
				PluginID:  PluginSupDanceMusicGeneration,
				Available: false,
				UpdatedBy: actor.ID,
				UpdatedAt: now,
			})
		}
	case MusicLifecycleDisabled:
		mgr.SetState(MusicLifecycleDisabled)
		if s.repo != nil {
			_ = s.repo.SavePluginPlatformState(&model.PluginPlatformState{
				PluginID:  PluginSupDanceMusicGeneration,
				Available: false,
				UpdatedBy: actor.ID,
				UpdatedAt: now,
			})
		}
	case MusicLifecycleUpdating:
		mgr.SetState(MusicLifecycleUpdating)
	case MusicLifecycleError:
		mgr.SetState(MusicLifecycleError)
		if s.repo != nil {
			_ = s.repo.SavePluginPlatformState(&model.PluginPlatformState{
				PluginID:  PluginSupDanceMusicGeneration,
				Available: false,
				UpdatedBy: actor.ID,
				UpdatedAt: now,
			})
		}
	case MusicLifecycleUninstalled:
		mgr.SetState(MusicLifecycleUninstalled)
		if s.repo != nil {
			_ = s.repo.DeletePluginPlatformState(PluginSupDanceMusicGeneration)
			_ = s.repo.DeleteUserPluginStates(PluginSupDanceMusicGeneration)
			_ = s.repo.DeleteSystemSetting(MusicLifecycleSettingKey)
			// 注意：绝对不清理 supdance_music_generations 表与 model.Resource 资产
		}
	}

	if s.repo != nil && targetState != MusicLifecycleUninstalled {
		stateBytes, _ := json.Marshal(string(targetState))
		_ = s.repo.SaveSystemSetting(&model.SystemSetting{
			Key:       MusicLifecycleSettingKey,
			ValueJSON: string(stateBytes),
			UpdatedAt: now,
		})
	}

	_ = s.appendAdminAudit(actor, "plugin.lifecycle.update", "plugin", PluginSupDanceMusicGeneration, "更新音乐插件生命周期状态", map[string]any{
		"fromState":   currentState,
		"toState":     targetState,
		"activeTasks": activeTasks,
	})

	return &MusicLifecycleInfo{
		State:       targetState,
		ActiveTasks: mgr.ActiveTaskCount(),
		IsDraining:  mgr.IsDraining(),
		UpdatedAt:   now,
		UpdatedBy:   actor.ID,
	}, nil
}

// GetMusicPluginLifecycle returns the current lifecycle status view.
func (s *Service) GetMusicPluginLifecycle() *MusicLifecycleInfo {
	s.syncLifecycleStateFromDB()
	mgr := musicLifecycleManager()
	return &MusicLifecycleInfo{
		State:       mgr.GetState(),
		ActiveTasks: mgr.ActiveTaskCount(),
		IsDraining:  mgr.IsDraining(),
		UpdatedAt:   time.Now().UTC(),
	}
}

type (
	MusicStoredConfig        = music.StoredMusicConfig
	MusicAdminConfigView     = music.AdminMusicConfigView
	MusicUpdateConfigRequest = music.UpdateMusicConfigRequest
	MusicModelPricingConfig  = music.ModelPricingConfig
	MusicGenerationRequest   = music.MusicGenerationRequest
	MusicGenerationResponse  = music.MusicGenerationResponse
	MusicModelCapabilities   = music.ModelCapabilities
	SupDanceMusicGeneration  = music.SupDanceMusicGeneration
)

type musicLifecycleHost struct {
	svc *Service
}

func (h *musicLifecycleHost) IsDraining() bool {
	if h.svc == nil {
		return false
	}
	return h.svc.IsDraining() || h.svc.IsMusicPluginDraining()
}

func (h *musicLifecycleHost) ActiveTaskCount() int64 {
	if h.svc == nil {
		return 0
	}
	return h.svc.ActiveMusicTaskCount()
}

func (h *musicLifecycleHost) CheckMusicTaskAdmission(userID string) error {
	if h.svc == nil {
		return nil
	}
	return h.svc.CheckMusicTaskAdmission(userID)
}

func (h *musicLifecycleHost) TrackMusicTaskExecution() func() {
	if h.svc == nil {
		return func() {}
	}
	return h.svc.TrackMusicTaskExecution()
}

func (s *Service) MusicService() *music.Service {
	var repo music.Repository
	if s.repo != nil && s.repo.DB() != nil {
		repo = music.NewRepository(s.repo.DB())
	}
	return music.NewService(
		repo,
		s.repo,
		music.NewDefaultVault(),
		s.repo,
		&musicLifecycleHost{svc: s},
	)
}

func (s *Service) MusicAdminConfigView(actor *model.User) (*music.AdminMusicConfigView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.MusicService().GetAdminConfigView(context.Background())
}

func (s *Service) UpdateMusicAdminConfig(actor *model.User, req music.UpdateMusicConfigRequest) (*music.AdminMusicConfigView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	view, err := s.MusicService().UpdateAdminConfig(context.Background(), actor.ID, req)
	if err != nil {
		return nil, err
	}
	_ = s.appendAdminAudit(actor, "music.config.update", "plugin", PluginSupDanceMusicGeneration, "更新音乐插件凭据与定价配置", map[string]any{
		"hasApiKey":    view.HasAPIKey,
		"defaultModel": view.DefaultModel,
	})
	return view, nil
}

func (s *Service) TestMusicConnection(actor *model.User, apiKey string) (map[string]any, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.MusicService().TestConnection(context.Background(), apiKey)
}

func (s *Service) MusicCapabilities(ctx context.Context) ([]music.ModelCapabilities, error) {
	return s.MusicService().GetCapabilities(ctx)
}

func (s *Service) SubmitMusicTask(ctx context.Context, userID string, req music.MusicGenerationRequest) (*music.MusicGenerationResponse, error) {
	return s.MusicService().SubmitTask(ctx, userID, req)
}

func (s *Service) GetMusicTask(ctx context.Context, actor *model.User, taskID string) (*music.SupDanceMusicGeneration, error) {
	isAdmin := s.RequireAdmin(actor) == nil
	return s.MusicService().GetTask(ctx, actor.ID, taskID, isAdmin)
}

func (s *Service) ListUserMusicTasks(ctx context.Context, userID string, offset, limit int) ([]*music.SupDanceMusicGeneration, int64, error) {
	return s.MusicService().ListUserTasks(ctx, userID, offset, limit)
}

func (s *Service) DownloadMusicAudio(ctx context.Context, actor *model.User, taskID, format string) ([]byte, string, string, error) {
	isAdmin := s.RequireAdmin(actor) == nil
	return s.MusicService().DownloadAudio(ctx, actor.ID, taskID, format, isAdmin)
}

func (s *Service) HandleMusicWebhook(ctx context.Context, signature string, payload []byte) error {
	return s.MusicService().HandleWebhook(ctx, signature, payload)
}

func (s *Service) ListAdminMusicTasks(ctx context.Context, actor *model.User, status string, offset, limit int) ([]*music.SupDanceMusicGeneration, int64, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, 0, err
	}
	return s.MusicService().ListAdminTasks(ctx, status, offset, limit)
}
