package app

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/music"
)

func TestMusicToolSubmissionContract(t *testing.T) {
	for _, tc := range []struct {
		op, prompt, lyrics string
		start, end         int64
	}{
		{"reference", "", "Original lyrics", 0, 0}, {"persona", "soft jazz", "Lyrics", 0, 0},
		{"remix", "reggae", "Lyrics", 0, 0}, {"stems", "", "", 0, 0}, {"region", "", "Bridge", 100, 3100},
	} {
		cap, protocol, wired := musicProtocolProfile("mureka-music-tools", "mureka/"+tc.op)
		if !wired || protocol != "mureka-music-tools" || !musicOperationMatches(cap, tc.op) {
			t.Fatal(tc.op, cap)
		}
		cap.Available = true
		valid := music.MusicGenerationRequest{Mode: "custom", Operation: tc.op, SourceResourceID: "audio", Prompt: tc.prompt, Lyrics: tc.lyrics, EditStartMs: tc.start, EditEndMs: tc.end}
		if err := validateSiteMusicRequest(valid, cap); err != nil {
			t.Fatalf("%s: %v", tc.op, err)
		}
		for _, mutate := range []func(*music.MusicGenerationRequest){
			func(r *music.MusicGenerationRequest) { r.Operation = "" },
			func(r *music.MusicGenerationRequest) { r.SourceResourceID = "https://example.org/a.mp3" },
			func(r *music.MusicGenerationRequest) { r.EditStartMs = -1 },
			func(r *music.MusicGenerationRequest) { r.Lyrics = strings.Repeat("界", cap.MaxLyricsChars+1) },
			func(r *music.MusicGenerationRequest) { r.Prompt = strings.Repeat("界", cap.MaxPromptChars+1) },
		} {
			bad := valid
			mutate(&bad)
			if validateSiteMusicRequest(bad, cap) == nil {
				t.Fatalf("%s accepted invalid input", tc.op)
			}
		}
	}
	if _, _, wired := musicProtocolProfile("mureka-music-tools", "mureka/future-tool"); wired {
		t.Fatal("unimplemented operation advertised")
	}
	price := &model.ChannelModel{ModelKey: "friendly-name", ProviderModelKey: "mureka/region", PriceTiers: []model.ChannelModelPriceTier{{Enabled: true, PriceConfigured: true, BillingMode: "fixed_request"}}}
	if !hasDedicatedMusicToolPrice(price, "region") || hasDedicatedMusicToolPrice(price, "remix") {
		t.Fatal("incorrect SKU")
	}
	price.PriceTiers[0].ProviderModelKey = "mureka/remix"
	if hasDedicatedMusicToolPrice(price, "region") {
		t.Fatal("tier may not reroute the operation")
	}
	price.PriceTiers[0].ProviderModelKey = ""
	price.PriceTiers[0].BillingMode = "per_second"
	if hasDedicatedMusicToolPrice(price, "region") {
		t.Fatal("estimated price accepted")
	}
}

func TestMusicToolSourceLimits(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	r := model.Resource{ID: "audio", UserID: "artist", Kind: "audio", MimeType: "audio/mp4", Size: 900, Status: model.ResourceStatusReady}
	if err := db.Create(&r).Error; err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		op     string
		d, end int64
		ok     bool
	}{
		{"reference", 29999, 0, false}, {"reference", 30000, 0, true}, {"persona", 14999, 0, false}, {"persona", 15000, 0, true},
		{"remix", 9999, 0, false}, {"remix", 480000, 0, true}, {"remix", 480001, 0, false},
		{"region", 3000, 3001, false}, {"region", 3000, 3000, true}, {"region", 0, 3000, false}, {"stems", 0, 0, true},
	} {
		if err := db.Model(&r).Update("duration_ms", c.d).Error; err != nil {
			t.Fatal(err)
		}
		_, err := s.musicToolSource(r.UserID, music.MusicGenerationRequest{Operation: c.op, SourceResourceID: r.ID, EditEndMs: c.end})
		if (err == nil) != c.ok {
			t.Fatalf("%s duration=%d end=%d: %v", c.op, c.d, c.end, err)
		}
	}
	request := music.MusicGenerationRequest{Operation: "stems", SourceResourceID: r.ID}
	if _, err := s.musicToolSource("someone-else", request); err == nil {
		t.Fatal("foreign resource accepted")
	}
	for _, fields := range []map[string]any{{"kind": "video"}, {"kind": "audio", "mime_type": "audio/wav"}, {"mime_type": "audio/mpeg", "size": 10_000_001}, {"size": 100, "status": "pending"}} {
		if err := db.Model(&r).Updates(fields).Error; err != nil {
			t.Fatal(err)
		}
		if _, err := s.musicToolSource(r.UserID, request); err == nil {
			t.Fatal("invalid media accepted", fields)
		}
	}
}

