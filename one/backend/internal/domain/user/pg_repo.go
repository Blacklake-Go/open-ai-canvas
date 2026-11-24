package user

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"one/backend/internal/pkg/ids"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) GetByID(ctx context.Context, userID string) (*Profile, error) {
	return r.GetProfileByIdentifier(ctx, userID)
}

func (r *PGRepository) GetProfileByIdentifier(ctx context.Context, identifier string) (*Profile, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	clean := strings.TrimSpace(identifier)
	if clean == "" {
		return nil, nil
	}
	const q = `
		SELECT
			u.id,
			COALESCE(u.user_number, u.id),
			COALESCE(u.username, ''),
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.phone_country_code, '+86'),
			COALESCE(NULLIF(u.display_name, ''), NULLIF(split_part(u.email, '@', 1), ''), '创作者#' || u.id),
			COALESCE(u.avatar_url, ''),
			COALESCE(u.avatar_frame, ''),
			COALESCE(u.bio, ''),
			COALESCE(u.website, ''),
			COALESCE(NULLIF(u.locale, ''), 'en'),
			COALESCE(u.role, 'user'),
			COALESCE(u.status, 'active'),
			COALESCE(u.credits, 0)::bigint,
			(u.email_verified_at IS NOT NULL),
			((u.password_hash IS NOT NULL AND u.password_hash != '') OR EXISTS (
				SELECT 1 FROM auth_usr.auth_accounts aa WHERE aa.user_id = u.id AND aa.password_hash IS NOT NULL AND aa.password_hash != ''
			)) AS has_password,
			COALESCE(u.followers_count, 0),
			COALESCE(u.following_count, 0),
			COALESCE(u.is_activity_public, TRUE),
			COALESCE(u.privacy_settings, '{}'::jsonb),
			COALESCE(u.social_links, '{}'::jsonb) - 'agent_api_key',
			COALESCE(u.preferences_json, '{}'::jsonb),
			COALESCE(u.zodiac, ''),
			COALESCE(u.industry, ''),
			COALESCE(u.occupation, ''),
			COALESCE(u.country, ''),
			COALESCE(u.gender, ''),
			COALESCE(u.occupation_code, ''),
			COALESCE(u.style_codes, '{}'::text[]),
			COALESCE(u.onboarding_completed, FALSE),
			COALESCE(u.onboarding_step, 0),
			COALESCE(NULLIF(u.password_hash, ''), ''),
			COALESCE(NULLIF(u.password_salt, ''), ''),
			u.deletion_due_at
		FROM auth_usr.users u
		WHERE u.id = $1 OR u.user_number = $1
		LIMIT 1
	`
	var p Profile
	var privacyRaw, socialRaw, prefsRaw json.RawMessage
	err := r.Pool.QueryRow(ctx, q, clean).Scan(
		&p.ID, &p.UserNumber, &p.Username, &p.Email, &p.Phone, &p.PhoneCountryCode,
		&p.DisplayName, &p.AvatarURL, &p.AvatarFrame, &p.Bio, &p.Website,
		&p.Locale, &p.Role, &p.Status, &p.Credits, &p.EmailVerified, &p.HasPassword,
		&p.FollowersCount, &p.FollowingCount, &p.IsActivityPublic,
		&privacyRaw, &socialRaw, &prefsRaw,
		&p.Zodiac, &p.Industry, &p.Occupation, &p.Country, &p.Gender, &p.OccupationCode, &p.StyleCodes,
		&p.OnboardingComplete, &p.OnboardingStep,
		&p.PasswordHash, &p.PasswordSalt, &p.DeletionDueAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.UUID = p.ID
	p.Name = p.DisplayName
	p.PrivacySettings = map[string]any{}
	if len(privacyRaw) > 0 {
		_ = json.Unmarshal(privacyRaw, &p.PrivacySettings)
	}
	p.SocialLinks = map[string]any{}
	if len(socialRaw) > 0 {
		_ = json.Unmarshal(socialRaw, &p.SocialLinks)
	}
	p.Preferences = map[string]any{}
	if len(prefsRaw) > 0 {
		_ = json.Unmarshal(prefsRaw, &p.Preferences)
	}
	if len(p.Preferences) == 0 {
		if prefs, ok := p.SocialLinks["preferences"].(map[string]any); ok {
			p.Preferences = prefs
		}
	}
	_ = r.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM ai_studio.creations WHERE user_id = $1`, p.ID).Scan(&p.CreationsCount)
	_ = r.Pool.QueryRow(ctx, `SELECT COUNT(*)::int, COALESCE(SUM(likes_count), 0)::int FROM ai_studio.community_posts WHERE user_id = $1 AND status = 'published'`, p.ID).Scan(&p.PostsCount, &p.TotalLikes)
	return &p, nil
}

func (r *PGRepository) UpdateProfile(ctx context.Context, userID string, displayName, bio, website, avatarURL, username *string) (*Profile, error) {
	return r.UpdateProfilePatch(ctx, userID, ProfilePatch{
		DisplayName: displayName,
		Bio:         bio,
		Website:     website,
		AvatarURL:   avatarURL,
		Username:    username,
	})
}

func (r *PGRepository) UpdateProfilePatch(ctx context.Context, userID string, patch ProfilePatch) (*Profile, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var socialJSON *string
	if patch.SocialLinks != nil {
		var curRaw json.RawMessage
		_ = r.Pool.QueryRow(ctx, `SELECT COALESCE(social_links, '{}'::jsonb) FROM auth_usr.users WHERE id = $1`, userID).Scan(&curRaw)
		merged := mergeJSONMap(curRaw, patch.SocialLinks)
		delete(merged, "agent_api_key")
		b, _ := json.Marshal(merged)
		s := string(b)
		socialJSON = &s
	}
	var stylesArg []string
	if patch.HasStyleCodes {
		stylesArg = patch.StyleCodes
		if stylesArg == nil {
			stylesArg = []string{}
		}
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE auth_usr.users
		SET display_name = COALESCE($2, display_name),
		    bio = COALESCE($3, bio),
		    website = COALESCE($4, website),
		    avatar_url = COALESCE($5, avatar_url),
		    username = COALESCE($6, username),
		    social_links = COALESCE($7::jsonb, social_links),
		    locale = COALESCE(NULLIF($8, ''), locale),
		    zodiac = COALESCE($9, zodiac),
		    industry = COALESCE($10, industry),
		    occupation = COALESCE($11, occupation),
		    country = COALESCE(NULLIF($12, ''), country),
		    gender = COALESCE(NULLIF($13, ''), gender),
		    occupation_code = COALESCE(NULLIF($14, ''), occupation_code),
		    style_codes = CASE WHEN $15 THEN $16::text[] ELSE style_codes END,
		    updated_at = NOW()
		WHERE id = $1
	`, userID, patch.DisplayName, patch.Bio, patch.Website, patch.AvatarURL, patch.Username,
		socialJSON, patch.Locale, patch.Zodiac, patch.Industry, patch.Occupation,
		patch.Country, patch.Gender, patch.OccupationCode, patch.HasStyleCodes, stylesArg)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, userID)
}

