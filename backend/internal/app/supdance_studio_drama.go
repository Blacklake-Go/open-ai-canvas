package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/production"
	"yingce/backend/internal/repository"
)

type StudioShot struct {
	ID           string   `json:"id"`
	Revision     string   `json:"revision"`
	Sequence     int      `json:"sequence"`
	EpisodeID    string   `json:"episodeId"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Duration     float64  `json:"duration"`
	ImagePrompt  string   `json:"imagePrompt"`
	VideoPrompt  string   `json:"videoPrompt"`
	CharacterIDs []string `json:"characterIds"`
	SceneIDs     []string `json:"sceneIds"`
}

type studioCast struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type StudioDrama struct {
	SupdanceOpenAIProject
	Script         string       `json:"script"`
	ScriptEditable bool         `json:"scriptEditable"`
	Revision       string       `json:"revision"`
	Shots          []StudioShot `json:"shots"`
	Characters     []studioCast `json:"characters"`
	Scenes         []studioCast `json:"scenes"`
}

func (s *Service) StudioDrama(userID, projectID string) (StudioDrama, error) {
	if err := s.RequireFeature(FeatureShortDrama); err != nil {
		return StudioDrama{}, err
	}
	project, state, err := s.dramaForUser(userID, projectID)
	if err != nil {
		return StudioDrama{}, err
	}
	result := StudioDrama{SupdanceOpenAIProject: supdanceOpenAIProject(*project), Revision: strconv.FormatInt(state.Revision, 10),
		Shots: []StudioShot{}, Characters: []studioCast{}, Scenes: []studioCast{}}
	if state.Status == model.DramaStatusDraft && state.DraftJSON != "" && project.SourceType == production.SourceScript {
		draft, err := s.DramaDraft(userID, projectID)
		if err != nil {
			return StudioDrama{}, err
		}
		if draft.ChapterCount == 1 && len(draft.Form.SourceText) <= 20000 {
			result.Script, result.ScriptEditable = draft.Form.SourceText, true
		}
	}
	casts, err := s.repo.DramaCasts(projectID)
	if err != nil {
		return StudioDrama{}, err
	}
	for _, cast := range casts {
		if cast.Kind == "character" && cast.ParentID == "" && len(result.Characters) < 200 {
			result.Characters = append(result.Characters, studioCast{cast.ID, cast.Name})
		} else if cast.Kind == "scene" && len(result.Scenes) < 200 {
			result.Scenes = append(result.Scenes, studioCast{cast.ID, cast.Name})
		}
	}
	episodes, err := s.repo.DramaEpisodes(projectID)
	if err != nil {
		return StudioDrama{}, err
	}
	for _, episode := range episodes[:min(12, len(episodes))] {
		shots, err := s.repo.DramaShots(episode.ID)
		if err != nil {
			return StudioDrama{}, err
		}
		for _, shot := range shots[:min(200-len(result.Shots), len(shots))] {
			result.Shots = append(result.Shots, studioShotView(shot))
		}
		if len(result.Shots) == 200 {
			break
		}
	}
	if len(result.Shots) > 0 {
		result.ScriptEditable = false
	}
	return result, nil
}

func studioShotView(shot model.DramaShot) StudioShot {
	scenes := []string{}
	if shot.SceneCastID != "" {
		scenes = append(scenes, shot.SceneCastID)
	}
	return StudioShot{ID: shot.ID, Revision: shot.UpdatedAt.UTC().Format(time.RFC3339Nano), Sequence: shot.Position + 1,
		EpisodeID: shot.EpisodeID, Title: truncateRunes(firstNonEmpty(shot.Scene, shot.SegmentTitle, "Shot "+strconv.Itoa(max(shot.Position, 1))), 160),
		Description: truncateRunes(shot.Action, 1000), Duration: float64(shot.DurationMs) / 1000, ImagePrompt: truncateRunes(shot.ImagePrompt, 2000),
		VideoPrompt: truncateRunes(shot.VideoPrompt, 2000), CharacterIDs: append([]string{}, decodeStringList(shot.CastIDsJSON)...), SceneIDs: scenes}
}

func (s *Service) StudioCreateDrama(userID, key, title, script string) (SupdanceOpenAIProject, error) {
	if err := s.RequireFeature(FeatureShortDrama); err != nil {
		return SupdanceOpenAIProject{}, err
	}
	if !supdanceOpenAIID.MatchString(key) {
		return SupdanceOpenAIProject{}, BadAuthRequest("Invalid request ID")
	}
	id := uuid.NewSHA1(uuid.NameSpaceOID, []byte("supdance-studio-project\x00"+userID+"\x00"+key)).String()
	find := func() (*model.Project, error) { return s.repo.ProjectForUser(userID, id) }
	if project, err := find(); err == nil {
		return supdanceOpenAIProject(*project), nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return SupdanceOpenAIProject{}, err
	}
	creation, err := s.prepareDramaCreation(userID, id, CreateDramaRequest{Name: title, SourceFormat: production.SourceScript,
		Chapters: []DramaChapterInput{{Text: script}}, Draft: &DramaDraftForm{SourceText: script}})
	if err != nil {
		return SupdanceOpenAIProject{}, err
	}
	if err := s.repo.CreateDramaProject(&creation.project, creation.chapters, &creation.production, creation.episodes...); err != nil {
		if project, lookupErr := find(); lookupErr == nil {
			return supdanceOpenAIProject(*project), nil
		}
		if errors.Is(err, repository.ErrProjectNameConflict) {
			return SupdanceOpenAIProject{}, dramaNameConflict()
		}
		return SupdanceOpenAIProject{}, err
	}
	return supdanceOpenAIProject(creation.project), nil
}

func (s *Service) StudioSaveScript(userID, projectID, revision, script string) (StudioDrama, error) {
	view, err := s.StudioDrama(userID, projectID)
	if err != nil {
		return StudioDrama{}, err
	}
	if view.Revision != revision || !view.ScriptEditable {
		return StudioDrama{}, studioError(http.StatusConflict, "studio_revision_conflict")
	}
	if strings.TrimSpace(script) == view.Script {
		return view, nil
	}
	draft, err := s.DramaDraft(userID, projectID)
	if err != nil {
		return StudioDrama{}, err
	}
	form := draft.Form
	form.SourceText = script
	expected, _ := strconv.ParseInt(revision, 10, 64)
	_, err = s.SaveDramaDraft(userID, projectID, CreateDramaRequest{Name: draft.Name, SourceFormat: draft.SourceFormat,
		Settings: draft.Settings, BudgetMicrocredits: draft.BudgetMicrocredits, SelectedChapters: draft.SelectedChapters,
		Chapters: []DramaChapterInput{{Text: script}}, Draft: &form, expectedStudioRevision: &expected})
	if err != nil {
		return StudioDrama{}, err
	}
	return s.StudioDrama(userID, projectID)
}

func (s *Service) StudioApplyStoryboard(userID, projectID, revision string, input []SupdanceOpenAIShot) (StudioDrama, error) {
	view, err := s.StudioDrama(userID, projectID)
	if err != nil {
		return StudioDrama{}, err
	}
	if !view.ScriptEditable || view.Revision != revision || len(input) == 0 || len(input) > 24 {
		return StudioDrama{}, studioError(http.StatusConflict, "studio_revision_conflict")
	}
	_, state, err := s.dramaForUser(userID, projectID)
	if err != nil {
		return StudioDrama{}, err
	}
	episodes, err := s.repo.DramaEpisodes(projectID)
	if err != nil {
		return StudioDrama{}, err
	}
	if len(episodes) != 1 {
		return StudioDrama{}, studioError(http.StatusConflict, "studio_revision_conflict")
	}
	settings := parseDramaSettings(state.SettingsJSON)
	var profile dramaVideoProfile
	if !settings.Models.Video.Empty() {
		profile, err = s.dramaVideoProfile(settings.Models.Video)
		if err != nil {
			return StudioDrama{}, err
		}
	}
	now := time.Now()
	shots := make([]model.DramaShot, 0, len(input))
	var total int64
	for i, item := range input {
		duration := settings.Storyboard.ImportedShotMs(item.DurationSeconds, item.Dialogue)
		if limit := int64(profile.maxSeconds()) * 1000; limit > 0 {
			duration = min(limit, duration)
		}
		total += duration
		shots = append(shots, model.DramaShot{ID: newID(), ProjectID: projectID, EpisodeID: episodes[0].ID, Position: i,
			Scene: truncateRunes(item.Scene, 120), Action: truncateRunes(item.Action, 1000), Dialogue: truncateRunes(item.Dialogue, 500),
			ShotSize: truncateRunes(item.Framing, 30), Camera: truncateRunes(item.Camera, 60), ImagePrompt: truncateRunes(item.ImagePrompt, 2000),
			VideoPrompt: truncateRunes(item.VideoPrompt, 2000), DurationMs: duration, CastIDsJSON: "[]", PropIDsJSON: "[]", LookCastIDsJSON: "[]", CreatedAt: now, UpdatedAt: now})
	}
	assignDramaSegments(shots, settings.Storyboard.SegmentLimits(profile.Durations))
	fields := map[string]any{"shot_count": len(shots), "duration_ms": total, "stage": model.DramaEpisodePrompts, "approved": false}
	rev, _ := strconv.ParseInt(revision, 10, 64)
	if err := s.repo.ApplyStudioStoryboard(userID, projectID, rev, episodes[0], fields, shots); err != nil {
		if errors.Is(err, repository.ErrDramaSegmentChanged) {
			return StudioDrama{}, studioError(http.StatusConflict, "studio_revision_conflict")
		}
		return StudioDrama{}, err
	}
	return s.StudioDrama(userID, projectID)
}

type studioShotEdit struct {
	Revision   string
	Sequence   int
	Characters []string
	Scenes     []string
}

func (s *Service) StudioSaveShot(userID, projectID string, input StudioShot) (StudioDrama, error) {
	if err := s.RequireFeature(FeatureShortDrama); err != nil {
		return StudioDrama{}, err
	}
	_, err := s.UpdateDramaShot(userID, projectID, input.ID, UpdateDramaShotRequest{Action: &input.Description,
		ImagePrompt: &input.ImagePrompt, VideoPrompt: &input.VideoPrompt, DurationSeconds: &input.Duration,
		studioEdit: &studioShotEdit{Revision: input.Revision, Sequence: input.Sequence, Characters: input.CharacterIDs, Scenes: input.SceneIDs}})
	if errors.Is(err, repository.ErrDramaSegmentChanged) {
		return StudioDrama{}, studioError(http.StatusConflict, "studio_revision_conflict")
	}
	if err != nil {
		return StudioDrama{}, err
	}
	return s.StudioDrama(userID, projectID)
}

func (s *Service) applyStudioShotEdit(projectID string, shot *model.DramaShot, fields map[string]any, edit *studioShotEdit) error {
	if shot.UpdatedAt.UTC().Format(time.RFC3339Nano) != edit.Revision {
		return studioError(http.StatusConflict, "studio_revision_conflict")
	}
	if edit.Sequence-1 != shot.Position {
		if edit.Sequence < 1 {
			return BadAuthRequest("Invalid shot sequence")
		}
		fields["position"], shot.Position = edit.Sequence-1, edit.Sequence-1
	}
	if len(edit.Characters) > 32 || len(edit.Scenes) > 1 || len(edit.Characters) != len(uniqueNonEmpty(edit.Characters)) {
		return studioError(http.StatusBadRequest, "studio_invalid_reference")
	}
	for _, id := range append(append([]string{}, edit.Characters...), edit.Scenes...) {
		cast, err := s.repo.DramaCast(projectID, id)
		if err != nil || cast.ParentID != "" || cast.Kind != "character" && !slices.Contains(edit.Scenes, id) ||
			cast.Kind != "scene" && slices.Contains(edit.Scenes, id) {
			return studioError(http.StatusBadRequest, "studio_invalid_reference")
		}
	}
	if !slices.Equal(edit.Characters, decodeStringList(shot.CastIDsJSON)) {
		characters, _ := json.Marshal(edit.Characters)
		fields["cast_ids_json"], shot.CastIDsJSON = string(characters), string(characters)
		looks := []string{}
		for _, id := range decodeStringList(shot.LookCastIDsJSON) {
			cast, err := s.repo.DramaCast(projectID, id)
			if err == nil && slices.Contains(edit.Characters, cast.ParentID) {
				looks = append(looks, id)
			}
		}
		encoded, _ := json.Marshal(looks)
		fields["look_cast_ids_json"], shot.LookCastIDsJSON = string(encoded), string(encoded)
	}
	scene := ""
	if len(edit.Scenes) > 0 {
		scene = edit.Scenes[0]
	}
	if shot.SceneCastID != scene {
		fields["scene_cast_id"], shot.SceneCastID = scene, scene
	}
	return nil
}

func (s *Service) studioShotReferences(userID, projectID, shotID string, refs []string, metadata map[string]any) ([]string, error) {
	if err := s.RequireFeature(FeatureShortDrama); err != nil {
		return nil, err
	}
	if _, _, err := s.dramaForUser(userID, projectID); err != nil {
		return nil, err
	}
	shot, err := s.repo.DramaShot(projectID, shotID)
	if err != nil {
		return nil, dramaLookupError(err)
	}
	looks := map[string]string{}
	for _, id := range decodeStringList(shot.LookCastIDsJSON) {
		cast, err := s.repo.DramaCast(projectID, id)
		if err != nil {
			return nil, dramaLookupError(err)
		}
		looks[cast.ParentID] = id
	}
	ids := append(decodeStringList(shot.CastIDsJSON), shot.SceneCastID)
	for _, id := range uniqueNonEmpty(ids) {
		cast, err := s.repo.DramaCast(projectID, defaultString(looks[id], id))
		if err != nil || cast.ImageStatus != model.DramaMediaReady || cast.ImageResourceID == "" {
			return nil, studioError(http.StatusBadRequest, "studio_invalid_reference")
		}
		if !slices.Contains(refs, cast.ImageResourceID) {
			refs = append(refs, cast.ImageResourceID)
		}
	}
	metadata["studioDramaShotId"] = shot.ID
	metadata["studioDramaShotRevision"] = shot.UpdatedAt.UTC().Format(time.RFC3339Nano)
	return refs, nil
}
