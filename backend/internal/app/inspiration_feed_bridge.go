package app

import (
	"context"
	"encoding/json"
	"time"

	"yingce/backend/internal/inspirations"
	"yingce/backend/internal/model"
)

type (
	InspirationFeed               = inspirations.Feed
	InspirationFeedAdminStatus    = inspirations.AdminStatus
	InspirationFeedSettingsUpdate = inspirations.SettingsUpdate
)

type inspirationFeedAdminGate struct{ svc *Service }

func (g inspirationFeedAdminGate) RequireAdmin(user *model.User) error {
	if g.svc == nil {
		return Unauthorized("请先登录")
	}
	return g.svc.RequireAdmin(user)
}

func (g inspirationFeedAdminGate) AppendAudit(actor *model.User, action, targetType, targetID, summary string, metadata any) error {
	if g.svc == nil {
		return Unauthorized("请先登录")
	}
	return g.svc.appendAdminAudit(actor, action, targetType, targetID, summary, metadata)
}

// inspirationFeedLock 用协调器保证多实例部署里只有一个实例在同步上新；没有 Redis 的单实例部署是进程内互斥。
func (s *Service) inspirationFeedLock(ctx context.Context, key string, ttl time.Duration) (func(), bool, error) {
	return s.coordinator.Acquire(ctx, key, 1, ttl)
}

func (s *Service) inspirationFeedDomain() *inspirations.Service {
	if s.inspirationFeed != nil {
		return s.inspirationFeed
	}
	return inspirations.New(s.repo, inspirationFeedAdminGate{svc: s}, nil, nil)
}

func (s *Service) startInspirationFeedWorker() {
	s.inspirationFeedDomain().StartSyncWorker()
}

func (s *Service) InspirationFeed() (*InspirationFeed, error) {
	rows, err := s.InspirationGallery().Entries(false)
	if err != nil {
		return nil, err
	}
	feed, err := s.inspirationFeedDomain().Feed()
	if err != nil {
		return nil, err
	}
	feedIDs := make(map[string]bool, len(feed.Entries))
	for _, entry := range feed.Entries {
		feedIDs[entry.ID] = true
	}
	// Never mutate the domain's shared cached feed with request-specific filtering.
	filtered := *feed
	filtered.Entries = []inspirations.FeedEntry{}
	for _, row := range rows {
		id, _ := row["id"].(string)
		if !feedIDs[id] {
			continue
		}
		b, err := json.Marshal(row)
		if err != nil {
			return nil, err
		}
		var entry inspirations.FeedEntry
		if err = json.Unmarshal(b, &entry); err != nil {
			return nil, err
		}
		filtered.Entries = append(filtered.Entries, entry)
	}
	// Raw upstream categories are not independently authorized public content.
	filtered.Categories = map[string]map[string]string{}
	return &filtered, nil
}

func (s *Service) AdminInspirationFeed(actor *model.User) (*InspirationFeedAdminStatus, error) {
	return s.inspirationFeedDomain().AdminStatus(actor)
}

func (s *Service) UpdateInspirationFeedSettings(actor *model.User, input InspirationFeedSettingsUpdate) (*InspirationFeedAdminStatus, error) {
	return s.inspirationFeedDomain().UpdateSettings(actor, input)
}

func (s *Service) SyncInspirationFeed(ctx context.Context, actor *model.User) (*InspirationFeedAdminStatus, error) {
	return s.inspirationFeedDomain().SyncNow(ctx, actor)
}
