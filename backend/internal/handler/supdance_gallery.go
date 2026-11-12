package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func RegisterSupDanceGalleryRoutes(r *gin.RouterGroup, svc *service.Service) {
	r.GET("/public/inspirations/access", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		allowed, err := svc.InspirationGallery().Public(false)
		if err != nil || !allowed {
			c.Status(http.StatusForbidden)
			return
		}
		c.Status(http.StatusNoContent)
	})
	r.GET("/public/inspirations/catalog/*path", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Header("X-Robots-Tag", "noindex, noarchive")
		payload, err := svc.InspirationGallery().LegacyPack(c.Param("path")[1:])
		if err != nil {
			failService(c, err)
			return
		}
		c.JSON(http.StatusOK, payload)
	})
	r.GET("/public/inspirations/media/*path", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		path, err := svc.InspirationGallery().MediaPath("/inspiration-thumbs" + c.Param("path"))
		if err != nil {
			failService(c, err)
			return
		}
		c.File(path)
	})
	const admin = "/admin/supdance/compact-model-picker/inspirations"
	r.GET(admin, func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		rows, err := svc.AdminGalleryCandidates(actor, c.Query("q"))
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, rows)
	})
	r.PUT(admin, func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if err = svc.RequireAdmin(actor); err != nil {
			failService(c, err)
			return
		}
		var body struct {
			ID               string `json:"id"`
			Status           string `json:"status"`
			Evidence         string `json:"evidence"`
			Hash             string `json:"hash"`
			ReplacementImage string `json:"replacementImage"`
		}
		d := json.NewDecoder(http.MaxBytesReader(c.Writer, c.Request.Body, 8192))
		d.DisallowUnknownFields()
		if err = d.Decode(&body); err != nil || d.Decode(&struct{}{}) != io.EOF {
			fail(c, http.StatusBadRequest, errors.New("无效审核请求"))
			return
		}
		if err = svc.ReviewGalleryCandidate(actor, body.ID, body.Status, body.Evidence, body.Hash, body.ReplacementImage); err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"saved": true})
	})
}
