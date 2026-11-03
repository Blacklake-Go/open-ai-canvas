package i18n

import (
	"errors"
	"testing"
	"time"
)

func completeDraft(key, source string) TranslationDraft {
	trans := map[string]string{}
	for _, code := range SupportedLocaleCodes {
		trans[code] = source
	}
	return TranslationDraft{Entry: Entry{Key: key, Namespace: "custom", SourceText: source, Translations: trans}, SourceHash: SourceHash(source)}
}
func revision(v int) *int { return &v }
func TestWorkflowRequiresReviewAndSupportsRollback(t *testing.T) {
	state := EmptyWorkflow()
	custom := map[string]Entry{"custom.manual": {Key: "custom.manual", SourceText: "人工内容"}}
	snapshots := map[string]map[string]Entry{}
	run := func(req WorkflowRequest) {
		t.Helper()
		req.ExpectedRevision = revision(state.Revision)
		var err error
		state, custom, snapshots, err = ApplyWorkflow(state, snapshots, custom, req, "admin", time.Now())
		if err != nil {
			t.Fatal(err)
		}
	}
	draft := completeDraft("custom.new", "新增 {count} 项")
	run(WorkflowRequest{Action: "stage", Drafts: []TranslationDraft{draft}})
	if len(custom) != 1 {
		t.Fatal("staging must not publish")
	}
	if _, _, _, err := ApplyWorkflow(state, snapshots, custom, WorkflowRequest{Action: "publish", ExpectedRevision: revision(state.Revision), Keys: []string{draft.Entry.Key}}, "admin", time.Now()); !errors.Is(err, ErrInvalidTranslation) {
		t.Fatal("unreviewed publication accepted", err)
	}
	run(WorkflowRequest{Action: "review", Keys: []string{draft.Entry.Key}})
	run(WorkflowRequest{Action: "publish", Keys: []string{draft.Entry.Key}})
	if len(custom) != 2 || len(state.Drafts) != 0 || len(state.Releases) != 1 {
		t.Fatal("invalid published state")
	}
	run(WorkflowRequest{Action: "rollback", ReleaseID: state.Releases[0].ID})
	if len(custom) != 1 || custom["custom.manual"].SourceText != "人工内容" {
		t.Fatal("rollback must exactly restore manual overrides")
	}
}
func TestWorkflowRejectsStaleRevisionSourceAndLocks(t *testing.T) {
	state := EmptyWorkflow()
	state.Revision = 2
	_, _, _, err := ApplyWorkflow(state, nil, nil, WorkflowRequest{Action: "stage", ExpectedRevision: revision(1)}, "admin", time.Now())
	if !errors.Is(err, ErrWorkflowConflict) {
		t.Fatal(err)
	}
	draft := completeDraft("common.confirm", "确认")
	draft.BaseSourceHash = SourceHash("旧原文")
	_, _, _, err = ApplyWorkflow(state, nil, nil, WorkflowRequest{Action: "stage", ExpectedRevision: revision(2), Drafts: []TranslationDraft{draft}}, "admin", time.Now())
	if !errors.Is(err, ErrInvalidTranslation) {
		t.Fatal("stale source accepted")
	}
	draft = completeDraft("common.confirm", "确认")
	state.LockedKeys[draft.Entry.Key] = true
	_, _, _, err = ApplyWorkflow(state, nil, nil, WorkflowRequest{Action: "stage", ExpectedRevision: revision(2), Drafts: []TranslationDraft{draft}}, "admin", time.Now())
	if !errors.Is(err, ErrInvalidTranslation) {
		t.Fatal("locked entry accepted")
	}
	if len(state.Drafts) != 0 || state.Revision != 2 {
		t.Fatal("failed operation mutated input")
	}
}
func TestTranslationValidationRejectsExtraOrLostParametersAndURLs(t *testing.T) {
	for _, test := range []struct {
		source, translation string
		valid               bool
	}{
		{"新增 {count} 项", "Added {count} items", true},
		{"完成", "Done {count}", false},
		{"新增 {count} 项", "Added items", false},
		{"访问 https://example.com）", "Visit https://example.com)", true},
		{"访问 https://example.com", "Visit https://wrong.example", false},
		{"普通文本", "<script>alert(1)</script>", false},
	} {
		if (ValidateTranslation(test.source, test.translation) == nil) != test.valid {
			t.Fatalf("unexpected validation: %#v", test)
		}
	}
}
func TestPartialUpsertPreservesExistingTranslations(t *testing.T) {
	existing := map[string]Entry{"common.confirm": {Translations: map[string]string{LocaleEnUS: "Proceed"}}}
	next, _, err := UpsertEntries(existing, []Entry{{Key: "common.confirm", Translations: map[string]string{LocaleJaJP: "承認"}}}, "admin")
	if err != nil || next["common.confirm"].Translations[LocaleEnUS] != "Proceed" {
		t.Fatal("partial update lost manual translation", err)
	}
}
