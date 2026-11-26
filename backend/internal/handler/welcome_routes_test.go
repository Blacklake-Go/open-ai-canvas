package handler

import (
	"encoding/json"
	"maps"
	"net/http"
	"net/http/httptest"
	"testing"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func publicFeatureRoutesFixture(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&model.SystemSetting{}); err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	svc := service.New(repository.New(db), t.TempDir())
	t.Cleanup(func() { _ = svc.Close() })
	RegisterFeatureAvailabilityRoutes(router.Group("/api"), svc)
	return router, db
}

func TestWelcomeAvailabilityPublicRoute(t *testing.T) {
	router, db := publicFeatureRoutesFixture(t)
	for _, enabled := range []bool{true, false, true} {
		payload, _ := json.Marshal(map[string]bool{"welcomeEnabled": enabled})
		if err := db.Save(&model.SystemSetting{Key: "feature_availability", ValueJSON: string(payload)}).Error; err != nil {
			t.Fatal(err)
		}
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/public/welcome", nil))
		if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("unexpected public response: %d %s", response.Code, response.Body.String())
		}
		var body struct {
			Code int             `json:"code"`
			Data map[string]bool `json:"data"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Code != 0 || len(body.Data) != 1 || body.Data["welcomeEnabled"] != enabled {
			t.Fatalf("unexpected public payload: %s", response.Body.String())
		}
	}
}

func TestWorkspaceToolsPublicRoute(t *testing.T) {
	router, db := publicFeatureRoutesFixture(t)
	for _, enabled := range []bool{true, false} {
		flags := map[string]bool{
			"shortDramaEnabled":     enabled,
			"ecommerceEnabled":      enabled,
			"imageWorkbenchEnabled": enabled,
			"videoWorkbenchEnabled": enabled,
			"pluginCenterEnabled":   !enabled,
			"taskCenterEnabled":     !enabled,
		}
		payload, err := json.Marshal(flags)
		if err != nil {
			t.Fatal(err)
		}
		if err := db.Save(&model.SystemSetting{Key: "feature_availability", ValueJSON: string(payload), UpdatedBy: "admin-id"}).Error; err != nil {
			t.Fatal(err)
		}

		response := profileRequest(router, http.MethodGet, "/api/public/workspace-tools", "", "")
		if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("unexpected public response: %d %s", response.Code, response.Body.String())
		}
		var body struct {
			Code int                        `json:"code"`
			Data map[string]map[string]bool `json:"data"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Code != 0 || len(body.Data) != 1 || !maps.Equal(body.Data["features"], flags) {
			t.Fatalf("unexpected public workspace tools: %s", response.Body.String())
		}
	}
	if response := profileRequest(router, http.MethodGet, "/api/features", "", ""); response.Code != http.StatusUnauthorized {
		t.Fatalf("expected login for the full feature configuration, got %d", response.Code)
	}
}
