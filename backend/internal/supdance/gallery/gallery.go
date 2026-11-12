// Package gallery owns the public catalog boundary. Private assets and user works
// are never queried here. Reviews bind to content hashes, so upstream changes
// invalidate approval instead of silently publishing changed material.
package gallery

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/compactpicker"
)

// system_settings.key is varchar(80) on PostgreSQL. Keep the full SHA256
// with a short SupDance namespace; SQLite does not enforce this size.
const reviewPrefix = "supdance.ir."

type Entry = map[string]any
type Review struct {
	Status           string    `json:"status"`
	Evidence         string    `json:"evidence"`
	Hash             string    `json:"hash"`
	ReviewedBy       string    `json:"reviewedBy"`
	ReviewedAt       time.Time `json:"reviewedAt"`
	ReplacementImage string    `json:"replacementImage,omitempty"`
}
type Candidate struct {
	Entry  Entry  `json:"entry"`
	Review Review `json:"review"`
	Hash   string `json:"hash"`
}
type Service struct {
	Repo *repository.Repository
	Dir  string
}

func Digest(entry Entry) string {
	b, _ := json.Marshal(entry)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
func ID(entry Entry) string { id, _ := entry["id"].(string); return id }
func reviewKey(id string) string {
	h := sha256.Sum256([]byte(id))
	return reviewPrefix + hex.EncodeToString(h[:])
}

func (s Service) Review(id string) (Review, error) {
	r := Review{Status: "pending_review"}
	row, err := s.Repo.SystemSettingOptional(reviewKey(id))
	if err != nil || row == nil {
		return r, err
	}
	if err = json.Unmarshal([]byte(row.ValueJSON), &r); err != nil {
		return Review{}, err
	}
	return r, nil
}
func (s Service) Approved(entry Entry) (bool, error) {
	r, err := s.Review(ID(entry))
	return err == nil && r.Status == "approved" && strings.TrimSpace(r.Evidence) != "" && r.Hash == Digest(entry), err
}
func (s Service) Public(homepage bool) (bool, error) {
	p, err := compactpicker.Read(s.Repo)
	if err != nil {
		return false, err
	}
	if homepage {
		return p.HomepagePublic(), nil
	}
	return p.GalleryPublic(), nil
}

// Candidates reads only administrator curated packs and the dedicated public feed
// table. It has no access to projects, tasks, uploads or user asset tables.
func (s Service) candidates(public bool) ([]Entry, error) {
	out := []Entry{}
	seen := map[string]bool{}
	for _, source := range []string{"seedance", "haohaoxue", "youmind"} {
		b, err := os.ReadFile(filepath.Join(s.Dir, "inspirations", source+".json"))
		if err != nil {
			return nil, err
		}
		var pack struct {
			Entries []Entry `json:"entries"`
		}
		if err = json.Unmarshal(b, &pack); err != nil {
			return nil, err
		}
		for _, entry := range pack.Entries {
			id := ID(entry)
			if id == "" {
				return nil, fmt.Errorf("catalog entry missing ID")
			}
			if !seen[id] {
				seen[id] = true
				out = append(out, entry)
			}
		}
	}
	if public {
		setting, err := s.Repo.SystemSettingOptional("inspiration_feed")
		if err != nil {
			return nil, err
		}
		config := struct {
			Enabled bool `json:"enabled"`
		}{Enabled: true}
		if setting != nil {
			if err = json.Unmarshal([]byte(setting.ValueJSON), &config); err != nil {
				return nil, err
			}
		}
		if !config.Enabled {
			return out, nil
		}
	}
	rows, err := s.Repo.InspirationFeedEntries(10000)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if seen[row.ID] {
			continue
		}
		b, err := json.Marshal(row)
		if err != nil {
			return nil, err
		}
		var e Entry
		if err = json.Unmarshal(b, &e); err != nil {
			return nil, err
		}
		delete(e, "createdAt")
		delete(e, "updatedAt")
		e["addedAt"] = e["firstSeenAt"]
		delete(e, "firstSeenAt")
		out = append(out, e)
	}
	return out, nil
}
func (s Service) Find(id string) (Entry, error) {
	rows, err := s.candidates(false)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if ID(row) == id {
			return row, nil
		}
	}
	return nil, kernel.NotFound("灵感案例不存在")
}
func (s Service) ListAdmin(query string) ([]Candidate, error) {
	entries, err := s.candidates(false)
	if err != nil {
		return nil, err
	}
	out := []Candidate{}
	query = strings.ToLower(strings.TrimSpace(query))
	for _, e := range entries {
		b, _ := json.Marshal(e)
		if query != "" && !strings.Contains(strings.ToLower(string(b)), query) {
			continue
		}
		r, err := s.Review(ID(e))
		if err != nil {
			return nil, err
		}
		out = append(out, Candidate{e, r, Digest(e)})
		if len(out) >= 100 {
			break
		}
	}
	return out, nil
}
func (s Service) SaveReview(actor *model.User, id, status, evidence, expectedHash string, audit *model.AdminAuditEvent, replacement ...string) error {
	if status != "approved" && status != "pending_review" && status != "restricted" && status != "archived" {
		return kernel.BadAuthRequest("无效审核状态")
	}
	e, err := s.Find(id)
	if err != nil {
		return err
	}
	if expectedHash != Digest(e) {
		return kernel.BadAuthRequest("案例内容已变化，请重新核验")
	}
	if status == "approved" && len(strings.TrimSpace(evidence)) < 10 {
		return kernel.BadAuthRequest("请记录可核验的肖像与素材公开授权依据")
	}
	if len(evidence) > 4000 {
		return kernel.BadAuthRequest("授权依据过长")
	}
	r := Review{Status: status, Evidence: strings.TrimSpace(evidence), Hash: Digest(e), ReviewedBy: actor.ID, ReviewedAt: time.Now().UTC()}
	if len(replacement) > 0 && strings.TrimSpace(replacement[0]) != "" {
		image := strings.TrimSpace(replacement[0])
		u, err := url.Parse(image)
		if err != nil || len(image) > 1000 || u.User != nil || u.RawQuery != "" || u.Fragment != "" || strings.Contains(image, "..") || strings.Contains(image, "\\") || !(u.Scheme == "https" && u.Host != "" || u.Scheme == "" && u.Host == "" && strings.HasPrefix(image, "/inspiration-thumbs/")) {
			return kernel.BadAuthRequest("替换封面必须是无密钥的 HTTPS 公开素材或受保护的灵感缩略图")
		}
		r.ReplacementImage = image
	}
	b, err := json.Marshal(r)
	if err != nil {
		return err
	}
	return s.Repo.Transaction(func(tx *repository.Repository) error {
		if err := tx.SaveSystemSetting(&model.SystemSetting{Key: reviewKey(id), ValueJSON: string(b), UpdatedBy: actor.ID}); err != nil {
			return err
		}
		return tx.AppendAdminAudit(audit)
	})
}
func (s Service) RequireUnlock() error {
	entries, err := s.candidates(true)
	if err != nil {
		return err
	}
	for _, e := range entries {
		approved, err := s.Approved(e)
		if err != nil {
			return err
		}
		if approved {
			return nil
		}
	}
	return kernel.BadAuthRequest("至少完成一条案例的授权核验后才能解除合规锁")
}
func (s Service) Entries(homepage bool) ([]Entry, error) {
	allowed, err := s.Public(homepage)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, kernel.NotFound("灵感大厅处于公开隔离状态")
	}
	entries, err := s.candidates(true)
	if err != nil {
		return nil, err
	}
	out := []Entry{}
	for _, e := range entries {
		ok, err := s.Approved(e)
		if err != nil {
			return nil, err
		}
		if ok {
			review, err := s.Review(ID(e))
			if err != nil {
				return nil, err
			}
			if review.ReplacementImage != "" {
				e["image"] = review.ReplacementImage
			}
			out = append(out, e)
		}
	}
	return out, nil
}

