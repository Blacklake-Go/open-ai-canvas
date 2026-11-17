package database

import (
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
)

func TestEmailCenter106And107PreserveExistingData(t *testing.T) {
	for _, driver := range []string{"sqlite", "postgres"} {
		t.Run(driver, func(t *testing.T) {
			var db *gorm.DB
			var err error
			config := &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)}
			if driver == "sqlite" {
				db, err = gorm.Open(sqlite.Open("file:"+kernel.NewID()+"?mode=memory&cache=shared"), config)
			} else {
				dsn := os.Getenv("SUPDANCE_EMAIL_CENTER_TEST_DSN")
				if dsn == "" {
					t.Skip("set SUPDANCE_EMAIL_CENTER_TEST_DSN to an isolated local PostgreSQL")
				}
				u, parseErr := url.Parse(dsn)
				if parseErr != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") || !strings.Contains(u.Path, "email_center") {
					t.Fatal("test requires a dedicated local email_center database")
				}
				base, openErr := gorm.Open(postgres.Open(dsn), config)
				if openErr != nil {
					t.Fatal(openErr)
				}
				schema := "email_center_test_" + kernel.NewID()
				if err := base.Exec(fmt.Sprintf(`CREATE SCHEMA "%s"`, schema)).Error; err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() {
					_ = base.Exec(fmt.Sprintf(`DROP SCHEMA "%s" CASCADE`, schema)).Error
					sqlDB, _ := base.DB()
					_ = sqlDB.Close()
				})
				q := u.Query()
				q.Set("search_path", schema)
				u.RawQuery = q.Encode()
				db, err = gorm.Open(postgres.Open(u.String()), config)
			}
			if err != nil {
				t.Fatal(err)
			}
			sqlDB, _ := db.DB()
			t.Cleanup(func() { _ = sqlDB.Close() })
			if err := db.AutoMigrate(&model.SystemSetting{}, &model.EmailLog{}, &model.UserNotificationSetting{}); err != nil {
				t.Fatal(err)
			}
			fixtures := []model.SystemSetting{{Key: "email", ValueJSON: `{"enabled":true,"password":"enc:preserved-test-value","fromName":"Supdance"}`}, {Key: "plugin.supdance-email-marketing.templates", ValueJSON: `{"welcome":{"html":"<b>User content</b>"}}`}}
			for _, row := range fixtures {
				if err := db.Create(&row).Error; err != nil {
					t.Fatal(err)
				}
			}
			if err := db.Create(&model.EmailLog{ID: "historical-log", Purpose: "password_reset", Status: "sent", CreatedAt: time.Now()}).Error; err != nil {
				t.Fatal(err)
			}
			if err := db.Create(&model.UserNotificationSetting{UserID: "existing-user", ConsumptionReportEnabled: true}).Error; err != nil {
				t.Fatal(err)
			}
			if err := migrateSupDanceEmailCenter(db); err != nil {
				t.Fatal(err)
			}
			if err := migrateSupDanceEmailCenter(db); err != nil {
				t.Fatal(err)
			}
			for _, fixture := range fixtures {
				var row model.SystemSetting
				if err := db.First(&row, "key = ?", fixture.Key).Error; err != nil || row.ValueJSON != fixture.ValueJSON {
					t.Fatal("existing setting changed", fixture.Key, err)
				}
			}
			var count int64
			db.Model(&model.EmailLog{}).Where("id = ?", "historical-log").Count(&count)
			if count != 1 {
				t.Fatal("historical log lost")
			}
			var prefs model.UserNotificationSetting
			db.First(&prefs, "user_id = ?", "existing-user")
			if !prefs.ConsumptionReportEnabled {
				t.Fatal("existing notification subscription changed")
			}
			if err := db.Create(&model.SupDanceEmailReceipt{ID: "receipt", BrandVersion: strings.Repeat("a", 64) + ":appearance-revision", Status: "smtp_accepted"}).Error; err != nil {
				t.Fatal("brand metadata cannot be stored", err)
			}
			assertEmailLocaleMigrationPreservesData(t, db)
			for _, table := range []string{"supdance_email_templates", "supdance_email_revisions", "supdance_email_receipts", "supdance_email_contacts", "supdance_email_brand_assets", "supdance_email_campaigns", "supdance_email_jobs"} {
				if !db.Migrator().HasTable(table) {
					t.Fatal("migration missing table", table)
				}
			}
		})
	}
}
