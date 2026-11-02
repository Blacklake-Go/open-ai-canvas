package handler

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
	"yingce/backend/internal/supdance/socialauth"

	"yingce/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// RegisterSocialAuthRoutes mounts all public and administrative social auth endpoints.
func RegisterSocialAuthRoutes(api *gin.RouterGroup, svc *service.Service) {
	// 1. Public endpoints
	api.GET("/auth/social/providers", func(c *gin.Context) {
		res, err := svc.PublicSocialAuthProviders(c.Request)
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		ok(c, res)
	})

	api.GET("/auth/social/:provider/start", func(c *gin.Context) {
		provider := c.Param("provider")
		if !enforceRateLimit(c, "social-start:"+provider+":"+c.ClientIP(), 30, 10*time.Minute) {
			return
		}
		nextPath := c.Query("next")
		acceptedTerms := c.Query("acceptedTerms") == "true"
		isMock := c.Query("mock") == "true"

		target, err := svc.BeginSocialAuth(c.Request, provider, nextPath, acceptedTerms, isMock)
		if err != nil {
			failService(c, err)
			return
		}
		parsed, err := url.Parse(target)
		if err != nil || parsed.Query().Get("state") == "" {
			fail(c, http.StatusBadGateway, fmt.Errorf("授权服务返回无效状态"))
			return
		}
		http.SetCookie(c.Writer, &http.Cookie{Name: socialauth.OAuthBindingCookie, Value: socialauth.HashToken(parsed.Query().Get("state")), Path: "/api/auth", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: 600})
		c.Header("Cache-Control", "no-store")
		c.Redirect(http.StatusFound, target)
	})

	callbackHandler := func(c *gin.Context, provider string) {
		if !enforceRateLimit(c, "social-cb:"+provider+":"+c.ClientIP(), 60, 10*time.Minute) {
			return
		}
		state := c.Query("state")
		code := c.Query("code")

		result, err := svc.CompleteSocialAuth(c.Request, provider, state, code, sessionCookie(c), loginRequestContext(c))
		if err != nil {
			redirectTarget := "/login?oauth_error=" + url.QueryEscape(err.Error())
			if c.Query("lang") == "zh" || c.GetHeader("Referer") != "" && urlContains(c.GetHeader("Referer"), "/zh/login") {
				redirectTarget = "/zh/login?oauth_error=" + url.QueryEscape(err.Error())
			}
			c.Redirect(http.StatusFound, redirectTarget)
			return
		}

		http.SetCookie(c.Writer, &http.Cookie{Name: socialauth.OAuthBindingCookie, Value: "", Path: "/api/auth", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})

		// 1. If new user awaiting onboarding confirmation
		if result.OnboardingTicket != "" {
			if result.Session != nil {
				setSessionCookie(c, result.Session.Session, result.Session.MaxAgeSecs)
			}
			c.Redirect(http.StatusFound, result.Next)
			return
		}

		// 2. Normal login or account bind
		if result.Session != nil {
			setSessionCookie(c, result.Session.Session, result.Session.MaxAgeSecs)
		}
		c.Redirect(http.StatusFound, result.Next)
	}

	// 2. Onboarding endpoints
	api.GET("/auth/social/onboarding/profile", func(c *gin.Context) {
		ticket := c.Query("ticket")
		if strings.TrimSpace(ticket) == "" {
			fail(c, http.StatusBadRequest, fmt.Errorf("缺少入站凭证"))
			return
		}
		profile, err := svc.SocialAuthOnboardingProfile(ticket)
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		ok(c, profile)
	})

	api.POST("/auth/social/onboarding/complete", func(c *gin.Context) {
		var req service.SocialAuthCompleteOnboardingRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.CompleteSocialAuthOnboarding(c.Request, req, loginRequestContext(c))
		if err != nil {
			failService(c, err)
			return
		}
		if result.Session != nil {
			setSessionCookie(c, result.Session.Session, result.Session.MaxAgeSecs)
		}
		ok(c, result)
	})

	// 3. User account connected identities and unbind/bind endpoints
	api.GET("/auth/social/identities", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		view, err := svc.UserSocialIdentities(actor)
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		ok(c, view)
	})

	api.GET("/auth/social/:provider/bind", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		provider := c.Param("provider")
		target, err := svc.BeginSocialAuthBind(c.Request, actor, provider)
		if err != nil {
			failService(c, err)
			return
		}
		parsed, err := url.Parse(target)
		if err != nil || parsed.Query().Get("state") == "" {
			fail(c, http.StatusBadGateway, fmt.Errorf("授权服务返回无效状态"))
			return
		}
		http.SetCookie(c.Writer, &http.Cookie{Name: socialauth.OAuthBindingCookie, Value: socialauth.HashToken(parsed.Query().Get("state")), Path: "/api/auth", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: 600})
		c.Header("Cache-Control", "no-store")
		c.Redirect(http.StatusFound, target)
	})

	api.POST("/auth/social/:provider/unbind", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		provider := c.Param("provider")
		if err := svc.UnbindSocialAuth(actor, provider); err != nil {
			failService(c, err)
			return
		}
		view, err := svc.UserSocialIdentities(actor)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, view)
	})

	api.GET("/auth/social/:provider/callback", func(c *gin.Context) {
		callbackHandler(c, c.Param("provider"))
	})

	// Compatibility callback routes matching existing provider registration URLs
	api.GET("/auth/qq/callback", func(c *gin.Context) {
		callbackHandler(c, "qq")
	})
	api.GET("/auth/oauth/wechat/callback", func(c *gin.Context) {
		callbackHandler(c, "wechat")
	})
	api.GET("/auth/oauth/douyin/callback", func(c *gin.Context) {
		callbackHandler(c, "douyin")
	})
	api.GET("/auth/oauth/bilibili/callback", func(c *gin.Context) {
		callbackHandler(c, "bilibili")
	})

	// 2. Mock callback test harness JSON endpoint
	api.POST("/auth/social/mock-callback", func(c *gin.Context) {
		c.AbortWithStatusJSON(http.StatusGone, gin.H{"code": 410, "msg": "模拟登录入口已移除"})
	})

	// 3. Admin Social Login Config Center endpoints
	admin := api.Group("/admin/social-auth")
	{
		admin.GET("/settings", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			view, err := svc.SocialAuthAdminSettings(c.Request, actor)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, view)
		})

		admin.PUT("/settings", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req service.SocialAuthSettingsUpdateRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			view, err := svc.UpdateSocialAuthAdminSettings(c.Request, actor, req)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, view)
		})

		admin.POST("/test/:provider", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			result, err := svc.TestSocialAuthProvider(actor, c.Param("provider"))
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, result)
		})
	}
}

func urlContains(rawURL string, substr string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	return u.Path == substr || u.Path == substr+"/"
}
