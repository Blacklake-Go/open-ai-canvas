package handler

import (
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"yingce/backend/internal/assets"
	"yingce/backend/internal/logging"
	"yingce/backend/internal/service"
)

const (
	studioBridgePath           = "/supdance-openai/v2/studio"
	studioSecretFileEnv        = "CANVAS_SUPDANCE_STUDIO_BRIDGE_SECRET_FILE"
	studioPartnerSecretFileEnv = "CANVAS_SUPDANCE_STUDIO_PARTNER_SECRET_FILE"
)

// NewSupdanceStudioBridge serves the isolated ingress using the website's services.
func NewSupdanceStudioBridge(svc *service.Service) (http.Handler, error) {
	studioSecret, err := readSupdanceBridgeSecret(studioSecretFileEnv)
	if err != nil {
		return nil, err
	}
	partnerSecret, err := readSupdanceBridgeSecret(studioPartnerSecretFileEnv)
	if err != nil {
		return nil, err
	}
	if subtle.ConstantTimeCompare(studioSecret, partnerSecret) == 1 {
		return nil, fmt.Errorf("%s and %s must contain different credentials", studioSecretFileEnv, studioPartnerSecretFileEnv)
	}
	if strings.TrimSpace(os.Getenv(supdanceOpenAISecretFileEnv)) != "" {
		legacySecret, err := readSupdanceBridgeSecret(supdanceOpenAISecretFileEnv)
		if err != nil {
			return nil, err
		}
		if subtle.ConstantTimeCompare(legacySecret, partnerSecret) == 1 || subtle.ConstantTimeCompare(legacySecret, studioSecret) == 1 {
			return nil, fmt.Errorf("Studio ingress requires credentials distinct from %s", supdanceOpenAISecretFileEnv)
		}
	}
	router := gin.New()
	router.Use(logging.Recovery(), RequestCorrelationMiddleware())
	api := router.Group("/api")
	registerSupdanceOpenAIBridgeRoutes(api, svc, partnerSecret)
	registerSupdanceStudioRoutes(api, svc, studioSecret)
	return router, nil
}

func readSupdanceBridgeSecret(envName string) ([]byte, error) {
	path := strings.TrimSpace(os.Getenv(envName))
	if path == "" {
		return nil, fmt.Errorf("%s is required", envName)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read %s", envName)
	}
	secret, err := hex.DecodeString(strings.TrimSpace(string(raw)))
	if err != nil || len(secret) != 32 {
		return nil, fmt.Errorf("%s must contain a 32-byte hexadecimal credential", envName)
	}
	return secret, nil
}