// LegacyPack replaces the former public files; it never reads arbitrary paths.
func (s Service) LegacyPack(name string) (any, error) {
	entries, err := s.Entries(name == "gallery-pool.json")
	if err != nil {
		return nil, err
	}
	if name == "manifest.json" {
		return map[string]any{"sources": map[string]any{}}, nil
	}
	source := strings.TrimSuffix(name, ".json")
	if source != "seedance" && source != "haohaoxue" && source != "youmind" && source != "gallery-pool" {
		return nil, kernel.NotFound("目录不存在")
	}
	out := []Entry{}
	for _, e := range entries {
		if source == "gallery-pool" || e["sourceId"] == source {
			out = append(out, e)
		}
	}
	return map[string]any{"entries": out}, nil
}
func (s Service) MediaPath(name string) (string, error) {
	if strings.Contains(name, "..") || strings.Contains(name, "\\") || !strings.HasPrefix(name, "/inspiration-thumbs/") {
		return "", kernel.NotFound("素材不存在")
	}
	entries, err := s.Entries(false)
	if err != nil {
		return "", err
	}
	for _, e := range entries {
		if e["image"] == name {
			return filepath.Join(s.Dir, filepath.FromSlash(strings.TrimPrefix(name, "/"))), nil
		}
	}
	return "", kernel.NotFound("素材未获公开授权")
}
