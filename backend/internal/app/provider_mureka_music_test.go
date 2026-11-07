package app

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"yingce/backend/internal/model"
	"yingce/backend/internal/protocol"
)

func TestMurekaSongUploadWireContracts(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	s, db := newMediaRecoveryTestService(t)
	s = newService(s.repo, s.dataDir)
	if err := db.Create(&model.ModelChannel{ID: "music-direct", Name: "Mureka", Scope: model.ChannelScopeSystem, Enabled: true, ModelsJSON: "[]"}).Error; err != nil {
		t.Fatal(err)
	}
	ctx := context.WithValue(context.Background(), providerAnalyticsKey{}, providerAnalyticsContext{UserID: "artist", ChannelID: "music-direct", Service: s})
	for _, op := range []string{"reference", "persona", "remix", "region"} {
		t.Run(op, func(t *testing.T) {
			uploads := 0
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				uploads++
				if r.Method != "POST" || r.Header.Get("Authorization") != "Bearer test-key" {
					t.Errorf("wrong method or auth")
				}
				if err := r.ParseMultipartForm(1 << 18); err != nil {
					t.Error(err)
					w.WriteHeader(400)
					return
				}
				defer r.MultipartForm.RemoveAll()
				f, h, err := r.FormFile("file")
				if err != nil {
					t.Error(err)
					return
				}
				defer f.Close()
				blob, err := io.ReadAll(f)
				if err != nil || h.Filename != "source.mp3" || string(blob) != "ID3original" {
					t.Errorf("unexpected upload")
				}
				w.Header().Set("Content-Type", "application/json")
				if op == "persona" {
					if r.URL.Path != "/v1/song/vocal-clone" || r.FormValue("purpose") != "" {
						t.Error("wrong clone operation")
					}
					fmt.Fprint(w, `{"vocal_id":"voice-01"}`)
					return
				}
				want := map[string]string{"reference": "reference", "remix": "remix", "region": "audio"}[op]
				if r.URL.Path != "/v1/files/upload" || r.FormValue("purpose") != want {
					t.Error("wrong source upload purpose")
				}
				fmt.Fprint(w, `{"id":"file-01"}`)
			}))
			defer upstream.Close()
			config := providerConfig{BaseURL: upstream.URL, APIKey: "test-key", InterfaceType: "mureka-music-tools"}
			fields := map[string]any{"sourceResourceId": "my-clip", "lyrics": "My new verse", "style": "gentle folk", "editStartMs": 1000, "editEndMs": 4000}
			endpoint, body, err := murekaSongRequest(ctx, config, op, fields, []byte("ID3original"), "mp3")
			if err != nil {
				t.Fatal(err)
			}
			want := map[string]any{"lyrics": "My new verse", "model": "mureka-9.5", "n": 1}
			wantPath := "/v1/song/generate"
			switch op {
			case "reference":
				want["reference_id"] = "file-01"
			case "persona":
				want["vocal_id"], want["prompt"] = "voice-01", "gentle folk"
				_, _, err = murekaSongRequest(ctx, config, op, fields, []byte("ID3original"), "mp3")
				if err != nil {
					t.Fatal(err)
				}
			case "remix":
				wantPath = "/v1/song/remix"
				want["upload_audio_id"], want["prompt"] = "file-01", "gentle folk"
			case "region":
				wantPath = "/v1/song/region-edit"
				want = map[string]any{"upload_audio_id": "file-01", "lyrics": "My new verse", "edit_start": 1000, "edit_end": 4000}
			}
			if uploads != 1 || endpoint != wantPath || !reflect.DeepEqual(body, want) {
				t.Fatalf("uploads=%d endpoint=%q body=%v", uploads, endpoint, body)
			}
		})
	}
}