func registerSupdanceStudioRoutes(r *gin.RouterGroup, svc *service.Service, secret []byte) {
	authorization := "Bearer " + hex.EncodeToString(secret)
	group := r.Group(studioBridgePath, func(c *gin.Context) {
		if subtle.ConstantTimeCompare([]byte(c.GetHeader("Authorization")), []byte(authorization)) != 1 {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
	})
	group.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok", "version": 2}) })
	business := group.Group("", func(c *gin.Context) {
		encoded := c.GetHeader("X-Supdance-Subject")
		if len(encoded) == 0 || len(encoded) > 172 {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		decoded, err := base64.RawURLEncoding.DecodeString(encoded)
		if err != nil || len(decoded) == 0 {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		id := string(decoded)
		if err := svc.SupdanceOpenAIUser(id); err != nil {
			failService(c, err)
			c.Abort()
			return
		}
		if !enforceRateLimit(c, "supdance-studio:"+id, 110, time.Minute) {
			c.Abort()
			return
		}
		c.Set(supdanceOpenAISubject, id)
	})
	identity := func(c *gin.Context) string { return c.GetString(supdanceOpenAISubject) }
	business.GET("/models/:kind", func(c *gin.Context) {
		value, err := svc.StudioModels(identity(c), c.Param("kind"))
		supdanceOpenAIResult(c, value, err)
	})
	business.POST("/quote", func(c *gin.Context) {
		var req service.StudioGeneration
		if supdanceOpenAIDecode(c, &req) {
			value, err := svc.StudioEstimate(identity(c), secret, req)
			supdanceOpenAIResult(c, value, err)
		}
	})
	business.POST("/operations/:id", func(c *gin.Context) {
		var req service.StudioSubmit
		if supdanceOpenAIDecode(c, &req) {
			value, err := svc.StudioOperation(identity(c), c.Param("id"), req)
			supdanceOpenAIResult(c, value, err)
		}
	})
	business.GET("/operations/:id", func(c *gin.Context) {
		value, err := svc.StudioFindTask(identity(c), c.Param("id"))
		supdanceOpenAIResult(c, value, err)
	})
	business.GET("/tasks", func(c *gin.Context) {
		value, err := svc.StudioHistory(identity(c))
		supdanceOpenAIResult(c, value, err)
	})
	business.GET("/tasks/:id", func(c *gin.Context) {
		value, err := svc.StudioTask(identity(c), c.Param("id"))
		supdanceOpenAIResult(c, value, err)
	})
	business.POST("/tasks/:kind", func(c *gin.Context) {
		var req service.StudioSubmit
		if !supdanceOpenAIDecode(c, &req) {
			return
		}
		if req.Generation.Kind != c.Param("kind") {
			c.Status(http.StatusBadRequest)
			return
		}
		value, err := svc.StudioSubmit(identity(c), secret, c.GetHeader("Idempotency-Key"), req)
		supdanceOpenAIResult(c, value, err)
	})
	business.GET("/assets", func(c *gin.Context) {
		value, err := svc.StudioAssets(identity(c))
		supdanceOpenAIResult(c, value, err)
	})
	business.GET("/assets/:id", func(c *gin.Context) {
		value, err := svc.StudioAsset(identity(c), c.Param("id"))
		supdanceOpenAIResult(c, value, err)
	})
	business.POST("/assets", func(c *gin.Context) {
		data, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 8<<20))
		if err != nil {
			c.Status(http.StatusRequestEntityTooLarge)
			return
		}
		value, err := svc.StudioUpload(identity(c), c.GetHeader("Content-Type"), c.Query("name"), data)
		supdanceOpenAIResult(c, value, err)
	})
	for _, mode := range []string{"preview", "download"} {
		business.GET("/assets/:id/"+mode, func(c *gin.Context) {
			id, owner := c.Param("id"), identity(c)
			asset, err := svc.StudioAsset(owner, id)
			if err != nil {
				failService(c, err)
				return
			}
			stream, err := svc.OpenResourceRange(owner, id, c.GetHeader("Range"))
			if err != nil {
				failService(c, err)
				return
			}
			disposition := "inline"
			if mode == "download" {
				disposition = "attachment"
			}
			name := asset.Name
			if supplied := strings.TrimSpace(c.Query("name")); len(supplied) > 0 && len(supplied) <= 240 && !strings.ContainsAny(supplied, "/\\\r\n\x00") {
				name = supplied
			}
			content := mime.FormatMediaType(disposition, map[string]string{"filename": name})
			serveResourceDelivery(c, &service.ResourceDelivery{Stream: stream, Access: &assets.ResourceAccess{}}, "private, no-store", content)
		})
	}
	registerSupdanceStudioDrama(business, svc)
}

func registerSupdanceStudioDrama(r *gin.RouterGroup, svc *service.Service) {
	identity := func(c *gin.Context) string { return c.GetString(supdanceOpenAISubject) }
	r.GET("/projects/:id", func(c *gin.Context) {
		result, err := svc.StudioDrama(identity(c), c.Param("id"))
		supdanceOpenAIResult(c, result, err)
	})
	r.POST("/projects", func(c *gin.Context) {
		var req struct {
			Title  string `json:"title"`
			Script string `json:"script"`
		}
		if supdanceOpenAIDecode(c, &req) {
			result, err := svc.StudioCreateDrama(identity(c), c.GetHeader("Idempotency-Key"), req.Title, req.Script)
			supdanceOpenAIResult(c, result, err)
		}
	})
	r.POST("/projects/:id/script", func(c *gin.Context) {
		var req struct {
			Revision string `json:"revision"`
			Script   string `json:"script"`
		}
		if supdanceOpenAIDecode(c, &req) {
			result, err := svc.StudioSaveScript(identity(c), c.Param("id"), req.Revision, req.Script)
			supdanceOpenAIResult(c, result, err)
		}
	})
	r.POST("/projects/:id/shots", func(c *gin.Context) {
		var req struct {
			Shot service.StudioShot `json:"shot"`
		}
		if supdanceOpenAIDecode(c, &req) {
			result, err := svc.StudioSaveShot(identity(c), c.Param("id"), req.Shot)
			supdanceOpenAIResult(c, result, err)
		}
	})
	r.POST("/projects/:id/storyboard", func(c *gin.Context) {
		var req struct {
			Revision string                       `json:"revision"`
			Shots    []service.SupdanceOpenAIShot `json:"shots"`
		}
		if supdanceOpenAIDecode(c, &req) {
			result, err := svc.StudioApplyStoryboard(identity(c), c.Param("id"), req.Revision, req.Shots)
			supdanceOpenAIResult(c, result, err)
		}
	})
}
