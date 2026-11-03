package i18n

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

const Version = "1.2.0"
const WorkflowSettingKey = "supdance_i18n_workflow"

var ErrWorkflowConflict = errors.New("i18n_workflow_conflict")
var ErrInvalidTranslation = errors.New("i18n_invalid_translation")

type SourceReference struct {
	File string `json:"file"`
	Line int    `json:"line"`
}
type TranslationDraft struct {
	Entry          Entry             `json:"entry"`
	SourceHash     string            `json:"sourceHash"`
	BaseSourceHash string            `json:"baseSourceHash,omitempty"`
	References     []SourceReference `json:"references,omitempty"`
	Status         string            `json:"status"`
	ReviewedBy     string            `json:"reviewedBy,omitempty"`
}
type TranslationRelease struct {
	ID        string           `json:"id"`
	CreatedAt string           `json:"createdAt"`
	CreatedBy string           `json:"createdBy"`
	Count     int              `json:"count"`
	Overrides map[string]Entry `json:"-"`
}

// Snapshots are stored separately from the public/admin view so historical data is not sent to browsers.
type WorkflowState struct {
	StaleOverrides []string             `json:"staleOverrides"`
	Revision       int                  `json:"revision"`
	Drafts         []TranslationDraft   `json:"drafts"`
	LockedKeys     map[string]bool      `json:"lockedKeys"`
	Releases       []TranslationRelease `json:"releases"`
}
type WorkflowRequest struct {
	Action           string             `json:"action"`
	ExpectedRevision *int               `json:"expectedRevision"`
	Drafts           []TranslationDraft `json:"drafts,omitempty"`
	Keys             []string           `json:"keys,omitempty"`
	ReleaseID        string             `json:"releaseId,omitempty"`
}

func SourceHash(source string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(source)))
	return hex.EncodeToString(sum[:])
}

var catalogOnce sync.Once
var catalogHash string

func builtinCatalogRevision() string {
	catalogOnce.Do(func() { raw, _ := json.Marshal(BuiltinEntries()); catalogHash = SourceHash(Version + string(raw)) })
	return catalogHash
}

var placeholderPattern = regexp.MustCompile(`\{([a-zA-Z0-9_]+)\}`)
var urlPattern = regexp.MustCompile(`https?://[a-zA-Z0-9][^\s<>()（），,]*`)
var markupPattern = regexp.MustCompile(`(?i)</?[a-z][^>]*>`)

func sameTokens(pattern *regexp.Regexp, a, b string) bool {
	left, right := pattern.FindAllString(a, -1), pattern.FindAllString(b, -1)
	sort.Strings(left)
	sort.Strings(right)
	return strings.Join(left, "\x00") == strings.Join(right, "\x00")
}

// Validation is shared by direct edits, imports and reviewed releases.
func ValidateTranslation(source, translation string) error {
	if strings.TrimSpace(translation) == "" {
		return fmt.Errorf("%w: empty_translation", ErrInvalidTranslation)
	}
	if !sameTokens(placeholderPattern, source, translation) {
		return fmt.Errorf("%w: placeholder_mismatch", ErrInvalidTranslation)
	}
	if !sameTokens(urlPattern, source, translation) {
		return fmt.Errorf("%w: url_mismatch", ErrInvalidTranslation)
	}
	if markupPattern.MatchString(translation) && !markupPattern.MatchString(source) {
		return fmt.Errorf("%w: unexpected_markup", ErrInvalidTranslation)
	}
	return nil
}

func EmptyWorkflow() WorkflowState {
	return WorkflowState{Drafts: []TranslationDraft{}, LockedKeys: map[string]bool{}, Releases: []TranslationRelease{}}
}