func (r *PGRepository) SetAvatarFrame(ctx context.Context, userID, frame string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	var val *string
	if frame != "" {
		val = &frame
	}
	_, err := r.Pool.Exec(ctx, `UPDATE auth_usr.users SET avatar_frame = $2, updated_at = NOW() WHERE id = $1`, userID, val)
	return err
}

func (r *PGRepository) HasUnlockedAvatarFrame(ctx context.Context, userID, frame string) (bool, error) {
	if r == nil || r.Pool == nil {
		return false, nil
	}
	var count int
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM ops_bill.currency_journal_entries
		WHERE user_id = $1 AND biz_type = 'BENEFIT_REDEEM' AND biz_id LIKE '%' || $2 || '%'
	`, userID, frame).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *PGRepository) UpdatePassword(ctx context.Context, userID, passwordHash, passwordSalt string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE auth_usr.users SET password_hash = $1, password_salt = $2, updated_at = NOW() WHERE id = $3`, passwordHash, passwordSalt, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE auth_usr.auth_accounts SET password_hash = $1, password_salt = $2, updated_at = NOW() WHERE user_id = $3 AND provider = 'email'`, passwordHash, passwordSalt, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PGRepository) IsEmailOwnedByAnother(ctx context.Context, email, userID string) (bool, error) {
	if r == nil || r.Pool == nil {
		return false, nil
	}
	var id string
	err := r.Pool.QueryRow(ctx, `
		SELECT id FROM auth_usr.users WHERE LOWER(email) = $1 AND id <> $2
		UNION
		SELECT user_id AS id FROM auth_usr.auth_accounts WHERE provider = 'email' AND LOWER(provider_user_id) = $1 AND user_id <> $2
		LIMIT 1
	`, email, userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (r *PGRepository) BindEmail(ctx context.Context, userID, email string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	_, err := r.Pool.Exec(ctx, `UPDATE auth_usr.users SET email = $2, email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`, userID, email)
	return err
}

func (r *PGRepository) UnbindEmail(ctx context.Context, userID string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE auth_usr.users SET email = NULL, email_verified_at = NULL, updated_at = NOW() WHERE id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM auth_usr.auth_accounts WHERE user_id = $1 AND provider = 'email'`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PGRepository) ClearAvatar(ctx context.Context, userID string) (*Profile, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	if _, err := r.Pool.Exec(ctx, `UPDATE auth_usr.users SET avatar_url = NULL, avatar_object_key = NULL, updated_at = NOW() WHERE id = $1`, userID); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, userID)
}

