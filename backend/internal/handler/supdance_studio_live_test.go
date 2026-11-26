package handler

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
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
	clip := makeStudioFixtureVideo(t)
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
	var productCalls, partialCalls, shotCalls, failedCalls atomic.Int32
	var videoCreates, videoPolls, videoFiles atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch req.Method + " " + req.URL.Path {
		case "POST /v1beta/models/veo-fixture:predictLongRunning":
			videoCreates.Add(1)
			var input struct {
				Instances []struct {
					Prompt string
					Image  struct {
						InlineData struct {
							Data     string
							MimeType string
						}
					}
				}
				Parameters struct {
					AspectRatio     string
					DurationSeconds int
					Resolution      string
				}
			}
			if err := json.NewDecoder(req.Body).Decode(&input); err != nil || len(input.Instances) != 1 {
				t.Errorf("invalid video create request: %v", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			image := input.Instances[0].Image.InlineData
			parameters := input.Parameters
			if image.MimeType != "image/png" || image.Data != base64.StdEncoding.EncodeToString(picture.Bytes()) ||
				input.Instances[0].Prompt != "The courier steps off the train." || parameters.DurationSeconds != 4 ||
				parameters.AspectRatio != "16:9" || parameters.Resolution != "720p" {
				t.Errorf("video did not receive its role reference and requested parameters: %+v, has image=%t", parameters, image.Data != "")
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"name":"operations/video-fixture"}`)
			return
		case "GET /v1beta/operations/video-fixture":
			videoPolls.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"done":true,"response":{"videos":["http://`+req.Host+`/video-fixture.mp4"]}}`)
			return
		case "GET /video-fixture.mp4":
			videoFiles.Add(1)
			w.Header().Set("Content-Type", "video/mp4")
			_, _ = w.Write(clip)
			return
		}
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
		case err == nil && strings.Contains(prompt, "requested scene") && base64.StdEncoding.EncodeToString(data) == fixtureReference && req.FormValue("n") == "2":
			partialCalls.Add(1)
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

	setSecret := func(envName, filename string) string {
		t.Helper()
		secret := make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			t.Fatal(err)
		}
		secretHex := hex.EncodeToString(secret)
		path := filepath.Join(dir, filename)
		if err := os.WriteFile(path, []byte(secretHex), 0o600); err != nil {
			t.Fatal(err)
		}
		t.Setenv(envName, path)
		return secretHex
	}
	secretHex := setSecret(studioSecretFileEnv, "bridge.secret")
	partnerSecretHex := setSecret(studioPartnerSecretFileEnv, "partner.secret")
	t.Setenv(supdanceOpenAISecretFileEnv, "")
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
	router, err := NewSupdanceStudioBridge(svc)
	if err != nil {
		t.Fatal(err)
	}
	bridge := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/supdance-openai/v2/studio/quote" {
			router.ServeHTTP(w, r)
			return
		}
		result := httptest.NewRecorder()
		router.ServeHTTP(result, r)
		if result.Code >= http.StatusBadRequest {
			t.Logf("Studio quote rejected HTTP %d: %s", result.Code, result.Body.String())
		}
		for name, values := range result.Header() {
			w.Header()[name] = values
		}
		w.WriteHeader(result.Code)
		_, _ = result.Body.WriteTo(w)
	}))
	t.Cleanup(bridge.Close)
	videoDigest := sha256.Sum256(clip)
	request, err := json.Marshal(map[string]string{
		"url": bridge.URL + "/api/supdance-openai", "secret": secretHex, "partnerSecret": partnerSecretHex,
		"projectId": project.ID, "castId": cast.ID, "castAssetId": castAsset.ID,
		"videoSHA256": hex.EncodeToString(videoDigest[:]),
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 80*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, bun, "test/studio-live.ts")
	cmd.Dir = root
	cmd.Stdin = bytes.NewReader(request)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("plugin HTTP validation failed: %v\n%s", err, out)
	} else {
		t.Log(strings.TrimSpace(string(out)))
	}
	websiteProject, err := svc.DramaSummary("alice", project.ID)
	if err != nil || websiteProject.Project.ID != project.ID || len(websiteProject.Episodes) != 1 {
		t.Fatalf("website did not find Studio's project and episode: %v", err)
	}
	websiteEpisode, err := svc.DramaEpisodeDetail("alice", project.ID, websiteProject.Episodes[0].ID)
	if err != nil || len(websiteEpisode.Shots) != 2 {
		t.Fatalf("website did not find both Studio shots: %v", err)
	}
	if websiteEpisode.Shots[0].Action != "The courier turns around." || websiteEpisode.Shots[1].Scene != "Station" {
		t.Fatal("website did not see Studio's edit and unchanged neighboring shot")
	}
	if product, shot := productCalls.Load(), shotCalls.Load(); product != 1 || shot != 1 {
		t.Errorf("expected one worker request per operation (product=%d, shot=%d)", product, shot)
	}
	if partialCalls.Load() != 1 {
		t.Error("expected one request for a multi-image product scene")
	}
	if failedCalls.Load() == 0 {
		t.Error("the failed task did not reach the fixture")
	}
	if creates, polls, files := videoCreates.Load(), videoPolls.Load(), videoFiles.Load(); creates != 1 || polls != 1 || files != 1 {
		t.Errorf("expected one video create, status poll, and result fetch, got %d/%d/%d", creates, polls, files)
	}
	var orders []model.BillingOrder
	if err := db.Where("user_id = ?", "alice").Find(&orders).Error; err != nil {
		t.Fatal(err)
	}
	settledImages, settledVideos, refunded := 0, 0, 0
	for _, order := range orders {
		switch {
		case order.Status == model.BillingStatusSettled && order.ActualAmountMicrocredits == 100:
			settledImages++
		case order.Status == model.BillingStatusSettled && order.ActualAmountMicrocredits == 200:
			settledVideos++
		case order.Status == model.BillingStatusRefunded && order.ActualAmountMicrocredits == 0:
			refunded++
		}
	}
	if len(orders) != 5 || settledImages != 3 || settledVideos != 1 || refunded != 1 {
		t.Fatalf("expected three image settlements, one video settlement and one refund, got %d orders (%d/%d/%d)", len(orders), settledImages, settledVideos, refunded)
	}
}

