package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"yingce/backend/internal/service"
	"yingce/backend/internal/supdance/gallery"
)

func registerInspirationCurationRoutes(r *gin.RouterGroup, svc *service.Service) {
	const base = "/admin/inspiration-curation"
	r.GET("/public/inspirations/curation", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		doc, err := svc.InspirationGallery().PublicCuration()
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, doc)
	})
	r.GET(base, func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		state, err := svc.AdminInspirationCuration(actor)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, state)
	})
	r.GET(base+"/catalog", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		cards, err := svc.AdminInspirationCurationCatalog(actor, c.Query("q"))
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, cards)
	})
	for _, action := range []string{"draft", "publish", "rollback"} {
		r.POST(base+"/"+action, func(c *gin.Context) {
			c.Header("Cache-Control", "no-store")
			actor, err := currentUser(c, svc)
			if err == nil {
				err = svc.RequireAdmin(actor)
			}
			if err != nil {
				failService(c, err)
				return
			}
			var input gallery.CurationChange
			decoder := json.NewDecoder(http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20))
			decoder.DisallowUnknownFields()
			if decoder.Decode(&input) != nil || decoder.Decode(new(json.RawMessage)) != io.EOF {
				failService(c, service.BadAuthRequest("策展请求无效或超出大小限制"))
				return
			}
			state, err := svc.ChangeInspirationCuration(actor, action, input)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, state)
		})
	}
}
