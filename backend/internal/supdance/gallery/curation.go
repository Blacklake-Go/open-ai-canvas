package gallery

import (
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

const (
	curationKey       = "supdance.inspiration.curation"
	curationVersion   = "supdance.inspiration.version."
	MaxFeatured       = 12
	maxGalleryOrder   = 10000
	maxCurationEdits  = 5000
	maxCurationStyles = 60
)

var termID = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,55}$`)
var seededStyles = []string{"cinematic", "retro", "documentary", "cyberpunk", "anime", "editorial", "minimal", "3d"}
var promptTypes = []string{"description", "shot-script", "structured", "template"}

type StyleTerm struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type CaseTags struct {
	Styles     []string `json:"styles"`
	PromptType string   `json:"promptType,omitempty"`
}

type FeaturedCase struct {
	ID     string `json:"id"`
	Pinned bool   `json:"pinned"`
	Title  string `json:"title,omitempty"`
	FocusX int    `json:"focusX"`
	FocusY int    `json:"focusY"`
}

type CurationDocument struct {
	Styles   []StyleTerm         `json:"styles"`
	Cases    map[string]CaseTags `json:"cases"`
	Featured []FeaturedCase      `json:"featured"`
	// A missing order keeps the source catalog. An empty order publishes an empty catalog.
	GalleryOrder *[]string `json:"galleryOrder,omitempty"`
}

type CurationRelease struct {
	ID           string    `json:"id"`
	CreatedAt    time.Time `json:"createdAt"`
	ActorID      string    `json:"actorId"`
	RestoredFrom string    `json:"restoredFrom,omitempty"`
}

type CurationState struct {
	Revision  int64             `json:"revision"`
	Draft     CurationDocument  `json:"draft"`
	Published string            `json:"published"`
	History   []CurationRelease `json:"history"`
}

type CurationChange struct {
	ExpectedRevision *int64            `json:"expectedRevision"`
	Document         *CurationDocument `json:"document,omitempty"`
	Version          string            `json:"version,omitempty"`
}

type CurationCard struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Image       string `json:"image"`
	Mode        string `json:"mode"`
	Source      string `json:"source"`
	Credit      string `json:"credit"`
	Category    string `json:"category"`
	Date        string `json:"date,omitempty"`
	Eligible    bool   `json:"eligible"`
}

func blankCuration() CurationDocument {
	return CurationDocument{Styles: []StyleTerm{}, Cases: map[string]CaseTags{}, Featured: []FeaturedCase{}}
}

func initialCuration() CurationState {
	doc := blankCuration()
	for _, id := range seededStyles {
		doc.Styles = append(doc.Styles, StyleTerm{ID: id})
	}
	return CurationState{Draft: doc, History: []CurationRelease{}}
}

func (s Service) Curation() (CurationState, error) {
	state := initialCuration()
	row, err := s.Repo.SystemSettingOptional(curationKey)
	if err != nil || row == nil {
		return state, err
	}
	err = json.Unmarshal([]byte(row.ValueJSON), &state)
	return state, err
}

func (s Service) curationSnapshot(id string) (CurationDocument, error) {
	var doc CurationDocument
	row, err := s.Repo.SystemSetting(curationVersion + id)
	if err != nil {
		return doc, err
	}
	err = json.Unmarshal([]byte(row.ValueJSON), &doc)
	return doc, err
}

func (s Service) publishedCuration() (*CurationDocument, error) {
	state, err := s.Curation()
	if err != nil || state.Published == "" {
		return nil, err
	}
	doc, err := s.curationSnapshot(state.Published)
	if err != nil {
		return nil, fmt.Errorf("read published inspiration curation: %w", err)
	}
	return &doc, nil
}

func (doc *CurationDocument) applyGalleryOrder(entries []Entry) []Entry {
	if doc == nil || doc.GalleryOrder == nil {
		return entries
	}
	index := make(map[string]Entry, len(entries))
	for _, entry := range entries {
		index[ID(entry)] = entry
	}
	out := make([]Entry, 0, min(len(index), len(*doc.GalleryOrder)))
	for _, id := range *doc.GalleryOrder {
		if entry, found := index[id]; found {
			out = append(out, entry)
		}
	}
	return out
}

func (s Service) CurationCatalog(query string) ([]CurationCard, error) {
	if utf8.RuneCountInString(query) > 120 {
		return nil, kernel.BadAuthRequest("灵感搜索字数超出限制")
	}
	entries, err := s.candidates(false)
	if err != nil {
		return nil, err
	}
	reviews, err := s.reviews()
	if err != nil {
		return nil, err
	}
	feedEnabled, err := s.curationFeedEnabled()
	if err != nil {
		return nil, err
	}
	query = strings.ToLower(strings.TrimSpace(query))
	cards := []CurationCard{}
	for _, entry := range entries {
		if query != "" && !matchesCurationQuery(entry, query) {
			continue
		}
		allowed, eligible := publicEntry(entry, reviews)
		if eligible {
			entry = allowed
		}
		eligible = eligible && (feedEnabled || entry["addedAt"] == nil)
		date := textField(entry, "publishedAt")
		if date == "" {
			date = textField(entry, "addedAt")
		}
		cards = append(cards, CurationCard{
			ID: ID(entry), Title: textField(entry, "title"), Description: textField(entry, "description"),
			Image: textField(entry, "image"), Mode: textField(entry, "mode"), Source: textField(entry, "sourceId"),
			Credit: textField(entry, "credit"), Category: textField(entry, "category"), Date: date, Eligible: eligible,
		})
	}
	return cards, nil
}

func textField(entry Entry, key string) string {
	value, _ := entry[key].(string)
	return value
}

func matchesCurationQuery(entry Entry, query string) bool {
	for _, key := range []string{"id", "title", "description", "prompt", "category", "sourceId"} {
		if strings.Contains(strings.ToLower(textField(entry, key)), query) {
			return true
		}
	}
	return false
}

func (s Service) ChangeCuration(action string, input CurationChange, audit *model.AdminAuditEvent) (CurationState, error) {
	if input.ExpectedRevision == nil {
		return CurationState{}, kernel.BadAuthRequest("缺少草稿版本，请刷新后重试")
	}
	var result CurationState
	err := s.Repo.Transaction(func(tx *repository.Repository) error {
		working := s
		working.Repo = tx
		initial, err := json.Marshal(initialCuration())
		if err != nil {
			return err
		}
		if err := tx.LockSystemSetting(curationKey, string(initial)); err != nil {
			return err
		}
		state, err := working.Curation()
		if err != nil {
			return err
		}
		if state.Revision != *input.ExpectedRevision {
			return kernel.NewAppError(409, "其他管理员已修改灵感策展，请重新载入")
		}
		row, err := tx.SystemSetting(curationKey)
		if err != nil {
			return err
		}
		switch action {
		case "draft":
			if input.Document == nil {
				return kernel.BadAuthRequest("缺少灵感策展草稿")
			}
			if err := working.validateCuration(input.Document, state.Draft, false); err != nil {
				return err
			}
			state.Draft = *input.Document
		case "publish":
			if err := working.validateCuration(&state.Draft, state.Draft, true); err != nil {
				return err
			}
			if err := working.saveCurationVersion(&state, state.Draft, "", audit.ActorUserID); err != nil {
				return err
			}
		case "rollback":
			if input.Version == state.Published || !slices.ContainsFunc(state.History, func(item CurationRelease) bool { return item.ID == input.Version }) {
				return kernel.BadAuthRequest("所选历史版本不可恢复")
			}
			doc, err := working.curationSnapshot(input.Version)
			if err != nil {
				return err
			}
			if err := working.saveCurationVersion(&state, doc, input.Version, audit.ActorUserID); err != nil {
				return err
			}
		default:
			return kernel.NotFound("未知的策展操作")
		}
		state.Revision++
		raw, err := json.Marshal(state)
		if err != nil {
			return err
		}
		row.ValueJSON = string(raw)
		row.UpdatedBy = audit.ActorUserID
		row.UpdatedAt = time.Now().UTC()
		if err := tx.SaveSystemSetting(row); err != nil {
			return err
		}
		metadata, err := json.Marshal(map[string]any{"revision": state.Revision, "published": state.Published, "restoredFrom": input.Version})
		if err != nil {
			return err
		}
		audit.MetadataJSON = string(metadata)
		if err := tx.AppendAdminAudit(audit); err != nil {
			return err
		}
		result = state
		return nil
	})
	return result, err
}

func (s Service) saveCurationVersion(state *CurationState, doc CurationDocument, previous, actorID string) error {
	raw, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	version := CurationRelease{ID: kernel.NewID(), CreatedAt: time.Now().UTC(), ActorID: actorID, RestoredFrom: previous}
	if err := s.Repo.SaveSystemSetting(&model.SystemSetting{Key: curationVersion + version.ID, ValueJSON: string(raw), UpdatedBy: actorID, UpdatedAt: version.CreatedAt}); err != nil {
		return err
	}
	state.Published = version.ID
	state.History = append([]CurationRelease{version}, state.History...)
	if len(state.History) > 25 {
		state.History = state.History[:25]
	}
	return nil
}

func (s Service) validateCuration(doc *CurationDocument, previous CurationDocument, publish bool) error {
	if len(doc.Styles) > maxCurationStyles || len(doc.Cases) > maxCurationEdits || len(doc.Featured) > MaxFeatured {
		return kernel.BadAuthRequest("灵感标签、分类或精选数量超出限制")
	}
	if doc.Styles == nil {
		doc.Styles = []StyleTerm{}
	}
	if doc.Cases == nil {
		doc.Cases = map[string]CaseTags{}
	}
	if doc.Featured == nil {
		doc.Featured = []FeaturedCase{}
	}
	terms := make(map[string]bool, len(doc.Styles))
	labels := map[string]bool{}
	for i, style := range doc.Styles {
		style.Label = strings.TrimSpace(style.Label)
		doc.Styles[i] = style
		label := strings.ToLower(style.Label)
		if !termID.MatchString(style.ID) || terms[style.ID] || utf8.RuneCountInString(style.Label) > 36 ||
			(style.Label == "" && !slices.Contains(seededStyles, style.ID)) || (label != "" && labels[label]) {
			return kernel.BadAuthRequest("风格标签无效或重复")
		}
		terms[style.ID] = true
		labels[label] = true
	}
	if doc.GalleryOrder != nil && len(*doc.GalleryOrder) > maxGalleryOrder {
		return kernel.BadAuthRequest("公开清单条目超出限制")
	}
	if len(doc.Cases) == 0 && len(doc.Featured) == 0 && (doc.GalleryOrder == nil || len(*doc.GalleryOrder) == 0) {
		return nil
	}
	cards, err := s.CurationCatalog("")
	if err != nil {
		return err
	}
	inventory := make(map[string]CurationCard, len(cards))
	for _, card := range cards {
		inventory[card.ID] = card
	}
	if doc.GalleryOrder != nil {
		prior := map[string]bool{}
		if previous.GalleryOrder != nil {
			for _, id := range *previous.GalleryOrder {
				prior[id] = true
			}
		}
		seen := map[string]bool{}
		for _, id := range *doc.GalleryOrder {
			if id == "" || seen[id] || (!inventory[id].Eligible && !prior[id]) {
				return kernel.BadAuthRequest("公开清单包含重复、未知或受限案例")
			}
			seen[id] = true
		}
	}
	for id, tags := range doc.Cases {
		_, exists := inventory[id]
		_, known := previous.Cases[id]
		if (!exists && !known) || len(tags.Styles) > 8 || (tags.PromptType != "" && !slices.Contains(promptTypes, tags.PromptType)) {
			return kernel.BadAuthRequest("案例分类无效")
		}
		used := map[string]bool{}
		for _, style := range tags.Styles {
			if !terms[style] || used[style] {
				return kernel.BadAuthRequest("案例风格不存在或重复")
			}
			used[style] = true
		}
		if len(tags.Styles) == 0 && tags.PromptType == "" {
			delete(doc.Cases, id)
		} else if tags.Styles == nil {
			tags.Styles = []string{}
			doc.Cases[id] = tags
		}
	}
	used := map[string]bool{}
	for i, featured := range doc.Featured {
		featured.Title = strings.TrimSpace(featured.Title)
		doc.Featured[i] = featured
		card, exists := inventory[featured.ID]
		hadSlot := slices.ContainsFunc(previous.Featured, func(prior FeaturedCase) bool { return prior.ID == featured.ID })
		if used[featured.ID] || (!exists && !hadSlot) || utf8.RuneCountInString(featured.Title) > 80 ||
			featured.FocusX < 0 || featured.FocusX > 100 || featured.FocusY < 0 || featured.FocusY > 100 {
			return kernel.BadAuthRequest("精选位置或封面参数无效")
		}
		if (publish || !hadSlot) && (!card.Eligible || card.Image == "") {
			err := kernel.BadAuthRequest("精选包含当前不可公开或缺少封面的案例")
			err.Details = map[string]any{"caseId": featured.ID}
			return err
		}
		used[featured.ID] = true
	}
	sort.SliceStable(doc.Featured, func(i, j int) bool { return doc.Featured[i].Pinned && !doc.Featured[j].Pinned })
	return nil
}

func (s Service) PublicCuration() (CurationDocument, error) {
	empty := blankCuration()
	if err := s.requirePublic(false); err != nil {
		return empty, err
	}
	doc, err := s.publishedCuration()
	if err != nil || doc == nil {
		return empty, err
	}
	entries, err := s.visibleEntries(doc)
	if err != nil {
		return empty, err
	}
	allowed := make(map[string]bool, len(entries))
	for _, entry := range entries {
		allowed[ID(entry)] = true
	}
	if doc.GalleryOrder != nil {
		order := make([]string, 0, len(entries))
		for _, entry := range entries {
			order = append(order, ID(entry))
		}
		empty.GalleryOrder = &order
	}
	home, err := s.Public(true)
	if err != nil {
		return empty, err
	}
	empty.Styles = doc.Styles
	for id, tags := range doc.Cases {
		if allowed[id] {
			empty.Cases[id] = tags
		}
	}
	if home {
		for _, item := range doc.Featured {
			if allowed[item.ID] {
				empty.Featured = append(empty.Featured, item)
			}
		}
	}
	return empty, nil
}

func (s Service) editorialPool(doc *CurationDocument) ([]Entry, error) {
	if doc == nil || (doc.GalleryOrder == nil && len(doc.Featured) == 0) {
		return nil, nil
	}
	entries, err := s.visibleEntries(doc)
	if err != nil {
		return nil, err
	}
	if doc.GalleryOrder != nil && len(doc.Featured) == 0 {
		return entries[:min(len(entries), MaxFeatured)], nil
	}
	allowed := make(map[string]Entry, len(entries))
	for _, entry := range entries {
		allowed[ID(entry)] = entry
	}
	out := []Entry{}
	for _, item := range doc.Featured {
		if entry, found := allowed[item.ID]; found {
			out = append(out, entry)
		}
	}
	return out, nil
}
