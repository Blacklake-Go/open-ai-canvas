package auth

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"one/backend/internal/middleware"
	"one/backend/internal/pkg/ids"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrEmailExists   = errors.New("EMAIL_ALREADY_EXISTS")
	ErrInvalidInvite = errors.New("INVALID_INVITE_CODE")
	ErrUserNotFound  = errors.New("USER_NOT_FOUND")
	ErrPhoneBound    = errors.New("PHONE_ALREADY_BOUND")
	ErrFlowNotFound  = errors.New("OAUTH_FLOW_NOT_FOUND")
)

type CredentialRecord struct {
	UserID       string
	UserNumber   string
	Email        *string
	Phone        *string
	DisplayName  string
	AvatarURL    *string
	Role         string
	Status       string
	Locale       string
	Credits      int64
	PasswordHash string
	PasswordSalt string
}

type SessionRecord struct {
	Token     string
	TokenHash string
	UserID    string
	ExpiresAt time.Time
}

type VerificationCodeRecord struct {
	ID        string
	Target    string
	CodeHash  string
	Type      string
	Attempts  int
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

type ResetUserRecord struct {
	ID         string
	UserNumber string
	Email      *string
	Phone      *string
	Username   *string
	Status     string
}

type InviteCodeCheck struct {
	Valid   bool
	Code    string
	Reason  string
	ErrCode string
}

type CreateUserParams struct {
	Email              string
	PasswordHash       string
	PasswordSalt       string
	DisplayName        string
	Locale             string
	RegistrationSource string
	IP                 string
	EmailVerified      bool
	InviteCode         string
	Phone              string
	PhoneCountryCode   string
}

type OAuthFlowRecord struct {
	ID           string
	Provider     string
	Mode         string
	Status       string
	State        string
	CodeVerifier string
	ReturnTo     string
	ReturnOrigin string
	ProviderUID  string
	Email        string
	DisplayName  string
	AvatarURL    string
	UserID       string
	ExpiresAt    time.Time
}

type AuthRepository interface {
	GetSettingJSON(ctx context.Context, key string) (json.RawMessage, error)
	FindCredentialByAccount(ctx context.Context, identifier string) (*CredentialRecord, error)
	CheckInviteCodeValid(ctx context.Context, code string) (InviteCodeCheck, error)
	CreateUser(ctx context.Context, params CreateUserParams) (*middleware.SessionUser, error)
	UpdateLoginAudit(ctx context.Context, userID, ip string) error

	CreateSession(ctx context.Context, userID, rawToken, tokenHash string, expiresAt time.Time) (*SessionRecord, error)
	RotateSession(ctx context.Context, oldTokenHash, nextRawToken, nextTokenHash string, nextExpiresAt time.Time) (*SessionRecord, string, error)
	RevokeSession(ctx context.Context, tokenHash string) error
	RevokeAllUserSessions(ctx context.Context, userID string) error

	LastVerificationCodeIssuedAt(ctx context.Context, target, codeType string) (*time.Time, error)
	ReplaceVerificationCode(ctx context.Context, id, target, codeHash, codeType string, expiresAt time.Time, requestIP string) error
	FindLatestVerificationCode(ctx context.Context, target, codeType string) (*VerificationCodeRecord, error)
	IncrementVerificationAttempts(ctx context.Context, id string) error
	MarkVerificationCodeUsed(ctx context.Context, id string) error

	FindResetUserByEmail(ctx context.Context, email string) (*ResetUserRecord, error)
	FindResetUserByPhone(ctx context.Context, phone string) (*ResetUserRecord, error)
	SetUserPassword(ctx context.Context, userID, passwordHash, passwordSalt string) error

	UpsertPhoneUserAndVerify(ctx context.Context, phone, countryCode, ip, locale string) (*middleware.SessionUser, error)
	BindUserPhone(ctx context.Context, userID, phone, countryCode string) error

	CreateOAuthFlow(ctx context.Context, flow OAuthFlowRecord) error
	FindOAuthFlowByID(ctx context.Context, id string) (*OAuthFlowRecord, error)
	FindOAuthFlowByState(ctx context.Context, state string) (*OAuthFlowRecord, error)
	UpdateOAuthFlow(ctx context.Context, flow OAuthFlowRecord) error
	FindOrCreateOAuthUser(ctx context.Context, provider, providerUID, email, username, displayName, avatarURL, locale, ip string, autoCreate bool) (*middleware.SessionUser, bool, error)

	RecordAuthEvent(ctx context.Context, userID, eventType, ip, details string) error
}

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) GetSettingJSON(ctx context.Context, key string) (json.RawMessage, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	var raw json.RawMessage
	err := r.Pool.QueryRow(ctx, `SELECT value_json FROM ops_bill.system_settings WHERE key = $1 LIMIT 1`, key).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return raw, err
}

