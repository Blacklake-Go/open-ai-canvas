package auth

import (
	"bytes"
	"crypto"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"github.com/emersion/go-msgauth/dkim"
	"net/mail"
	"os"
	"regexp"
	"strconv"
	"strings"
)

var dkimSelectorPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,63}$`)

// Local signing guarantees the RFC 8058 headers are covered; provider re-signing is not assumed.
func marketingDKIMOptions(from string) (*dkim.SignOptions, error) {
	address, err := mail.ParseAddress(from)
	if err != nil {
		return nil, errors.New("invalid DKIM From")
	}
	_, domain, ok := strings.Cut(address.Address, "@")
	if !ok {
		return nil, errors.New("invalid DKIM domain")
	}
	selector := os.Getenv("CANVAS_EMAIL_DKIM_SELECTOR")
	if !dkimSelectorPattern.MatchString(selector) {
		return nil, errors.New("marketing DKIM selector is not configured")
	}
	path := os.Getenv("CANVAS_EMAIL_DKIM_KEY_FILE")
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm()&0077 != 0 {
		return nil, errors.New("marketing DKIM key must exist with restricted file permissions")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.New("cannot read marketing DKIM key")
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("invalid marketing DKIM key")
	}
	var key any
	if block.Type == "RSA PRIVATE KEY" {
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	} else {
		key, err = x509.ParsePKCS8PrivateKey(block.Bytes)
	}
	if err != nil {
		return nil, errors.New("invalid marketing DKIM key")
	}
	signer, ok := key.(crypto.Signer)
	if !ok {
		return nil, errors.New("unsupported marketing DKIM key")
	}
	return &dkim.SignOptions{Domain: domain, Selector: selector, Signer: signer, HeaderCanonicalization: dkim.CanonicalizationRelaxed, BodyCanonicalization: dkim.CanonicalizationRelaxed, HeaderKeys: []string{"From", "To", "Subject", "Date", "Message-ID", "MIME-Version", "Content-Type", "List-Unsubscribe", "List-Unsubscribe-Post"}}, nil
}

func SignMarketingMIME(from string, raw []byte) ([]byte, error) {
	options, err := marketingDKIMOptions(from)
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	if err := dkim.Sign(&output, bytes.NewReader(raw), options); err != nil {
		return nil, errors.New("marketing DKIM signing failed")
	}
	return output.Bytes(), nil
}
func MarketingDKIMConfigured(from string) bool {
	_, err := marketingDKIMOptions(from)
	return err == nil
}

func MarketingDailyLimit() int {
	limit, err := strconv.Atoi(os.Getenv("CANVAS_EMAIL_MARKETING_DAILY_LIMIT"))
	if err != nil || limit < 1 || limit > 100000 {
		return 0
	}
	return limit
}
func MarketingDeliveryReady(from string) bool {
	return os.Getenv("CANVAS_EMAIL_CENTER_SAFE_MODE") != "true" && os.Getenv("CANVAS_EMAIL_MARKETING_ENABLED") == "true" && MarketingDailyLimit() > 0 && MarketingDKIMConfigured(from)
}
