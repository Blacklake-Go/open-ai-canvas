package handler

import (
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"yingce/backend/internal/service"
)

const supdanceOpenAISubject = "supdanceOpenAISubject"

// The bridge is disabled unless the host is explicitly provisioned with its
// own service credential. The public website session is never used for bridge calls.
func RegisterSupdanceOpenAIBridgeRoutes(r *gin.RouterGroup, svc *service.Service) {
	raw, err := os.ReadFile(os.Getenv("CANVAS_SUPDANCE_OPENAI_BRIDGE_SECRET_FILE"))
	if err != nil {
		return
	}
	secret, err := hex.DecodeString(strings.TrimSpace(string(raw)))
	if err != nil || len(secret) != 32 {
		return
	}
	authorization := "Bearer " + hex.EncodeToString(secret)
	v1 := r.Group("/supdance-openai/v1", func(c *gin.Context) {
		if subtle.ConstantTimeCompare([]byte(c.GetHeader("Authorization")), []byte(authorization)) != 1 {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
	})
	v1.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": 1})
	})
	business := v1.Group("", func(c *gin.Context) {
		encoded := c.GetHeader("X-Supdance-Subject")
		if len(encoded) > 172 {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		raw, err := base64.RawURLEncoding.DecodeString(encoded)
		if err != nil || len(raw) == 0 {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		id := string(raw)
		if err := svc.SupdanceOpenAIUser(id); err != nil {
			failService(c, err)
			c.Abort()
			return
		}
		if err := svc.RequireFeature(service.FeatureShortDrama); err != nil {
			failService(c, err)
			c.Abort()
			return
		}
		if !enforceRateLimit(c, "supdance-openai:"+id, 90, time.Minute) {
			c.Abort()
			return
		}
		c.Set(supdanceOpenAISubject, id)
	})
	business.GET("/projects", func(c *gin.Context) {
		result, err := svc.SupdanceOpenAIProjects(c.GetString(supdanceOpenAISubject))
		supdanceOpenAIResult(c, result, err)
	})
	business.GET("/projects/:projectId", func(c *gin.Context) {
		result, err := svc.SupdanceOpenAIGetProject(c.GetString(supdanceOpenAISubject), c.Param("projectId"))
		supdanceOpenAIResult(c, result, err)
	})
	business.GET("/projects/:projectId/canvases", func(c *gin.Context) {
		result, err := svc.SupdanceOpenAICanvases(c.GetString(supdanceOpenAISubject), c.Param("projectId"))
		supdanceOpenAIResult(c, result, err)
	})
	business.GET("/projects/:projectId/canvases/:canvasId", func(c *gin.Context) {
		result, err := svc.SupdanceOpenAIGetCanvas(c.GetString(supdanceOpenAISubject), c.Param("projectId"), c.Param("canvasId"))
		supdanceOpenAIResult(c, result, err)
	})
	reviewSubject := strings.TrimSpace(os.Getenv("CANVAS_SUPDANCE_OPENAI_REVIEW_SUBJECT"))
	reviewModel := strings.TrimSpace(os.Getenv("CANVAS_SUPDANCE_OPENAI_REVIEW_MODEL"))
	business.GET("/text/models", func(c *gin.Context) {
		if reviewSubject == "" || reviewModel == "" || c.GetString(supdanceOpenAISubject) != reviewSubject {
			supdanceOpenAIResult(c, []any{}, nil)
			return
		}
		result, err := svc.SupdanceOpenAIReviewModels(reviewModel)
		supdanceOpenAIResult(c, result, err)
	})
	business.POST("/text/stream", func(c *gin.Context) {
		if reviewSubject == "" || reviewModel == "" || c.GetString(supdanceOpenAISubject) != reviewSubject {
			c.Status(http.StatusPaymentRequired)
			return
		}
		if !enforceRateLimit(c, "supdance-openai-review-text:"+reviewSubject, 4, time.Minute) {
			return
		}
		var req service.SupdanceOpenAITextRequest
		if !supdanceOpenAIDecode(c, &req) {
			return
		}
		result, err := svc.SupdanceOpenAIReviewText(c.Request.Context(), reviewSubject, reviewModel, req)
		if err != nil {
			failService(c, err)
			return
		}
		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(result))
	})
	business.POST("/actions/preview", func(c *gin.Context) {
		var req struct {
			Action service.SupdanceOpenAIAction `json:"action"`
		}
		if !supdanceOpenAIDecode(c, &req) {
			return
		}
		result, err := svc.SupdanceOpenAIPreview(c.GetString(supdanceOpenAISubject), secret, req.Action)
		supdanceOpenAIResult(c, result, err)
	})
	business.POST("/actions/commit", func(c *gin.Context) {
		var req struct {
			Action     service.SupdanceOpenAIAction `json:"action"`
			QuoteID    string                       `json:"quoteId"`
			MaxCredits *int64                       `json:"maxCredits"`
		}
		if !supdanceOpenAIDecode(c, &req) {
			return
		}
		if req.MaxCredits == nil || *req.MaxCredits != 0 {
			c.Status(http.StatusPaymentRequired)
			return
		}
		result, err := svc.SupdanceOpenAICommit(c.GetString(supdanceOpenAISubject), secret, c.GetHeader("Idempotency-Key"), req.QuoteID, req.Action)
		supdanceOpenAIResult(c, result, err)
	})
}

func supdanceOpenAIDecode(c *gin.Context, target any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 512000)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		c.Status(http.StatusBadRequest)
		return false
	}
	if err := decoder.Decode(new(json.RawMessage)); !errors.Is(err, io.EOF) {
		c.Status(http.StatusBadRequest)
		return false
	}
	return true
}

func supdanceOpenAIResult(c *gin.Context, value any, err error) {
	if err != nil {
		failService(c, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, value)
}
