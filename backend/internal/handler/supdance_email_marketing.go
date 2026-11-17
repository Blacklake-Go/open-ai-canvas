package handler

import (
	"net/http"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// RegisterSupDanceEmailMarketingRoutes 挂载 supdance 邮件营销插件的 API 端点
func RegisterSupDanceEmailMarketingRoutes(r *gin.RouterGroup, svc *service.Service) {
	adminGroup := r.Group("/admin/plugins/supdance-email-marketing")
	{
		// 获取插件总览与模板列表
		adminGroup.GET("/overview", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			overview, err := svc.AdminEmailMarketingOverview(user)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})

		// 兼容 GET /templates 端点别名
		adminGroup.GET("/templates", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			overview, err := svc.AdminEmailMarketingOverview(user)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})

		// 保存自定义营销模板
		adminGroup.PUT("/templates", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req struct {
				Templates map[string]service.MarketingTemplate `json:"templates"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			overview, err := svc.AdminSaveEmailMarketingTemplates(user, req.Templates)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})

		// 重置单套或全部模板为默认
		adminGroup.POST("/templates/:key/reset", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			key := c.Param("key")
			overview, err := svc.AdminResetEmailMarketingTemplate(user, key)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})

		// 发送营销测试邮件
		adminGroup.POST("/test", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req service.EmailMarketingTestRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			result, err := svc.SendMarketingTestEmail(user, req)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, result)
		})
	}
}
