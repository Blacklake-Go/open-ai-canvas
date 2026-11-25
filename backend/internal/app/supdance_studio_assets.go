package app

import (
	"bytes"
	"crypto/sha256"
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
	extension := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif", "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov"}[resource.MimeType]
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
