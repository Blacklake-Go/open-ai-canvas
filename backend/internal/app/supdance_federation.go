package app

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/pem"
	"os"
	"strings"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/federation"
)

func federationUserAllowed(userID string) bool {
	if os.Getenv("CANVAS_SUPDANCE_FEDERATION_ENABLED") != "true" {
		return false
	}
	for _, id := range strings.Split(os.Getenv("CANVAS_SUPDANCE_FEDERATION_USER_IDS"), ",") {
		if strings.TrimSpace(id) == userID {
			return userID != ""
		}
	}
	return false
}

func federationPublicKey() (ed25519.PublicKey, error) {
	data, err := os.ReadFile(os.Getenv("CANVAS_FEDERATION_ONE_PUBLIC_KEY_FILE"))
	if err != nil {
		return nil, Forbidden("跨站账户服务尚未配置")
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, Forbidden("跨站账户服务配置无效")
	}
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, Forbidden("跨站账户服务配置无效")
	}
	key, ok := parsed.(ed25519.PublicKey)
	if !ok {
		return nil, Forbidden("跨站账户服务配置无效")
	}
	return key, nil
}

func federationPrivateKey() (ed25519.PrivateKey, error) {
	data, err := os.ReadFile(os.Getenv("CANVAS_FEDERATION_PRIVATE_KEY_FILE"))
	if err != nil {
		return nil, Forbidden("跨站账户服务尚未配置")
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, Forbidden("跨站账户服务配置无效")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, Forbidden("跨站账户服务配置无效")
	}
	key, ok := parsed.(ed25519.PrivateKey)
	if !ok {
		return nil, Forbidden("跨站账户服务配置无效")
	}
	return key, nil
}

func (s *Service) FederationLinkRequest(user *model.User, request string) (federation.Ticket, error) {
	if user == nil || !federationUserAllowed(user.ID) {
		return federation.Ticket{}, Forbidden("跨站账户连接尚未向此账户开放")
	}
	key, err := federationPublicKey()
	if err != nil {
		return federation.Ticket{}, err
	}
	ticket, err := federation.Verify(key, request, "one", "main", "link-request", time.Now())
	if err != nil {
		ticket, err = federation.Verify(key, request, "one", "main", "login-request", time.Now())
	}
	if err != nil {
		return federation.Ticket{}, BadAuthRequest("连接请求无效或已过期，请从 ONE 重新发起")
	}
	return ticket, nil
}

func (s *Service) AuthorizeFederationLink(user *model.User, cookie, password, request string) (string, error) {
	ticket, err := s.FederationLinkRequest(user, request)
	if err != nil {
		return "", err
	}
	if ticket.Purpose == "link-request" {
		if err := s.authDomain().VerifyProfileOwnership(user, cookie, password); err != nil {
			return "", err
		}
	} else if err := s.authDomain().VerifyProfileSession(user, cookie); err != nil {
		return "", err
	}
	key, err := federationPrivateKey()
	if err != nil {
		return "", err
	}
	now := time.Now()
	assertionPurpose := "identity-assertion"
	if ticket.Purpose == "login-request" {
		assertionPurpose = "login-assertion"
	}
	ticket.Issuer, ticket.Audience, ticket.Purpose = "main", "one", assertionPurpose
	ticket.MainUserID, ticket.MainDisplayName = user.ID, user.DisplayName
	ticket.IssuedAt, ticket.ExpiresAt = now.Unix(), now.Add(time.Minute).Unix()
	return federation.Sign(key, ticket, now)
}

// FederationWallet is read-only. The signed request identifies a verified link
// held by ONE; no legacy balance is silently credited or repriced here.
func (s *Service) FederationWallet(proof string) (*WalletSummary, error) {
	user, _, err := s.federationProofUser(proof, "wallet-read")
	if err != nil {
		return nil, err
	}
	accounts, err := s.repo.CreditAccounts([]string{user.ID})
	if err != nil {
		return nil, err
	}
	if len(accounts) != 1 {
		return nil, Forbidden("主站钱包尚未建立，请先在主站打开账户")
	}
	return s.Wallet(user, "", 1, 30)
}

func (s *Service) federationProofUser(proof, purpose string) (*model.User, federation.Ticket, error) {
	if os.Getenv("CANVAS_SUPDANCE_FEDERATION_ENABLED") != "true" {
		return nil, federation.Ticket{}, Forbidden("跨站账户连接尚未开放")
	}
	key, err := federationPublicKey()
	if err != nil {
		return nil, federation.Ticket{}, err
	}
	ticket, err := federation.Verify(key, proof, "one", "main", purpose, time.Now())
	if err != nil {
		return nil, federation.Ticket{}, Unauthorized("跨站请求无效或已过期")
	}
	if !federationUserAllowed(ticket.MainUserID) {
		return nil, federation.Ticket{}, Forbidden("跨站账户连接尚未向此账户开放")
	}
	user, err := s.repo.User(ticket.MainUserID)
	if err != nil {
		return nil, federation.Ticket{}, err
	}
	if user.Status != model.UserStatusActive {
		return nil, federation.Ticket{}, Forbidden("该账号已被禁用")
	}
	return user, ticket, nil
}
