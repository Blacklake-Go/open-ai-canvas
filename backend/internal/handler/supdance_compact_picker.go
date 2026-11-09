package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"yingce/backend/internal/service"
	"yingce/backend/internal/supdance/compactpicker"
)

func RegisterSupDanceCompactPickerRoutes(r *gin.RouterGroup, svc *service.Service) {
	const path = "/supdance/compact-model-picker/settings"
	r.GET(path, func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		settings, err := svc.CompactPickerSettings()
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, settings)
	})
	r.GET("/admin"+path, func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		settings, err := svc.AdminCompactPickerSettings(user)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, settings)
	})
	r.PUT("/admin"+path, func(c *gin.Context) {
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if err := svc.RequireAdmin(user); err != nil {
			failService(c, err)
			return
		}
		var body struct {
			Enabled          *bool `json:"enabled"`
			ShowDescription  *bool `json:"showDescription"`
			ShowPrice        *bool `json:"showPrice"`
			ShowInspirations *bool `json:"showInspirations"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(c.Writer, c.Request.Body, 4096))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&body); err != nil || decoder.Decode(&struct{}{}) != io.EOF {
			fail(c, http.StatusBadRequest, errors.New("模型选择器配置格式不正确"))
			return
		}
		if body.Enabled == nil || body.ShowDescription == nil || body.ShowPrice == nil {
			fail(c, http.StatusBadRequest, errors.New("请提供完整的模型选择器开关配置"))
			return
		}
		showInspirations := false
		if body.ShowInspirations != nil {
			showInspirations = *body.ShowInspirations
		}
		settings, err := svc.SaveAdminCompactPickerSettings(user, compactpicker.Settings{
			Enabled: *body.Enabled, Display: compactpicker.Display{
				ShowDescription:  *body.ShowDescription,
				ShowPrice:        *body.ShowPrice,
				ShowInspirations: showInspirations,
			},
		})
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, settings)
	})
}
