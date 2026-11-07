package app

import (
	"context"
	"errors"
	"mime"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/music"
)

// These are separately configured upstream products. A price for ordinary
// music generation cannot authorize an upload, clone, remix, stem or edit.
func musicToolProfile(upstream string) (music.ModelCapabilities, string, bool) {
	op, ok := strings.CutPrefix(upstream, "mureka/")
	cap := music.ModelCapabilities{Modes: []string{"custom"}, Formats: []string{"mp3"}, OutputCount: 1, TitleSupported: true}
	if !ok {
		return cap, "", false
	}
	switch op {
	case "reference":
		cap.LyricsSupported, cap.MaxLyricsChars = true, 5000
	case "persona", "remix":
		cap.LyricsSupported, cap.MaxLyricsChars = true, 5000
		cap.StyleSupported, cap.MaxPromptChars = true, 1024
	case "region":
		cap.LyricsSupported, cap.MaxLyricsChars = true, 3000
		cap.Formats = []string{"wav"}
	case "stems":
		cap.Formats, cap.StemSeparation, cap.OutputCount = []string{"wav"}, true, 0
	default:
		return cap, "", false
	}
	cap.Operations = []string{op}
	return cap, "mureka-music-tools", true
}

func musicOperationMatches(cap music.ModelCapabilities, op string) bool {
	if len(cap.Operations) == 0 {
		return op == ""
	}
	return len(cap.Operations) == 1 && cap.Operations[0] == op
}

func hasDedicatedMusicToolPrice(cm *model.ChannelModel, op string) bool {
	sku := "mureka/" + op
	if firstNonEmpty(cm.ProviderModelKey, cm.ModelKey) != sku {
		return false
	}
	defaultPrice := false
	for _, tier := range cm.PriceTiers {
		if !tier.Enabled {
			continue
		}
		if !tier.PriceConfigured || tier.BillingMode != "fixed_request" || (tier.ProviderModelKey != "" && tier.ProviderModelKey != sku) {
			return false
		}
		if len(tier.Selector) == 0 {
			defaultPrice = true
		}
	}
	return defaultPrice
}

func validateMusicToolFields(req music.MusicGenerationRequest, cap music.ModelCapabilities) error {
	if req.SourceResourceID == "" || len(req.SourceResourceID) > 36 || strings.ContainsAny(req.SourceResourceID, "/:\\? \t\r\n") {
		return BadAuthRequest("Choose an audio file from your library.")
	}
	if utf8.RuneCountInString(req.Title) > 200 || req.SongLanguage != "" || req.Instrumental || req.DurationSeconds != 0 || req.VocalGender != "" || req.TempoBpm != 0 || req.KeySignature != "" || req.SynthIDWatermark != nil || len(req.Stems) != 0 || req.ContinuationClipID != "" || (req.Format != "" && req.Format != cap.Formats[0]) {
		return BadAuthRequest("Unsupported parameters for this music operation.")
	}
	if req.Prompt != "" && req.Tags != "" {
		return BadAuthRequest("Specify only one style prompt.")
	}
	style := firstNonEmpty(req.Prompt, req.Tags)
	if utf8.RuneCountInString(style) > cap.MaxPromptChars || utf8.RuneCountInString(req.Lyrics) > cap.MaxLyricsChars {
		return BadAuthRequest("Music input exceeds the selected operation's limit.")
	}
	if cap.LyricsSupported && strings.TrimSpace(req.Lyrics) == "" || req.Operation == "remix" && strings.TrimSpace(style) == "" {
		return BadAuthRequest("The selected music operation requires lyrics and, for remix, a style prompt.")
	}
	if req.Operation == "region" {
		if req.EditStartMs < 0 || req.EditEndMs <= req.EditStartMs || req.EditEndMs-req.EditStartMs < 3000 {
			return BadAuthRequest("Select a region at least three seconds long.")
		}
	} else if req.EditStartMs != 0 || req.EditEndMs != 0 {
		return BadAuthRequest("Only region editing accepts a time range.")
	}
	return nil
}

func (s *Service) musicToolSource(userID string, req music.MusicGenerationRequest) (*model.Resource, error) {
	resource, err := s.repo.ResourceForUser(userID, req.SourceResourceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, NotFound("Audio source not found.")
	}
	if err != nil {
		return nil, err
	}
	if resource.Status != model.ResourceStatusReady || resource.Kind != "audio" {
		return nil, BadAuthRequest("Choose a ready audio resource.")
	}
	mediaType, _, _ := mime.ParseMediaType(resource.MimeType)
	switch mediaType {
	case "audio/mp3", "audio/mpeg", "audio/mp4", "audio/m4a", "audio/x-m4a":
	default:
		return nil, BadAuthRequest("The source format must be MP3 or M4A.")
	}
	if resource.Size <= 0 || resource.Size > 10_000_000 {
		return nil, BadAuthRequest("The source audio must be no larger than 10 MB.")
	}
	if err := validateMusicToolDuration(req, resource.DurationMs); err != nil {
		return nil, err
	}
	return resource, nil
}

func validateMusicToolDuration(req music.MusicGenerationRequest, duration int64) error {
	if (req.Operation == "reference" && duration < 30_000) || (req.Operation == "persona" && duration < 15_000) ||
		(req.Operation == "remix" && (duration < 10_000 || duration > 480_000)) ||
		(req.Operation == "region" && req.EditEndMs > duration) {
		return BadAuthRequest("The source duration does not support this music operation or selected range.")
	}
	return nil
}

func (s *Service) verifyMusicSourceAudio(ctx context.Context, req music.MusicGenerationRequest, source *model.Resource) error {
	// Upload duration and MIME are user-supplied. For these billable operations
	// inspect the actual resource (bounded at admission), including a tail moov on M4A.
	demuxer := "mov"
	mediaType, _, _ := mime.ParseMediaType(source.MimeType)
	if mediaType == "audio/mpeg" || mediaType == "audio/mp3" {
		demuxer = "mp3"
	}
	probe, err := s.probeStoredMedia(ctx, source, source.Size, demuxer)
	if errors.Is(err, errMediaProbeUnavailable) {
		return err
	}
	if err != nil || !probe.hasAudio || probe.hasVideo {
		return BadAuthRequest("The file could not be verified as an audio-only MP3 or M4A.")
	}
	return validateMusicToolDuration(req, probe.DurationMs)
}
