package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"
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
)

func TestSupDanceEmailMarketingHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()

	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "email_mkt.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	if err := db.AutoMigrate(
		&model.User{},
		&model.AuthSession{},
		&model.PluginPlatformState{},
		&model.UserPluginState{},
		&model.SystemSetting{},
		&model.AdminAuditEvent{},
		&model.EmailLog{},
	); err != nil {
		t.Fatal(err)
	}

	for _, role := range []model.UserRole{model.UserRoleAdmin, model.UserRoleUser} {
		id := string(role)
		if err := db.Create(&model.User{ID: id, Username: id, Role: role, Status: model.UserStatusActive, Email: id + "@example.com"}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&model.AuthSession{ID: id, UserID: id, TokenHash: auth.HashToken("session"), ExpiresAt: time.Now().Add(time.Hour)}).Error; err != nil {
			t.Fatal(err)
		}
	}

	svc := service.New(repository.New(db), dir)
	previousRuntime := runtimeService
	ConfigureRuntime(svc)
	t.Cleanup(func() { ConfigureRuntime(previousRuntime) })
	t.Cleanup(func() { _ = svc.Close() })

	router := gin.New()
	RegisterCanvasAPI(router.Group("/api"), svc)

	const overviewPath = "/api/admin/plugins/supdance-email-marketing/overview"
	const templatesPath = "/api/admin/plugins/supdance-email-marketing/templates"
	const testSendPath = "/api/admin/plugins/supdance-email-marketing/test"
	const resetPath = "/api/admin/plugins/supdance-email-marketing/templates/welcome/reset"

	const adminCookie = "admin.session"
	const userCookie = "user.session"

	// 1. 未登录鉴权防护
	if rec := profileRequest(router, "GET", overviewPath, "", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated request, got %d", rec.Code)
	}

	// 2. 普通用户越权防护
	if rec := profileRequest(router, "GET", overviewPath, "", userCookie); rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin user, got %d", rec.Code)
	}

	// 3. 管理员成功获取总览
	rec := profileRequest(router, "GET", overviewPath, "", adminCookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin overview, got %d: %s", rec.Code, rec.Body)
	}

	var res struct {
		Code int                            `json:"code"`
		Data service.EmailMarketingOverview `json:"data"`
		Msg  string                         `json:"msg"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("unmarshal overview error: %v", err)
	}
	if res.Data.PluginID != service.PluginSupDanceEmailMarketing {
		t.Errorf("expected pluginId %s, got %s", service.PluginSupDanceEmailMarketing, res.Data.PluginID)
	}
	if len(res.Data.Templates) != 4 {
		t.Errorf("expected 4 templates, got %d", len(res.Data.Templates))
	}

	// 4. 管理员修改模板配置
	templates := res.Data.Templates
	welcome := templates["welcome"]
	welcome.Subject = "定制欢迎标题: {{brand_name}}"
	templates["welcome"] = welcome

	updateBody, _ := json.Marshal(map[string]any{
		"templates": templates,
	})
	recUpdate := profileRequest(router, "PUT", templatesPath, string(updateBody), adminCookie)
	if recUpdate.Code != http.StatusOK {
		t.Fatalf("expected 200 for updating templates, got %d: %s", recUpdate.Code, recUpdate.Body)
	}

	// 5. 重置单套模板
	recReset := profileRequest(router, "POST", resetPath, "{}", adminCookie)
	if recReset.Code != http.StatusOK {
		t.Fatalf("expected 200 for resetting template, got %d: %s", recReset.Code, recReset.Body)
	}

	// 6. 测试邮件发信入参校验
	recBadEmail := profileRequest(router, "POST", testSendPath, `{"to":"bad-email","templateKey":"welcome"}`, adminCookie)
	if recBadEmail.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad email, got %d: %s", recBadEmail.Code, recBadEmail.Body)
	}
}
