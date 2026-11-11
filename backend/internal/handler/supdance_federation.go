package handler

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"yingce/backend/internal/service"
)

func RegisterSupDanceFederationRoutes(api *gin.RouterGroup, svc *service.Service) {
	group := api.Group("/supdance/federation")
	for _, path := range []string{"/assets", "/asset"} {
		group.POST(path, func(c *gin.Context) {
			if !enforceRateLimit(c, "federation-assets:"+c.ClientIP(), 120, time.Minute) {
				return
			}
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8<<10)
			var req struct {
				Proof    string `json:"proof"`
				Describe bool   `json:"describe"`
			}
			if c.ShouldBindJSON(&req) != nil {
				failService(c, service.BadAuthRequest("作品请求无效"))
				return
			}
			c.Header("Cache-Control", "private, no-store")
			if c.FullPath() == "/api/supdance/federation/assets" {
				items, err := svc.FederationAssets(req.Proof)
				if err != nil {
					failService(c, err)
					return
				}
				ok(c, items)
				return
			}
			item, delivery, err := svc.FederationAsset(req.Proof, c.GetHeader("Range"), req.Describe)
			if err != nil {
				failService(c, err)
				return
			}
			if req.Describe {
				ok(c, item)
				return
			}
			serveResourceDelivery(c, delivery, "private, no-store", "")
		})
	}
	group.POST("/link", func(c *gin.Context) {
		expectedOrigin := os.Getenv("CANVAS_FEDERATION_MAIN_ORIGIN")
		if expectedOrigin == "" {
			expectedOrigin = "https://www.supdance.com"
		}
		if c.GetHeader("Origin") != expectedOrigin {
			failService(c, service.Forbidden("请求来源无效"))
			return
		}
		user, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		if !enforceRateLimit(c, "federation-link:"+user.ID, 10, 10*time.Minute) {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8<<10)
		var req struct {
			Request  string `json:"request"`
			Password string `json:"password"`
			Confirm  bool   `json:"confirm"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			failService(c, service.BadAuthRequest("连接请求参数无效"))
			return
		}
		if !req.Confirm {
			ticket, err := svc.FederationLinkRequest(user, req.Request)
			if err != nil {
				failService(c, err)
				return
			}
			c.Header("Cache-Control", "no-store")
			ok(c, gin.H{"oneUserId": ticket.OneUserID, "mainUserId": user.ID, "mainDisplayName": user.DisplayName, "purpose": ticket.Purpose})
			return
		}
		assertion, err := svc.AuthorizeFederationLink(user, sessionCookie(c), req.Password, req.Request)
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		ok(c, gin.H{"assertion": assertion})
	})
	group.POST("/wallet", func(c *gin.Context) {
		if !enforceRateLimit(c, "federation-wallet:"+c.ClientIP(), 120, time.Minute) {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8<<10)
		var req struct {
			Proof string `json:"proof"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			failService(c, service.BadAuthRequest("钱包请求参数无效"))
			return
		}
		wallet, err := svc.FederationWallet(req.Proof)
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "private, no-store")
		ok(c, wallet)
	})
}
