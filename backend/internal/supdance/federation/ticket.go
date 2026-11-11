// Package federation authenticates narrowly scoped, short-lived messages between
// the main site and ONE. Browser cookies and passwords never cross sites.
package federation

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"
)

var ErrInvalidTicket = errors.New("invalid federation ticket")

type Ticket struct {
	Version         int    `json:"version"`
	Issuer          string `json:"issuer"`
	Audience        string `json:"audience"`
	Purpose         string `json:"purpose"`
	Nonce           string `json:"nonce"`
	OneUserID       string `json:"oneUserId"`
	MainUserID      string `json:"mainUserId,omitempty"`
	MainDisplayName string `json:"mainDisplayName,omitempty"`
	AssetID         string `json:"assetId,omitempty"`
	IssuedAt        int64  `json:"issuedAt"`
	ExpiresAt       int64  `json:"expiresAt"`
}

func valid(t Ticket, issuer, audience, purpose string, now time.Time) bool {
	for _, r := range t.Nonce {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-') {
			return false
		}
	}
	if purpose != "link-request" && purpose != "identity-assertion" && purpose != "wallet-read" && purpose != "login-request" && purpose != "login-assertion" && purpose != "asset-list" && purpose != "asset-read" {
		return false
	}
	maxTTL := int64(300)
	if purpose == "wallet-read" || purpose == "asset-list" || purpose == "asset-read" {
		maxTTL = 30
	}
	if purpose == "asset-read" {
		if strings.TrimSpace(t.AssetID) == "" || len(t.AssetID) > 80 {
			return false
		}
	} else if t.AssetID != "" {
		return false
	}
	if t.Version != 1 || t.Issuer != issuer || t.Audience != audience || t.Purpose != purpose ||
		len(t.Nonce) < 32 || len(t.Nonce) > 128 || len(t.OneUserID) > 120 ||
		t.IssuedAt > now.Unix()+5 || t.ExpiresAt <= now.Unix() || t.ExpiresAt <= t.IssuedAt || t.ExpiresAt-t.IssuedAt > maxTTL {
		return false
	}
	if purpose == "login-request" {
		return t.OneUserID == "" && t.MainUserID == "" && t.MainDisplayName == ""
	}
	if purpose != "login-assertion" && strings.TrimSpace(t.OneUserID) == "" {
		return false
	}
	if purpose == "login-assertion" && t.OneUserID != "" {
		return false
	}
	if purpose == "link-request" {
		return t.MainUserID == "" && t.MainDisplayName == ""
	}
	return t.MainUserID != "" && len(t.MainUserID) <= 120 && len(t.MainDisplayName) <= 256
}

func Sign(privateKey ed25519.PrivateKey, ticket Ticket, now time.Time) (string, error) {
	if len(privateKey) != ed25519.PrivateKeySize || !valid(ticket, ticket.Issuer, ticket.Audience, ticket.Purpose, now) {
		return "", ErrInvalidTicket
	}
	payload, err := json.Marshal(ticket)
	if err != nil {
		return "", err
	}
	encoded := "SD1." + base64.RawURLEncoding.EncodeToString(payload)
	return encoded + "." + base64.RawURLEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(encoded))), nil
}

func Verify(publicKey ed25519.PublicKey, value, issuer, audience, purpose string, now time.Time) (Ticket, error) {
	var ticket Ticket
	if len(publicKey) != ed25519.PublicKeySize || len(value) > 4096 {
		return ticket, ErrInvalidTicket
	}
	parts := strings.Split(value, ".")
	if len(parts) != 3 || parts[0] != "SD1" {
		return ticket, ErrInvalidTicket
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return ticket, ErrInvalidTicket
	}
	if !ed25519.Verify(publicKey, []byte(parts[0]+"."+parts[1]), signature) {
		return ticket, ErrInvalidTicket
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ticket, ErrInvalidTicket
	}
	decoder := json.NewDecoder(strings.NewReader(string(payload)))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&ticket) != nil || decoder.Decode(new(any)) != io.EOF || !valid(ticket, issuer, audience, purpose, now) {
		return Ticket{}, ErrInvalidTicket
	}
	return ticket, nil
}
