package handler

import (
	"encoding/json"
	"errors"
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
			Config  json.RawMessage `json:"config"`
			Comment string          `json:"comment"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		config, err := visualengine.DecodeConfig(req.Config)
		if err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		if len(req.Comment) > 2000 {
			fail(c, http.StatusBadRequest, errors.New("发布说明不能超过 2000 字节"))
			return
		}
		overview, err := svc.PublishAdminVisualEngine(user, config, req.Comment)
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
			Version string `json:"version" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		overview, err := svc.RollbackAdminVisualEngine(user, req.Version)
		if err != nil {
			if errors.Is(err, visualengine.ErrSnapshotNotFound) {
				fail(c, http.StatusNotFound, err)
				return
			}
			failService(c, err)
			return
		}
		ok(c, overview)
	})
}