func (r *PGRepository) UpdatePhone(ctx context.Context, userID, phone, countryCode string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	var existing string
	err := r.Pool.QueryRow(ctx, `SELECT id FROM auth_usr.users WHERE phone = $1 AND id <> $2 LIMIT 1`, phone, userID).Scan(&existing)
	if err == nil {
		return ErrPhoneConflict
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	_, err = r.Pool.Exec(ctx, `UPDATE auth_usr.users SET phone = $2, phone_country_code = $3, phone_verified_at = NOW(), updated_at = NOW() WHERE id = $1`, userID, phone, countryCode)
	return err
}

func (r *PGRepository) UnbindPhone(ctx context.Context, userID string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE auth_usr.users SET phone = NULL, phone_country_code = NULL, phone_verified_at = NULL, updated_at = NOW() WHERE id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM auth_usr.auth_accounts WHERE user_id = $1 AND provider = 'phone'`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PGRepository) GetPreferences(ctx context.Context, userID string) (map[string]any, error) {
	p, err := r.GetByID(ctx, userID)
	if err != nil || p == nil {
		return map[string]any{}, err
	}
	return p.Preferences, nil
}

func (r *PGRepository) UpdatePreferences(ctx context.Context, userID string, prefs map[string]any) (map[string]any, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var raw json.RawMessage
	err := r.Pool.QueryRow(ctx, `SELECT COALESCE(preferences_json, '{}'::jsonb) FROM auth_usr.users WHERE id = $1`, userID).Scan(&raw)
	if err != nil {
		return nil, err
	}
	merged := mergeJSONMap(raw, prefs)
	encoded, _ := json.Marshal(merged)
	var localeArg *string
	if loc, ok := prefs["locale"].(string); ok && strings.TrimSpace(loc) != "" {
		clean := strings.TrimSpace(loc)
		localeArg = &clean
	}
	_, err = r.Pool.Exec(ctx, `
		UPDATE auth_usr.users
		SET preferences_json = $2::jsonb,
		    locale = COALESCE($3, locale),
		    updated_at = NOW()
		WHERE id = $1
	`, userID, string(encoded), localeArg)
	if err != nil {
		return nil, err
	}
	return merged, nil
}

func (r *PGRepository) UpdatePrivacy(ctx context.Context, userID string, isPublic *bool, settings map[string]any) (bool, map[string]any, error) {
	if r == nil || r.Pool == nil {
		return false, nil, ErrNotImplemented
	}
	var curPublic bool
	var curRaw json.RawMessage
	err := r.Pool.QueryRow(ctx, `SELECT COALESCE(is_activity_public, TRUE), COALESCE(privacy_settings, '{}'::jsonb) FROM auth_usr.users WHERE id = $1`, userID).Scan(&curPublic, &curRaw)
	if err != nil {
		return false, nil, err
	}
	nextPublic := curPublic
	if isPublic != nil {
		nextPublic = *isPublic
	}
	merged := mergeJSONMap(curRaw, settings)
	encoded, _ := json.Marshal(merged)
	_, err = r.Pool.Exec(ctx, `UPDATE auth_usr.users SET is_activity_public = $2, privacy_settings = $3::jsonb, updated_at = NOW() WHERE id = $1`, userID, nextPublic, string(encoded))
	if err != nil {
		return false, nil, err
	}
	return nextPublic, merged, nil
}

func (r *PGRepository) IsFollowing(ctx context.Context, userID, targetID string) (bool, error) {
	if r == nil || r.Pool == nil {
		return false, nil
	}
	var exists bool
	err := r.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM ai_studio.user_follows WHERE follower_id = $1 AND following_id = $2)
	`, userID, targetID).Scan(&exists)
	return exists, err
}

