package handler

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"net/http"
	"path/filepath"
	"testing"
	"time"
	"yingce/backend/internal/auth"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/service"
)

func TestSupDanceEmailCenterHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("CANVAS_PUBLIC_BASE_URL", "https://mail.example.test")
	t.Setenv("CANVAS_EMAIL_MARKETING_ENABLED", "false")
	dir := t.TempDir()
	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "email-center.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&model.User{}, &model.AuthSession{}, &model.PluginPlatformState{}, &model.UserPluginState{}, &model.SystemSetting{}, &model.AdminAuditEvent{}, &model.EmailLog{}, &model.SupDanceEmailTemplate{}, &model.SupDanceEmailRevision{}, &model.SupDanceEmailReceipt{}, &model.SupDanceEmailContact{}, &model.SupDanceEmailBrandAsset{}, &model.SupDanceEmailCampaign{}, &model.SupDanceEmailJob{}); err != nil {
		t.Fatal(err)
	}
	for _, role := range []model.UserRole{model.UserRoleAdmin, model.UserRoleUser} {
		id := string(role)
		if err := db.Create(&model.User{ID: id, Username: id, Role: role, Status: model.UserStatusActive, Email: id + "@example.test"}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&model.AuthSession{ID: id, UserID: id, TokenHash: auth.HashToken("session"), ExpiresAt: time.Now().Add(time.Hour)}).Error; err != nil {
			t.Fatal(err)
		}
	}
	contact := model.SupDanceEmailContact{Email: "user@example.test", Scope: "marketing", Suppression: "complaint"}
	if err := db.Create(&contact).Error; err != nil {
		t.Fatal(err)
	}
	svc := service.New(repository.New(db), dir)
	previous := runtimeService
	ConfigureRuntime(svc)
	t.Cleanup(func() { ConfigureRuntime(previous) })
	t.Cleanup(func() { _ = svc.Close() })
	router := gin.New()
	RegisterCanvasAPI(router.Group("/api"), svc)
	const overview = "/api/admin/plugins/supdance-email-marketing/overview?locale=ja-JP"
	for _, check := range []struct {
		cookie string
		status int
	}{{"", http.StatusUnauthorized}, {"user.session", http.StatusForbidden}} {
		if rec := profileRequest(router, "GET", overview, "", check.cookie); rec.Code != check.status {
			t.Fatalf("overview authorization: got %d, want %d", rec.Code, check.status)
		}
	}
	if rec := profileRequest(router, "POST", "/api/admin/email-center/initialize", "{}", "admin.session"); rec.Code != http.StatusOK {
		t.Fatalf("initialize: %d %s", rec.Code, rec.Body)
	}
	rec := profileRequest(router, "GET", overview, "", "admin.session")
	var result struct {
		Code int `json:"code"`
		Data struct {
			Locale           string            `json:"locale"`
			SupportedLocales []string          `json:"supportedLocales"`
			Templates        []json.RawMessage `json:"templates"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK || result.Code != 0 || result.Data.Locale != "ja-JP" || len(result.Data.Templates) != 11 || len(result.Data.SupportedLocales) != 8 {
		t.Fatalf("localized overview: status=%d locale=%s templates=%d languages=%d", rec.Code, result.Data.Locale, len(result.Data.Templates), len(result.Data.SupportedLocales))
	}
	if rec := profileRequest(router, "GET", "/api/admin/email-center/brand", "", "user.session"); rec.Code != http.StatusForbidden {
		t.Fatalf("non-admin brand: %d", rec.Code)
	}
	if rec := profileRequest(router, "GET", "/api/admin/email-center/brand", "", "admin.session"); rec.Code != http.StatusOK || rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("brand metadata: %d", rec.Code)
	}
	const language = "/api/auth/email-center/language"
	if rec := profileRequest(router, "PUT", language, `{"locale":"fr-FR","userId":"admin"}`, "user.session"); rec.Code != http.StatusOK {
		t.Fatalf("language write: %d %s", rec.Code, rec.Body)
	}
	var user, admin model.User
	if err := db.First(&user, "id = ?", "user").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&admin, "id = ?", "admin").Error; err != nil {
		t.Fatal(err)
	}
	if user.PreferredLocale != "fr-FR" || admin.PreferredLocale != "" {
		t.Fatal("language write crossed account boundary")
	}
	if err := db.First(&contact, "email = ?", contact.Email).Error; err != nil {
		t.Fatal(err)
	}
	if contact.Marketing || contact.Suppression != "complaint" {
		t.Fatal("language changed consent or suppression")
	}
	if rec := profileRequest(router, "PUT", language, `{"locale":"xx-YY"}`, "user.session"); rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid language: %d", rec.Code)
	}
	for _, raw := range []struct{ method, path, body string }{{"PUT", "/templates", `{"templates":{}}`}, {"POST", "/test", `{"to":"qa@example.test","html":"<b>raw bypass</b>"}`}} {
		if rec := profileRequest(router, raw.method, "/api/admin/plugins/supdance-email-marketing"+raw.path, raw.body, "admin.session"); rec.Code < 400 {
			t.Fatalf("legacy raw bypass: %s %d", raw.path, rec.Code)
		}
	}
}
