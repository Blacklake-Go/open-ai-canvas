package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"yingce/backend/internal/auth"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/service"
	"yingce/backend/internal/supdance/compactpicker"
)

func TestSupDanceCompactPickerHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "picker.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&model.User{}, &model.AuthSession{}, &model.PluginPlatformState{}, &model.UserPluginState{}, &model.SystemSetting{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	for _, role := range []model.UserRole{model.UserRoleAdmin, model.UserRoleUser} {
		id := string(role)
		if err := db.Create(&model.User{ID: id, Username: id, Role: role, Status: model.UserStatusActive}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&model.AuthSession{ID: id, UserID: id, TokenHash: auth.HashToken("session"), ExpiresAt: time.Now().Add(time.Hour)}).Error; err != nil {
			t.Fatal(err)
		}
	}
	newRouter := func() *gin.Engine {
		svc := service.New(repository.New(db), dir)
		t.Cleanup(func() { _ = svc.Close() })
		router := gin.New()
		RegisterCanvasAPI(router.Group("/api"), svc)
		return router
	}
	router := newRouter()
	const public = "/api/supdance/compact-model-picker/settings"
	const admin = "/api/admin/supdance/compact-model-picker/settings"
	const toggle = "/api/admin/plugins/" + compactpicker.PluginID + "/availability"
	const adminCookie = "admin.session"
	const userCookie = "user.session"
	const saved = `{"enabled":false,"showDescription":true,"showPrice":false}`
	for _, tc := range []struct {
		method, path, body, cookie string
		status                     int
	}{
		{"GET", admin, "", "", http.StatusUnauthorized},
		{"PUT", admin, saved, "", http.StatusUnauthorized},
		{"GET", admin, "", userCookie, http.StatusForbidden},
		{"PUT", admin, saved, userCookie, http.StatusForbidden},
		{"PUT", public, saved, adminCookie, http.StatusNotFound},
		{"PUT", admin, `{}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, `{"enabled":true,"showDescription":true}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, `{"enabled":false,"showDescription":null,"showPrice":true}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, `{"enabled":true,"showDescription":false,"showPrice":"true"}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, `{"enabled":true,"showDescription":true,"showPrice":true,"other":false}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, saved + `{}`, adminCookie, http.StatusBadRequest},
	} {
		if rec := profileRequest(router, tc.method, tc.path, tc.body, tc.cookie); rec.Code != tc.status {
			t.Fatalf("%s %s %s: want %d, got %d %s", tc.method, tc.path, tc.body, tc.status, rec.Code, rec.Body)
		}
	}
	check := func(method, path, body, cookie string, enabled, description, price bool) {
		t.Helper()
		rec := profileRequest(router, method, path, body, cookie)
		var result struct {
			Code int             `json:"code"`
			Data map[string]bool `json:"data"`
		}
		want := map[string]bool{"enabled": enabled, "showDescription": description, "showPrice": price}
		if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &result) != nil || result.Code != 0 || !reflect.DeepEqual(result.Data, want) {
			t.Fatalf("%s %s: got %d %s, want %v", method, path, rec.Code, rec.Body, want)
		}
		if method == "GET" && rec.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("settings GET must be revalidated after an administrator changes them")
		}
	}
	check("GET", public, "", "", true, true, true)
	check("GET", admin, "", adminCookie, true, true, true)
	check("PUT", admin, saved, adminCookie, false, true, false)
	rec := profileRequest(router, "GET", "/api/admin/plugins", "", adminCookie)
	var listing struct {
		Data struct {
			States map[string]struct {
				PlatformAvailable bool `json:"platformAvailable"`
				EffectiveEnabled  bool `json:"effectiveEnabled"`
			} `json:"states"`
		} `json:"data"`
	}
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &listing) != nil {
		t.Fatalf("plugin center: %d %s", rec.Code, rec.Body)
	}
	if state, ok := listing.Data.States[compactpicker.PluginID]; !ok || state.PlatformAvailable || state.EffectiveEnabled {
		t.Fatalf("plugin center did not see the disabled plugin: %+v", state)
	}
	router = newRouter()
	check("GET", public, "", "", false, true, false)
	if rec := profileRequest(router, "PUT", toggle, `{"available":true}`, adminCookie); rec.Code != 200 {
		t.Fatalf("plugin center toggle failed: %s", rec.Body)
	}
	check("GET", public, "", "", true, true, false)
	check("GET", admin, "", adminCookie, true, true, false)
	if err := db.Exec("CREATE TRIGGER reject_picker_audit BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;").Error; err != nil {
		t.Fatal(err)
	}
	if rec := profileRequest(router, "PUT", admin, `{"enabled":false,"showDescription":false,"showPrice":true}`, adminCookie); rec.Code != 500 {
		t.Fatalf("audit failure must abort the save: %d %s", rec.Code, rec.Body)
	}
	check("GET", public, "", "", true, true, false)
}