func TestMusicToolsAdmissionThroughProviderAndAssetArchive(t *testing.T) {
	if !mediaProbeAvailable() {
		t.Skip("ffprobe is required to authorize real source media")
	}
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg is required for region delivery")
	}
	repaint, err := exec.Command(ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=33", "-ac", "2", "-f", "mp3", "pipe:1").Output()
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	s, db := newMediaRecoveryTestService(t)
	s = newService(s.repo, s.dataDir)
	ensureTestUsers(t, db)
	userID := testGroupUserID(s)
	runtime, err := newPluginRuntime(s.dataDir)
	if err != nil {
		t.Fatal(err)
	}
	s.pluginRuntime = runtime
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	t.Cleanup(func() { ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled) })
	// A real 32.6-second MPEG-1 Layer III silence stream, long enough for all five tools.
	frame := make([]byte, 417)
	copy(frame, []byte{0xff, 0xfb, 0x90, 0})
	mp3 := bytes.Repeat(frame, 1250)
	wav := make([]byte, 44+1600)
	copy(wav, "RIFF")
	binary.LittleEndian.PutUint32(wav[4:], uint32(len(wav)-8))
	copy(wav[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(wav[16:], 16)
	binary.LittleEndian.PutUint16(wav[20:], 1)
	binary.LittleEndian.PutUint16(wav[22:], 1)
	binary.LittleEndian.PutUint32(wav[24:], 8000)
	binary.LittleEndian.PutUint32(wav[28:], 16000)
	binary.LittleEndian.PutUint16(wav[32:], 2)
	binary.LittleEndian.PutUint16(wav[34:], 16)
	copy(wav[36:], "data")
	binary.LittleEndian.PutUint32(wav[40:], 1600)
	var archive bytes.Buffer
	zw := zip.NewWriter(&archive)
	for _, name := range []string{"vocals.wav", "instrumental.wav"} {
		f, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = f.Write(wav); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	var submits atomic.Int32
	var uploads, songs, polls, downloads atomic.Int32
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasPrefix(path, "/v1/") && r.Header.Get("Authorization") != "Bearer music-test-key" {
			t.Error("missing provider authentication")
			http.Error(w, "unauthorized", 401)
			return
		}
		if strings.HasPrefix(path, "/v1/song/query/") {
			polls.Add(1)
			id := strings.TrimPrefix(path, "/v1/song/query/")
			_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "succeeded", "choices": []any{map[string]string{"url": server.URL + "/output.mp3?receipt=" + id}}})
			return
		}
		switch r.URL.Path {
		case "/v1/files/upload", "/v1/song/vocal-clone":
			if err := r.ParseMultipartForm(1 << 20); err != nil {
				t.Error(err)
				http.Error(w, "invalid", 400)
				return
			}
			file, _, err := r.FormFile("file")
			if err != nil {
				t.Error(err)
				http.Error(w, "invalid", 400)
				return
			}
			got, err := io.ReadAll(file)
			file.Close()
			if err != nil || !bytes.Equal(got, mp3) {
				t.Error("provider did not receive the owned original")
				http.Error(w, "invalid", 400)
				return
			}
			uploads.Add(1)
			purpose := r.FormValue("purpose")
			if path == "/v1/song/vocal-clone" {
				_ = json.NewEncoder(w).Encode(map[string]string{"vocal_id": "voice-handle"})
				return
			}
			if purpose != "audio" && purpose != "reference" && purpose != "remix" {
				t.Error("unsupported upload purpose", purpose)
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"id": purpose + "-handle"})
		case "/v1/song/generate", "/v1/song/remix", "/v1/song/region-edit":
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Error(err)
				http.Error(w, "invalid", 400)
				return
			}
			op := strings.TrimPrefix(stringValue(body["lyrics"]), "lyrics-")
			if _, leaked := body["title"]; leaked {
				t.Error("local asset title leaked upstream")
			}
			valid := false
			switch op {
			case "persona":
				valid = path == "/v1/song/generate" && body["vocal_id"] == "voice-handle" && body["prompt"] == "jazz"
			case "reference":
				valid = path == "/v1/song/generate" && body["reference_id"] == "reference-handle" && body["prompt"] == nil
			case "remix":
				valid = path == "/v1/song/remix" && body["upload_audio_id"] == "remix-handle" && body["prompt"] == "jazz"
			case "region":
				valid = path == "/v1/song/region-edit" && body["upload_audio_id"] == "audio-handle" && body["edit_start"] == 1234.0 && body["edit_end"] == 7011.0
			}
			if op != "region" {
				valid = valid && body["model"] == "mureka-9.5" && body["n"] == 1.0
			}
			if !valid {
				t.Errorf("bad %s contract: %s %+v", op, path, body)
				http.Error(w, "invalid", 400)
				return
			}
			songs.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]string{"id": "async-" + op, "status": "queued"})
		case "/output.mp3":
			if r.Header.Get("Authorization") != "" {
				t.Error("channel credentials leaked to result download")
			}
			downloads.Add(1)
			w.Header().Set("Content-Type", "audio/mpeg")
			if r.URL.Query().Get("receipt") == "async-region" {
				_, _ = w.Write(repaint)
			} else {
				_, _ = w.Write(mp3[:834])
			}
		case "/v1/song/stem":
			var body struct{ URL, Model string }
			if r.Method != http.MethodPost || r.Header.Get("Authorization") != "Bearer music-test-key" || json.NewDecoder(r.Body).Decode(&body) != nil || body.Model != "audio-separation-1" || !strings.HasSuffix(body.URL, base64.StdEncoding.EncodeToString(mp3)) {
				t.Errorf("incorrect authenticated stem request")
				http.Error(w, "invalid", 400)
				return
			}
			submits.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"zip_url": server.URL + "/generated-stems.zip"})
		case "/generated-stems.zip":
			if r.Header.Get("Authorization") != "" {
				t.Error("download leaked provider key")
			}
			w.Header().Set("Content-Type", "application/zip")
			_, _ = io.Copy(w, bytes.NewReader(archive.Bytes()))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	oldOrigin := murekaAPIOrigin
	murekaAPIOrigin = server.URL
	t.Cleanup(func() { murekaAPIOrigin = oldOrigin })
	ch := model.ModelChannel{ID: "tools-channel", Name: "Tools", Scope: model.ChannelScopeSystem, Enabled: true, APIKey: "music-test-key", BaseURL: server.URL, APIFormat: "openai"}
	cm := model.ChannelModel{ID: "stems-price-model", ChannelID: ch.ID, ModelKey: "separate-in-studio", ProviderModelKey: "mureka/stems", Capability: "audio", Protocol: "mureka-music-tools", Enabled: true, PriceConfigured: true, BillingMode: "fixed_request"}
	tier := model.ChannelModelPriceTier{ID: "stems-fixed", ChannelModelID: cm.ID, SelectorKey: "{}", SelectorJSON: "{}", BillingMode: "fixed_request", PriceConfigured: true, Enabled: true, UnitPriceMicrocredits: 120}
	account := model.CreditAccount{UserID: userID, AvailableMicrocredits: 1000}
	for _, item := range []any{&model.PluginPlatformState{PluginID: PluginSupDanceMusicGeneration, Available: true}, &ch, &cm, &tier, &account} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}
	source, _, err := s.storeResource(userID, "audio", "source.mp3", "audio/mpeg", int64(len(mp3)), 0, 0, 32000, bytes.NewReader(mp3), nil, true)
	if err != nil {
		t.Fatal(err)
	}
	id := ch.ID + "::" + cm.ModelKey
	access, err := s.userGroupAccess(userID)
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := s.ModelCatalog(access, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, public := range catalog.Channels {
		for _, item := range public.Models {
			if item.Protocol == "mureka-music-tools" {
				t.Fatal("tool advertised as a general-purpose generation model")
			}
		}
	}
	if configured, err := s.SystemChannelModel(ch.ID, cm.ModelKey); err != nil || configured.ID != cm.ID {
		t.Fatalf("tool disappeared from channel configuration: %v", err)
	}
	if _, err := s.QuoteMusicTask(userID, id); err == nil {
		t.Fatal("plain creation claimed the stem SKU")
	}
	if _, err := s.QuoteMusicOperation(userID, id, "region"); err == nil {
		t.Fatal("incorrect operation quote")
	}
	price, err := s.QuoteMusicOperation(userID, id, "stems")
	if err != nil || price.AmountMicrocredits != 120 {
		t.Fatalf("dedicated quote: %+v %v", price, err)
	}
	req := music.MusicGenerationRequest{Model: id, Mode: "custom", Operation: "stems", Title: "Midnight Song", SourceResourceID: source.ID, IdempotencyNonce: "one-stem-request", QuotedMicrocredits: &price.AmountMicrocredits}
	if err := s.verifyMusicSourceAudio(context.Background(), music.MusicGenerationRequest{Operation: "region", EditEndMs: 35_000}, source); err == nil {
		t.Fatal("edit past the real media duration accepted")
	}
	foreign := req
	foreign.SourceResourceID = "foreign"
	if _, err := s.SubmitMusicTask(context.Background(), userID, foreign); err == nil {
		t.Fatal("unknown source accepted")
	}
	wrongPrice := req
	var stale int64 = 90
	wrongPrice.QuotedMicrocredits = &stale
	if _, err := s.SubmitMusicTask(context.Background(), userID, wrongPrice); err == nil {
		t.Fatal("stale quote accepted")
	}
	attempt := CreateTaskRequest{Type: "canvas_audio", Operation: "audio", Model: cm.ModelKey, Prompt: "stems", Input: map[string]any{"mode": "audio", "config": map[string]any{"channelId": ch.ID, "model": cm.ModelKey}, "metadata": map[string]any{"source": "music-workbench", "music": map[string]any{"operation": "stems", "sourceResourceId": source.ID}}}}
	if _, err := s.CreateTask(userID, attempt); err == nil {
		t.Fatal("generic route bypassed dedicated admission")
	}
	var count int64
	if err := db.Model(&model.BillingOrder{}).Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("invalid requests reserved credit: %d %v", count, err)
	}
	receipt, err := s.SubmitMusicTask(context.Background(), userID, req)
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.SubmitMusicTask(context.Background(), userID, req)
	if err != nil || again.TaskID != receipt.TaskID {
		t.Fatalf("retry: %+v %v", again, err)
	}
	if err := s.ProcessNextTask(); err != nil {
		t.Fatal(err)
	}
	task, err := s.repo.Task(receipt.TaskID)
	if err != nil || task.Status != model.TaskStatusSucceeded || task.MediaStage != "completed" || submits.Load() != 1 {
		t.Fatalf("worker did not archive stems: %+v %v", task, err)
	}
	if !strings.Contains(task.ResultJSON, "vocals") || !strings.Contains(task.ResultJSON, "instrumental") {
		t.Fatal("named stems not persisted", task.ResultJSON)
	}
	var assets []model.Asset
	if err := db.Find(&assets, "user_id = ?", userID).Error; err != nil || len(assets) != 2 {
		t.Fatalf("individual assets=%d %v", len(assets), err)
	}
	for _, stem := range []string{"vocals", "instrumental"} {
		found := false
		for _, asset := range assets {
			if strings.Contains(strings.ToLower(asset.Title), stem) && strings.Contains(asset.Title, req.Title) {
				found = true
			}
		}
		if !found {
			t.Fatalf("missing titled asset for %s: %+v", stem, assets)
		}
	}
	if err := db.Model(&model.BillingOrder{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("duplicate bill: %d %v", count, err)
	}
	if err := db.First(&account, "user_id = ?", userID).Error; err != nil || account.AvailableMicrocredits != 880 || account.ReservedMicrocredits != 0 {
		t.Fatalf("settlement: %+v %v", account, err)
	}
	for i, op := range []string{"reference", "persona", "remix", "region"} {
		t.Run(op, func(t *testing.T) {
			tool := model.ChannelModel{ID: "model-" + op, ChannelID: ch.ID, ModelKey: "tool-" + op, ProviderModelKey: "mureka/" + op, Capability: "audio", Protocol: "mureka-music-tools", Enabled: true, PriceConfigured: true, BillingMode: "fixed_request"}
			fee := int64(21 + i)
			priceTier := model.ChannelModelPriceTier{ID: "price-" + op, ChannelModelID: tool.ID, SelectorKey: "{}", SelectorJSON: "{}", BillingMode: "fixed_request", Enabled: true, PriceConfigured: true, UnitPriceMicrocredits: fee}
			if err := db.Create(&tool).Error; err != nil {
				t.Fatal(err)
			}
			if err := db.Create(&priceTier).Error; err != nil {
				t.Fatal(err)
			}
			id := ch.ID + "::" + tool.ModelKey
			quote, err := s.QuoteMusicOperation(userID, id, op)
			if err != nil || quote.AmountMicrocredits != fee {
				t.Fatalf("wrong %s price: %+v %v", op, quote, err)
			}
			request := music.MusicGenerationRequest{Model: id, Operation: op, SourceResourceID: source.ID, Mode: "custom", Lyrics: "lyrics-" + op, Title: "My song · " + op, IdempotencyNonce: "request-" + op, QuotedMicrocredits: &fee}
			if op == "remix" || op == "persona" {
				request.Prompt = "jazz"
			}
			if op == "region" {
				request.EditStartMs, request.EditEndMs = 1234, 7011
				// The upload claims 32 seconds, but its bytes contain only two frames.
				short, _, err := s.storeResource(userID, "audio", "wrong-duration.mp3", "audio/mpeg", 834, 0, 0, 32000, bytes.NewReader(mp3[:834]), nil, true)
				if err != nil {
					t.Fatal(err)
				}
				bad := request
				bad.SourceResourceID = short.ID
				if _, err = s.SubmitMusicTask(context.Background(), userID, bad); err == nil {
					t.Fatal("spoofed source duration passed admission")
				}
			}
			first, err := s.SubmitMusicTask(context.Background(), userID, request)
			if err != nil {
				t.Fatal(err)
			}
			if err = s.ProcessNextTask(); err != nil {
				t.Fatal(err)
			}
			task, err := s.repo.Task(first.TaskID)
			if err != nil || task.ProviderRequestID != "async-"+op || task.Status == model.TaskStatusFailed {
				t.Fatalf("missing detached receipt %s %v", task.Error, err)
			}
			retry, err := s.SubmitMusicTask(context.Background(), userID, request)
			if err != nil || retry.TaskID != first.TaskID {
				t.Fatalf("retry submitted twice: %+v %v", retry, err)
			}
			if err := db.Model(&model.Task{}).Where("id = ?", task.ID).Update("next_poll_at", time.Now().Add(-time.Second)).Error; err != nil {
				t.Fatal(err)
			}
			if err = s.ProcessNextTask(); err != nil {
				t.Fatal(err)
			}
			task, err = s.repo.Task(first.TaskID)
			if err != nil || task.Status != model.TaskStatusSucceeded || task.MediaStage != "completed" || strings.Contains(task.ResultJSON, source.ID) {
				t.Fatalf("failed to archive derivative: %+v %v", task, err)
			}
			var result model.Asset
			if err := db.First(&result, "user_id = ? AND title = ?", userID, request.Title).Error; err != nil {
				t.Fatalf("missing derivative asset: %v", err)
			}
			if op == "region" {
				verifyArchivedRegion(t, s, result, mp3, repaint)
			}
			if err := db.Model(&model.BillingOrder{}).Where("task_id = ? AND amount_microcredits = ?", task.ID, fee).Count(&count).Error; err != nil || count != 1 {
				t.Fatalf("incorrect bill for %s: %d %v", op, count, err)
			}
		})
	}
	if uploads.Load() != 4 || songs.Load() != 4 || polls.Load() != 4 || downloads.Load() != 4 {
		t.Fatalf("unexpected calls: uploads=%d songs=%d polls=%d downloads=%d", uploads.Load(), songs.Load(), polls.Load(), downloads.Load())
	}
	if err := db.First(&account, "user_id = ?", userID).Error; err != nil || account.AvailableMicrocredits != 790 || account.ReservedMicrocredits != 0 {
		t.Fatalf("final settlement: %+v %v", account, err)
	}
	_, original, err := s.OpenResource(userID, source.ID)
	if err != nil {
		t.Fatal(err)
	}
	defer original.Close()
	before, err := io.ReadAll(original)
	if err != nil || !bytes.Equal(before, mp3) {
		t.Fatal("source modified", err)
	}
}

