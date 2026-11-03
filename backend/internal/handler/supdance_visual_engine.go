package handler

import (
	"net/http"

	"yingce/backend/internal/service"
	visualengine "yingce/backend/internal/supdance/visualengine"

	"github.com/gin-gonic/gin"
)

// RegisterSupDanceVisualEngineRoutes mounts the public and administrative HTTP endpoints
// for the SupDance Visual Engine plugin (supdance-visual-engine).
func RegisterSupDanceVisualEngineRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/plugins/supdance-visual-engine/bundle", func(c *gin.Context) {
		bundle, err := svc.PublicVisualEngineBundle()
		if err != nil {
			failService(c, err)
			return
		}
		etag := `"` + bundle.Revision + `"`
		c.Header("Cache-Control", "no-store")
		c.Header("ETag", etag)
		if match := c.GetHeader("If-None-Match"); match != "" && (match == etag || match == bundle.Revision) {
			c.Status(http.StatusNotModified)
			return
		}
		ok(c, bundle)
	})

	adminGroup := r.Group("/admin/plugins/supdance-visual-engine")
	adminGroup.Use(func(c *gin.Context) { c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20); c.Next() })
	adminGroup.GET("/capabilities", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		permissions, err := svc.AdminVisualEngineCapabilities(actor)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, permissions)
	})
	adminGroup.POST("/preview", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var request struct {
			Config visualengine.Config `json:"config"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		config, err := svc.PreviewAdminVisualEngine(actor, request.Config)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, config)
	})
	adminGroup.POST("/lifecycle", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var request struct {
			Action       string `json:"action" binding:"required"`
			RetainConfig bool   `json:"retainConfig"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.ManageAdminVisualEngine(actor, request.Action, request.RetainConfig)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
	adminGroup.GET("/permissions", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		result, err := svc.AdminVisualEnginePermissions(actor)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})
	adminGroup.PUT("/permissions", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var request visualengine.PermissionPolicy
		if err := c.ShouldBindJSON(&request); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		if err := svc.SaveAdminVisualEnginePermissions(actor, request); err != nil {
			failService(c, err)
			return
		}
		ok(c, request)
	})
	adminGroup.PUT("/draft", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req struct {
			Config visualengine.Config `json:"config"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		draft, err := svc.SaveAdminVisualEngineDraft(user, req.Config)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, draft)
	})
	adminGroup.GET("/overview", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		overview, err := svc.AdminVisualEngineOverview(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, overview)
	})
	adminGroup.POST("/publish", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req struct {
			Config           visualengine.Config `json:"config"`
			Comment          string              `json:"comment"`
			ExpectedRevision string              `json:"expectedRevision" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		overview, err := svc.PublishAdminVisualEngine(user, req.Config, req.Comment, req.ExpectedRevision)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, overview)
	})
	adminGroup.POST("/rollback", func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req struct {
			Version          string `json:"version" binding:"required"`
			ExpectedRevision string `json:"expectedRevision" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		overview, err := svc.RollbackAdminVisualEngine(user, req.Version, req.ExpectedRevision)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, overview)
	})
}
