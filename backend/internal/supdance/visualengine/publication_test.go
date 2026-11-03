package visualengine

import (
	"encoding/json"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

func TestDecodeConfigRejectsOmittedNullAndUnknownFields(t *testing.T) {
	raw, err := json.Marshal(DefaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := DecodeConfig(raw); err != nil {
		t.Fatal(err)
	}
	for name, malformed := range map[string]string{
		"missing boolean": strings.Replace(string(raw), `"enabled":true,`, "", 1),
		"null boolean":    strings.Replace(string(raw), `"enabled":true`, `"enabled":null`, 1),
		"null number":     strings.Replace(string(raw), `"modalBackdropBlur":8`, `"modalBackdropBlur":null`, 1),
		"unknown field":   strings.Replace(string(raw), `"schemaVersion":2`, `"unknown":true,"schemaVersion":2`, 1),
	} {
		t.Run(name, func(t *testing.T) {
			if malformed == string(raw) {
				t.Fatal("mutation did not modify fixture")
			}
			if _, err := DecodeConfig([]byte(malformed)); err == nil {
				t.Fatal("accepted malformed config")
			}
		})
	}
}

func TestPostgresConcurrentPublicationAndAtomicAuditFailure(t *testing.T) {
	dsn := os.Getenv("CANVAS_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("requires isolated CANVAS_TEST_POSTGRES_DSN")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	schema := "visual_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := db.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = db.Exec("DROP SCHEMA " + schema + " CASCADE").Error
		connection, _ := db.DB()
		_ = connection.Close()
	})
	isolated, err := gorm.Open(postgres.Open(dsn+" search_path="+schema), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	connection, err := isolated.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	if err := isolated.AutoMigrate(&model.SystemSetting{}); err != nil {
		t.Fatal(err)
	}
	repo := repository.New(isolated)
	var group sync.WaitGroup
	failures := make(chan error, 8)
	for index := 0; index < 8; index++ {
		group.Add(1)
		go func() { defer group.Done(); failures <- Publish(repo, "admin", DefaultConfig(), "concurrent", "") }()
	}
	group.Wait()
	close(failures)
	for err := range failures {
		if err != nil {
			t.Fatal(err)
		}
	}
	snapshots, err := ReadSnapshots(repo)
	if err != nil || len(snapshots) != 9 {
		t.Fatalf("lost publication: %d %v", len(snapshots), err)
	}
	versions := map[string]bool{}
	for _, snapshot := range snapshots {
		if versions[snapshot.Version] {
			t.Fatal("duplicate version")
		}
		versions[snapshot.Version] = true
	}
	entries, err := ReadAudit(repo)
	if err != nil || len(entries) != 8 {
		t.Fatalf("lost audit: %d %v", len(entries), err)
	}
	before, err := ReadConfig(repo)
	if err != nil {
		t.Fatal(err)
	}
	if err := isolated.Exec("CREATE FUNCTION reject_visual_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key = 'supdance_visual_engine_audit' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$").Error; err != nil {
		t.Fatal(err)
	}
	if err := isolated.Exec("CREATE TRIGGER reject_visual_audit BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION reject_visual_audit()").Error; err != nil {
		t.Fatal(err)
	}
	if err := Publish(repo, "admin", DefaultConfig(), "must fail", ""); err == nil {
		t.Fatal("audit failure accepted")
	}
	after, err := ReadConfig(repo)
	if err != nil || after.PublishedVersion != before.PublishedVersion {
		t.Fatal("partial PostgreSQL commit")
	}
	snapshots, err = ReadSnapshots(repo)
	if err != nil || len(snapshots) != 9 {
		t.Fatal("failed audit retained snapshot")
	}
}

func publicationRepository(t *testing.T) *repository.Repository {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.SystemSetting{}); err != nil {
		t.Fatal(err)
	}
	connection, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	return repository.New(db)
}

func TestPublicationPreservesBaselineAndCreatesNewRollbackRevision(t *testing.T) {
	repo := publicationRepository(t)
	baseline, err := ReadConfig(repo)
	if err != nil {
		t.Fatal(err)
	}
	config := DefaultConfig()
	config.Tokens["dark"] = config.Tokens["light"]
	config.PublishedVersion = "untrusted-client-version"
	if err := Publish(repo, "admin-id", config, "publish", ""); err != nil {
		t.Fatal(err)
	}
	first, err := ReadConfig(repo)
	if err != nil {
		t.Fatal(err)
	}
	if first.PublishedVersion == config.PublishedVersion || first.UpdatedBy != "admin-id" {
		t.Fatal("client metadata was trusted")
	}
	snapshots, err := ReadSnapshots(repo)
	if err != nil || len(snapshots) != 2 || snapshots[1].Config.Tokens["dark"] != baseline.Tokens["dark"] {
		t.Fatalf("baseline missing: %v", err)
	}
	if err := Publish(repo, "second-admin", Config{}, "", baseline.PublishedVersion); err != nil {
		t.Fatal(err)
	}
	restored, err := ReadConfig(repo)
	if err != nil {
		t.Fatal(err)
	}
	if restored.PublishedVersion == first.PublishedVersion || restored.PublishedVersion == baseline.PublishedVersion || restored.Tokens["dark"] != baseline.Tokens["dark"] {
		t.Fatal("rollback did not create a new revision with baseline content")
	}
	entries, err := ReadAudit(repo)
	if err != nil || len(entries) != 2 || entries[0].Action != "config.rollback" || entries[0].Actor != "second-admin" {
		t.Fatalf("audit missing: %v", err)
	}
}

func TestPublicationRollsBackEveryWriteOnSnapshotOrAuditFailure(t *testing.T) {
	for _, failingKey := range []string{SnapshotsSettingKey, AuditSettingKey} {
		t.Run(failingKey, func(t *testing.T) {
			repo := publicationRepository(t)
			if err := Publish(repo, "admin", DefaultConfig(), "first", ""); err != nil {
				t.Fatal(err)
			}
			before, _ := ReadConfig(repo)
			snapshotsBefore, _ := ReadSnapshots(repo)
			query := "CREATE TRIGGER reject_visual_write BEFORE UPDATE ON system_settings WHEN NEW.key = '" + failingKey + "' BEGIN SELECT RAISE(ABORT, 'injected failure'); END"
			if err := repo.DB().Exec(query).Error; err != nil {
				t.Fatal(err)
			}
			changed := DefaultConfig()
			changed.ThemeMode = "light"
			if err := Publish(repo, "admin", changed, "must fail", ""); err == nil {
				t.Fatal("failed storage reported success")
			}
			after, _ := ReadConfig(repo)
			snapshotsAfter, _ := ReadSnapshots(repo)
			entries, _ := ReadAudit(repo)
			if after.PublishedVersion != before.PublishedVersion || after.ThemeMode != before.ThemeMode || len(snapshotsAfter) != len(snapshotsBefore) || len(entries) != 1 {
				t.Fatal("partial publication escaped transaction")
			}
		})
	}
}

func TestInvalidPublicationAndUnknownRollbackDoNotWrite(t *testing.T) {
	repo := publicationRepository(t)
	if err := Publish(repo, "admin", Config{}, "invalid", ""); err == nil {
		t.Fatal("empty configuration accepted")
	}
	if err := Publish(repo, "admin", Config{}, "", "missing-version"); err == nil {
		t.Fatal("unknown rollback accepted")
	}
	var count int64
	if err := repo.DB().Model(&model.SystemSetting{}).Count(&count).Error; err != nil || count != 0 {
		t.Fatal("rejected request mutated storage")
	}
}

func TestValidateConfigRejectsMalformedSections(t *testing.T) {
	mutations := map[string]func(*Config){
		"unknown theme mode":   func(config *Config) { config.Tokens["unknown"] = config.Tokens["dark"] },
		"unknown elevation":    func(config *Config) { config.Elevations["E5"] = config.Elevations["E4"] },
		"unknown status copy":  func(config *Config) { config.WorkspaceRecovery.StatusCopies["unknown"] = "unknown" },
		"unknown stage detail": func(config *Config) { config.WorkspaceRecovery.StageDetails["unknown"] = "unknown" },
		"null page rules":      func(config *Config) { config.PageRules = nil },
		"shadow": func(config *Config) {
			elevation := config.Elevations["E2"]
			elevation.ShadowDark = "not-a-shadow"
			config.Elevations["E2"] = elevation
		},
		"schema": func(config *Config) { config.SchemaVersion = 99 },
		"tokens": func(config *Config) { delete(config.Tokens, "light") },
		"color": func(config *Config) {
			tokens := config.Tokens["dark"]
			tokens.Primary = "invalid"
			config.Tokens["dark"] = tokens
		},
		"elevation": func(config *Config) { delete(config.Elevations, "E2") },
		"size":      func(config *Config) { config.Components.ButtonRadius = -1 },
		"opacity":   func(config *Config) { config.Overlays.ModalBackdropOpacity = 2 },
		"duration":  func(config *Config) { config.Motion.DurationModal = -1 },
		"easing":    func(config *Config) { config.Motion.EasingStandard = "invalid" },
		"recovery":  func(config *Config) { config.WorkspaceRecovery.OrbitSpeed = -1 },
		"logo":      func(config *Config) { config.WorkspaceRecovery.BrandLogoURL = "javascript:alert(1)" },
		"rules": func(config *Config) {
			config.PageRules = []PageRule{{ID: "test", Name: "test", PathPattern: "https://example.com"}}
		},
	}
	if err := ValidateConfig(DefaultConfig()); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range mutations {
		t.Run(name, func(t *testing.T) {
			config := DefaultConfig()
			mutate(&config)
			if ValidateConfig(config) == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
}