// ApplyWorkflow is pure: a failed action never changes the caller's draft or published maps.
func ApplyWorkflow(state WorkflowState, snapshots map[string]map[string]Entry, custom map[string]Entry, req WorkflowRequest, actor string, now time.Time) (WorkflowState, map[string]Entry, map[string]map[string]Entry, error) {
	invalid := func(reason string) (WorkflowState, map[string]Entry, map[string]map[string]Entry, error) {
		return WorkflowState{}, nil, nil, fmt.Errorf("%w: %s", ErrInvalidTranslation, reason)
	}
	if actor == "" || req.ExpectedRevision == nil {
		return invalid("missing_actor_or_revision")
	}
	if *req.ExpectedRevision != state.Revision {
		return WorkflowState{}, nil, nil, ErrWorkflowConflict
	}
	next := EmptyWorkflow()
	next.Revision = state.Revision + 1
	next.Drafts = append(next.Drafts, state.Drafts...)
	next.Releases = append(next.Releases, state.Releases...)
	for k, v := range state.LockedKeys {
		next.LockedKeys[k] = v
	}
	nextCustom := map[string]Entry{}
	for k, v := range custom {
		nextCustom[k] = v
	}
	nextSnapshots := map[string]map[string]Entry{}
	for k, v := range snapshots {
		nextSnapshots[k] = v
	}
	merged, _, _ := MergeEntries(custom)
	byKey := map[string]Entry{}
	for _, e := range merged {
		byKey[e.Key] = e
	}
	selected := map[string]bool{}
	for _, k := range req.Keys {
		selected[k] = true
	}
	switch req.Action {
	case "stage":
		if len(req.Drafts) == 0 || len(req.Drafts) > 500 {
			return invalid("draft_batch_limit_1_500")
		}
		for _, d := range req.Drafts {
			e := d.Entry
			e.Key = strings.TrimSpace(e.Key)
			e.SourceText = strings.TrimSpace(e.SourceText)
			if !validKeyRegex.MatchString(e.Key) || e.SourceText == "" || len(e.SourceText) > 10000 || d.SourceHash != SourceHash(e.SourceText) {
				return invalid("invalid_source_or_hash")
			}
			if next.LockedKeys[e.Key] {
				return invalid("locked_key")
			}
			for code, value := range e.Translations {
				if !isSupportedLocale(code) {
					return invalid("unsupported_locale")
				}
				if strings.TrimSpace(value) != "" {
					if err := ValidateTranslation(e.SourceText, value); err != nil {
						return invalid(e.Key + ": " + err.Error())
					}
				}
			}
			if e.Namespace == "" {
				e.Namespace = "custom"
			}
			if _, ok := NamespaceLabels[e.Namespace]; !ok {
				return invalid("unknown_namespace")
			}
			if base, ok := byKey[e.Key]; ok {
				if d.BaseSourceHash == "" {
					if e.SourceText != base.SourceText {
						return invalid("source_changed_without_base_hash")
					}
					d.BaseSourceHash = SourceHash(base.SourceText)
				}
				if d.BaseSourceHash != SourceHash(base.SourceText) {
					return invalid("stale_source")
				}
			}
			if len(d.References) > 100 {
				return invalid("reference_limit")
			}
			d.Entry = e
			d.Status = "draft"
			d.ReviewedBy = ""
			replaced := false
			for i, old := range next.Drafts {
				if old.Entry.Key == e.Key {
					next.Drafts[i] = d
					replaced = true
					break
				}
			}
			if !replaced {
				next.Drafts = append(next.Drafts, d)
			}
		}
		if len(next.Drafts) > 2000 {
			return invalid("draft_limit")
		}
	case "review", "publish", "discard", "lock", "unlock":
		if len(selected) == 0 || len(selected) > 500 {
			return invalid("select_1_500_keys")
		}
		if req.Action == "lock" || req.Action == "unlock" {
			for k := range selected {
				if _, ok := byKey[k]; !ok {
					return invalid("unknown_key")
				}
				if req.Action == "lock" {
					next.LockedKeys[k] = true
				} else {
					delete(next.LockedKeys, k)
				}
			}
			break
		}
		found := 0
		updates := []Entry{}
		remaining := []TranslationDraft{}
		for _, d := range next.Drafts {
			if !selected[d.Entry.Key] {
				remaining = append(remaining, d)
				continue
			}
			found++
			if req.Action == "discard" {
				continue
			}
			if next.LockedKeys[d.Entry.Key] {
				return invalid("locked_key")
			}
			if d.SourceHash != SourceHash(d.Entry.SourceText) {
				return invalid("stale_draft")
			}
			if base, ok := byKey[d.Entry.Key]; ok && d.BaseSourceHash != SourceHash(base.SourceText) {
				return invalid("stale_source")
			}
			if d.Entry.Translations[LocaleZhCN] != d.Entry.SourceText {
				return invalid("source_translation_mismatch")
			}
			for _, code := range SupportedLocaleCodes {
				if err := ValidateTranslation(d.Entry.SourceText, d.Entry.Translations[code]); err != nil {
					return invalid(d.Entry.Key + " [" + code + "]: " + err.Error())
				}
			}
			if req.Action == "review" {
				d.Status = "reviewed"
				d.ReviewedBy = actor
				remaining = append(remaining, d)
			} else {
				if d.Status != "reviewed" || d.ReviewedBy == "" {
					return invalid("review_required")
				}
				updates = append(updates, d.Entry)
			}
		}
		if found != len(selected) {
			return invalid("unknown_draft")
		}
		next.Drafts = remaining
		if req.Action == "publish" {
			var err error
			nextCustom, _, err = UpsertEntries(custom, updates, actor)
			if err != nil {
				return invalid(err.Error())
			}
			id := fmt.Sprintf("%d-%d", now.UnixNano(), next.Revision)
			nextSnapshots[id] = custom
			next.Releases = append([]TranslationRelease{{ID: id, CreatedAt: now.UTC().Format(time.RFC3339), CreatedBy: actor, Count: len(updates)}}, next.Releases...)
			if len(next.Releases) > 10 {
				for _, r := range next.Releases[10:] {
					delete(nextSnapshots, r.ID)
				}
				next.Releases = next.Releases[:10]
			}
		}
	case "rollback":
		snapshot, ok := snapshots[req.ReleaseID]
		if !ok {
			return invalid("unknown_release")
		}
		// Restore the overrides as a unit. Never reinterpret an old snapshot as built-in edits.
		id := fmt.Sprintf("%d-%d", now.UnixNano(), next.Revision)
		nextSnapshots[id] = custom
		nextCustom = map[string]Entry{}
		for k, v := range snapshot {
			nextCustom[k] = v
		}
		next.Releases = append([]TranslationRelease{{ID: id, CreatedAt: now.UTC().Format(time.RFC3339), CreatedBy: actor, Count: len(snapshot)}}, next.Releases...)
		if len(next.Releases) > 10 {
			for _, r := range next.Releases[10:] {
				delete(nextSnapshots, r.ID)
			}
			next.Releases = next.Releases[:10]
		}
	default:
		return invalid("unknown_action")
	}
	for k, locked := range state.LockedKeys {
		if locked && req.Action != "unlock" {
			before, _ := json.Marshal(custom[k])
			after, _ := json.Marshal(nextCustom[k])
			if string(before) != string(after) {
				return invalid("locked_key")
			}
		}
	}
	return next, nextCustom, nextSnapshots, nil
}

func isSupportedLocale(code string) bool {
	for _, c := range SupportedLocaleCodes {
		if c == code {
			return true
		}
	}
	return false
}
