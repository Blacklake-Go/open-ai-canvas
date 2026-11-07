package handler

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"yingce/backend/internal/database"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/service"
	"yingce/backend/internal/supdance/socialauth"
)

func TestSocialBrandIconPublicHTTP(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := database.MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "resources"), 0750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "resources", "icon.png"), []byte("icon-bytes"), 0640); err != nil {
		t.Fatal(err)
	}
	resource := model.Resource{ID: "brand", UserID: "admin", Kind: "social-brand-icon", Status: model.ResourceStatusReady, Provider: "local", ObjectKey: "icon.png", MimeType: "image/png", Size: 10}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}
	svc := service.New(repository.New(db), dir)
	admin := &model.User{ID: "admin", Role: model.UserRoleAdmin, Status: model.UserStatusActive}
	url := "/api/auth/social/brand-icons/brand"
	request := httptest.NewRequest("PUT", "/", nil)
	update := socialauth.UpdateSettingsRequest{Providers: map[string]socialauth.UpdateProviderInput{"qq": {IconLightURL: url}}}
	if _, err := svc.UpdateSocialAuthAdminSettings(request, admin, update); err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	RegisterSocialAuthRoutes(router.Group("/api"), svc)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, url, nil))
	if response.Code != 200 || response.Body.String() != "icon-bytes" || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("public icon: %d %q", response.Code, response.Body.String())
	}
	for _, target := range []string{"/api/admin/social-auth/brand-icons/brand"} {
		response = httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, target, nil))
		if response.Code == 200 {
			t.Fatalf("unauthenticated access: %s", target)
		}
	}
	update.Providers["qq"] = socialauth.UpdateProviderInput{}
	if _, err := svc.UpdateSocialAuthAdminSettings(request, admin, update); err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, url, nil))
	if response.Code != 404 {
		t.Fatalf("cleared icon HTTP %d", response.Code)
	}
}
