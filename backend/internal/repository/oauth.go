package repository

import (
	"time"

	"yingce/backend/internal/model"

	"gorm.io/gorm"
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
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := lockRegistrationEmail(tx, user.Email); err != nil {
			return err
		}
		if err := New(tx).CheckEmailAvailable(user.Email, ""); err != nil {
			return err
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

func (r *Repository) UpsertUserIdentity(identity *model.UserIdentity) error {
	var existing model.UserIdentity
	err := r.db.First(&existing, "user_id = ? AND provider = ?", identity.UserID, identity.Provider).Error
	if err == nil {
		existing.Subject = identity.Subject
		existing.ProviderUsername = identity.ProviderUsername
		existing.AvatarURL = identity.AvatarURL
		existing.UpdatedAt = time.Now()
		return r.db.Save(&existing).Error
	}
	return r.db.Create(identity).Error
}
