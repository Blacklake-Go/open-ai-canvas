package handler

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"yingce/backend/internal/service"
	"yingce/backend/internal/supdance/socialauth"

	"github.com/gin-gonic/gin"
)

const socialOnboardingCookie = "__Host-supdance-social-onboarding"

func setSocialOnboardingCookie(c *gin.Context, value string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{Name: socialOnboardingCookie, Value: value, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: maxAge})
}

func socialOnboardingTicket(c *gin.Context) (string, bool) {
	c.Header("Cache-Control", "no-store")
	value, _ := c.Cookie(socialOnboardingCookie)
	if !strings.HasPrefix(value, socialauth.OnboardingTicketPrefix) || len(value) != len(socialauth.OnboardingTicketPrefix)+64 {
		fail(c, http.StatusBadRequest, fmt.Errorf("入站授权已过期，请重新登录"))
		return "", false
	}
	return value, true
}

// RegisterSocialAuthRoutes mounts all public and administrative social auth endpoints.
func RegisterSocialAuthRoutes(api *gin.RouterGroup, svc *service.Service) {
	registerSocialBrandIconRoutes(api, svc)
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

		target, err := svc.BeginSocialAuth(c.Request, provider, nextPath, acceptedTerms)
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
		c.Header("Cache-Control", "no-store")
		c.Header("Referrer-Policy", "no-referrer")
		if !enforceRateLimit(c, "social-cb:"+provider+":"+c.ClientIP(), 60, 10*time.Minute) {
			return
		}
		state := c.Query("state")
		code := c.Query("code")

		result, err := svc.CompleteSocialAuth(c.Request, provider, state, code, sessionCookie(c), loginRequestContext(c))
		if err != nil {
			var accountErr *socialauth.AccountAuthorizationError
			if errors.As(err, &accountErr) {
				http.SetCookie(c.Writer, &http.Cookie{Name: socialauth.OAuthBindingCookie, Value: "", Path: "/api/auth", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
				c.Redirect(http.StatusFound, accountErr.Next)
				return
			}
			message := "第三方授权失败，请重新登录"
			var appErr *service.AppError
			if errors.As(err, &appErr) && appErr.Status < 500 {
				message = appErr.Message
			}
			redirectTarget := "/login?oauth_error=" + url.QueryEscape(message)
			if c.Query("lang") == "zh" || c.GetHeader("Referer") != "" && urlContains(c.GetHeader("Referer"), "/zh/login") {
				redirectTarget = "/zh/login?oauth_error=" + url.QueryEscape(message)
			}
			c.Redirect(http.StatusFound, redirectTarget)
			return
		}

		http.SetCookie(c.Writer, &http.Cookie{Name: socialauth.OAuthBindingCookie, Value: "", Path: "/api/auth", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})

		if result.OnboardingTicket != "" {
			setSocialOnboardingCookie(c, result.OnboardingTicket, 1800)
			c.Redirect(http.StatusFound, result.Next)
			return
		}

		if result.Session != nil {
			setSessionCookie(c, result.Session.Session, result.Session.MaxAgeSecs)
		}
		c.Redirect(http.StatusFound, result.Next)
	}

	api.GET("/auth/social/onboarding/profile", func(c *gin.Context) {
		ticket, okTicket := socialOnboardingTicket(c)
		if !okTicket {
			return
		}
		profile, err := svc.SocialAuthOnboardingProfile(ticket)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, profile)
	})

	api.POST("/auth/social/onboarding/email-code", func(c *gin.Context) {
		ticket, okTicket := socialOnboardingTicket(c)
		if !okTicket || !enforceRateLimit(c, "social-onboarding-email:"+c.ClientIP(), 20, 10*time.Minute) {
			return
		}
		var req struct {
			Email string `json:"email"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		result, err := svc.SendSocialOnboardingEmail(c.Request, ticket, req.Email)
		if err != nil {
			failService(c, err)
			return
		}
		ok(c, result)
	})

	api.POST("/auth/social/onboarding/complete", func(c *gin.Context) {
		ticket, okTicket := socialOnboardingTicket(c)
		if !okTicket || !enforceRateLimit(c, "social-onboarding-complete:"+c.ClientIP(), 40, 10*time.Minute) {
			return
		}
		var req service.SocialAuthCompleteOnboardingRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, err)
			return
		}
		req.TicketID = ticket
		result, err := svc.CompleteSocialAuthOnboarding(c.Request, req, loginRequestContext(c))
		if err != nil {
			failService(c, err)
			return
		}
		setSessionCookie(c, result.Session.Session, result.Session.MaxAgeSecs)
		setSocialOnboardingCookie(c, "", -1)
		ok(c, gin.H{"user": result.Session.User, "next": result.Next})
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

	beginAccountAuthorization := func(reauthenticate bool) gin.HandlerFunc {
		return func(c *gin.Context) {
			provider := c.Param("provider")
			if !enforceRateLimit(c, "social-bind:"+provider+":"+c.ClientIP(), 30, 10*time.Minute) {
				return
			}
			target, err := svc.BeginSocialAuthBind(sessionCookie(c), provider, c.Query("next"), reauthenticate)
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
		}
	}
	api.GET("/auth/social/:provider/bind", beginAccountAuthorization(false))
	api.GET("/auth/social/:provider/reauth", beginAccountAuthorization(true))

	api.POST("/auth/social/:provider/unbind", func(c *gin.Context) {
		actor, err := currentUser(c, svc)
		if err != nil {
			failService(c, err)
			return
		}
		provider := c.Param("provider")
		if err := svc.UnbindSocialAuth(actor, provider, c.Request); err != nil {
			failService(c, err)
			return
		}
		ok(c, nil)
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

	// 2. Admin Social Login Config Center endpoints
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
			if strings.TrimSpace(req.Revision) == "" {
				fail(c, http.StatusBadRequest, fmt.Errorf("请刷新社交登录配置后再保存"))
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

		// Operations endpoints
		admin.GET("/operations/overview", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			overview, err := svc.SocialAuthOperationsOverview(c.Request, actor)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})

		admin.PUT("/operations/policies", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			var req struct {
				service.SocialAuthOperationalPolicies
				Revision string `json:"revision"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			if strings.TrimSpace(req.Revision) == "" {
				fail(c, http.StatusBadRequest, fmt.Errorf("请刷新社交登录运营策略后再保存"))
				return
			}
			overview, err := svc.UpdateSocialAuthPolicies(actor, req.SocialAuthOperationalPolicies, req.Revision)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, overview)
		})

		admin.GET("/operations/users", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			query := c.Query("q")
			users, err := svc.SearchSocialAuthUsers(actor, query)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, users)
		})

		unbindHandler := func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			targetUserID := c.Param("userId")
			provider := c.Param("provider")
			if err := svc.AdminUnbindSocialAuth(actor, targetUserID, provider); err != nil {
				failService(c, err)
				return
			}
			ok(c, gin.H{"success": true})
		}
		admin.POST("/operations/users/:userId/unbind/:provider", unbindHandler)
		admin.DELETE("/operations/users/:userId/unbind/:provider", unbindHandler)

		admin.GET("/operations/logs", func(c *gin.Context) {
			actor, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			logs, err := svc.SocialAuthLoginLogs(actor, 100)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, logs)
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