func TestMurekaReferenceWorkerResumesOriginalReceipt(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	s, db := newMediaRecoveryTestService(t)
	s = newService(s.repo, s.dataDir)
	uploads, creates, polls, downloads := 0, 0, 0, 0
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/files/upload":
			uploads++
			fmt.Fprint(w, `{"id":"file-1"}`)
		case "/v1/song/generate":
			creates++
			var b map[string]any
			if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b["reference_id"] != "file-1" || b["lyrics"] != "verse" || b["n"] != float64(1) {
				t.Errorf("actual generation body %v, %v", b, err)
			}
			fmt.Fprint(w, `{"id":"receipt-1","status":"queued"}`)
		case "/v1/song/query/receipt-1":
			polls++
			if polls == 1 {
				w.WriteHeader(503)
				fmt.Fprint(w, `{"error":"temporary"}`)
				return
			}
			fmt.Fprintf(w, `{"id":"receipt-1","status":"succeeded","choices":[{"url":%q}]}`, server.URL+"/music.mp3")
		case "/music.mp3":
			downloads++
			if r.Header.Get("Authorization") != "" {
				t.Error("output request carried upstream key")
			}
			w.Header().Set("Content-Type", "audio/mpeg")
			fmt.Fprint(w, "ID3sample")
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	old := murekaAPIOrigin
	murekaAPIOrigin = server.URL
	t.Cleanup(func() { murekaAPIOrigin = old })
	cfg := providerConfig{BaseURL: server.URL, APIKey: "test-key", InterfaceType: "mureka-music-tools", Model: "mureka/reference"}
	task := seedMediaTask(t, db, cfg)
	res, _, err := s.storeResource(task.UserID, "audio", "source.mp3", "audio/mpeg", 8, 0, 0, 32000, strings.NewReader("ID3music"), nil, true)
	if err != nil {
		t.Fatal(err)
	}
	input := canvasGenerationInput{Mode: "audio", Config: cfg, Metadata: map[string]any{"source": "music-workbench", "music": map[string]any{"operation": "reference", "sourceResourceId": res.ID, "lyrics": "verse"}}}
	raw, _ := json.Marshal(input)
	task.Type, task.InputJSON = "canvas_audio", string(raw)
	if err := db.Save(task).Error; err != nil {
		t.Fatal(err)
	}
	run := func(svc *Service, row model.Task) (map[string]interface{}, error) {
		ctx := withProviderAnalytics(context.WithValue(context.Background(), mediaExecutionTaskKey{}, row), svc, row)
		return runAudioTask(ctx, input)
	}
	_, err = run(s, *task)
	var pending providerStatePendingError
	if !errors.As(err, &pending) || !pending.Detached {
		t.Fatalf("create: %v", err)
	}
	saved, err := s.repo.Task(task.ID)
	if err != nil || saved.ProviderRequestID != "receipt-1" {
		t.Fatalf("missing saved receipt %v", err)
	}
	resumed := newService(s.repo, s.dataDir)
	_, err = run(resumed, *saved)
	if !errors.As(err, &pending) || !resumed.shouldDeferProviderTask(*saved, string(raw), err) {
		t.Fatalf("poll retry: %v", err)
	}
	result, err := run(resumed, *saved)
	if err != nil {
		t.Fatal(err)
	}
	audios, ok := result["audios"].([]interface{})
	if !ok || len(audios) != 1 {
		t.Fatalf("bad result %v", result)
	}
	track := audios[0].(map[string]interface{})
	if track["resourceId"] == "" || uploads != 1 || creates != 1 || polls != 2 || downloads != 1 {
		t.Fatalf("result=%v counts=%d/%d/%d/%d", track, uploads, creates, polls, downloads)
	}
	// Simulate takeover after a paid request left the process, but before its receipt was saved.
	if err := db.Model(task).Updates(map[string]any{"provider_request_id": "", "poll_stage": "mureka_dispatching"}).Error; err != nil {
		t.Fatal(err)
	}
	task.ProviderRequestID = ""
	if _, err = run(resumed, *task); err == nil || uploads != 1 || creates != 1 {
		t.Fatalf("unconfirmed dispatch replayed: %v", err)
	}
	var logs []model.ApiCallLog
	if err := db.Where("task_id = ?", task.ID).Find(&logs).Error; err != nil || len(logs) == 0 {
		t.Fatalf("no audit logs: %v", err)
	}
	for _, entry := range logs {
		if entry.RequestBody != "" || entry.ResponseBody != "" || strings.Contains(entry.Error, "test-key") {
			t.Fatal("private upstream payload persisted")
		}
	}
}

