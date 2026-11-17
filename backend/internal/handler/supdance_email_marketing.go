package handler

import (
	"github.com/gin-gonic/gin"
	"html"
	"io"
	"net/http"
	"yingce/backend/internal/service"
)

func RegisterSupDanceEmailMarketingRoutes(r *gin.RouterGroup, svc *service.Service) {
	for _, base := range []string{"/admin/email-center", "/admin/plugins/supdance-email-marketing"} {
		group := r.Group(base)
		group.GET("/queue", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			rows, err := svc.AdminEmailQueue(actor)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, rows)
		})
		group.GET("/activity", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			rows, err := svc.AdminEmailCenterActivity(actor)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, rows)
		})
		group.POST("/assets", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 6<<20)
			file, _, err := c.Request.FormFile("file")
			if c.Request.MultipartForm != nil {
				defer c.Request.MultipartForm.RemoveAll()
			}
			if err != nil {
				failService(c, service.BadAuthRequest("请提供图片文件"))
				return
			}
			defer file.Close()
			data, err := io.ReadAll(io.LimitReader(file, (5<<20)+1))
			if err != nil {
				failService(c, service.BadAuthRequest("读取图片失败"))
				return
			}
			assetURL, err := svc.UploadEmailCenterAsset(actor, data)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, gin.H{"url": assetURL})
		})
		group.GET("/overview", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			out, err := svc.AdminEmailCenter(actor)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, out)
		})
		group.POST("/initialize", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			if err := svc.InitializeEmailCenter(actor); err != nil {
				failService(c, err)
				return
			}
			ok(c, gin.H{"initialized": true})
		})
		group.GET("/campaigns", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			out, err := svc.AdminEmailCampaigns(actor)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, out)
		})
		group.POST("/campaigns", func(c *gin.Context) {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 32<<10)
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req service.EmailCampaignRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				failService(c, service.BadAuthRequest("活动请求无效"))
				return
			}
			if err := svc.CreateEmailCampaign(actor, req); err != nil {
				failService(c, err)
				return
			}
			ok(c, gin.H{"saved": true})
		})
		group.POST("/campaigns/:id/:action", func(c *gin.Context) {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024)
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req service.EmailCampaignRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				failService(c, service.BadAuthRequest("活动请求无效"))
				return
			}
			if err := svc.ControlEmailCampaign(actor, c.Param("id"), c.Param("action"), req.ScheduleAt); err != nil {
				failService(c, err)
				return
			}
			ok(c, gin.H{"saved": true})
		})
		for _, action := range []string{"draft", "publish", "preview", "test"} {
			action := action
			group.POST("/templates/:key/"+action, func(c *gin.Context) {
				c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 128<<10)
				actor, err := currentUser(c, svc)
				if err != nil {
					failService(c, err)
					return
				}
				var req service.EmailCenterEditRequest
				if err := c.ShouldBindJSON(&req); err != nil {
					failService(c, service.BadAuthRequest("邮件请求格式无效"))
					return
				}
				key := c.Param("key")
				switch action {
				case "draft":
					err = svc.SaveEmailCenterDraft(actor, key, req)
				case "publish":
					err = svc.PublishEmailCenter(actor, key, req)
				case "test":
					err = svc.TestEmailCenter(actor, key, req)
				case "preview":
					out, previewErr := svc.PreviewEmailCenter(actor, key, req)
					if previewErr != nil {
						failService(c, previewErr)
						return
					}
					ok(c, out)
					return
				}
				if err != nil {
					failService(c, err)
					return
				}
				ok(c, gin.H{"success": true})
			})
		}
	}
	r.GET("/public/email-center/brand/:id", func(c *gin.Context) {
		asset, err := svc.EmailCenterBrandAsset(c.Param("id"))
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Data(http.StatusOK, asset.ContentType, asset.Data)
	})
	r.GET("/public/email-center/unsubscribe", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Content-Security-Policy", "default-src 'none'; form-action 'self'; frame-ancestors 'none'")
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SupDance · 退订营销邮件</title><h1>退订营销邮件</h1><p>必要账户安全邮件不受影响。</p><form method="post"><input type="hidden" name="token" value="`+html.EscapeString(c.Query("token"))+`"><button name="List-Unsubscribe" value="One-Click">退订营销邮件 / Unsubscribe</button></form></html>`))
	})
	r.POST("/public/email-center/unsubscribe", func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
		if c.PostForm("List-Unsubscribe") != "One-Click" {
			c.Status(http.StatusBadRequest)
			return
		}
		token := c.Query("token")
		if token == "" {
			token = c.PostForm("token")
		}
		if err := svc.UnsubscribeEmailCenter(token); err != nil {
			c.Status(http.StatusBadRequest)
			return
		}
		c.Header("Cache-Control", "no-store")
		c.String(http.StatusOK, "Unsubscribed / 已退订营销邮件")
	})
	r.GET("/auth/email-center/preference", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		subscribed, err := svc.EmailCenterPreference(actor)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"marketing": subscribed})
	})
	r.PUT("/auth/email-center/preference", func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024)
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		var req struct {
			Marketing *bool `json:"marketing"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Marketing == nil {
			failService(c, service.BadAuthRequest("请提供 marketing"))
			return
		}
		if err := svc.SetEmailCenterPreference(actor, *req.Marketing); err != nil {
			failService(c, err)
			return
		}
		ok(c, gin.H{"saved": true})
	})
}
