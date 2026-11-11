package app

import (
	"encoding/json"
	"strings"
	"yingce/backend/internal/assets"
	"yingce/backend/internal/model"
)

// Community metadata intentionally excludes storage keys, private URLs and provider secrets.
type FederationAsset struct {
	ID         string `json:"id"`
	MainUserID string `json:"mainUserId"`
	Title      string `json:"title"`
	Kind       string `json:"kind"`
	MimeType   string `json:"mimeType"`
}

func (s *Service) federationAsset(userID string, asset *model.Asset) (*FederationAsset, *model.Resource, error) {
	if asset == nil || asset.UserID != userID || asset.Status != "confirmed" || (asset.Kind != "image" && asset.Kind != "video" && asset.Kind != "audio") {
		return nil, nil, Forbidden("作品尚未归档或不可用")
	}
	var payload struct {
		Data struct {
			StorageKey string `json:"storageKey"`
		} `json:"data"`
	}
	if json.Unmarshal([]byte(asset.PayloadJSON), &payload) != nil || !strings.HasPrefix(payload.Data.StorageKey, "resource:") {
		return nil, nil, Forbidden("作品尚未归档")
	}
	resource, err := s.repo.ResourceForUser(userID, strings.TrimPrefix(payload.Data.StorageKey, "resource:"))
	if err != nil {
		return nil, nil, err
	}
	if resource.Status != model.ResourceStatusReady || !assets.InlineMediaType(resource.MimeType) || resource.Kind != asset.Kind {
		return nil, nil, Forbidden("作品媒体不可用")
	}
	return &FederationAsset{ID: asset.ID, MainUserID: userID, Title: asset.Title, Kind: asset.Kind, MimeType: resource.MimeType}, resource, nil
}

func (s *Service) FederationAssets(proof string) ([]FederationAsset, error) {
	user, _, err := s.federationProofUser(proof, "asset-list")
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.Assets(user.ID)
	if err != nil {
		return nil, err
	}
	result := make([]FederationAsset, 0)
	for i := range rows {
		item, _, err := s.federationAsset(user.ID, &rows[i])
		if err == nil {
			result = append(result, *item)
		}
		if len(result) >= 100 {
			break
		}
	}
	return result, nil
}

func (s *Service) FederationAsset(proof, rangeHeader string, describeOnly bool) (*FederationAsset, *ResourceDelivery, error) {
	user, ticket, err := s.federationProofUser(proof, "asset-read")
	if err != nil {
		return nil, nil, err
	}
	asset, err := s.repo.AssetForUser(user.ID, ticket.AssetID)
	if err != nil {
		return nil, nil, err
	}
	item, resource, err := s.federationAsset(user.ID, asset)
	if err != nil || describeOnly {
		return item, nil, err
	}
	stream, err := s.OpenResourceRange(user.ID, resource.ID, rangeHeader)
	if err != nil {
		return nil, nil, err
	}
	return item, &ResourceDelivery{Resource: resource, Stream: stream, Access: &assets.ResourceAccess{Delivery: assets.DeliveryProxy}}, nil
}