func verifyArchivedRegion(t *testing.T, s *Service, asset model.Asset, original, providerMP3 []byte) {
	t.Helper()
	var payload struct {
		Data struct{ StorageKey, MimeType string }
	}
	if err := json.Unmarshal([]byte(asset.PayloadJSON), &payload); err != nil || payload.Data.MimeType != "audio/wav" {
		t.Fatalf("wrong archived MIME: %+v %v", payload, err)
	}
	resource, reader, err := s.OpenResource(asset.UserID, strings.TrimPrefix(payload.Data.StorageKey, "resource:"))
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	wav, err := io.ReadAll(reader)
	if err != nil || len(wav) < 44 || resource.MimeType != "audio/wav" || string(wav[:4]) != "RIFF" || binary.LittleEndian.Uint32(wav[24:]) != 48000 || binary.LittleEndian.Uint16(wav[22:]) != 2 || binary.LittleEndian.Uint16(wav[34:]) != 16 {
		t.Fatalf("invalid delivered stereo PCM WAV: %s (%d bytes), %v", resource.MimeType, len(wav), err)
	}
	decode := func(mp3 []byte) []byte {
		cmd := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "mp3", "-i", "pipe:0", "-af", "aresample=48000", "-ac", "2", "-f", "s16le", "pipe:1")
		cmd.Stdin = bytes.NewReader(mp3)
		pcm, err := cmd.Output()
		if err != nil {
			t.Fatal(err)
		}
		return pcm
	}
	orig, take, got := decode(original), decode(providerMP3), wav[44:]
	const start = 1234 * 48 * 4
	const end = 7011 * 48 * 4
	if len(got) != len(orig) || len(take) < end || len(got) < end || uint32(len(got)) != binary.LittleEndian.Uint32(wav[40:]) {
		t.Fatal("invalid duration or WAV length", len(got), len(orig), len(take))
	}
	if !bytes.Equal(got[:start], orig[:start]) || !bytes.Equal(got[end:], orig[end:]) {
		t.Fatal("samples outside the selected region changed")
	}
	if !bytes.Equal(got[start:end], take[start:end]) || bytes.Equal(got[start:end], orig[start:end]) {
		t.Fatal("selected samples do not match the regenerated performance")
	}
}