func TestMurekaControlNeverFollowsRedirectOrEchoesPrivateErrors(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	leaked := 0
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked++ }))
	defer destination.Close()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/redirect") {
			http.Redirect(w, r, destination.URL, http.StatusTemporaryRedirect)
			return
		}
		w.WriteHeader(400)
		fmt.Fprint(w, "secret-data-that-an-upstream-can-echo")
	}))
	defer upstream.Close()
	cfg := providerConfig{BaseURL: upstream.URL, APIKey: "private-token"}
	ctx := context.WithValue(context.Background(), murekaPrivateRequestKey{}, true)
	for _, path := range []string{"/v1/redirect", "/v1/error"} {
		var out map[string]any
		err := postJSON(ctx, cfg, path, map[string]any{"url": "data:audio/mp3;base64,example"}, &out)
		if err == nil || strings.Contains(err.Error(), "secret-data") || strings.Contains(err.Error(), "private-token") {
			t.Fatalf("unsafe control response: %v", err)
		}
	}
	if leaked != 0 {
		t.Fatal("authenticated request followed a redirect")
	}
}

func TestMurekaVocalScopeAndEncryptedPersistence(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	n := 0
	clone := func() (string, error) { n++; return fmt.Sprintf("voice-private-%d", n), nil }
	for _, tc := range []struct {
		user, channel, resource, key string
		want                         int
	}{
		{"u", "ch", "r", "k", 1}, {"u", "ch", "r", "k", 1}, {"v", "ch", "r", "k", 2}, {"u", "other", "r", "k", 3}, {"u", "ch", "s", "k", 4}, {"u", "ch", "r", "rotated", 5},
	} {
		id, err := s.murekaVocalID(context.Background(), tc.user, tc.channel, tc.resource, tc.key, clone)
		if err != nil || id != fmt.Sprintf("voice-private-%d", tc.want) {
			t.Fatalf("%s: %s %v", tc.user, id, err)
		}
	}
	var count int64
	if err := db.Table("system_settings").Where("key LIKE ? AND value_json LIKE ?", "mureka.voice.%", "%voice-private%").Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("unencrypted ID in store: %d, %v", count, err)
	}
}

func TestMurekaReceiptStatusAndArchiveValidation(t *testing.T) {
	for _, status := range []string{"preparing", "queued", "running", "streaming"} {
		_, err := finishMurekaSong(context.Background(), providerConfig{}, "t-1", murekaSongTask{ID: "t-1", Status: status})
		var pending providerStatePendingError
		if !errors.As(err, &pending) || pending.TaskID != "t-1" || !pending.Detached {
			t.Fatalf("bad receipt for %s: %v", status, err)
		}
	}
	_, err := finishMurekaSong(context.Background(), providerConfig{}, "t-1", murekaSongTask{ID: "t-1", Status: "failed", Failure: "Rejected"})
	var terminal providerTaskTerminalError
	if !errors.As(err, &terminal) || terminal.Status != protocol.StatusFailed {
		t.Fatal(err)
	}
	for _, names := range [][]string{{"vocals.wav", "instrumental.wav"}, {"../vocals.wav"}, {"bad.wav"}, {"v.wav", "V.WAV"}, {"a.wav", "b.wav", "c.wav", "d.wav", "e.wav", "f.wav"}} {
		var archive bytes.Buffer
		zw := zip.NewWriter(&archive)
		for _, name := range names {
			f, _ := zw.Create(name)
			data := "RIFFxxxxWAVE"
			if name == "bad.wav" {
				data = "not an audio file"
			}
			io.WriteString(f, data)
		}
		zw.Close()
		var labels []string
		err := readMurekaStems(archive.Bytes(), func(name string, _ []byte) error { labels = append(labels, name); return nil })
		if names[0] == "vocals.wav" {
			if err != nil || strings.Join(labels, ",") != "vocals,instrumental" {
				t.Fatalf("%v %v", labels, err)
			}
		} else if err == nil {
			t.Fatalf("accepted invalid archive %v", names)
		}
	}
	m := murekaSongTask{}
	if err = json.Unmarshal([]byte(`{"id":"t","status":"succeeded","choices":[{"url":"https://cdn.mureka.ai/song.mp3"}]}`), &m); err != nil || len(m.Choices) != 1 {
		t.Fatal("song choices not decoded")
	}
}
