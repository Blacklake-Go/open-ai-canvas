package database

import (
	"testing"
	"time"
)

func TestSupDanceAppliedSchema83SurvivesUpstreamUpgrade(t *testing.T) {
	db, err := Open(Config{Driver: "sqlite", DSN: "file:supdance-schema-lineage?mode=memory&cache=shared"})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&schemaMigration{}); err != nil {
		t.Fatal(err)
	}
	legacy := schemaMigration{Version: 83, Name: "token_context_price_bands", Checksum: "sha256:token-context-price-bands-v83-20261106", AppliedAt: time.Date(2026, 11, 5, 19, 0, 0, 0, time.UTC)}
	if err := db.Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	if err := MigrateSchema(db); err != nil {
		t.Fatalf("upgrade rejected the already-applied SupDance history: %v", err)
	}
	var preserved schemaMigration
	if err := db.First(&preserved, "version = ?", 83).Error; err != nil {
		t.Fatal(err)
	}
	if preserved.Name != legacy.Name || preserved.Checksum != legacy.Checksum || !preserved.AppliedAt.Equal(legacy.AppliedAt) {
		t.Fatalf("applied schema 83 was rewritten: %#v", preserved)
	}
	for version, name := range map[int64]string{84: "skill_admin_edits", 85: "token_price_rules", 86: "pose_library", 87: "ark_asset_groups", 88: "inspiration_feed"} {
		var record schemaMigration
		if err := db.First(&record, "version = ?", version).Error; err != nil || record.Name != name {
			t.Fatalf("upstream migration %s was not applied at %d: %#v, %v", name, version, record, err)
		}
	}
	if err := RequireSchemaVersion(db); err != nil {
		t.Fatal(err)
	}
}
