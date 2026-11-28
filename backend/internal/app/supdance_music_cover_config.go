package app

import (
	"encoding/json"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/music"
)

const defaultMusicCoverPrompt = "Square album cover for {title}. Visually interpret the mood and style: {prompt}. Lyrics: {lyrics}. No lettering or watermark."

func defaultMusicCoverConfig() music.CoverConfig {
	return music.CoverConfig{
		AllowedModels:  []string{},
		MaxUploadBytes: 10 << 20,
		MaxDimension:   4096,
		PromptTemplate: defaultMusicCoverPrompt,
	}
}

func (s *Service) musicCoverConfig() (music.CoverConfig, error) {
	config := defaultMusicCoverConfig()
	setting, err := s.repo.SystemSettingOptional(music.CoverConfigSettingKey)
	if err != nil || setting == nil {
		return config, err
	}
	err = json.Unmarshal([]byte(setting.ValueJSON), &config)
	return config, err
}

func (s *Service) musicCoverIntent(channelID, modelKey string) (ModelRequestIntent, error) {
	item, err := s.repo.ChannelModelByKey(channelID, modelKey)
	if err != nil {
		return ModelRequestIntent{}, err
	}
	profile, err := normalizedChannelModelCapability(item, s.protocolRegistry())
	if err != nil {
		return ModelRequestIntent{}, err
	}
	spec, err := CapabilitySpecFromModelCapabilityConfig(profile, item.Capability)
	if err != nil {
		return ModelRequestIntent{}, err
	}
	defaults := map[string]any{}
	applyChannelCapabilityDefaults(defaults, "image", profile)
	request := dramaImageRequestForSpec(spec, defaults, "1:1", "")
	ratio, _ := dramaRatioValue(request.Size)
	if request.Issue != "" || ratio != 1 {
		return ModelRequestIntent{}, InvalidModelSelection("Choose a cover model that supports square images.")
	}
	image := profile.Image
	if imageSizePixelOutbound(image, string(item.Protocol)) && strings.Contains(request.Size, ":") &&
		strings.Contains(resolveImageTaskSize(image, string(item.Protocol), request.Size, request.Resolution), ":") {
		// Some size fields accept both ratios and pixels without an active
		// resolution switch. Use the explicitly configured square size.
		preset, ok := declaredImageSizePreset(image.Size.Presets, request.Size, request.Resolution, imagePresetDefaultTier(image))
		if !ok || !matchOptionConstraint("size", spec.Options["size"], preset.Size) {
			return ModelRequestIntent{}, InvalidModelSelection("The cover model has no square pixel size.")
		}
		request.Size = preset.Size
	}
	intent := ModelRequestIntent{Capability: "image", Operation: "text_to_image", Options: map[string]any{"count": 1}}
	request.apply(intent.Options)
	return intent, nil
}

func (s *Service) musicCoverModels(userID string, allowed []string) ([]music.CoverModel, error) {
	access, err := s.userGroupAccess(userID)
	if err != nil {
		return nil, err
	}
	discovery := ModelRequestIntent{Capability: "image", Operation: "text_to_image"}
	channels, err := s.systemChannelCatalog(access, &discovery, false)
	if err != nil {
		return nil, err
	}
	models := []music.CoverModel{}
	for _, channel := range channels {
		for _, item := range channel.Models {
			id := channel.ID + "::" + item.ModelKey
			if item.Capability != "image" || !item.Available || allowed != nil && !slices.Contains(allowed, id) {
				continue
			}
			intent, err := s.musicCoverIntent(channel.ID, item.ModelKey)
			if err != nil {
				continue
			}
			quote, err := s.quoteChannelModel(userID, ChannelModelQuoteRequest{ChannelID: channel.ID, ModelKey: item.ModelKey, Intent: intent}, true)
			if err != nil {
				continue
			}
			models = append(models, music.CoverModel{ID: id, Name: firstNonEmpty(item.DisplayName, item.ModelKey), Channel: channel.DisplayName, QuoteMicrocredits: quote.AmountMicrocredits, Estimated: quote.Estimated})
		}
	}
	return models, nil
}

func (s *Service) MusicCoverOptions(actor *model.User) (*music.CoverOptions, error) {
	if actor == nil {
		return nil, Unauthorized("Login is required.")
	}
	if err := s.CheckMusicTaskAdmission(actor.ID); err != nil {
		return nil, err
	}
	config, err := s.musicCoverConfig()
	if err != nil {
		return nil, err
	}
	options := &music.CoverOptions{AllowUpload: config.AllowUpload, MaxUploadBytes: config.MaxUploadBytes, MaxDimension: config.MaxDimension, Models: []music.CoverModel{}}
	if config.Enabled {
		options.Models, err = s.musicCoverModels(actor.ID, config.AllowedModels)
		if err != nil {
			return nil, err
		}
		options.Enabled = len(options.Models) > 0
		if options.Enabled {
			options.DefaultModel = options.Models[0].ID
			for _, option := range options.Models {
				if option.ID == config.DefaultModel {
					options.DefaultModel = option.ID
					break
				}
			}
		}
	}
	return options, nil
}

func normalizeMusicCoverConfig(config music.CoverConfig, models []music.CoverModel) (music.CoverConfig, error) {
	config.PromptTemplate = strings.TrimSpace(config.PromptTemplate)
	if config.PromptTemplate == "" {
		config.PromptTemplate = defaultMusicCoverPrompt
	}
	if utf8.RuneCountInString(config.PromptTemplate) > 1000 || config.MaxUploadBytes < 1<<20 || config.MaxUploadBytes > 20<<20 || config.MaxDimension < 512 || config.MaxDimension > 4096 || len(config.AllowedModels) > 20 {
		return config, BadAuthRequest("Invalid music cover settings.")
	}
	if config.AllowedModels == nil {
		config.AllowedModels = []string{}
	}
	seen := make(map[string]bool, len(config.AllowedModels))
	for _, id := range config.AllowedModels {
		if seen[id] || !slices.ContainsFunc(models, func(option music.CoverModel) bool { return option.ID == id }) {
			return config, InvalidModelSelection("Choose enabled text-to-image models from site channels.")
		}
		seen[id] = true
	}
	if config.DefaultModel != "" && !seen[config.DefaultModel] || config.Enabled && config.DefaultModel == "" {
		return config, BadAuthRequest("Select a default model from the allowed cover models.")
	}
	return config, nil
}

func (s *Service) saveMusicCoverConfig(actor *model.User, requested music.CoverConfig) error {
	if err := s.CheckMusicTaskAdmission(actor.ID); err != nil {
		return err
	}
	models, err := s.musicCoverModels(actor.ID, nil)
	if err != nil {
		return err
	}
	config, err := normalizeMusicCoverConfig(requested, models)
	if err != nil {
		return err
	}
	raw, err := json.Marshal(config)
	if err != nil {
		return err
	}
	event, err := newAdminAuditEvent(actor, "music.cover.config.update", "plugin", PluginSupDanceMusicGeneration, "更新音乐封面配置", map[string]any{"generationEnabled": config.Enabled, "allowUpload": config.AllowUpload, "defaultModel": config.DefaultModel, "allowedModels": config.AllowedModels})
	if err != nil {
		return err
	}
	return s.repo.Transaction(func(repo *repository.Repository) error {
		if err := repo.SaveSystemSetting(&model.SystemSetting{Key: music.CoverConfigSettingKey, ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()}); err != nil {
			return err
		}
		return repo.AppendAdminAudit(event)
	})
}