func (r *PGRepository) ToggleFollow(ctx context.Context, userID, targetID string) (bool, error) {
	if r == nil || r.Pool == nil {
		return false, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `DELETE FROM ai_studio.user_follows WHERE follower_id = $1 AND following_id = $2`, userID, targetID)
	if err != nil {
		return false, err
	}
	following := false
	if tag.RowsAffected() > 0 {
		_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET following_count = GREATEST(0, following_count - 1) WHERE id = $1`, userID)
		_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = $1`, targetID)
	} else {
		fid, _ := ids.NewPrefixedID("fol")
		_, err = tx.Exec(ctx, `INSERT INTO ai_studio.user_follows (id, follower_id, following_id, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`, fid, userID, targetID)
		if err != nil {
			return false, err
		}
		_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET following_count = following_count + 1 WHERE id = $1`, userID)
		_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET followers_count = followers_count + 1 WHERE id = $1`, targetID)
		following = true
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return following, nil
}

func (r *PGRepository) ListNotifications(ctx context.Context, userID string, limit int) ([]NotificationItem, int, error) {
	if r == nil || r.Pool == nil {
		return []NotificationItem{}, 0, nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT id, COALESCE(type, 'system'), COALESCE(title, ''), COALESCE(content, ''), COALESCE(is_read, FALSE), COALESCE(link_url, ''), created_at
		FROM sys_core.user_notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return []NotificationItem{}, 0, nil
	}
	defer rows.Close()
	var items []NotificationItem
	for rows.Next() {
		var it NotificationItem
		if err := rows.Scan(&it.ID, &it.Type, &it.Title, &it.Content, &it.IsRead, &it.Link, &it.CreatedAt); err == nil {
			items = append(items, it)
		}
	}
	if items == nil {
		items = []NotificationItem{}
	}
	var unread int
	_ = r.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM sys_core.user_notifications WHERE user_id = $1 AND is_read = FALSE`, userID).Scan(&unread)
	return items, unread, nil
}

func (r *PGRepository) MarkAllNotificationsRead(ctx context.Context, userID string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `UPDATE sys_core.user_notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, userID)
	return err
}

func (r *PGRepository) GetActivityDashboard(ctx context.Context, targetID string) (*ActivityDashboard, error) {
	if r == nil || r.Pool == nil {
		return &ActivityDashboard{Heatmap: map[string]int{}, TopModels: []map[string]any{}, IsPublic: true}, nil
	}
	dash := &ActivityDashboard{Heatmap: map[string]int{}, TopModels: []map[string]any{}, IsPublic: true}
	_ = r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int, COALESCE(SUM(credit_cost), 0)::bigint, COUNT(DISTINCT DATE(created_at))::int
		FROM ai_studio.creations WHERE user_id = $1
	`, targetID).Scan(&dash.TotalCreations, &dash.TotalCredits, &dash.ActiveDays)

	rows, err := r.Pool.Query(ctx, `
		WITH dates AS (
			SELECT DATE(created_at) AS active_date, COUNT(*)::int AS cnt FROM ai_studio.creations WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '365 days' GROUP BY DATE(created_at)
			UNION ALL
			SELECT DATE(created_at) AS active_date, COUNT(*)::int AS cnt FROM sys_core.user_activity_logs WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '365 days' GROUP BY DATE(created_at)
		)
		SELECT active_date::text, SUM(cnt)::int FROM dates GROUP BY active_date ORDER BY active_date ASC
	`, targetID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d string
			var cnt int
			if rows.Scan(&d, &cnt) == nil {
				dash.Heatmap[d] = cnt
			}
		}
	}
	return dash, nil
}

func (r *PGRepository) GetOnboarding(ctx context.Context, userID string) (*OnboardingPayload, error) {
	if r == nil || r.Pool == nil {
		return &OnboardingPayload{}, nil
	}
	var out OnboardingPayload
	var country, gender, occ, persona *string
	err := r.Pool.QueryRow(ctx, `
		SELECT COALESCE(onboarding_completed, FALSE), COALESCE(onboarding_step, 0),
		       country, gender, occupation_code, COALESCE(style_codes, '{}'::text[]), creator_persona_code
		FROM auth_usr.users WHERE id = $1 LIMIT 1
	`, userID).Scan(&out.Completed, &out.Step, &country, &gender, &occ, &out.StyleCodes, &persona)
	if err != nil {
		return nil, err
	}
	if country != nil {
		out.Country = *country
	}
	if gender != nil {
		out.Gender = *gender
	}
	if occ != nil {
		out.OccupationCode = *occ
	}
	if persona != nil {
		out.CreatorPersonaCode = *persona
	}
	return &out, nil
}

func (r *PGRepository) SaveOnboarding(ctx context.Context, userID string, in OnboardingPayload) (*OnboardingPayload, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	styles := in.StyleCodes
	if styles == nil {
		styles = []string{}
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE auth_usr.users
		SET onboarding_completed = $2,
		    onboarding_step = $3,
		    country = NULLIF($4, ''),
		    gender = NULLIF($5, ''),
		    occupation_code = NULLIF($6, ''),
		    style_codes = $7::text[],
		    creator_persona_code = NULLIF($8, ''),
		    updated_at = NOW()
		WHERE id = $1
	`, userID, in.Completed, in.Step, in.Country, in.Gender, in.OccupationCode, styles, in.CreatorPersonaCode)
	if err != nil {
		return nil, err
	}
	return &in, nil
}

