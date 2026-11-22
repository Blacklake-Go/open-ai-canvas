package auth

import (
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"math/big"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/pbkdf2"
	"golang.org/x/crypto/scrypt"
)

const (
	scryptN      = 16384
	scryptR      = 8
	scryptP      = 1
	scryptKeyLen = 64
)

var (
	digitsOnlyRe = regexp.MustCompile(`[^\d+]`)
	e164Re       = regexp.MustCompile(`^\+[1-9]\d{6,14}$`)
	sixDigitRe   = regexp.MustCompile(`^\d{6}$`)
)

// HashPassword produces a Node crypto.scryptSync(password, salt, 64).toString('hex')
// compatible 128-char hex digest and 32-char hex salt.
func HashPassword(password string) (digestHex string, saltHex string, err error) {
	saltBytes := make([]byte, 16)
	if _, err = rand.Read(saltBytes); err != nil {
		return "", "", err
	}
	saltHex = hex.EncodeToString(saltBytes)
	dk, err := scrypt.Key([]byte(password), []byte(saltHex), scryptN, scryptR, scryptP, scryptKeyLen)
	if err != nil {
		return "", "", err
	}
	return hex.EncodeToString(dk), saltHex, nil
}

// VerifyPassword verifies Node scryptSync hex digests and legacy pbkdf2 formats.
func VerifyPassword(password, storedHash, salt string) bool {
	if password == "" || storedHash == "" {
		return false
	}
	if strings.HasPrefix(storedHash, "pbkdf2$") || strings.HasPrefix(storedHash, "pbkdf2:") {
		return verifyPBKDF2Password(password, storedHash, salt)
	}
	if salt == "" {
		return false
	}
	expectedBytes, err := hex.DecodeString(strings.TrimSpace(storedHash))
	if err != nil || len(expectedBytes) == 0 {
		return false
	}
	dk, err := scrypt.Key([]byte(password), []byte(salt), scryptN, scryptR, scryptP, len(expectedBytes))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(dk, expectedBytes) == 1
}

func verifyPBKDF2Password(password, storedHash, fallbackSalt string) bool {
	sep := "$"
	if strings.HasPrefix(storedHash, "pbkdf2:") {
		sep = ":"
	}
	parts := strings.Split(storedHash, sep)
	// Supported shapes:
	// pbkdf2$sha256$100000$salt$hexhash
	// pbkdf2$sha512$10000$hexhash (salt from column)
	if len(parts) < 4 {
		return false
	}
	algo := strings.ToLower(parts[1])
	iter, err := strconv.Atoi(parts[2])
	if err != nil || iter <= 0 {
		return false
	}
	var saltStr, hashStr string
	if len(parts) >= 5 {
		saltStr = parts[3]
		hashStr = parts[4]
	} else {
		saltStr = fallbackSalt
		hashStr = parts[3]
	}
	if saltStr == "" || hashStr == "" {
		return false
	}
	var hFn func() hash.Hash
	switch algo {
	case "sha256":
		hFn = sha256.New
	case "sha512":
		hFn = sha512.New
	default:
		return false
	}
	expectedBytes, err := hex.DecodeString(hashStr)
	if err != nil {
		expectedBytes, err = base64.StdEncoding.DecodeString(hashStr)
		if err != nil || len(expectedBytes) == 0 {
			return false
		}
	}
	dk := pbkdf2.Key([]byte(password), []byte(saltStr), iter, len(expectedBytes), hFn)
	return subtle.ConstantTimeCompare(dk, expectedBytes) == 1
}

func HashSessionToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

func GenerateRandomHex(numBytes int) string {
	b := make([]byte, numBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func GenerateNumericOTP(digits int) string {
	if digits <= 0 {
		digits = 6
	}
	b := make([]byte, digits)
	_, _ = rand.Read(b)
	out := make([]byte, digits)
	for i := 0; i < digits; i++ {
		out[i] = '0' + (b[i] % 10)
	}
	return string(out)
}

func HashVerificationCode(secret, target, codeType, code string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strings.ToLower(strings.TrimSpace(target)) + ":" + codeType + ":" + strings.TrimSpace(code)))
	return hex.EncodeToString(mac.Sum(nil))
}

func VerifyVerificationCode(secret, target, codeType, inputCode, storedHash string) bool {
	if storedHash == "" || inputCode == "" {
		return false
	}
	expected := HashVerificationCode(secret, target, codeType, inputCode)
	return subtle.ConstantTimeCompare([]byte(expected), []byte(storedHash)) == 1
}

