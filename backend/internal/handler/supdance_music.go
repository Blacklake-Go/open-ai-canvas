package handler

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// RegisterSupDanceMusicRoutes mounts client and admin HTTP endpoints for AI music generation.
func RegisterSupDanceMusicRoutes(r *gin.RouterGroup, svc *service.Service) {
	// Client music endpoints
	musicGroup := r.Group("/v1/supdance/music")
	{
		musicGroup.GET("/capabilities", func(c *gin.Context) {
			caps, err := svc.MusicCapabilities(c.Request.Context())
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, caps)
		})

		musicGroup.POST("/tasks", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req service.MusicGenerationRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			resp, err := svc.SubmitMusicTask(c.Request.Context(), user.ID, req)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, resp)
		})

		musicGroup.GET("/tasks/:id", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			taskID := strings.TrimSpace(c.Param("id"))
			task, err := svc.GetMusicTask(c.Request.Context(), user, taskID)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, task)
		})

		musicGroup.GET("/tasks", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
			if page < 1 {
				page = 1
			}
			if pageSize < 1 || pageSize > 100 {
				pageSize = 20
			}
			offset := (page - 1) * pageSize

			tasks, total, err := svc.ListUserMusicTasks(c.Request.Context(), user.ID, offset, pageSize)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, gin.H{
				"items":    tasks,
				"total":    total,
				"page":     page,
				"pageSize": pageSize,
			})
		})

		musicGroup.GET("/tasks/:id/download", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			taskID := strings.TrimSpace(c.Param("id"))
			format := strings.TrimSpace(c.DefaultQuery("format", "mp3"))

			data, mimeType, filename, err := svc.DownloadMusicAudio(c.Request.Context(), user, taskID, format)
			if err != nil {
				failService(c, err)
				return
			}

			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
			c.Data(http.StatusOK, mimeType, data)
		})

		musicGroup.POST("/webhook", func(c *gin.Context) {
			sig := c.GetHeader("X-Koyosim-Signature")
			if sig == "" {
				sig = c.GetHeader("X-Signature")
			}
			payload, err := io.ReadAll(c.Request.Body)
			if err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			if err := svc.HandleMusicWebhook(c.Request.Context(), sig, payload); err != nil {
				fail(c, http.StatusUnauthorized, err)
				return
			}
			ok(c, gin.H{"status": "ok"})
		})
	}

	// Admin endpoints
	adminGroup := r.Group("/admin/plugins/music-generation")
	{
		adminGroup.GET("/overview", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			if err := svc.RequireAdmin(user); err != nil {
				failService(c, err)
				return
			}
			lifecycle := svc.GetMusicPluginLifecycle()
			ok(c, lifecycle)
		})

		adminGroup.POST("/lifecycle", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req struct {
				State service.MusicPluginLifecycleState `json:"state" binding:"required"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			info, err := svc.SetMusicPluginLifecycle(user, req.State)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, info)
		})

		adminGroup.GET("/config", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			view, err := svc.MusicAdminConfigView(user)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, view)
		})

		adminGroup.PUT("/config", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req service.MusicUpdateConfigRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			view, err := svc.UpdateMusicAdminConfig(user, req)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, view)
		})

		adminGroup.POST("/test-connection", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req struct {
				APIKey string `json:"apiKey"`
			}
			_ = c.ShouldBindJSON(&req)
			res, err := svc.TestMusicConnection(user, req.APIKey)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, res)
		})

		adminGroup.GET("/tasks", func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			status := c.Query("status")
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
			if page < 1 {
				page = 1
			}
			if pageSize < 1 || pageSize > 100 {
				pageSize = 20
			}
			offset := (page - 1) * pageSize

			tasks, total, err := svc.ListAdminMusicTasks(c.Request.Context(), user, status, offset, pageSize)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, gin.H{
				"items":    tasks,
				"total":    total,
				"page":     page,
				"pageSize": pageSize,
			})
		})
	}
}
