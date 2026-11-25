package handler

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"yingce/backend/internal/database"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/service"
)

// The HTTP bridge, worker, model protocol, media library and ledger are real.
// The plugin harness supplies identities and the local upstream supplies PNG bytes.
func TestSupdanceStudioLiveBridge(t *testing.T) {
	root := os.Getenv("SUPDANCE_STUDIO_PLUGIN_TEST_ROOT")
	if root == "" {
		t.Skip("set SUPDANCE_STUDIO_PLUGIN_TEST_ROOT to the plugin checkout to run the cross-repository test")
	}
	bun := os.Getenv("SUPDANCE_STUDIO_BUN")
	if bun == "" {
		bun = "bun"
	}
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "studio.sqlite")+"?_journal_mode=WAL&_busy_timeout=5000"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	conn, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if err := db.AutoMigrate(database.Models()...); err != nil {
		t.Fatal(err)
	}
	var picture bytes.Buffer
	if err := png.Encode(&picture, image.NewRGBA(image.Rect(0, 0, 3, 2))); err != nil {
		t.Fatal(err)
	}
	const fixtureReference = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII="
	var productCalls, shotCalls, failedCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost || req.URL.Path != "/v1/images/edits" {
			t.Errorf("unexpected upstream request %s %s", req.Method, req.URL.Path)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if err := req.ParseMultipartForm(1 << 20); err != nil {
			t.Error(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		defer req.MultipartForm.RemoveAll()
		file, _, err := req.FormFile("image")
		if err != nil {
			file, _, err = req.FormFile("image[]")
		}
		if err != nil {
			t.Error(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		defer file.Close()
		data, err := io.ReadAll(file)
		prompt := req.FormValue("prompt")
		switch {
		case err == nil && strings.Contains(prompt, "solid white background") && base64.StdEncoding.EncodeToString(data) == fixtureReference:
			productCalls.Add(1)
		case err == nil && prompt == "Courier portrait for the first shot." && bytes.Equal(data, picture.Bytes()):
			shotCalls.Add(1)
		case err == nil && prompt == "Reject this test frame." && bytes.Equal(data, picture.Bytes()):
			failedCalls.Add(1)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_, _ = io.WriteString(w, `{"error":{"type":"invalid_request_error","message":"Fixture declined this request"}}`)
			return
		default:
			t.Error("provider did not receive the matching reference bytes and prompt")
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"data": []map[string]string{{"b64_json": base64.StdEncoding.EncodeToString(picture.Bytes())}}})
	}))
	t.Cleanup(upstream.Close)
	seedStudioLiveModels(t, db, upstream.URL)

	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		t.Fatal(err)
	}
	secretHex := hex.EncodeToString(secret)
	secretPath := filepath.Join(dir, "bridge.secret")
	if err := os.WriteFile(secretPath, []byte(secretHex), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CANVAS_SUPDANCE_STUDIO_BRIDGE_SECRET_FILE", secretPath)
	t.Setenv("CANVAS_SUPDANCE_OPENAI_BRIDGE_SECRET_FILE", secretPath)
	svc := service.New(repository.New(db), dir)
	t.Cleanup(func() { _ = svc.Close() })
	previousRuntime := runtimeService
	ConfigureRuntime(svc)
	t.Cleanup(func() { ConfigureRuntime(previousRuntime) })
	project, err := svc.StudioCreateDrama("alice", "studio-live-drama", "The last train", "A courier discovers a note on an empty train.")
	if err != nil {
		t.Fatal(err)
	}
	cast, err := svc.CreateDramaCast("alice", project.ID, service.CreateDramaCastRequest{Kind: "character", Name: "Courier", Appearance: "A courier in a navy coat"})
	if err != nil {
		t.Fatal(err)
	}
	castAsset, err := svc.StudioUpload("alice", "image/png", "courier.png", picture.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SetDramaCastImage("alice", project.ID, cast.ID, service.SetDramaCastImageRequest{ResourceID: castAsset.ID, Source: "upload"}); err != nil {
		t.Fatal(err)
	}
	svc.StartWorker()
	router := gin.New()
	api := router.Group("/api")
	RegisterSupdanceStudioRoutes(api, svc)
	RegisterSupdanceOpenAIBridgeRoutes(api, svc)
	bridge := httptest.NewServer(router)
	t.Cleanup(bridge.Close)
	request, err := json.Marshal(map[string]string{
		"url": bridge.URL + "/api/supdance-openai", "secret": secretHex,
		"projectId": project.ID, "castId": cast.ID, "castAssetId": castAsset.ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, bun, "test/studio-live.ts")
	cmd.Dir = root
	cmd.Stdin = bytes.NewReader(request)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("plugin HTTP validation failed: %v\n%s", err, out)
	} else {
		t.Log(strings.TrimSpace(string(out)))
	}
	if product, shot := productCalls.Load(), shotCalls.Load(); product != 1 || shot != 1 {
		t.Errorf("expected one worker request per operation (product=%d, shot=%d)", product, shot)
	}
	if failedCalls.Load() == 0 {
		t.Error("the failed task did not reach the fixture")
	}
	var orders []model.BillingOrder
	if err := db.Where("user_id = ?", "alice").Find(&orders).Error; err != nil {
		t.Fatal(err)
	}
	settled, refunded := 0, 0
	for _, order := range orders {
		switch {
		case order.Status == model.BillingStatusSettled && order.ActualAmountMicrocredits == 100:
			settled++
		case order.Status == model.BillingStatusRefunded && order.ActualAmountMicrocredits == 0:
			refunded++
		}
	}
	if len(orders) != 3 || settled != 2 || refunded != 1 {
		t.Fatalf("expected two settled orders of 100 test microcredits and one refund, got %d orders (%d settled, %d refunded)", len(orders), settled, refunded)
	}
}

func seedStudioLiveModels(t *testing.T, db *gorm.DB, upstream string) {
	t.Helper()
	const fixtureModel = "gpt-image-1"
	profile := service.DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceOpenAIImage), fixtureModel)
	profile.Image.Size.Values = []string{"1024x1024", "1536x1024", "1024x1536"}
	profile.Image.Size.Default = "1024x1024"
	profile.Image.Size.AllowCustom = false
	profile.Image.Size.Presets = nil
	spec, err := service.CapabilitySpecFromModelCapabilityConfig(profile, "image")
	if err != nil {
		t.Fatal(err)
	}
	encode := func(value any) string {
		t.Helper()
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return string(raw)
	}
	for _, row := range []any{
		&model.User{ID: "alice", Username: "alice", Email: "alice@example.invalid", Role: model.UserRoleUser, Status: model.UserStatusActive},
		&model.User{ID: "bob", Username: "bob", Email: "bob@example.invalid", Role: model.UserRoleUser, Status: model.UserStatusActive},
		&model.CreditAccount{UserID: "alice", AvailableMicrocredits: 10_000},
		&model.SystemSetting{Key: "feature_availability", ValueJSON: `{"frontendModelsEnabled":true,"shortDramaEnabled":true,"ecommerceEnabled":true,"imageWorkbenchEnabled":true,"creditsEnabled":true}`},
		&model.ModelChannel{ID: "studio-e2e-channel", Scope: model.ChannelScopeSystem, Enabled: true, Name: "Local test provider", BaseURL: upstream, APIKey: "fixture-provider"},
		&model.ChannelModel{ID: "studio-e2e-channel-model", ChannelID: "studio-e2e-channel", ModelKey: fixtureModel, ProviderModelKey: fixtureModel, Capability: "image", Protocol: model.ChannelInterfaceOpenAIImage, Enabled: true, CapabilityConfigJSON: encode(profile), BillingMode: "fixed_request", PriceConfigured: true},
		&model.ChannelModelPriceTier{ID: "studio-e2e-tier", ChannelModelID: "studio-e2e-channel-model", SelectorKey: "{}", SelectorJSON: "{}", BillingMode: "fixed_request", UnitPriceMicrocredits: 100, PriceConfigured: true, Enabled: true},
		&model.LogicalModel{ID: "studio-e2e-image", Code: "studio-e2e-image", Name: "Local test image", Capability: "image", Enabled: true, ActiveRevisionID: "studio-e2e-rev", PricePolicy: "channel", BillingMode: "fixed_request"},
		&model.LogicalModelRevision{ID: "studio-e2e-rev", LogicalModelID: "studio-e2e-image", Version: 1, CapabilitySpecJSON: encode(spec), DefaultOptionsJSON: "{}"},
		&model.LogicalModelRoute{ID: "studio-e2e-route", LogicalModelRevisionID: "studio-e2e-rev", ChannelModelID: "studio-e2e-channel-model", Enabled: true, Weight: 1},
	} {
		if err := db.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
}
