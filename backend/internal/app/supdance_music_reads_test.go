package app

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/protocol"
	"yingce/backend/internal/supdance/music"
)

func TestMusicPartialArchiveIsPrivateAndKeepsPendingStatus(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	task := seedMediaTask(t, db, providerConfig{})
	task.Type = "canvas_audio"
	if err := db.Save(task).Error; err != nil {
		t.Fatal(err)
	}
	resource := model.Resource{ID: "saved-audio", UserID: task.UserID, Kind: "audio", Status: model.ResourceStatusReady, MimeType: "audio/mpeg", Size: 12345, DurationMs: 42000}
	if err := db.Create(&resource).Error; err != nil {
		t.Fatal(err)
	}
	checkpoint := &mediaCheckpoint{Mode: "audio", StartedAt: time.Now(), Items: []mediaCheckpointItem{
		{ResourceID: resource.ID, Reference: protocol.MediaReference{URL: "https://media.example.com/private.mp3?token=do-not-expose"}},
		{Reference: protocol.MediaReference{URL: "https://media.example.com/pending.mp3"}},
	}}
	if err := s.saveMediaCheckpoint(task, checkpoint, "download"); err != nil {
		t.Fatal(err)
	}
	view, err := s.MusicTaskView(context.Background(), &model.User{ID: task.UserID, Role: model.UserRoleUser}, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	projected := view.(*MusicHostTask)
	raw, _ := json.Marshal(projected)
	if !projected.PartiallySaved || projected.Status != model.TaskStatusRunning || !strings.Contains(projected.ResultJSON, "resource:saved-audio") || strings.Contains(string(raw), "media.example.com") || strings.Contains(string(raw), "do-not-expose") {
		t.Fatalf("unsafe partial view: %s", raw)
	}
	if _, err := s.MusicTaskView(context.Background(), &model.User{ID: "other-user", Role: model.UserRoleUser}, task.ID); err == nil {
		t.Fatal("another user read partial media")
	}
}

func TestMusicMixedHistoryPaginatesBeforeProjection(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	if err := db.AutoMigrate(&music.SupDanceMusicGeneration{}); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	for index, id := range []string{"host-new", "host-old"} {
		task := model.Task{ID: id, UserID: "history-user", Type: "canvas_audio", Status: model.TaskStatusSucceeded, InputJSON: `{"metadata":{"source":"music-workbench"}}`, CreatedAt: now.Add(-time.Duration(index*2) * time.Hour)}
		if err := db.Create(&task).Error; err != nil {
			t.Fatal(err)
		}
	}
	for index, id := range []string{"legacy-middle", "legacy-last"} {
		legacy := music.SupDanceMusicGeneration{ID: id, TaskID: id, UserID: "history-user", Status: music.StatusCompleted, CreatedAt: now.Add(-time.Duration(index*2+1) * time.Hour)}
		if err := db.Create(&legacy).Error; err != nil {
			t.Fatal(err)
		}
	}
	actor := &model.User{ID: "history-user", Role: model.UserRoleUser}
	for offset, expected := range []string{"host-new", "legacy-middle", "host-old", "legacy-last"} {
		page, err := s.MusicTaskPage(context.Background(), actor, "", offset, 1, false)
		if err != nil {
			t.Fatal(err)
		}
		actual := ""
		if len(page.Items) == 1 {
			actual = page.Items[0].ID
		}
		if len(page.LegacyItems) == 1 {
			actual = page.LegacyItems[0].ID
		}
		if page.Total != 4 || actual != expected {
			t.Fatalf("offset %d: total=%d id=%q want %q", offset, page.Total, actual, expected)
		}
	}
	actor.ID = "other-user"
	page, err := s.MusicTaskPage(context.Background(), actor, "", 0, 20, false)
	if err != nil || page.Total != 0 {
		t.Fatalf("history crossed user scope: %+v %v", page, err)
	}
}
