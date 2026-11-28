package app

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"slices"
	"strings"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/music"
)

func hasMusicCoverSelection(task *model.Task) bool {
	return strings.Contains(task.InputJSON, `"musicCoverSelection":{`)
}

func (s *Service) validateMusicCoverSelection(userID, operation string, musicPrice int64, cover music.CoverSelection) error {
	if operation != "" || cover.QuotedMicrocredits == nil || *cover.QuotedMicrocredits < 0 {
		return BadAuthRequest("A current cover quote is required when creating a song with cover art.")
	}
	options, err := s.MusicCoverOptions(&model.User{ID: userID})
	if err != nil {
		return err
	}
	if !options.Enabled || !slices.ContainsFunc(options.Models, func(item music.CoverModel) bool {
		return item.ID == cover.Model && item.QuoteMicrocredits == *cover.QuotedMicrocredits
	}) {
		failure := NewAppError(409, "The cover quote changed. Reload the price before generating.")
		failure.Reason = "music_cover_quote_changed"
		return failure
	}
	if *cover.QuotedMicrocredits > 0 {
		account, err := s.repo.CreditAccount(userID)
		if err != nil {
			return err
		}
		if account.AvailableMicrocredits < musicPrice || account.AvailableMicrocredits-musicPrice < *cover.QuotedMicrocredits {
			return NewAppError(402, "Insufficient credits for music and cover generation.")
		}
	}
	return nil
}

func (s *Service) dispatchRequestedMusicCover(task *model.Task) error {
	if task.Status != model.TaskStatusSucceeded || !hasMusicCoverSelection(task) {
		return nil
	}
	var input struct {
		Metadata struct {
			Source string               `json:"source"`
			Cover  music.CoverSelection `json:"musicCoverSelection"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal([]byte(task.InputJSON), &input); err != nil {
		return err
	}
	if input.Metadata.Source != "music-workbench" {
		return nil
	}
	cover, err := readMusicCoverState(task)
	if err != nil || !cover.AutomaticPending && (cover.ChildTaskID != "" || cover.StorageKey != "" || cover.AutomaticFailed) {
		return err
	}
	request := MusicCoverRequest{Model: input.Metadata.Cover.Model, QuotedMicrocredits: input.Metadata.Cover.QuotedMicrocredits, Nonce: "after-music"}
	_, issue := s.generateMusicCover(&model.User{ID: task.UserID}, task.ID, request, true)
	if issue != nil {
		var failure *AppError
		if !errors.As(issue, &failure) || failure.Status >= 500 {
			return issue
		}
		// Admission may have changed while audio was rendering. Record a
		// cover-only failure and keep the independently delivered audio.
	}
	latest, err := s.repo.TaskForUser(task.UserID, task.ID)
	if err != nil {
		return err
	}
	cover, err = readMusicCoverState(latest)
	if err != nil {
		return err
	}
	if !cover.AutomaticPending && (cover.ChildTaskID != "" || cover.StorageKey != "" || cover.AutomaticFailed) {
		return nil
	}
	if issue != nil {
		// A competing dispatch may have created the deterministic child.
		// Retry rather than overwrite an in-progress claim.
		if cover.ChildTaskID != "" {
			return issue
		}
		cover.AutomaticFailed = true
	}
	cover.AutomaticPending = false
	return s.writeMusicCover(latest, cover)
}

func (s *Service) startMusicCoverDispatchWorker() {
	s.runWorkerLoop(func(ctx context.Context) {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			// The persisted opt-in is also the recovery source after a process restart.
			tasks, err := s.repo.WithContext(ctx).MusicTasksAwaitingCover(20)
			if err != nil {
				if ctx.Err() == nil {
					slog.Warn("music cover dispatch lookup failed", "error", err)
				}
			}
			for i := range tasks {
				if ctx.Err() != nil || s.IsDraining() {
					return
				}
				if err := s.dispatchRequestedMusicCover(&tasks[i]); err != nil {
					_ = s.log(tasks[i].UserID, tasks[i].ID, "warn", "Music cover dispatch will retry", err.Error())
				}
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	})
}
