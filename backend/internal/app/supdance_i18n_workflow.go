package app

import (
	"encoding/json"
	"fmt"
	"time"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	i18n "yingce/backend/internal/supdance/i18n"
)

type SupDanceI18nWorkflowRequest = i18n.WorkflowRequest
type storedI18nWorkflow struct {
	State     i18n.WorkflowState               `json:"state"`
	Snapshots map[string]map[string]i18n.Entry `json:"snapshots"`
}

// Direct edits use the same lock as reviewed publications; no writer may silently bypass a locked key.
func (s *Service) mutateI18nEntries(actorID string, keys []string, mutate func(map[string]i18n.Entry) (map[string]i18n.Entry, error)) error {
	if s.repo == nil {
		return fmt.Errorf("系统配置存储未初始化")
	}
	return s.repo.Transaction(func(repo *repository.Repository) error {
		if err := repo.LockSystemSetting(i18n.WorkflowSettingKey, `{"state":{"revision":0,"drafts":[],"lockedKeys":{},"releases":[]},"snapshots":{}}`); err != nil {
			return err
		}
		stored, err := readI18nWorkflow(repo)
		if err != nil {
			return err
		}
		for _, k := range keys {
			if stored.State.LockedKeys[k] {
				return fmt.Errorf("%w: locked_key %s", i18n.ErrInvalidTranslation, k)
			}
		}
		scoped := *s
		scoped.repo = repo
		existing, err := scoped.readSupDanceI18nCustomEntries()
		if err != nil {
			return err
		}
		next, err := mutate(existing)
		if err != nil {
			return err
		}
		for k, locked := range stored.State.LockedKeys {
			if locked {
				before, _ := json.Marshal(existing[k])
				after, _ := json.Marshal(next[k])
				if string(before) != string(after) {
					return fmt.Errorf("%w: locked_key %s", i18n.ErrInvalidTranslation, k)
				}
			}
		}
		if err = scoped.saveSupDanceI18nCustomEntries(actorID, next); err != nil {
			return err
		}
		stored.State.Revision++
		raw, err := json.Marshal(stored)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		return repo.SaveSystemSetting(&model.SystemSetting{Key: i18n.WorkflowSettingKey, ValueJSON: string(raw), UpdatedBy: actorID, UpdatedAt: now, CreatedAt: now})
	})
}
func readI18nWorkflow(repo *repository.Repository) (storedI18nWorkflow, error) {
	result := storedI18nWorkflow{State: i18n.EmptyWorkflow(), Snapshots: map[string]map[string]i18n.Entry{}}
	row, err := repo.SystemSettingOptional(i18n.WorkflowSettingKey)
	if err != nil {
		return result, err
	}
	if row != nil && row.ValueJSON != "" {
		if err = json.Unmarshal([]byte(row.ValueJSON), &result); err != nil {
			return result, fmt.Errorf("读取翻译工作流失败：%w", err)
		}
	}
	return result, nil
}
func (s *Service) AdminSupDanceI18nWorkflow(actor *model.User) (i18n.WorkflowState, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return i18n.WorkflowState{}, err
	}
	if s.repo == nil {
		return i18n.WorkflowState{}, fmt.Errorf("系统配置存储未初始化")
	}
	stored, err := readI18nWorkflow(s.repo)
	if err != nil {
		return i18n.WorkflowState{}, err
	}
	custom, err := s.readSupDanceI18nCustomEntries()
	if err != nil {
		return i18n.WorkflowState{}, err
	}
	stored.State.StaleOverrides = []string{}
	for _, builtin := range i18n.BuiltinEntries() {
		if override, ok := custom[builtin.Key]; ok && override.BuiltinSourceHash != "" && override.BuiltinSourceHash != i18n.SourceHash(builtin.SourceText) {
			stored.State.StaleOverrides = append(stored.State.StaleOverrides, builtin.Key)
		}
	}
	return stored.State, err
}
func (s *Service) UpdateSupDanceI18nWorkflow(actor *model.User, req i18n.WorkflowRequest) (i18n.WorkflowState, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return i18n.WorkflowState{}, err
	}
	if s.repo == nil {
		return i18n.WorkflowState{}, fmt.Errorf("系统配置存储未初始化")
	}
	err := s.repo.Transaction(func(repo *repository.Repository) error {
		if err := repo.LockSystemSetting(i18n.WorkflowSettingKey, `{"state":{"revision":0,"drafts":[],"lockedKeys":{},"releases":[]},"snapshots":{}}`); err != nil {
			return err
		}
		stored, err := readI18nWorkflow(repo)
		if err != nil {
			return err
		}
		scoped := *s
		scoped.repo = repo
		custom, err := scoped.readSupDanceI18nCustomEntries()
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		state, custom, snapshots, err := i18n.ApplyWorkflow(stored.State, stored.Snapshots, custom, req, actor.ID, now)
		if err != nil {
			return err
		}
		data, err := json.Marshal(storedI18nWorkflow{State: state, Snapshots: snapshots})
		if err != nil {
			return err
		}
		if err = repo.SaveSystemSetting(&model.SystemSetting{Key: i18n.WorkflowSettingKey, ValueJSON: string(data), UpdatedBy: actor.ID, UpdatedAt: now, CreatedAt: now}); err != nil {
			return err
		}
		if req.Action == "publish" || req.Action == "rollback" {
			if err = scoped.saveSupDanceI18nCustomEntries(actor.ID, custom); err != nil {
				return err
			}
		}
		if err = repo.AppendAdminAudit(&model.AdminAuditEvent{ID: newID(), ActorUserID: actor.ID, Action: "supdance.i18n." + req.Action, TargetType: "plugin", TargetID: i18n.PluginID, Summary: "国际化翻译工作流 " + req.Action, MetadataJSON: fmt.Sprintf(`{"revision":%d}`, state.Revision), CreatedAt: now}); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return i18n.WorkflowState{}, err
	}
	invalidateI18nBundleCache()
	return s.AdminSupDanceI18nWorkflow(actor)
}
