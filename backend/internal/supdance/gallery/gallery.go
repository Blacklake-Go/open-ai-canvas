// Package gallery owns the public catalog boundary. Private assets and user works
// are never queried here. Explicit restrictions and content-bound reviews apply
// across every public representation of a catalog entry.
package gallery

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"maps"
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
	Repo    *repository.Repository
	Dir     string
	archive *archiveCache
}

func New(repo *repository.Repository, root string) *Service {
	return &Service{Repo: repo, Dir: root, archive: &archiveCache{packs: map[string]cachedPack{}}}
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
	r := Review{Status: "unreviewed"}
	row, err := s.Repo.SystemSettingOptional(reviewKey(id))
	if err != nil || row == nil {
		return r, err
	}
	if err = json.Unmarshal([]byte(row.ValueJSON), &r); err != nil {
		return Review{}, err
	}
	return r, nil
}
func (s Service) reviews() (map[string]Review, error) {
	rows, err := s.Repo.SystemSettingsWithPrefix(reviewPrefix, -1)
	if err != nil {
		return nil, err
	}
	reviews := make(map[string]Review, len(rows))
	for _, row := range rows {
		var review Review
		if err := json.Unmarshal([]byte(row.ValueJSON), &review); err != nil {
			return nil, err
		}
		reviews[row.Key] = review
	}
	return reviews, nil
}

func publicEntry(entry Entry, reviews map[string]Review) (Entry, bool) {
	review, found := reviews[reviewKey(ID(entry))]
	if !found {
		return entry, true
	}
	if review.Status != "approved" || strings.TrimSpace(review.Evidence) == "" || review.Hash != Digest(entry) {
		return nil, false
	}
	if review.ReplacementImage != "" {
		entry = maps.Clone(entry)
		entry["image"] = review.ReplacementImage
	}
	return entry, true
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
func (s Service) catalogEntries() ([]Entry, error) {
	out, err := originalCatalog()
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, entry := range out {
		seen[ID(entry)] = true
	}
	for _, source := range catalogSources {
		pack, err := s.readPack(source + ".json")
		if err != nil {
			return nil, err
		}
		for _, entry := range pack {
			id := ID(entry)
			if !seen[id] {
				seen[id] = true
				out = append(out, entry)
			}
		}
	}
	return out, nil
}

func (s Service) candidates(public bool) ([]Entry, error) {
	out, err := s.catalogEntries()
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool, len(out))
	for _, entry := range out {
		seen[ID(entry)] = true
	}
	if public {
		enabled, err := s.curationFeedEnabled()
		if err != nil {
			return nil, err
		}
		if !enabled {
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

func (s Service) curationFeedEnabled() (bool, error) {
	setting, err := s.Repo.SystemSettingOptional("inspiration_feed")
	if err != nil {
		return false, err
	}
	config := struct {
		Enabled bool `json:"enabled"`
	}{Enabled: true}
	if setting != nil {
		err = json.Unmarshal([]byte(setting.ValueJSON), &config)
	}
	return config.Enabled, err
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
func (s Service) Entries(homepage bool) (entries []Entry, manuallyOrdered bool, err error) {
	if err := s.requirePublic(homepage); err != nil {
		return nil, false, err
	}
	doc, err := s.publishedCuration()
	if err != nil {
		return nil, false, err
	}
	entries, err = s.visibleEntries(doc)
	return entries, doc != nil && doc.GalleryOrder != nil, err
}

func (s Service) visibleEntries(doc *CurationDocument) ([]Entry, error) {
	entries, err := s.candidates(true)
	if err != nil {
		return nil, err
	}
	reviews, err := s.reviews()
	if err != nil {
		return nil, err
	}
	return filterEntries(doc.applyGalleryOrder(entries), reviews), nil
}

func (s Service) requirePublic(homepage bool) error {
	allowed, err := s.Public(homepage)
	if err != nil {
		return err
	}
	if !allowed {
		return kernel.NotFound("灵感大厅处于公开隔离状态")
	}
	return nil
}

func filterEntries(entries []Entry, reviews map[string]Review) []Entry {
	out := []Entry{}
	for _, e := range entries {
		if entry, ok := publicEntry(e, reviews); ok {
			out = append(out, entry)
		}
	}
	return out
}
func (s Service) MediaPath(name string) (string, error) {
	if strings.Contains(name, "..") || strings.Contains(name, "\\") || !strings.HasPrefix(name, "/inspiration-thumbs/") {
		return "", kernel.NotFound("素材不存在")
	}
	if err := s.requirePublic(false); err != nil {
		return "", err
	}
	reviews, err := s.reviews()
	if err != nil {
		return "", err
	}
	entries, err := s.catalogEntries()
	if err != nil {
		return "", err
	}
	doc, err := s.publishedCuration()
	if err != nil {
		return "", err
	}
	for _, entry := range doc.applyGalleryOrder(entries) {
		if e, ok := publicEntry(entry, reviews); ok && e["image"] == name {
			root, err := os.OpenRoot(s.Dir)
			if err != nil {
				return "", err
			}
			defer root.Close()
			relative := filepath.FromSlash(strings.TrimPrefix(name, "/"))
			info, err := root.Stat(relative)
			if err != nil || !info.Mode().IsRegular() {
				return "", kernel.NotFound("素材不存在")
			}
			return filepath.Join(s.Dir, relative), nil
		}
	}
	return "", kernel.NotFound("素材未获公开授权")
}
