package app

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"net/http"
	"path"
	"strings"

	_ "golang.org/x/image/webp"
	"gorm.io/gorm"
	"yingce/backend/internal/assets"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

type StudioAsset struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	CreatedAt int64  `json:"createdAt"`
}

const studioUploadLimit = 8 << 20

func studioAssetView(resource *model.Resource, name string) StudioAsset {
	base := defaultString(name, resource.Kind+"-"+resource.ID[:min(8, len(resource.ID))])
	base = strings.Map(func(r rune) rune {
		if r < 32 || r == '/' || r == '\\' || r == ':' || r == 127 {
			return '-'
		}
		return r
	}, base)
	extension := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif", "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg", "audio/flac": ".flac"}[resource.MimeType]
	if extension != "" && !strings.EqualFold(path.Ext(base), extension) {
		base += extension
	}
	return StudioAsset{ID: resource.ID, Kind: resource.Kind, Name: truncateRunes(base, 240), CreatedAt: resource.CreatedAt.UnixMilli()}
}

func studioAssetAvailable(resource *model.Resource) bool {
	return resource.Status == model.ResourceStatusReady && studioTaskKind(resource.Kind) && assets.InlineMediaType(resource.MimeType)
}

func (s *Service) StudioAssetRecord(userID, id string) (*model.Resource, error) {
	resource, err := s.repo.ResourceForUser(userID, id)
	if errors.Is(err, gorm.ErrRecordNotFound) || err == nil && !studioAssetAvailable(resource) {
		return nil, NotFound("Studio asset unavailable")
	}
	return resource, err
}

func (s *Service) StudioAsset(userID, id string) (StudioAsset, error) {
	resource, err := s.StudioAssetRecord(userID, id)
	if err != nil {
		return StudioAsset{}, err
	}
	name := ""
	if asset, err := s.repo.AssetForUser(userID, id); err == nil {
		name = asset.Title
	}
	return studioAssetView(resource, name), nil
}

func (s *Service) StudioAssets(userID string) ([]StudioAsset, error) {
	resources, err := s.repo.Resources(userID, 100)
	result := make([]StudioAsset, 0)
	for _, resource := range resources {
		if studioAssetAvailable(&resource) {
			result = append(result, studioAssetView(&resource, ""))
		}
		if len(result) == 60 {
			break
		}
	}
	return result, err
}

type StudioAssetPage struct {
	Assets   []StudioAsset `json:"assets"`
	NextPage int           `json:"nextPage,omitempty"`
}

func (s *Service) StudioAssetLibrary(userID, kind, query string, page int) (StudioAssetPage, error) {
	if (kind != "" && !studioTaskKind(kind)) || page < 1 || page > 10000 || len(query) > 160 {
		return StudioAssetPage{}, BadAuthRequest("Invalid asset filters")
	}
	const pageSize = 24
	items, total, err := s.repo.UserAssetsPage(userID, page, pageSize, repository.UserAssetPageFilter{
		Kind: kind, Kinds: []string{"image", "video", "audio"}, Status: "active", Query: query,
	})
	result := StudioAssetPage{Assets: []StudioAsset{}}
	if err != nil {
		return result, err
	}
	for _, item := range items {
		var payload struct{ Data any }
		if json.Unmarshal(clientAssetListPayload(item), &payload) != nil {
			continue
		}
		ids := []string{}
		studioResultResources(payload.Data, &ids)
		for _, id := range ids {
			resource, err := s.StudioAssetRecord(userID, id)
			if err == nil && resource.Kind == item.Kind {
				result.Assets = append(result.Assets, studioAssetView(resource, item.Title))
				break
			}
			if err != nil && !studioNotFound(err) {
				return result, err
			}
		}
	}
	if page < 10000 && int64(page*pageSize) < total {
		result.NextPage = page + 1
	}
	return result, nil
}

func (s *Service) StudioUpload(userID, mime, filename string, data []byte) (StudioAsset, error) {
	if len(data) == 0 || len(data) > studioUploadLimit {
		return StudioAsset{}, studioError(http.StatusBadRequest, "studio_asset_invalid")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width > 8192 || config.Height > 8192 || int64(config.Width)*int64(config.Height) > 24_000_000 ||
		mime != "image/"+format || (format != "jpeg" && format != "png" && format != "webp") {
		return StudioAsset{}, studioError(http.StatusBadRequest, "studio_asset_invalid")
	}
	name := path.Base(strings.ReplaceAll(filename, "\\", "/"))
	if name == "." || len(name) > 240 {
		name = "reference." + format
	}
	key := fmt.Sprintf("supdance-studio-%x", sha256.Sum256(data))
	resource, err := s.UploadResourceFile(userID, name, int64(len(data)), "image", config.Width, config.Height, 0, bytes.NewReader(data), key)
	if err != nil {
		return StudioAsset{}, err
	}
	if existing, err := s.repo.AssetForUser(userID, resource.ID); err == nil {
		return studioAssetView(resource, existing.Title), nil
	}
	assetView := studioAssetView(resource, name)
	asset, err := s.assetFromUploadedResource(userID, resource.ID, assetView.Name, "supdance-chatgpt-studio")
	if err != nil {
		return StudioAsset{}, err
	}
	if _, err := s.UpsertUserAsset(userID, []byte(asset.PayloadJSON)); err != nil {
		return StudioAsset{}, err
	}
	return assetView, nil
}
