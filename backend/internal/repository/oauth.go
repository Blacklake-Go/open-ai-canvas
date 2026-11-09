package repository

import (
	"errors"
	"strings"
	"time"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (r *Repository) UserIdentity(provider string, subject string) (*model.UserIdentity, error) {
	var identity model.UserIdentity
	if err := r.db.First(&identity, "provider = ? AND subject = ?", provider, subject).Error; err != nil {
		return nil, err
	}
	return &identity, nil
}

func (r *Repository) UserIdentityForUser(userID string, provider string) (*model.UserIdentity, error) {
	var identity model.UserIdentity
	if err := r.db.First(&identity, "user_id = ? AND provider = ?", userID, provider).Error; err != nil {
		return nil, err
	}
	return &identity, nil
}

func (r *Repository) CreateOAuthState(state *model.OAuthState) error {
	return r.db.Create(state).Error
}

func (r *Repository) ConsumeOAuthState(provider string, stateHash string) (*model.OAuthState, error) {
	var state model.OAuthState
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&state, "provider = ? AND state_hash = ? AND used_at IS NULL AND expires_at > ?", provider, stateHash, time.Now()).Error; err != nil {
			return err
		}
		now := time.Now()
		updated := tx.Model(&model.OAuthState{}).Where("id = ? AND used_at IS NULL", state.ID).Update("used_at", &now)
		if updated.Error != nil {
			return updated.Error
		}
		if updated.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		state.UsedAt = &now
		return nil
	})
	return &state, err
}

func (r *Repository) CreateOAuthUser(user *model.User, identity *model.UserIdentity) error {
	return r.CreateOAuthUserWithVerification(user, identity, "")
}

func (r *Repository) CreateOAuthUserWithVerification(user *model.User, identity *model.UserIdentity, verificationID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := lockRegistrationEmail(tx, user.Email); err != nil {
			return err
		}
		if err := New(tx).CheckEmailAvailable(user.Email, ""); err != nil {
			return err
		}
		if verificationID != "" {
			if err := consumeVerification(tx, verificationID, time.Now()); err != nil {
				return err
			}
		}
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		if err := tx.Create(identity).Error; err != nil {
			return err
		}
		return tx.Create(&model.CreditAccount{UserID: user.ID}).Error
	})
}

func (r *Repository) UserIdentitiesForUser(userID string) ([]model.UserIdentity, error) {
	var list []model.UserIdentity
	if err := r.db.Find(&list, "user_id = ?", userID).Error; err != nil {
		return nil, err
	}
	return list, nil
}

func (r *Repository) DeleteUserIdentity(userID string, provider string) error {
	return r.db.Delete(&model.UserIdentity{}, "user_id = ? AND provider = ?", userID, provider).Error
}

func (r *Repository) DeleteOAuthIdentitySafely(userID, provider string, usableProviders []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := lockProfileUser(tx, userID); err != nil {
			return err
		}
		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "id = ?", userID).Error; err != nil {
			return err
		}
		if user.PasswordHash == "" {
			var remaining int64
			if err := tx.Model(&model.UserIdentity{}).Where("user_id = ? AND provider <> ? AND provider IN ?", userID, provider, usableProviders).Count(&remaining).Error; err != nil {
				return err
			}
			if remaining == 0 {
				return kernel.BadAuthRequest("无法解绑唯一可用的登录方式，请先设置密码或绑定其他可用渠道")
			}
		}
		result := tx.Delete(&model.UserIdentity{}, "user_id = ? AND provider = ?", userID, provider)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return kernel.BadAuthRequest("未找到已绑定的该渠道账号")
		}
		return nil
	})
}

func (r *Repository) UpdateOAuthIdentityProfile(identity *model.UserIdentity) error {
	result := r.db.Model(&model.UserIdentity{}).
		Where("id = ? AND user_id = ? AND provider = ? AND subject = ?", identity.ID, identity.UserID, identity.Provider, identity.Subject).
		Updates(map[string]any{"provider_username": identity.ProviderUsername, "avatar_url": identity.AvatarURL, "updated_at": time.Now()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) BindOAuthIdentity(identity *model.UserIdentity, session *model.AuthSession) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := lockProfileUser(tx, identity.UserID); err != nil {
			return err
		}
		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "id = ?", identity.UserID).Error; err != nil {
			return err
		}
		if session == nil {
			return ErrProfileAuthorization
		}
		if err := profileAuthorization(tx, &user, session, time.Now(), false); err != nil {
			return err
		}
		return New(tx).UpsertUserIdentity(identity)
	})
}

func (r *Repository) UpsertUserIdentity(identity *model.UserIdentity) error {
	var existing model.UserIdentity
	err := r.db.First(&existing, "user_id = ? AND provider = ?", identity.UserID, identity.Provider).Error
	if err == nil {
		return r.db.Model(&model.UserIdentity{}).Where("id = ?", existing.ID).
			Updates(map[string]any{"subject": identity.Subject, "provider_username": identity.ProviderUsername, "avatar_url": identity.AvatarURL, "updated_at": time.Now()}).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return r.db.Create(identity).Error
}

func (r *Repository) UserIdentitiesCountByProvider() (map[string]int64, error) {
	type Result struct {
		Provider string
		Count    int64
	}
	var results []Result
	if err := r.db.Model(&model.UserIdentity{}).Select("provider, count(*) as count").Group("provider").Scan(&results).Error; err != nil {
		return nil, err
	}
	m := make(map[string]int64)
	for _, res := range results {
		m[res.Provider] = res.Count
	}
	return m, nil
}

func (r *Repository) SocialLoginLogs(limit int) ([]model.LoginLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var list []model.LoginLog
	if err := r.db.Where("method LIKE ? OR source LIKE ?", "social_%", "%social%").Order("created_at desc").Limit(limit).Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}

func (r *Repository) RecentSocialLoginLogs(since time.Time) ([]model.LoginLog, error) {
	var list []model.LoginLog
	if err := r.db.Where("(method LIKE ? OR source LIKE ?) AND created_at >= ?", "social_%", "%social%", since).Order("created_at asc").Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}

func (r *Repository) SearchUsersWithSocialIdentities(query string, limit int) ([]model.User, map[string][]model.UserIdentity, error) {
	query = strings.TrimSpace(query)
	var users []model.User
	db := r.db.Model(&model.User{})
	if query != "" {
		like := "%" + query + "%"
		var matchedUserIDs []string
		_ = r.db.Model(&model.UserIdentity{}).Where("provider_username LIKE ? OR subject LIKE ?", like, like).Pluck("user_id", &matchedUserIDs)
		if len(matchedUserIDs) > 0 {
			db = db.Where("id IN ? OR id = ? OR username LIKE ? OR email LIKE ? OR display_name LIKE ?", matchedUserIDs, query, like, like, like)
		} else {
			db = db.Where("id = ? OR username LIKE ? OR email LIKE ? OR display_name LIKE ?", query, like, like, like)
		}
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if err := db.Order("created_at desc").Limit(limit).Find(&users).Error; err != nil {
		return nil, nil, err
	}
	identitiesMap := make(map[string][]model.UserIdentity)
	if len(users) > 0 {
		var uids []string
		for _, u := range users {
			uids = append(uids, u.ID)
		}
		var allIdentities []model.UserIdentity
		if err := r.db.Where("user_id IN ?", uids).Find(&allIdentities).Error; err == nil {
			for _, idn := range allIdentities {
				identitiesMap[idn.UserID] = append(identitiesMap[idn.UserID], idn)
			}
		}
	}
	return users, identitiesMap, nil
}