func (r *PGRepository) ListOAuthAccounts(ctx context.Context, userID string) ([]OAuthAccountItem, error) {
	if r == nil || r.Pool == nil {
		return []OAuthAccountItem{}, nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT provider, COALESCE(provider_username, ''), COALESCE(profile_json->>'displayName', ''), created_at, COALESCE(provider_email_verified, FALSE)
		FROM auth_usr.auth_accounts
		WHERE user_id = $1 AND provider = ANY($2)
		ORDER BY created_at
	`, userID, oauthProviders)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OAuthAccountItem
	for rows.Next() {
		var it OAuthAccountItem
		if rows.Scan(&it.Provider, &it.ProviderUsername, &it.DisplayName, &it.CreatedAt, &it.ProviderEmailVerified) == nil {
			out = append(out, it)
		}
	}
	if out == nil {
		out = []OAuthAccountItem{}
	}
	return out, nil
}

func (r *PGRepository) CountValidCredentials(ctx context.Context, userID string) (int, int, error) {
	if r == nil || r.Pool == nil {
		return 0, 0, nil
	}
	var hasPwd, hasPhone int
	_ = r.Pool.QueryRow(ctx, `
		SELECT CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 ELSE 0 END,
		       CASE WHEN phone IS NOT NULL AND phone_verified_at IS NOT NULL THEN 1 ELSE 0 END
		FROM auth_usr.users WHERE id = $1
	`, userID).Scan(&hasPwd, &hasPhone)
	var oauthCount int
	_ = r.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM auth_usr.auth_accounts WHERE user_id = $1 AND provider = ANY($2)`, userID, oauthProviders).Scan(&oauthCount)
	return hasPwd + hasPhone + oauthCount, oauthCount, nil
}

func (r *PGRepository) UnbindOAuthProvider(ctx context.Context, userID, provider string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	_, err := r.Pool.Exec(ctx, `DELETE FROM auth_usr.auth_accounts WHERE user_id = $1 AND provider = $2`, userID, provider)
	return err
}

func (r *PGRepository) ScheduleDeactivation(ctx context.Context, userID string, dueAt time.Time, reason string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `
		UPDATE auth_usr.users
		SET status = 'deletion_pending',
		    is_active = FALSE,
		    deletion_requested_at = COALESCE(deletion_requested_at, NOW()),
		    deletion_due_at = $2,
		    updated_at = NOW()
		WHERE id = $1
	`, userID, dueAt.UTC()); err != nil {
		return err
	}
	_, _ = tx.Exec(ctx, `DELETE FROM auth_usr.sessions WHERE user_id = $1`, userID)
	aeID, _ := ids.NewPrefixedID("ae")
	metaBytes, _ := json.Marshal(map[string]any{"reason": reason, "dueAt": dueAt.UTC().Format(time.RFC3339)})
	_, _ = tx.Exec(ctx, `
		INSERT INTO sys_core.auth_events (id, event_type, target, metadata_json, created_at)
		VALUES ($1, 'ACCOUNT_DELETION_REQUESTED', $2, $3::jsonb, NOW())
	`, aeID, userID, string(metaBytes))
	return tx.Commit(ctx)
}

func (r *PGRepository) CancelDeactivation(ctx context.Context, userID string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE auth_usr.users
		SET status = 'active',
		    is_active = TRUE,
		    deletion_requested_at = NULL,
		    deletion_due_at = NULL,
		    updated_at = NOW()
		WHERE id = $1 AND status = 'deletion_pending'
	`, userID)
	return err
}
