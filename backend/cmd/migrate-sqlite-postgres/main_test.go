package main

import (
	"bytes"
	"strings"
	"sync"
	"testing"
	"time"

	"yingce/backend/internal/database"
	"yingce/backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestMigrationListCoversSchemaModels(t *testing.T) {
	want := make(map[string]bool, len(database.Models()))
	cache := &sync.Map{}
	for _, value := range database.Models() {
		parsed, err := schema.Parse(value, cache, schema.NamingStrategy{})
		if err != nil {
			t.Fatal(err)
		}
		want[parsed.Table] = false
	}
	for _, migration := range migrations() {
		if _, exists := want[migration.name]; !exists {
			t.Fatalf("migration list contains unknown table %q", migration.name)
		}
		if want[migration.name] {
			t.Fatalf("migration list contains duplicate table %q", migration.name)
		}
		want[migration.name] = true
	}
	for table, covered := range want {
		if !covered {
			t.Errorf("migration list is missing table %q", table)
		}
	}
}

func TestCanvasHistoryCompositeKeyMigration(t *testing.T) {
	source, err := database.Open(database.Config{Driver: "sqlite", DSN: "file:history-migration-source?mode=memory&cache=shared"})
	if err != nil {
		t.Fatal(err)
	}
	target, err := database.Open(database.Config{Driver: "sqlite", DSN: "file:history-migration-target?mode=memory&cache=shared"})
	if err != nil {
		t.Fatal(err)
	}
	for _, db := range []*gorm.DB{source, target} {
		if err := db.AutoMigrate(&model.Resource{}, &model.CanvasSnapshotResource{}); err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&model.Resource{ID: "resource"}).Error; err != nil {
			t.Fatal(err)
		}
	}
	refs := []model.CanvasSnapshotResource{{SnapshotID: "b", ResourceID: "resource"}, {SnapshotID: "a", ResourceID: "resource"}}
	if err := source.Create(&refs).Error; err != nil {
		t.Fatal(err)
	}
	count, err := migrateTable[model.CanvasSnapshotResource]("canvas_snapshot_resources").run(source, target, true)
	if err != nil || count != 2 {
		t.Fatalf("history refs not copied/verified: %d %v", count, err)
	}
}

func TestEmailCenterRowsPreserveLocalesAssetsAndSuppression(t *testing.T) {
	source, err := database.Open(database.Config{Driver: "sqlite", DSN: "file:email-migration-source?mode=memory&cache=shared"})
	if err != nil {
		t.Fatal(err)
	}
	target, err := database.Open(database.Config{Driver: "sqlite", DSN: "file:email-migration-target?mode=memory&cache=shared"})
	if err != nil {
		t.Fatal(err)
	}
	for _, db := range []*gorm.DB{source, target} {
		if err := db.AutoMigrate(&model.SupDanceEmailBrandAsset{}, &model.SupDanceEmailContact{}, &model.SupDanceEmailRevision{}, &model.SupDanceEmailTemplate{}, &model.SupDanceEmailCampaign{}, &model.SupDanceEmailJob{}, &model.SupDanceEmailReceipt{}); err != nil {
			t.Fatal(err)
		}
		connection, err := db.DB()
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = connection.Close() })
	}
	stamp := time.Unix(1_700_000_000, 0).UTC()
	asset := []byte{0, 1, 128, 255}
	for _, row := range []any{
		&model.SupDanceEmailBrandAsset{ID: "brand", ContentType: "image/png", Data: asset, CreatedAt: stamp},
		&model.SupDanceEmailContact{Email: "creator@example.test", PreferredLocale: "en-US", Marketing: false, Suppression: "unsubscribed", UnsubscribedAt: &stamp, UpdatedAt: stamp},
		&model.SupDanceEmailRevision{ID: "rev-en", Key: "newsletter", Locale: "en-US", ContentJSON: `{"subject":"Update"}`, Kind: "published", CreatedAt: stamp},
		&model.SupDanceEmailRevision{ID: "rev-zh", Key: "newsletter", Locale: "zh-CN", ContentJSON: `{"subject":"产品更新"}`, Kind: "published", CreatedAt: stamp},
		&model.SupDanceEmailTemplate{Key: "newsletter", Locale: "en-US", DraftID: "rev-en", PublishedID: "rev-en", Revision: 2, UpdatedAt: stamp},
		&model.SupDanceEmailTemplate{Key: "newsletter", Locale: "zh-CN", DraftID: "rev-zh", PublishedID: "rev-zh", Revision: 3, UpdatedAt: stamp},
		&model.SupDanceEmailCampaign{ID: "campaign", TemplateKey: "newsletter", RevisionsJSON: `{"en-US":"rev-en","zh-CN":"rev-zh"}`, Status: "cancelled", CreatedAt: stamp, UpdatedAt: stamp},
		&model.SupDanceEmailJob{ID: "job", CampaignID: "campaign", Recipient: "creator@example.test", Status: "cancelled", Attempts: 1, CreatedAt: stamp, UpdatedAt: stamp},
		&model.SupDanceEmailReceipt{ID: "receipt", Locale: "en-US", Event: "newsletter", TemplateID: "rev-en", Status: "unknown", Stage: "after-data", CreatedAt: stamp, UpdatedAt: stamp},
	} {
		if err := source.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	for _, migration := range migrations() {
		if !strings.HasPrefix(migration.name, "supdance_email_") {
			continue
		}
		for _, copyRows := range []bool{true, false} {
			if count, err := migration.run(source, target, copyRows); err != nil || count == 0 {
				t.Fatalf("%s copy=%v count=%d: %v", migration.name, copyRows, count, err)
			}
		}
	}
	var templates []model.SupDanceEmailTemplate
	if err := target.Order("locale").Find(&templates).Error; err != nil || len(templates) != 2 || templates[0].PublishedID != "rev-en" || templates[1].PublishedID != "rev-zh" {
		t.Fatalf("localized template pointers: %+v %v", templates, err)
	}
	var brand model.SupDanceEmailBrandAsset
	if err := target.First(&brand).Error; err != nil || !bytes.Equal(brand.Data, asset) {
		t.Fatalf("brand bytes changed: %v", err)
	}
	var contact model.SupDanceEmailContact
	if err := target.First(&contact).Error; err != nil || contact.Marketing || contact.Suppression != "unsubscribed" || contact.UnsubscribedAt == nil || !contact.UnsubscribedAt.Equal(stamp) {
		t.Fatalf("suppression changed: %+v %v", contact, err)
	}
}

func TestMigrationDependencyOrder(t *testing.T) {
	positions := make(map[string]int)
	for i, migration := range migrations() {
		positions[migration.name] = i
	}
	for _, dependency := range [][2]string{
		{"channel_websites", "model_channels"},
		{"model_channels", "channel_catalog_snapshots"},
		{"channel_websites", "channel_protocol_selections"},
		{"channel_models", "channel_protocol_selections"},
		{"users", "channel_protocol_selections"},
		{"users", "mcp_connection_grants"},
		{"mcp_connections", "mcp_connection_grants"},
		{"users", "mcp_storage_usages"},
		{"users", "agent_storage_usages"},
	} {
		parent, parentFound := positions[dependency[0]]
		child, childFound := positions[dependency[1]]
		if !parentFound || !childFound || parent >= child {
			t.Errorf("migration must copy %s before %s", dependency[0], dependency[1])
		}
	}
}
