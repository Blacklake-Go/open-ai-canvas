package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"yingce/backend/internal/model"
	"yingce/backend/internal/service"
)

func registerSocialBrandIconRoutes(api *gin.RouterGroup, svc *service.Service) {
	serve := func(admin bool) gin.HandlerFunc {
		return func(c *gin.Context) {
			var actor *model.User
			if admin {
				var err error
				actor, err = currentUser(c, svc)
				if err != nil {
					failService(c, err)
					return
				}
			}
			delivery, err := svc.PrepareSocialBrandIconDelivery(actor, c.Param("id"), resourceAccessOptions(c), c.GetHeader("Range"))
			if err != nil {
				failService(c, err)
				return
			}
			serveResourceDelivery(c, delivery, "no-store", "")
		}
	}
	api.GET("/auth/social/brand-icons/:id", serve(false))
	api.GET("/admin/social-auth/brand-icons/:id", serve(true))
	api.POST("/admin/social-auth/brand-icons", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if err := svc.RequireAdmin(actor); err != nil {
			failService(c, err)
			return
		}
		policy, available := loadRuntimePolicy(c, svc)
		if !available || !enforceRateLimit(c, "social-brand-upload:"+actor.ID, policy.Request.ResourceUploadPerMinute, time.Minute) {
			return
		}
		maxBytes, err := service.AppearanceAssetMaxBytes("logo")
		if err != nil {
			failService(c, err)
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes+(1<<20))
		file, err := c.FormFile("file")
		if c.Request.MultipartForm != nil {
			defer c.Request.MultipartForm.RemoveAll()
		}
		if err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		url, err := svc.UploadSocialBrandIcon(actor, file)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"url": url})
	})
}
