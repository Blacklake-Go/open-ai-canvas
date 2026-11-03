package app

import (
	"encoding/json"
	"errors"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"testing"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	i18n "yingce/backend/internal/supdance/i18n"
)

func TestSupDanceI18nWorkflowPostgresConcurrentRevision(t *testing.T) {
	// The shared helper owns a unique schema and removes only that schema at cleanup.
	svc, db := newProjectNameConflictPostgresService(t)
	if err := db.AutoMigrate(&model.SystemSetting{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	admin := &model.User{ID: "admin", Role: model.UserRoleAdmin}
	zero := 0
	draft := i18n.TranslationDraft{Entry: i18n.Entry{Key: "custom.concurrent", Namespace: "custom", SourceText: "并发草稿", Translations: map[string]string{i18n.LocaleZhCN: "并发草稿"}}, SourceHash: i18n.SourceHash("并发草稿")}
	start := make(chan struct{})
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func() {
			<-start
			_, err := svc.UpdateSupDanceI18nWorkflow(admin, i18n.WorkflowRequest{Action: "stage", ExpectedRevision: &zero, Drafts: []i18n.TranslationDraft{draft}})
			results <- err
		}()
	}
	close(start)
	succeeded, conflicted := 0, 0
	for i := 0; i < 2; i++ {
		err := <-results
		if err == nil {
			succeeded++
		} else if errors.Is(err, i18n.ErrWorkflowConflict) {
			conflicted++
		} else {
			t.Fatal(err)
		}
	}
	if succeeded != 1 || conflicted != 1 {
		t.Fatalf("success=%d conflict=%d", succeeded, conflicted)
	}
	state, err := svc.AdminSupDanceI18nWorkflow(admin)
	if err != nil || state.Revision != 1 || len(state.Drafts) != 1 {
		t.Fatal("concurrent state corrupted", state, err)
	}
	var count int64
	db.Model(&model.AdminAuditEvent{}).Count(&count)
	if count != 1 {
		t.Fatalf("audit rows=%d", count)
	}
}

func TestSupDanceI18nWorkflowPersistencePermissionsAndIsolation(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.AutoMigrate(&model.SystemSetting{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	svc := &Service{repo: repository.New(db)}
	admin := &model.User{ID: "admin", Role: model.UserRoleAdmin}
	user := &model.User{ID: "user", Role: model.UserRoleUser}
	if _, err = svc.AdminSupDanceI18nWorkflow(user); err == nil {
		t.Fatal("non-admin read accepted")
	}
	zero := 0
	if _, err = svc.UpdateSupDanceI18nWorkflow(user, i18n.WorkflowRequest{Action: "stage", ExpectedRevision: &zero}); err == nil {
		t.Fatal("non-admin write accepted")
	}
	trans := map[string]string{}
	for _, code := range i18n.SupportedLocaleCodes {
		trans[code] = "工作流测试 {count}"
	}
	draft := i18n.TranslationDraft{Entry: i18n.Entry{Key: "custom.workflow_test", Namespace: "custom", SourceText: trans["zh-CN"], Translations: trans}, SourceHash: i18n.SourceHash(trans["zh-CN"])}
	state, err := svc.UpdateSupDanceI18nWorkflow(admin, i18n.WorkflowRequest{Action: "stage", ExpectedRevision: &zero, Drafts: []i18n.TranslationDraft{draft}})
	if err != nil {
		t.Fatal(err)
	}
	custom, err := svc.readSupDanceI18nCustomEntries()
	if err != nil || len(custom) != 0 {
		t.Fatal("draft leaked into published overrides", err)
	}
	for _, action := range []string{"review", "publish"} {
		rev := state.Revision
		state, err = svc.UpdateSupDanceI18nWorkflow(admin, i18n.WorkflowRequest{Action: action, ExpectedRevision: &rev, Keys: []string{draft.Entry.Key}})
		if err != nil {
			t.Fatal(action, err)
		}
	}
	custom, err = svc.readSupDanceI18nCustomEntries()
	if err != nil || custom[draft.Entry.Key].SourceText != draft.Entry.SourceText {
		t.Fatal("publication not persisted", err)
	}
	// A lock must protect both the workflow and the legacy direct-edit/import API.
	rev := state.Revision
	state, err = svc.UpdateSupDanceI18nWorkflow(admin, i18n.WorkflowRequest{Action: "lock", ExpectedRevision: &rev, Keys: []string{draft.Entry.Key}})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = svc.UpsertAdminSupDanceI18nEntries(admin, []i18n.Entry{draft.Entry}); err == nil {
		t.Fatal("direct-edit API bypassed lock")
	}
	if _, _, err = svc.DeleteAdminSupDanceI18nEntry(admin, draft.Entry.Key); err == nil {
		t.Fatal("delete API bypassed lock")
	}
	if _, _, err = svc.ImportAdminSupDanceI18n(admin, i18n.ExportPayload{Entries: []i18n.Entry{draft.Entry}}, true); err == nil {
		t.Fatal("replace import bypassed lock")
	}
	var auditCount int64
	db.Model(&model.AdminAuditEvent{}).Count(&auditCount)
	if auditCount != 4 {
		t.Fatalf("audit count=%d", auditCount)
	}
	// Administrative JSON never serializes full historical snapshots.
	raw, _ := json.Marshal(state)
	var view map[string]json.RawMessage
	_ = json.Unmarshal(raw, &view)
	if _, ok := view["snapshots"]; ok {
		t.Fatal("snapshots leaked")
	}
	rev = state.Revision
	state, err = svc.UpdateSupDanceI18nWorkflow(admin, i18n.WorkflowRequest{Action: "unlock", ExpectedRevision: &rev, Keys: []string{draft.Entry.Key}})
	if err != nil {
		t.Fatal(err)
	}
	rev = state.Revision
	_, err = svc.UpdateSupDanceI18nWorkflow(admin, i18n.WorkflowRequest{Action: "rollback", ExpectedRevision: &rev, ReleaseID: state.Releases[0].ID})
	if err != nil {
		t.Fatal(err)
	}
	custom, _ = svc.readSupDanceI18nCustomEntries()
	if len(custom) != 0 {
		t.Fatal("rollback not persisted")
	}
}
