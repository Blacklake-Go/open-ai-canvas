package handler

import (
	"net/http"

	"yingce/backend/internal/app"
	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// RegisterSupDanceHtmlPageManagerRoutes 挂载 supdance html页面管理插件的 API 端点
func RegisterSupDanceHtmlPageManagerRoutes(r *gin.RouterGroup, svc *service.Service) {
	// 公开页面接口
	publicGroup := r.Group("/plugins/supdance-html-page-manager")
	{
		publicGroup.GET("/pages", func(c *gin.Context) {
			pages, err := svc.PublicHtmlPages()
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, gin.H{"pages": pages})
		})

		publicGroup.GET("/pages/:slug", func(c *gin.Context) {
			slug := c.Param("slug")
			page, err := svc.PublicHtmlPageBySlug(slug)
			if err != nil {
				fail(c, http.StatusNotFound, err)
				return
			}
			// 支持直接返回纯 HTML 渲染模式（当 Accept 为 text/html 或携带 ?raw=1 时）
			if c.Query("raw") == "1" || c.GetHeader("Accept") == "text/html" {
				c.Header("Content-Type", "text/html; charset=utf-8")
				c.String(http.StatusOK, page.HTML)
				return
			}
			ok(c, page)
		})
	}

	// 管理员后台接口
	adminGroup := r.Group("/admin/plugins/supdance-html-page-manager")
	{
		adminGroup.GET("/overview", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			overview, err := svc.AdminHtmlPagesOverview(user)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})

		adminGroup.PUT("/pages", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req struct {
				Pages []app.HtmlPageItem `json:"pages"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			overview, err := svc.AdminSaveHtmlPages(user, req.Pages)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})

		adminGroup.POST("/reset", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			overview, err := svc.AdminResetHtmlPages(user)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})
	}
}