func NormalizeEmail(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func IsValidEmail(email string) bool {
	clean := NormalizeEmail(email)
	if clean == "" || len(clean) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(clean)
	if err != nil || addr.Address != clean {
		return false
	}
	at := strings.LastIndex(clean, "@")
	return at > 0 && strings.Contains(clean[at+1:], ".")
}

func ValidateCredentials(email, password string) string {
	cleanEmail := NormalizeEmail(email)
	if !IsValidEmail(cleanEmail) {
		return "请输入有效的邮箱地址"
	}
	if len(password) < 8 || len(password) > 128 {
		return "密码长度需在 8 到 128 位之间"
	}
	return ""
}

func NormalizePhoneE164(phone, defaultCountryCode string) (string, string, bool) {
	cleaned := digitsOnlyRe.ReplaceAllString(strings.TrimSpace(phone), "")
	if cleaned == "" {
		return "", "", false
	}
	cc := strings.TrimSpace(defaultCountryCode)
	if cc == "" {
		cc = "+86"
	}
	if !strings.HasPrefix(cc, "+") {
		cc = "+" + cc
	}
	if strings.HasPrefix(cleaned, "00") && len(cleaned) > 4 {
		cleaned = "+" + cleaned[2:]
	}
	if !strings.HasPrefix(cleaned, "+") {
		if cc == "+86" && strings.HasPrefix(cleaned, "86") && len(cleaned) == 13 {
			cleaned = "+" + cleaned
		} else {
			cleaned = cc + strings.TrimLeft(cleaned, "0")
		}
	}
	if !e164Re.MatchString(cleaned) {
		return "", "", false
	}
	if strings.HasPrefix(cleaned, "+86") {
		if len(cleaned) != 14 || cleaned[3] != '1' {
			return "", "", false
		}
		return cleaned, "+86", true
	}
	return cleaned, cc, true
}

func MaskEmail(email string) string {
	clean := NormalizeEmail(email)
	parts := strings.SplitN(clean, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	local, domain := parts[0], parts[1]
	if len(local) <= 2 {
		return local[:1] + "***@" + domain
	}
	return local[:2] + "***@" + domain
}

func MaskPhone(phone string) string {
	if len(phone) <= 6 {
		return "***"
	}
	return phone[:len(phone)-6] + "****" + phone[len(phone)-2:]
}

type JWK struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type GoogleIDClaims struct {
	Issuer        string `json:"iss"`
	Audience      string `json:"aud"`
	Subject       string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	ExpiresAt     int64  `json:"exp"`
}

// VerifyGoogleIDTokenWithKeys verifies an RS256 Google ID Token against a set of JWKs.
func VerifyGoogleIDTokenWithKeys(idToken, expectedAudience string, keys []JWK, now time.Time) (*GoogleIDClaims, error) {
	if expectedAudience == "" {
		return nil, errors.New("GOOGLE_CLIENT_ID_MISSING")
	}
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, errors.New("GOOGLE_ID_TOKEN_MALFORMED")
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errors.New("GOOGLE_ID_TOKEN_MALFORMED")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("GOOGLE_ID_TOKEN_MALFORMED")
	}
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errors.New("GOOGLE_ID_TOKEN_MALFORMED")
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil || header.Alg != "RS256" || header.Kid == "" {
		return nil, errors.New("GOOGLE_ID_TOKEN_ALG")
	}

	var matched *JWK
	for i := range keys {
		if keys[i].Kid == header.Kid {
			matched = &keys[i]
			break
		}
	}
	if matched == nil {
		return nil, errors.New("GOOGLE_ID_TOKEN_KID")
	}
	pub, err := jwkToRSAPublicKey(matched)
	if err != nil {
		return nil, fmt.Errorf("GOOGLE_ID_TOKEN_JWK: %w", err)
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], sigBytes); err != nil {
		return nil, errors.New("GOOGLE_ID_TOKEN_SIGNATURE")
	}
	var claims GoogleIDClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, errors.New("GOOGLE_ID_TOKEN_MALFORMED")
	}
	if claims.Issuer != "accounts.google.com" && claims.Issuer != "https://accounts.google.com" {
		return nil, errors.New("GOOGLE_ID_TOKEN_ISS")
	}
	if claims.Audience != expectedAudience {
		return nil, errors.New("GOOGLE_ID_TOKEN_AUD")
	}
	if claims.ExpiresAt+60 < now.Unix() {
		return nil, errors.New("GOOGLE_ID_TOKEN_EXPIRED")
	}
	if claims.Subject == "" {
		return nil, errors.New("GOOGLE_ID_TOKEN_SUB")
	}
	return &claims, nil
}

func jwkToRSAPublicKey(k *JWK) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
	if err != nil {
		return nil, err
	}
	n := new(big.Int).SetBytes(nBytes)
	eInt := new(big.Int).SetBytes(eBytes)
	if !eInt.IsInt64() || eInt.Int64() <= 0 {
		return nil, errors.New("invalid exponent")
	}
	return &rsa.PublicKey{N: n, E: int(eInt.Int64())}, nil
}
