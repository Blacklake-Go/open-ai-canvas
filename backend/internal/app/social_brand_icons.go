package app

import (
	"mime/multipart"
	"strings"

	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/socialauth"
)

const socialBrandIconKind = "social-brand-icon"
const socialBrandIconPrefix = "/api/auth/social/brand-icons/"

func (s *Service) socialBrandIconReferences(ids []string) map[string][]AdminResourceReferenceView {
	result := make(map[string][]AdminResourceReferenceView)
	settings, err := s.socialAuthService().ReadSettings()
	for _, id := range ids {
		if err != nil {
			result[id] = []AdminResourceReferenceView{{Kind: "社交图标", ID: PluginSupDanceSocialAuth, Title: "社交配置无法读取"}}
			continue
		}
		for provider, cfg := range settings.Providers {
			if cfg.IconLightURL == socialBrandIconPrefix+id || cfg.IconDarkURL == socialBrandIconPrefix+id {
				result[id] = append(result[id], AdminResourceReferenceView{Kind: "社交图标", ID: provider, Title: "社交登录品牌图标"})
			}
		}
	}
	return result
}

func (s *Service) UploadSocialBrandIcon(actor *model.User, header *multipart.FileHeader) (string, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return "", err
	}
	mimeType, err := validateAppearanceUpload(AppearanceAssetLogo, header)
	if err != nil {
		return "", err
	}
	header.Header.Set("Content-Type", mimeType)
	resource, err := s.uploadLocalResource(actor.ID, header, socialBrandIconKind, 0, 0, 0)
	if err != nil {
		return "", err
	}
	return socialBrandIconPrefix + resource.ID, nil
}

func (s *Service) socialBrandIcon(id string) (*model.Resource, error) {
	resource, err := s.repo.Resource(id)
	if err != nil {
		return nil, NotFound("品牌图标不存在")
	}
	if resource.Kind != socialBrandIconKind {
		return nil, BadAuthRequest("不是专用品牌图标")
	}
	image := *resource
	image.Kind = "image"
	if err := validateAppearanceResourceType(AppearanceAssetLogo, &image); err != nil {
		return nil, err
	}
	return resource, nil
}

func (s *Service) validateSocialBrandIconSettings(actor *model.User, req socialauth.UpdateSettingsRequest) error {
	current, err := s.socialAuthService().ReadSettings()
	if err != nil {
		return err
	}
	for provider, input := range req.Providers {
		before := current.Providers[provider]
		for _, raw := range []string{input.IconLightURL, input.IconDarkURL} {
			value := strings.TrimSpace(raw)
			if value == "" {
				continue
			}
			if !strings.HasPrefix(value, socialBrandIconPrefix) {
				if value == before.IconLightURL || value == before.IconDarkURL {
					continue
				}
				return BadAuthRequest("请通过品牌图标专用入口上传")
			}
			resource, err := s.socialBrandIcon(strings.TrimPrefix(value, socialBrandIconPrefix))
			if err != nil {
				return err
			}
			if value != before.IconLightURL && value != before.IconDarkURL && resource.UserID != actor.ID {
				return Forbidden("只能选择当前管理员上传的品牌图标")
			}
		}
	}
	return nil
}

func (s *Service) PrepareSocialBrandIconDelivery(actor *model.User, id string, options ResourceAccessOptions, rangeHeader string) (*ResourceDelivery, error) {
	if actor != nil {
		if err := s.RequireAdmin(actor); err != nil {
			return nil, err
		}
	} else {
		settings, err := s.socialAuthService().ReadSettings()
		if err != nil {
			return nil, err
		}
		found := false
		for _, cfg := range settings.Providers {
			if cfg.IconLightURL == socialBrandIconPrefix+id || cfg.IconDarkURL == socialBrandIconPrefix+id {
				found = true
			}
		}
		if !found {
			return nil, NotFound("品牌图标未配置")
		}
	}
	resource, err := s.socialBrandIcon(id)
	if err != nil {
		return nil, err
	}
	return s.prepareResourceDelivery(resource.UserID, resource, options, rangeHeader)
}