func (r *PGRepository) FindCredentialByAccount(ctx context.Context, identifier string) (*CredentialRecord, error) {
	if r == nil || r.Pool == nil {
		return nil, errors.New("auth pg repo pool is nil")
	}
	clean := strings.TrimSpace(identifier)
	if clean == "" {
		return nil, nil
	}
	const q = `
		SELECT
			u.id,
			COALESCE(u.user_number, u.id) AS user_number,
			u.email,
			u.phone,
			COALESCE(NULLIF(u.display_name, ''), NULLIF(split_part(u.email, '@', 1), ''), '创作者#' || u.id) AS display_name,
			u.avatar_url,
			COALESCE(u.role, 'user') AS role,
			COALESCE(u.status, 'active') AS status,
			COALESCE(NULLIF(u.locale, ''), 'en') AS locale,
			COALESCE(u.credits, 0)::bigint AS credits,
			COALESCE(NULLIF(u.password_hash, ''), aa.password_hash, '') AS password_hash,
			COALESCE(NULLIF(u.password_salt, ''), aa.password_salt, '') AS password_salt
		FROM auth_usr.users u
		LEFT JOIN auth_usr.auth_accounts aa
		  ON aa.user_id = u.id AND aa.provider = 'email'
		WHERE u.user_number = $1
		   OR LOWER(u.email) = LOWER($1)
		   OR LOWER(aa.provider_user_id) = LOWER($1)
		ORDER BY (u.user_number = $1) DESC, (LOWER(u.email) = LOWER($1)) DESC
		LIMIT 1
	`
	var rec CredentialRecord
	err := r.Pool.QueryRow(ctx, q, clean).Scan(
		&rec.UserID, &rec.UserNumber, &rec.Email, &rec.Phone, &rec.DisplayName, &rec.AvatarURL,
		&rec.Role, &rec.Status, &rec.Locale, &rec.Credits, &rec.PasswordHash, &rec.PasswordSalt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *PGRepository) CheckInviteCodeValid(ctx context.Context, code string) (InviteCodeCheck, error) {
	norm := strings.ToUpper(strings.TrimSpace(code))
	if norm == "" {
		return InviteCodeCheck{Valid: false, Reason: "邀请码不能为空", ErrCode: "INVITE_CODE_REQUIRED"}, nil
	}
	if r == nil || r.Pool == nil {
		return InviteCodeCheck{Valid: false, Reason: "邀请码不存在", ErrCode: "INVALID_INVITE_CODE"}, nil
	}
	var status string
	var maxUses, usedCount int
	var expiresAt *time.Time
	err := r.Pool.QueryRow(ctx, `
		SELECT status, max_uses, used_count, expires_at
		FROM ai_studio.invite_codes
		WHERE UPPER(code) = $1
		LIMIT 1
	`, norm).Scan(&status, &maxUses, &usedCount, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return InviteCodeCheck{Valid: false, Reason: "邀请码不存在", ErrCode: "INVALID_INVITE_CODE"}, nil
	}
	if err != nil {
		return InviteCodeCheck{}, err
	}
	if status != "active" {
		return InviteCodeCheck{Valid: false, Reason: "邀请码已被禁用或已用尽", ErrCode: "INVITE_CODE_EXHAUSTED"}, nil
	}
	if expiresAt != nil && !expiresAt.After(time.Now()) {
		return InviteCodeCheck{Valid: false, Reason: "邀请码已过期", ErrCode: "INVITE_CODE_EXPIRED"}, nil
	}
	if usedCount >= maxUses {
		return InviteCodeCheck{Valid: false, Reason: "邀请码使用次数已达上限", ErrCode: "INVITE_CODE_EXHAUSTED"}, nil
	}
	return InviteCodeCheck{Valid: true, Code: norm}, nil
}

func (r *PGRepository) CreateUser(ctx context.Context, p CreateUserParams) (*middleware.SessionUser, error) {
	if r == nil || r.Pool == nil {
		return nil, errors.New("auth pg repo pool is nil")
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	email := NormalizeEmail(p.Email)
	if email != "" {
		var exists string
		err := tx.QueryRow(ctx, `SELECT id FROM auth_usr.users WHERE LOWER(email) = $1 LIMIT 1`, email).Scan(&exists)
		if err == nil {
			return nil, ErrEmailExists
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	alloc := &ids.UserIDAllocator{Store: ids.PGUserIDStore{Tx: tx}}
	userID, err := alloc.Allocate(ctx)
	if err != nil {
		return nil, err
	}

	locale := p.Locale
	if locale == "" {
		locale = "en"
	}
	displayName := p.DisplayName
	if displayName == "" && email != "" {
		displayName = strings.SplitN(email, "@", 2)[0]
	}
	if displayName == "" {
		displayName = "创作者#" + userID
	}

	var emailVerifiedAt *time.Time
	now := time.Now().UTC()
	if p.EmailVerified {
		emailVerifiedAt = &now
	}

	var emailPtr, phonePtr, ccPtr *string
	if email != "" {
		emailPtr = &email
	}
	if p.Phone != "" {
		phonePtr = &p.Phone
		cc := p.PhoneCountryCode
		if cc == "" {
			cc = "+86"
		}
		ccPtr = &cc
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO auth_usr.users (
			id, email, phone, phone_country_code, display_name,
			password_hash, password_salt, role, status, locale, credits,
			email_verified_at, registration_source, last_login_ip, last_login_at,
			is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', 'active', $8, 0, $9, $10, $11, $12, TRUE, $12, $12)
	`, userID, emailPtr, phonePtr, ccPtr, displayName, p.PasswordHash, p.PasswordSalt,
		locale, emailVerifiedAt, p.RegistrationSource, nullIfEmpty(p.IP), now)
	if err != nil {
		return nil, err
	}

	if email != "" {
		accID, _ := ids.NewPrefixedID("acc")
		_, err = tx.Exec(ctx, `
			INSERT INTO auth_usr.auth_accounts (
				id, user_id, provider, provider_user_id, provider_email,
				password_hash, password_salt, created_at, updated_at
			) VALUES ($1, $2, 'email', $3, $3, $4, $5, $6, $6)
			ON CONFLICT (provider, provider_user_id) DO NOTHING
		`, accID, userID, email, p.PasswordHash, p.PasswordSalt, now)
		if err != nil {
			return nil, err
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_wallets (user_id, daily_free_credits, subscription_credits, perpetual_credits, frozen_credits, version, created_at, updated_at)
		VALUES ($1, 0, 0, 0, 0, 1, $2, $2)
		ON CONFLICT (user_id) DO NOTHING
	`, userID, now)
	if err != nil {
		return nil, err
	}

	if p.InviteCode != "" {
		var inviteID string
		err := tx.QueryRow(ctx, `
			UPDATE ai_studio.invite_codes
			SET used_count = used_count + 1,
			    status = CASE WHEN used_count + 1 >= max_uses THEN 'exhausted' ELSE status END,
			    updated_at = $2
			WHERE UPPER(code) = $1 AND status = 'active' AND used_count < max_uses
			  AND (expires_at IS NULL OR expires_at > $2)
			RETURNING id
		`, strings.ToUpper(p.InviteCode), now).Scan(&inviteID)
		if err != nil {
			return nil, ErrInvalidInvite
		}
		redID, _ := ids.NewPrefixedID("invr")
		if _, rErr := tx.Exec(ctx, `
			INSERT INTO ai_studio.invite_code_redemptions (id, invite_code_id, user_id, redeemed_at, ip)
			VALUES ($1, $2, $3, $4, $5)
		`, redID, inviteID, userID, now, nullIfEmpty(p.IP)); rErr != nil {
			return nil, rErr
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &middleware.SessionUser{
		ID:          userID,
		UserNumber:  userID,
		Email:       emailPtr,
		Phone:       phonePtr,
		DisplayName: displayName,
		Role:        "user",
		Status:      "active",
		Locale:      locale,
		PlanID:      "free",
	}, nil
}

func (r *PGRepository) UpdateLoginAudit(ctx context.Context, userID, ip string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE auth_usr.users SET last_login_ip = COALESCE($2, last_login_ip), last_login_at = NOW(), updated_at = NOW() WHERE id = $1
	`, userID, nullIfEmpty(ip))
	return err
}

func (r *PGRepository) CreateSession(ctx context.Context, userID, rawToken, tokenHash string, expiresAt time.Time) (*SessionRecord, error) {
	if r == nil || r.Pool == nil {
		return &SessionRecord{Token: rawToken, TokenHash: tokenHash, UserID: userID, ExpiresAt: expiresAt}, nil
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO auth_usr.sessions (user_id, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, NOW())
	`, userID, tokenHash, expiresAt.UTC())
	if err != nil {
		return nil, err
	}
	return &SessionRecord{Token: rawToken, TokenHash: tokenHash, UserID: userID, ExpiresAt: expiresAt}, nil
}

func (r *PGRepository) RotateSession(ctx context.Context, oldTokenHash, nextRawToken, nextTokenHash string, nextExpiresAt time.Time) (*SessionRecord, string, error) {
	if r == nil || r.Pool == nil {
		return nil, "", errors.New("auth pg repo pool is nil")
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, "", err
	}
	defer tx.Rollback(ctx)

	var userID string
	var exp time.Time
	err = tx.QueryRow(ctx, `
		SELECT user_id, expires_at
		FROM auth_usr.sessions
		WHERE token_hash = $1 AND revoked_at IS NULL
		FOR UPDATE
	`, oldTokenHash).Scan(&userID, &exp)
	if errors.Is(err, pgx.ErrNoRows) || !exp.After(time.Now()) {
		return nil, "", nil
	}
	if err != nil {
		return nil, "", err
	}

	_, err = tx.Exec(ctx, `UPDATE auth_usr.sessions SET revoked_at = NOW() WHERE token_hash = $1`, oldTokenHash)
	if err != nil {
		return nil, "", err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO auth_usr.sessions (user_id, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, NOW())
	`, userID, nextTokenHash, nextExpiresAt.UTC())
	if err != nil {
		return nil, "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, "", err
	}
	return &SessionRecord{Token: nextRawToken, TokenHash: nextTokenHash, UserID: userID, ExpiresAt: nextExpiresAt}, userID, nil
}

func (r *PGRepository) RevokeSession(ctx context.Context, tokenHash string) error {
	if r == nil || r.Pool == nil || tokenHash == "" {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `UPDATE auth_usr.sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`, tokenHash)
	return err
}

func (r *PGRepository) RevokeAllUserSessions(ctx context.Context, userID string) error {
	if r == nil || r.Pool == nil || userID == "" {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `DELETE FROM auth_usr.sessions WHERE user_id = $1`, userID)
	return err
}

func (r *PGRepository) LastVerificationCodeIssuedAt(ctx context.Context, target, codeType string) (*time.Time, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	var ts time.Time
	err := r.Pool.QueryRow(ctx, `
		SELECT created_at FROM sys_core.auth_verification_codes
		WHERE target = $1 AND type = $2 AND used_at IS NULL AND expires_at > NOW()
		ORDER BY created_at DESC LIMIT 1
	`, target, codeType).Scan(&ts)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &ts, nil
}

func (r *PGRepository) ReplaceVerificationCode(ctx context.Context, id, target, codeHash, codeType string, expiresAt time.Time, requestIP string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `
		UPDATE sys_core.auth_verification_codes SET used_at = NOW()
		WHERE target = $1 AND type = $2 AND used_at IS NULL
	`, target, codeType)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO sys_core.auth_verification_codes (id, target, code, type, attempts, expires_at, used_at, created_at, request_ip)
		VALUES ($1, $2, $3, $4, 0, $5, NULL, NOW(), $6)
	`, id, target, codeHash, codeType, expiresAt.UTC(), nullIfEmpty(requestIP))
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PGRepository) FindLatestVerificationCode(ctx context.Context, target, codeType string) (*VerificationCodeRecord, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	var rec VerificationCodeRecord
	err := r.Pool.QueryRow(ctx, `
		SELECT id, target, code, type, attempts, expires_at, used_at, created_at
		FROM sys_core.auth_verification_codes
		WHERE target = $1 AND type = $2
		ORDER BY created_at DESC LIMIT 1
	`, target, codeType).Scan(
		&rec.ID, &rec.Target, &rec.CodeHash, &rec.Type, &rec.Attempts, &rec.ExpiresAt, &rec.UsedAt, &rec.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *PGRepository) IncrementVerificationAttempts(ctx context.Context, id string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE sys_core.auth_verification_codes SET attempts = attempts + 1 WHERE id = $1 AND used_at IS NULL
	`, id)
	return err
}

func (r *PGRepository) MarkVerificationCodeUsed(ctx context.Context, id string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE sys_core.auth_verification_codes SET used_at = NOW() WHERE id = $1 AND used_at IS NULL
	`, id)
	return err
}

func (r *PGRepository) FindResetUserByEmail(ctx context.Context, email string) (*ResetUserRecord, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	var rec ResetUserRecord
	err := r.Pool.QueryRow(ctx, `
		SELECT u.id, COALESCE(u.user_number, u.id), u.email, u.phone, u.username, COALESCE(u.status, 'active')
		FROM auth_usr.users u
		WHERE LOWER(u.email) = $1
		   OR EXISTS (
			 SELECT 1 FROM auth_usr.auth_accounts a
			 WHERE a.user_id = u.id AND a.provider = 'email' AND LOWER(a.provider_user_id) = $1
		   )
		ORDER BY (LOWER(u.email) = $1) DESC
		LIMIT 1
	`, NormalizeEmail(email)).Scan(&rec.ID, &rec.UserNumber, &rec.Email, &rec.Phone, &rec.Username, &rec.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &rec, err
}

func (r *PGRepository) FindResetUserByPhone(ctx context.Context, phone string) (*ResetUserRecord, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	var rec ResetUserRecord
	err := r.Pool.QueryRow(ctx, `
		SELECT id, COALESCE(user_number, id), email, phone, username, COALESCE(status, 'active')
		FROM auth_usr.users
		WHERE phone = $1 AND phone_verified_at IS NOT NULL
		LIMIT 1
	`, phone).Scan(&rec.ID, &rec.UserNumber, &rec.Email, &rec.Phone, &rec.Username, &rec.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &rec, err
}

func (r *PGRepository) SetUserPassword(ctx context.Context, userID, passwordHash, passwordSalt string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `UPDATE auth_usr.users SET password_hash = $1, password_salt = $2, updated_at = NOW() WHERE id = $3`, passwordHash, passwordSalt, userID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE auth_usr.auth_accounts SET password_hash = $1, password_salt = $2, updated_at = NOW() WHERE user_id = $3 AND provider = 'email'`, passwordHash, passwordSalt, userID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PGRepository) UpsertPhoneUserAndVerify(ctx context.Context, phone, countryCode, ip, locale string) (*middleware.SessionUser, error) {
	if r == nil || r.Pool == nil {
		return nil, errors.New("auth pg repo pool is nil")
	}
	var userID, userNumber, displayName, role, status, userLocale string
	var emailPtr, phonePtr, avatarPtr *string
	var credits int64
	err := r.Pool.QueryRow(ctx, `
		SELECT id, COALESCE(user_number, id), email, phone,
		       COALESCE(NULLIF(display_name, ''), '创作者#' || id),
		       avatar_url, COALESCE(role, 'user'), COALESCE(status, 'active'),
		       COALESCE(NULLIF(locale, ''), 'zh-CN'), COALESCE(credits, 0)::bigint
		FROM auth_usr.users
		WHERE phone = $1
		LIMIT 1
	`, phone).Scan(&userID, &userNumber, &emailPtr, &phonePtr, &displayName, &avatarPtr, &role, &status, &userLocale, &credits)
	if err == nil {
		_, _ = r.Pool.Exec(ctx, `
			UPDATE auth_usr.users
			SET phone_verified_at = COALESCE(phone_verified_at, NOW()), last_login_ip = COALESCE($2, last_login_ip), last_login_at = NOW(), updated_at = NOW()
			WHERE id = $1
		`, userID, nullIfEmpty(ip))
		return &middleware.SessionUser{
			ID:          userID,
			UserNumber:  userNumber,
			Email:       emailPtr,
			Phone:       phonePtr,
			DisplayName: displayName,
			AvatarURL:   avatarPtr,
			Role:        role,
			Status:      status,
			Locale:      userLocale,
			Credits:     credits,
			PlanID:      "free",
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	u, err := r.CreateUser(ctx, CreateUserParams{
		Phone:              phone,
		PhoneCountryCode:   countryCode,
		Locale:             locale,
		RegistrationSource: "web_phone",
		IP:                 ip,
	})
	if err != nil {
		return nil, err
	}
	_, _ = r.Pool.Exec(ctx, `UPDATE auth_usr.users SET phone_verified_at = NOW() WHERE id = $1`, u.ID)
	return u, nil
}

func (r *PGRepository) BindUserPhone(ctx context.Context, userID, phone, countryCode string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	var owner string
	err := r.Pool.QueryRow(ctx, `SELECT id FROM auth_usr.users WHERE phone = $1 AND id <> $2 LIMIT 1`, phone, userID).Scan(&owner)
	if err == nil {
		return ErrPhoneBound
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	_, err = r.Pool.Exec(ctx, `
		UPDATE auth_usr.users
		SET phone = $1, phone_country_code = $2, phone_verified_at = NOW(), updated_at = NOW()
		WHERE id = $3
	`, phone, countryCode, userID)
	return err
}

type oauthFlowPayload struct {
	ID           string `json:"id"`
	Provider     string `json:"provider"`
	Mode         string `json:"mode"`
	Status       string `json:"status"`
	State        string `json:"state"`
	CodeVerifier string `json:"codeVerifier,omitempty"`
	ReturnTo     string `json:"returnTo"`
	ReturnOrigin string `json:"returnOrigin,omitempty"`
	ProviderUID  string `json:"providerUserId,omitempty"`
	Email        string `json:"email,omitempty"`
	DisplayName  string `json:"displayName,omitempty"`
	AvatarURL    string `json:"avatarUrl,omitempty"`
	UserID       string `json:"userId,omitempty"`
}

func oauthFlowToPayload(f OAuthFlowRecord) ([]byte, string, string) {
	kind := "state"
	keyToken := f.State
	if f.Status == "onboarding" || f.Mode == "onboarding" {
		kind = "onboarding"
		keyToken = f.ID
	} else if f.Mode == "step_up" {
		kind = "step_up"
		keyToken = f.ID
	}
	if strings.TrimSpace(keyToken) == "" {
		keyToken = f.ID
	}
	p := oauthFlowPayload{
		ID:           f.ID,
		Provider:     f.Provider,
		Mode:         f.Mode,
		Status:       f.Status,
		State:        f.State,
		CodeVerifier: f.CodeVerifier,
		ReturnTo:     f.ReturnTo,
		ReturnOrigin: f.ReturnOrigin,
		ProviderUID:  f.ProviderUID,
		Email:        f.Email,
		DisplayName:  f.DisplayName,
		AvatarURL:    f.AvatarURL,
		UserID:       f.UserID,
	}
	b, _ := json.Marshal(p)
	return b, kind, HashSessionToken(keyToken)
}

func (r *PGRepository) CreateOAuthFlow(ctx context.Context, f OAuthFlowRecord) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	_, _ = r.Pool.Exec(ctx, `DELETE FROM auth_usr.oauth_flows WHERE expires_at < NOW() - INTERVAL '1 day'`)
	payloadBytes, kind, tokHash := oauthFlowToPayload(f)
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO auth_usr.oauth_flows (token_hash, kind, payload, expires_at)
		VALUES ($1, $2, $3::jsonb, $4)
		ON CONFLICT (token_hash) DO UPDATE
		SET kind = EXCLUDED.kind, payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at, consumed_at = NULL
	`, tokHash, kind, string(payloadBytes), f.ExpiresAt.UTC())
	return err
}

func (r *PGRepository) FindOAuthFlowByID(ctx context.Context, id string) (*OAuthFlowRecord, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	return r.scanOAuthFlow(ctx, `WHERE (token_hash = $1 OR payload->>'id' = $2) AND consumed_at IS NULL`, HashSessionToken(id), id)
}

func (r *PGRepository) FindOAuthFlowByState(ctx context.Context, state string) (*OAuthFlowRecord, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	return r.scanOAuthFlow(ctx, `WHERE (token_hash = $1 OR payload->>'state' = $2) AND kind = 'state' AND consumed_at IS NULL`, HashSessionToken(state), state)
}

func (r *PGRepository) scanOAuthFlow(ctx context.Context, where string, arg1, arg2 string) (*OAuthFlowRecord, error) {
	var raw []byte
	var expiresAt time.Time
	err := r.Pool.QueryRow(ctx, `
		SELECT payload, expires_at
		FROM auth_usr.oauth_flows `+where+`
		ORDER BY expires_at DESC
		LIMIT 1
	`, arg1, arg2).Scan(&raw, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var p oauthFlowPayload
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &p)
	}
	ret := p.ReturnTo
	if ret == "" {
		ret = "/"
	}
	return &OAuthFlowRecord{
		ID:           p.ID,
		Provider:     p.Provider,
		Mode:         p.Mode,
		Status:       p.Status,
		State:        p.State,
		CodeVerifier: p.CodeVerifier,
		ReturnTo:     ret,
		ReturnOrigin: p.ReturnOrigin,
		ProviderUID:  p.ProviderUID,
		Email:        p.Email,
		DisplayName:  p.DisplayName,
		AvatarURL:    p.AvatarURL,
		UserID:       p.UserID,
		ExpiresAt:    expiresAt,
	}, nil
}

func (r *PGRepository) UpdateOAuthFlow(ctx context.Context, f OAuthFlowRecord) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	payloadBytes, _, tokHash := oauthFlowToPayload(f)
	consumed := f.Status == "completed" || f.Status == "consumed"
	_, err := r.Pool.Exec(ctx, `
		UPDATE auth_usr.oauth_flows
		SET payload = $2::jsonb,
		    consumed_at = CASE WHEN $3 THEN COALESCE(consumed_at, NOW()) ELSE consumed_at END
		WHERE token_hash = $1 OR payload->>'id' = $4 OR (payload->>'state' = $5 AND $5 <> '')
	`, tokHash, string(payloadBytes), consumed, f.ID, f.State)
	return err
}

func (r *PGRepository) FindOrCreateOAuthUser(ctx context.Context, provider, providerUID, email, username, displayName, avatarURL, locale, ip string, autoCreate bool) (*middleware.SessionUser, bool, error) {
	if r == nil || r.Pool == nil {
		return nil, false, errors.New("auth pg repo pool is nil")
	}
	var userID string
	err := r.Pool.QueryRow(ctx, `
		SELECT user_id FROM auth_usr.auth_accounts WHERE provider = $1 AND provider_user_id = $2 LIMIT 1
	`, provider, providerUID).Scan(&userID)
	if err == nil {
		u, uErr := r.loadSessionUserByID(ctx, userID)
		return u, false, uErr
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, err
	}

	if email != "" {
		err = r.Pool.QueryRow(ctx, `SELECT id FROM auth_usr.users WHERE LOWER(email) = $1 LIMIT 1`, NormalizeEmail(email)).Scan(&userID)
		if err == nil {
			accID, _ := ids.NewPrefixedID("acc")
			_, _ = r.Pool.Exec(ctx, `
				INSERT INTO auth_usr.auth_accounts (id, user_id, provider, provider_user_id, provider_email, provider_username, provider_email_verified, oauth_confirmed_at, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW(), NOW())
				ON CONFLICT (provider, provider_user_id) DO NOTHING
			`, accID, userID, provider, providerUID, email, nullIfEmpty(username))
			u, uErr := r.loadSessionUserByID(ctx, userID)
			return u, false, uErr
		}
	}

	if !autoCreate {
		return nil, false, ErrUserNotFound
	}

	u, err := r.CreateUser(ctx, CreateUserParams{
		Email:              email,
		DisplayName:        displayName,
		Locale:             locale,
		RegistrationSource: "oauth_" + provider,
		IP:                 ip,
		EmailVerified:      email != "",
	})
	if err != nil {
		return nil, false, err
	}
	accID, _ := ids.NewPrefixedID("acc")
	_, _ = r.Pool.Exec(ctx, `
		INSERT INTO auth_usr.auth_accounts (id, user_id, provider, provider_user_id, provider_email, provider_username, provider_email_verified, oauth_confirmed_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW(), NOW())
		ON CONFLICT (provider, provider_user_id) DO NOTHING
	`, accID, u.ID, provider, providerUID, nullIfEmpty(email), nullIfEmpty(username))
	if avatarURL != "" {
		_, _ = r.Pool.Exec(ctx, `UPDATE auth_usr.users SET avatar_url = COALESCE(avatar_url, $2) WHERE id = $1`, u.ID, avatarURL)
		u.AvatarURL = &avatarURL
	}
	return u, true, nil
}

func (r *PGRepository) loadSessionUserByID(ctx context.Context, userID string) (*middleware.SessionUser, error) {
	var u middleware.SessionUser
	err := r.Pool.QueryRow(ctx, `
		SELECT id, COALESCE(user_number, id), email, phone,
		       COALESCE(NULLIF(display_name, ''), '创作者#' || id),
		       avatar_url, COALESCE(role, 'user'), COALESCE(status, 'active'),
		       COALESCE(NULLIF(locale, ''), 'en'), COALESCE(credits, 0)::bigint,
		       COALESCE(onboarding_completed, false), COALESCE(onboarding_step, 0)
		FROM auth_usr.users WHERE id = $1 LIMIT 1
	`, userID).Scan(
		&u.ID, &u.UserNumber, &u.Email, &u.Phone, &u.DisplayName, &u.AvatarURL,
		&u.Role, &u.Status, &u.Locale, &u.Credits, &u.OnboardingOK, &u.OnboardingStp,
	)
	if err != nil {
		return nil, err
	}
	u.PlanID = "free"
	return &u, nil
}

func (r *PGRepository) RecordAuthEvent(ctx context.Context, userID, eventType, ip, details string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	id, _ := ids.NewPrefixedID("act")
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO sys_core.user_activity_logs (id, user_id, event_category, event_action, metadata_json, ip, created_at)
		VALUES ($1, $2, 'auth', $3, $4::jsonb, $5, NOW())
	`, id, nullIfEmpty(userID), eventType, jsonStringOrEmpty(details), nullIfEmpty(ip))
	return err
}

func nullIfEmpty(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	v := strings.TrimSpace(s)
	return &v
}

func jsonStringOrEmpty(s string) string {
	if strings.TrimSpace(s) == "" {
		return "{}"
	}
	b, _ := json.Marshal(map[string]string{"detail": s})
	return string(b)
}
