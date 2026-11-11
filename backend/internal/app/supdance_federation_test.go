package app

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"yingce/backend/internal/auth"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/federation"
)

func TestSupDanceFederationRequiresCurrentOwnerAndKeepsWalletReadOnly(t *testing.T) {
	svc, db := newChannelModelTestService(t)
	if err := db.AutoMigrate(&model.AuthSession{}, &model.CreditAccount{}, &model.CreditLedgerEntry{}, &model.Asset{}, &model.Resource{}); err != nil {
		t.Fatal(err)
	}
	hash, err := auth.HashPassword("fixture-owner-password")
	if err != nil {
		t.Fatal(err)
	}
	user := &model.User{ID: "federation-main", Username: "federation-main", DisplayName: "Creator", Status: model.UserStatusActive, PasswordHash: hash}
	missingWalletUser := &model.User{ID: "federation-no-wallet", Username: "federation-no-wallet", Status: model.UserStatusActive}
	if err := db.Create(user).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(missingWalletUser).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.AuthSession{ID: "owner-session", UserID: user.ID, TokenHash: auth.HashToken("session-token"), ExpiresAt: time.Now().Add(time.Hour)}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.CreditAccount{UserID: user.ID, AvailableMicrocredits: 12_345_000, ReservedMicrocredits: 0}).Error; err != nil {
		t.Fatal(err)
	}
	onePublic, onePrivate, _ := ed25519.GenerateKey(rand.Reader)
	mainPublic, mainPrivate, _ := ed25519.GenerateKey(rand.Reader)
	publicDER, _ := x509.MarshalPKIXPublicKey(onePublic)
	privateDER, _ := x509.MarshalPKCS8PrivateKey(mainPrivate)
	dir := t.TempDir()
	publicPath, privatePath := filepath.Join(dir, "one-public.pem"), filepath.Join(dir, "main-private.pem")
	if err := os.WriteFile(publicPath, pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER}), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(privatePath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateDER}), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CANVAS_SUPDANCE_FEDERATION_ENABLED", "true")
	t.Setenv("CANVAS_SUPDANCE_FEDERATION_USER_IDS", user.ID+","+missingWalletUser.ID)
	t.Setenv("CANVAS_FEDERATION_ONE_PUBLIC_KEY_FILE", publicPath)
	t.Setenv("CANVAS_FEDERATION_PRIVATE_KEY_FILE", privatePath)
	now := time.Now()
	ticket := federation.Ticket{Version: 1, Issuer: "one", Audience: "main", Purpose: "link-request", Nonce: strings.Repeat("n", 43), OneUserID: "one-user", IssuedAt: now.Unix(), ExpiresAt: now.Add(time.Minute).Unix()}
	request, err := federation.Sign(onePrivate, ticket, now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AuthorizeFederationLink(user, "owner-session.session-token", "wrong", request); err == nil {
		t.Fatal("wrong password authorized identity link")
	}
	if _, err := svc.AuthorizeFederationLink(user, "another-session.session-token", "fixture-owner-password", request); err == nil {
		t.Fatal("another session authorized identity link")
	}
	assertion, err := svc.AuthorizeFederationLink(user, "owner-session.session-token", "fixture-owner-password", request)
	if err != nil {
		t.Fatal(err)
	}
	verified, err := federation.Verify(mainPublic, assertion, "main", "one", "identity-assertion", time.Now())
	if err != nil || verified.MainUserID != user.ID || verified.Nonce != ticket.Nonce {
		t.Fatalf("incorrect signed identity: %+v %v", verified, err)
	}
	if _, err := federation.Verify(onePublic, assertion, "main", "one", "identity-assertion", time.Now()); err == nil {
		t.Fatal("ONE key could verify a main identity assertion")
	}
	loginTicket := federation.Ticket{Version: 1, Issuer: "one", Audience: "main", Purpose: "login-request", Nonce: strings.Repeat("s", 43), OneUserID: "", IssuedAt: now.Unix(), ExpiresAt: now.Add(time.Minute).Unix()}
	loginRequest, _ := federation.Sign(onePrivate, loginTicket, now)
	if _, err := svc.AuthorizeFederationLink(user, "invalid-session", "", loginRequest); err == nil {
		t.Fatal("SSO accepted an invalid current session")
	}
	loginProof, err := svc.AuthorizeFederationLink(user, "owner-session.session-token", "", loginRequest)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := federation.Verify(mainPublic, loginProof, "main", "one", "login-assertion", time.Now()); err != nil {
		t.Fatal(err)
	}
	ticket.Purpose, ticket.MainUserID, ticket.ExpiresAt = "wallet-read", user.ID, now.Add(30*time.Second).Unix()
	proof, _ := federation.Sign(onePrivate, ticket, now)
	wallet, err := svc.FederationWallet(proof)
	if err != nil || wallet.Account.AvailableMicrocredits != 12_345_000 {
		t.Fatalf("wallet read: %+v %v", wallet, err)
	}
	resource := &model.Resource{ID: "community-resource", UserID: user.ID, Kind: "image", Status: model.ResourceStatusReady, MimeType: "image/png", ObjectKey: "private/test.png", PublicURL: "https://private.example/must-not-leak"}
	if err := db.Create(resource).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.Asset{ID: "community-asset", UserID: user.ID, Kind: "image", Status: "confirmed", Title: "Owned work", PayloadJSON: `{"data":{"storageKey":"resource:community-resource"}}`}).Error; err != nil {
		t.Fatal(err)
	}
	ticket.Purpose = "asset-list"
	assetProof, _ := federation.Sign(onePrivate, ticket, now)
	items, err := svc.FederationAssets(assetProof)
	if err != nil || len(items) != 1 || items[0].ID != "community-asset" {
		t.Fatalf("owned asset list: %+v %v", items, err)
	}
	ticket.Purpose, ticket.AssetID = "asset-read", "community-asset"
	assetProof, _ = federation.Sign(onePrivate, ticket, now)
	item, delivery, err := svc.FederationAsset(assetProof, "", true)
	if err != nil || delivery != nil || item.MainUserID != user.ID {
		t.Fatalf("asset metadata: %+v %v", item, err)
	}
	ticket.MainUserID = missingWalletUser.ID
	assetProof, _ = federation.Sign(onePrivate, ticket, now)
	if _, _, err := svc.FederationAsset(assetProof, "", true); err == nil {
		t.Fatal("another user read private asset")
	}
	ticket.AssetID, ticket.Purpose = "", "wallet-read"
	ticket.MainUserID = missingWalletUser.ID
	proof, _ = federation.Sign(onePrivate, ticket, now)
	if _, err := svc.FederationWallet(proof); err == nil {
		t.Fatal("missing wallet was silently created")
	}
	var count int64
	db.Model(&model.CreditAccount{}).Count(&count)
	if count != 1 {
		t.Fatalf("read changed account count: %d", count)
	}
	db.Model(&model.CreditLedgerEntry{}).Count(&count)
	if count != 0 {
		t.Fatal("identity link wrote a credit ledger entry")
	}
	t.Setenv("CANVAS_SUPDANCE_FEDERATION_ENABLED", "false")
	if _, err := svc.FederationLinkRequest(user, request); err == nil {
		t.Fatal("disabled rollout accepted request")
	}
}
