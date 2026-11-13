package app

import (
	"fmt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"testing"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	i18n "yingce/backend/internal/supdance/i18n"
)

func TestI18nPublicationCacheRejectsSupersededRead(t *testing.T) {
	cache := &i18nBundleCache{generation: 2}
	if cache.publishIfCurrent(i18n.PublicBundle{Revision: "old"}, 1) || cache.valid {
		t.Fatal("a read predating publication repopulated the cache")
	}
	if !cache.publishIfCurrent(i18n.PublicBundle{Revision: "new"}, 2) || cache.bundle.Revision != "new" {
		t.Fatal("current publication was not cached")
	}
}

func TestI18nImportAcrossBatchesIsAtomic(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.AutoMigrate(&model.SystemSetting{}, &model.AdminAuditEvent{}, &model.PluginPlatformState{}); err != nil {
		t.Fatal(err)
	}
	svc := &Service{repo: repository.New(db)}
	admin := &model.User{ID: "admin", Role: model.UserRoleAdmin}
	entries := make([]i18n.Entry, i18n.MaxEntryUpdates+1)
	for index := range entries {
		translations := map[string]string{}
		for _, code := range i18n.SupportedLocaleCodes {
			translations[code] = "Import test"
		}
		translations[i18n.LocaleZhCN] = "导入测试"
		entries[index] = i18n.Entry{Key: fmt.Sprintf("custom.atomic_%d", index), Namespace: "custom", SourceText: "导入测试", Translations: translations, Origin: i18n.EntryOriginCustom}
	}
	valid := entries[len(entries)-1].Key
	entries[len(entries)-1].Key = "invalid key"
	if _, _, err = svc.ImportAdminSupDanceI18n(admin, i18n.ExportPayload{Entries: entries}, false); err == nil {
		t.Fatal("invalid last batch accepted")
	}
	current, err := svc.readSupDanceI18nCustomEntries()
	if err != nil || len(current) != 0 {
		t.Fatal("failed import leaked the first batch", len(current), err)
	}
	entries[len(entries)-1].Key = valid
	_, count, err := svc.ImportAdminSupDanceI18n(admin, i18n.ExportPayload{Entries: entries}, false)
	if err != nil || count != len(entries) {
		t.Fatal("complete import failed", count, err)
	}
	current, err = svc.readSupDanceI18nCustomEntries()
	if err != nil || len(current) != len(entries) {
		t.Fatal("complete import was not persisted", len(current), err)
	}
}
