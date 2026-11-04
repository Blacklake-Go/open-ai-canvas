package repository

import (
	"errors"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
	"yingce/backend/internal/model"
)

func TestSystemSettingLockAndEscapedPrefixPreserveTransaction(t *testing.T) {
	db, err := gorm.Open(sqlite.Dialector{DriverName: "sqlite", DSN: "file:" + t.Name() + "?mode=memory&cache=shared"}, &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	if err := db.AutoMigrate(&model.SystemSetting{}); err != nil {
		t.Fatal(err)
	}
	repo := New(db)
	key := "supdance_%:workflow"
	if err := repo.Transaction(func(tx *Repository) error {
		if err := tx.LockSystemSetting(key, `{"revision":1}`); err != nil {
			return err
		}
		return tx.LockSystemSetting(key, `{"revision":0}`)
	}); err != nil {
		t.Fatal(err)
	}
	if err := repo.SaveSystemSetting(&model.SystemSetting{Key: "supdanceXX:other", ValueJSON: "{}"}); err != nil {
		t.Fatal(err)
	}
	rows, err := repo.SystemSettingsWithPrefix("supdance_%:", 10)
	if err != nil || len(rows) != 1 || rows[0].Key != key || rows[0].ValueJSON != `{"revision":1}` {
		t.Fatalf("literal prefix or lock initialization changed: rows=%+v err=%v", rows, err)
	}
	rollback := errors.New("publication failed")
	err = repo.Transaction(func(tx *Repository) error {
		if err := tx.LockSystemSetting(key, "{}"); err != nil {
			return err
		}
		if err := tx.SaveSystemSetting(&model.SystemSetting{Key: key, ValueJSON: `{"revision":2}`}); err != nil {
			return err
		}
		return rollback
	})
	if !errors.Is(err, rollback) {
		t.Fatalf("transaction error = %v", err)
	}
	stored, err := repo.SystemSetting(key)
	if err != nil || stored.ValueJSON != `{"revision":1}` {
		t.Fatalf("failed publication escaped rollback: setting=%+v err=%v", stored, err)
	}
}
