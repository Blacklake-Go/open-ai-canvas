package database

import (
	"gorm.io/gorm"
	"testing"
	"yingce/backend/internal/model"
)

// Called for both the isolated SQLite and PostgreSQL upgrade fixtures.
func assertEmailLocaleMigrationPreservesData(t *testing.T, db *gorm.DB) {
	t.Helper()
	if err := db.Exec(`CREATE TABLE users (id varchar(36) PRIMARY KEY, username varchar(80), email varchar(160), password_hash text, status varchar(24))`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO users (id,username,email,password_hash,status) VALUES (?,?,?,?,?)`, "existing-user", "original-user", "original@example.test", "preserved-fixture-hash", "active").Error; err != nil {
		t.Fatal(err)
	}
	contact := model.SupDanceEmailContact{Email: "original@example.test", Marketing: false, Scope: "marketing", Source: "original-consent-source", Suppression: "complaint"}
	if err := db.Create(&contact).Error; err != nil {
		t.Fatal(err)
	}
	campaign := model.SupDanceEmailCampaign{ID: "existing-campaign", Name: "Original campaign", RevisionID: "original-version", Status: "paused", VariablesJSON: `{"name":"Original content"}`}
	if err := db.Create(&campaign).Error; err != nil {
		t.Fatal(err)
	}
	for _, field := range []struct {
		table any
		name  string
	}{{&model.SupDanceEmailContact{}, "PreferredLocale"}, {&model.SupDanceEmailReceipt{}, "Locale"}, {&model.SupDanceEmailCampaign{}, "RevisionsJSON"}, {&model.SupDanceEmailCampaign{}, "LocalizedVariablesJSON"}} {
		if err := db.Migrator().DropColumn(field.table, field.name); err != nil {
			t.Fatal(err)
		}
	}
	for range 2 {
		if err := migrateEmailLocales(db); err != nil {
			t.Fatal(err)
		}
	}
	var user model.User
	if err := db.First(&user, "id = ?", "existing-user").Error; err != nil {
		t.Fatal(err)
	}
	if user.PreferredLocale != "" || user.PasswordHash != "preserved-fixture-hash" || user.Email != "original@example.test" {
		t.Fatal("migration invented a preference or changed identity")
	}
	var stored model.SupDanceEmailContact
	if err := db.First(&stored, "email = ?", contact.Email).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Marketing || stored.Suppression != contact.Suppression || stored.Source != contact.Source {
		t.Fatal("migration changed consent or suppression")
	}
	var saved model.SupDanceEmailCampaign
	if err := db.First(&saved, "id = ?", campaign.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.Status != "paused" || saved.VariablesJSON != campaign.VariablesJSON || saved.RevisionID != campaign.RevisionID {
		t.Fatal("migration changed or replayed a campaign")
	}
	for _, field := range []struct {
		table any
		name  string
	}{{&model.User{}, "PreferredLocale"}, {&model.SupDanceEmailContact{}, "PreferredLocale"}, {&model.SupDanceEmailReceipt{}, "Locale"}, {&model.SupDanceEmailCampaign{}, "RevisionsJSON"}, {&model.SupDanceEmailCampaign{}, "LocalizedVariablesJSON"}} {
		if !db.Migrator().HasColumn(field.table, field.name) {
			t.Fatal("missing locale field", field.name)
		}
	}
}