func makeStudioFixtureVideo(t *testing.T) []byte {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "color=blue:s=32x32:r=2", "-t", "4",
		"-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1")
	var diagnostics bytes.Buffer
	cmd.Stderr = &diagnostics
	clip, err := cmd.Output()
	if err != nil {
		t.Fatalf("create synthetic test video with ffmpeg: %v: %s", err, diagnostics.String())
	}
	return clip
}

func seedStudioLiveModels(t *testing.T, db *gorm.DB, upstream string) {
	t.Helper()
	const fixtureModel = "gpt-image-1"
	profile := service.DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceOpenAIImage), fixtureModel)
	profile.Image.Size.Values = []string{"1024x1024", "1536x1024", "1024x1536"}
	profile.Image.Size.Default = "1024x1024"
	profile.Image.Size.AllowCustom = false
	profile.Image.Size.Presets = nil
	const fixtureVideoModel = "veo-fixture"
	const fixtureVideoProtocol = model.ChannelInterfaceGeminiVeo
	videoProfile := service.DefaultModelCapabilityConfigForModel(string(fixtureVideoProtocol), fixtureVideoModel)
	videoProfile.Video.References.MaxImages = 1
	videoProfile.Video.Duration.Selection = "enum"
	videoProfile.Video.Duration.Values = []int{4}
	videoProfile.Video.Duration.Default = 4
	videoProfile.Video.Ratios = []string{"16:9", "9:16"}
	videoProfile.Video.Resolutions = []string{"720p"}
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
		&model.SystemSetting{Key: "feature_availability", ValueJSON: `{"frontendModelsEnabled":false,"shortDramaEnabled":true,"ecommerceEnabled":true,"imageWorkbenchEnabled":true,"videoWorkbenchEnabled":true,"creditsEnabled":true}`},
		&model.ModelChannel{ID: "studio-e2e-channel", Scope: model.ChannelScopeSystem, Enabled: true, Name: "Local test provider", BaseURL: upstream, APIKey: "fixture-provider"},
		&model.ChannelModel{ID: "studio-e2e-channel-model", ChannelID: "studio-e2e-channel", ModelKey: fixtureModel, ProviderModelKey: fixtureModel, Capability: "image", Protocol: model.ChannelInterfaceOpenAIImage, Enabled: true, CapabilityConfigJSON: encode(profile), BillingMode: "fixed_request", PriceConfigured: true},
		&model.ChannelModelPriceTier{ID: "studio-e2e-tier", ChannelModelID: "studio-e2e-channel-model", SelectorKey: "{}", SelectorJSON: "{}", BillingMode: "fixed_request", UnitPriceMicrocredits: 100, PriceConfigured: true, Enabled: true},
		&model.ChannelModel{ID: "studio-e2e-video-channel-model", ChannelID: "studio-e2e-channel", ModelKey: fixtureVideoModel, ProviderModelKey: fixtureVideoModel, Capability: "video", Protocol: fixtureVideoProtocol, Enabled: true, CapabilityConfigJSON: encode(videoProfile), BillingMode: "per_second", PriceConfigured: true},
		&model.ChannelModelPriceTier{ID: "studio-e2e-video-tier", ChannelModelID: "studio-e2e-video-channel-model", SelectorKey: "{}", SelectorJSON: "{}", BillingMode: "per_second", UnitPriceMicrocredits: 50, PriceConfigured: true, Enabled: true},
		&model.ChannelModel{ID: "studio-e2e-missing-channel-model", ChannelID: "studio-e2e-channel", ModelKey: "missing-video", Capability: "video", Protocol: "custom-video", Enabled: true, CapabilityConfigJSON: encode(videoProfile), BillingMode: "per_second", PriceConfigured: true},
		&model.ChannelModelPriceTier{ID: "studio-e2e-missing-tier", ChannelModelID: "studio-e2e-missing-channel-model", SelectorKey: "{}", SelectorJSON: "{}", BillingMode: "per_second", UnitPriceMicrocredits: 50, PriceConfigured: true, Enabled: true},
	} {
		if err := db.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
}
