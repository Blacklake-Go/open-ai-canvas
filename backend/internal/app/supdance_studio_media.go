package app

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"yingce/backend/internal/imagebilling"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

type StudioGeneration struct {
	Kind       string   `json:"kind"`
	Purpose    string   `json:"purpose"`
	Model      string   `json:"model"`
	Prompt     string   `json:"prompt"`
	ProjectID  string   `json:"projectId,omitempty"`
	Ratio      string   `json:"ratio,omitempty"`
	Size       string   `json:"size,omitempty"`
	Duration   int      `json:"duration,omitempty"`
	Count      int      `json:"count,omitempty"`
	References []string `json:"references"`
	ShotID     string   `json:"shotId,omitempty"`
}

type StudioQuote struct {
	ID           string `json:"id"`
	Microcredits int64  `json:"microcredits"`
	ExpiresAt    int64  `json:"expiresAt"`
	Estimated    bool   `json:"estimated"`
}

type StudioSubmit struct {
	Generation StudioGeneration `json:"generation"`
	Quote      StudioQuote      `json:"quote"`
}

type StudioModel struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Kind          string   `json:"kind"`
	Ratios        []string `json:"ratios"`
	Sizes         []string `json:"sizes"`
	Durations     []int    `json:"durations"`
	Counts        []int    `json:"counts"`
	MinReferences int      `json:"minReferences"`
	MaxReferences int      `json:"maxReferences"`
}

func studioError(status int, reason string) *AppError {
	err := NewAppError(status, "SupDance Studio request unavailable")
	err.Reason = kernel.ErrorReason(reason)
	return err
}

func (s *Service) StudioModels(userID, kind string) ([]StudioModel, error) {
	if err := s.studioMediaFeature(kind); err != nil {
		return nil, err
	}
	if err := s.RequireFeature(FeatureFrontendModels); err != nil {
		return nil, err
	}
	access, err := s.userGroupAccess(userID)
	if err != nil {
		return nil, err
	}
	models, err := s.PublicLogicalModels(access, nil)
	if err != nil {
		return nil, err
	}
	snapshot, err := s.routeCatalogSnapshot()
	if err != nil {
		return nil, err
	}
	channels := map[string]bool{}
	result := make([]StudioModel, 0)
	for _, item := range models {
		if !item.Available || item.Capability != kind || !supdanceOpenAIID.MatchString(item.ID) {
			continue
		}
		for _, route := range snapshot.Models[item.ID].Routes {
			channelID := route.ChannelModel.ChannelID
			if !route.Route.Enabled || route.Route.Weight <= 0 || !access.allowsChannel(channelID) || s.logicalRouteBlocked(route) {
				continue
			}
			if _, checked := channels[channelID]; !checked {
				channels[channelID] = s.studioChannelConfigured(channelID)
			}
			if channels[channelID] {
				result = append(result, studioModelView(item))
				break
			}
		}
		if len(result) == 100 {
			break
		}
	}
	return result, nil
}

func (s *Service) studioChannelConfigured(id string) bool {
	channel, err := s.repo.SystemChannel(id)
	return err == nil && channel.Enabled && strings.TrimSpace(channel.BaseURL) != "" && strings.TrimSpace(channel.APIKey) != ""
}

func studioModelView(item PublicLogicalModel) StudioModel {
	spec := item.CapabilitySpec
	refs := spec.Inputs["image"]
	result := StudioModel{ID: item.ID, Name: truncateRunes(defaultString(item.Name, item.Code), 160), Kind: item.Capability,
		Ratios: []string{}, Sizes: []string{}, Durations: []int{}, Counts: []int{}, MinReferences: refs.Min, MaxReferences: min(16, refs.Max)}
	if item.Capability == "video" {
		result.Ratios = studioOptionStrings(spec.Options["size"])
		result.Sizes = studioOptionStrings(spec.Options["vquality"])
		result.Durations = studioOptionInts(spec.Options["videoSeconds"], 120)
		return result
	}
	result.Counts = studioOptionInts(spec.Options["count"], 10)
	if spec.ImageSize != nil && len(spec.ImageSize.Presets) > 0 {
		for _, preset := range spec.ImageSize.Presets {
			if preset.Size != "" {
				result.Sizes = append(result.Sizes, preset.Size)
			}
		}
		result.Sizes = uniqueNonEmpty(result.Sizes)
	} else {
		result.Sizes = studioOptionStrings(spec.Options["size"])
		if len(result.Sizes) == 0 {
			result.Ratios = studioOptionStrings(spec.Options["aspectRatio"])
		}
	}
	result.Sizes = result.Sizes[:min(len(result.Sizes), 40)]
	return result
}

func studioOptionStrings(option OptionConstraint) []string {
	result := make([]string, 0)
	for _, value := range option.Values {
		if text, ok := value.(string); ok && len(text) <= 40 {
			result = append(result, text)
		}
	}
	return result[:min(len(result), 40)]
}

func studioOptionInts(option OptionConstraint, maxValue int) []int {
	result := make([]int, 0)
	for _, value := range option.Values {
		if count, err := strconv.Atoi(fmt.Sprint(value)); err == nil && count >= 1 && count <= maxValue {
			result = append(result, count)
		}
	}
	if option.Min != nil && option.Max != nil && len(result) == 0 {
		for n := 1; n <= maxValue; n++ {
			if matchOptionConstraint("", option, n) {
				result = append(result, n)
			}
		}
	}
	return result
}

func (s *Service) studioMediaFeature(kind string) error {
	switch kind {
	case "image":
		return s.RequireFeature(FeatureImageWorkbench)
	case "video":
		return s.RequireFeature(FeatureVideoWorkbench)
	default:
		return BadAuthRequest("Invalid media type")
	}
}

func (s *Service) studioPrepare(userID, id string, req StudioGeneration) (*model.Task, *model.BillingOrder, error) {
	if err := s.studioMediaFeature(req.Kind); err != nil {
		return nil, nil, err
	}
	prompt := strings.TrimSpace(req.Prompt)
	if !supdanceOpenAIID.MatchString(req.Model) || prompt == "" || utf8.RuneCountInString(prompt) > 4000 ||
		len(req.References) > 16 || len(req.Ratio) > 24 || len(req.Size) > 40 || req.Duration < 0 || req.Duration > 120 || req.Count < 0 || req.Count > 10 {
		return nil, nil, BadAuthRequest("Invalid studio generation parameters")
	}
	switch req.Purpose {
	case "general":
	case "product-white", "product-scene":
		if err := s.RequireFeature(FeatureEcommerce); err != nil {
			return nil, nil, err
		}
		if req.Kind != "image" || len(req.References) == 0 {
			return nil, nil, studioError(http.StatusBadRequest, "studio_invalid_reference")
		}
		brief := "Use the first reference image as the source of truth for the product. Preserve its shape, color, markings, and proportions."
		if req.Purpose == "product-white" {
			brief += " Place the product on a clean, solid white background."
		} else {
			brief += " Place the product in the requested scene."
		}
		prompt = brief + "\n\n" + prompt
	case "reference-video":
		if req.Kind != "video" || len(req.References) == 0 {
			return nil, nil, studioError(http.StatusBadRequest, "studio_invalid_reference")
		}
	default:
		return nil, nil, BadAuthRequest("Invalid studio purpose")
	}
	if req.ProjectID != "" {
		if _, err := s.activeProjectForUser(userID, req.ProjectID); err != nil {
			return nil, nil, supdanceOpenAINotFound(err)
		}
	}
	meta := map[string]any{"source": "supdance-chatgpt-studio", "studioPurpose": req.Purpose}
	refs := append([]string{}, req.References...)
	if req.ShotID != "" {
		var err error
		refs, err = s.studioShotReferences(userID, req.ProjectID, req.ShotID, refs, meta)
		if err != nil {
			return nil, nil, err
		}
	}
	images := make([]map[string]any, 0, len(refs))
	seen := make(map[string]bool, len(refs))
	for _, ref := range refs {
		if seen[ref] || !supdanceOpenAIID.MatchString(ref) {
			return nil, nil, studioError(http.StatusBadRequest, "studio_invalid_reference")
		}
		seen[ref] = true
		res, err := s.repo.ResourceForUser(userID, ref)
		if errors.Is(err, gorm.ErrRecordNotFound) || err == nil && (res.Status != model.ResourceStatusReady || res.Kind != "image") {
			return nil, nil, studioError(http.StatusBadRequest, "studio_invalid_reference")
		}
		if err != nil {
			return nil, nil, err
		}
		images = append(images, map[string]any{"id": ref, "storageKey": "resource:" + ref, "mimeType": res.MimeType,
			"bytes": res.Size, "width": res.Width, "height": res.Height})
	}
	meta["studioReferenceIds"] = refs
	options := map[string]any{}
	if req.Kind == "image" {
		if req.Size != "" {
			options["size"] = req.Size
		}
		if req.Ratio != "" {
			options["aspectRatio"] = req.Ratio
		}
		if req.Count > 0 {
			options["count"] = req.Count
		}
	} else {
		if req.Ratio != "" {
			options["size"] = req.Ratio
		}
		if req.Size != "" {
			options["vquality"] = req.Size
		}
		if req.Duration > 0 {
			options["videoSeconds"] = req.Duration
		}
	}
	preparation := &creationTaskPreparation{}
	input := map[string]any{"mode": req.Kind, "prompt": prompt, "config": options, "capabilityOptions": options,
		"referenceImages": images, "metadata": meta}
	source := "text"
	if len(images) > 0 {
		source = "image"
	}
	task, err := s.CreateTask(userID, CreateTaskRequest{ProjectID: req.ProjectID, Type: "canvas_" + req.Kind,
		Prompt: prompt, LogicalModelID: req.Model, Operation: source + "_to_" + req.Kind, Input: input, workbenchKind: req.Kind,
		creationPrepare: preparation})
	if err != nil {
		return nil, nil, err
	}
	channelModel, err := s.repo.ChannelModel(task.ChannelModelID)
	if err != nil || !s.studioChannelConfigured(channelModel.ChannelID) {
		return nil, nil, studioError(http.StatusUnprocessableEntity, "studio_model_unavailable")
	}
	task.ID = id
	if preparation.Order != nil {
		preparation.Order.TaskID = id
	}
	return task, preparation.Order, nil
}

func studioRequestHash(req StudioSubmit) string {
	data, _ := json.Marshal(req)
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:])
}

func studioQuoteSignature(secret []byte, userID string, generation StudioGeneration, quote StudioQuote, task *model.Task) string {
	quote.ID = ""
	mac := hmac.New(sha256.New, secret)
	fmt.Fprintf(mac, "supdance-studio-v2\x00%s\x00%s\x00%s\x00", userID, task.LogicalModelRevisionID, studioRequestHash(StudioSubmit{generation, quote}))
	var input canvasGenerationInput
	_ = json.Unmarshal([]byte(task.InputJSON), &input)
	refs, _ := json.Marshal(input.ReferenceImages)
	mac.Write(refs)
	fmt.Fprint(mac, "\x00", stringValue(input.Metadata["studioDramaShotRevision"]))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (s *Service) StudioEstimate(userID string, secret []byte, req StudioGeneration) (StudioQuote, error) {
	task, order, err := s.studioPrepare(userID, newID(), req)
	if err != nil {
		return StudioQuote{}, err
	}
	if order == nil || !studioBillableMode(order.BillingMode) {
		return StudioQuote{}, studioError(http.StatusUnprocessableEntity, "studio_quote_required")
	}
	quote := StudioQuote{Microcredits: order.AmountMicrocredits, ExpiresAt: time.Now().Add(5 * time.Minute).UnixMilli(),
		Estimated: order.BillingMode == "token" || order.BillingMode == imagebilling.Mode}
	quote.ID = studioQuoteSignature(secret, userID, req, quote, task)
	return quote, nil
}

func studioTaskID(userID, key string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("supdance-studio-task\x00"+userID+"\x00"+key)).String()
}

func (s *Service) StudioOperation(userID, key string, req StudioSubmit) (StudioTask, error) {
	if !supdanceOpenAIID.MatchString(key) {
		return StudioTask{}, BadAuthRequest("Invalid request ID")
	}
	task, err := s.repo.TaskForUser(userID, studioTaskID(userID, key))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return StudioTask{}, NotFound("Studio task unavailable")
	}
	if err != nil {
		return StudioTask{}, err
	}
	if task.SubmissionHash != studioRequestHash(req) {
		return StudioTask{}, studioError(http.StatusConflict, "studio_idempotency_conflict")
	}
	return s.studioTaskView(*task)
}

func (s *Service) StudioFindTask(userID, key string) (StudioTask, error) {
	if !supdanceOpenAIID.MatchString(key) {
		return StudioTask{}, BadAuthRequest("Invalid request ID")
	}
	return s.StudioTask(userID, studioTaskID(userID, key))
}

func (s *Service) StudioSubmit(userID string, secret []byte, key string, req StudioSubmit) (StudioTask, error) {
	if previous, err := s.StudioOperation(userID, key, req); err == nil || !studioNotFound(err) {
		return previous, err
	}
	if req.Quote.ExpiresAt <= time.Now().UnixMilli() || req.Quote.Microcredits < 0 {
		return StudioTask{}, studioError(http.StatusConflict, "studio_quote_changed")
	}
	task, order, err := s.studioPrepare(userID, studioTaskID(userID, key), req.Generation)
	if err != nil {
		return StudioTask{}, err
	}
	if order == nil || order.AmountMicrocredits != req.Quote.Microcredits ||
		!hmac.Equal([]byte(req.Quote.ID), []byte(studioQuoteSignature(secret, userID, req.Generation, req.Quote, task))) {
		return StudioTask{}, studioError(http.StatusConflict, "studio_quote_changed")
	}
	if !studioBillableMode(order.BillingMode) {
		return StudioTask{}, studioError(http.StatusUnprocessableEntity, "studio_quote_required")
	}
	var input map[string]any
	if err := json.Unmarshal([]byte(task.InputJSON), &input); err != nil {
		return StudioTask{}, err
	}
	if config, ok := input["config"].(map[string]any); ok {
		if meta, ok := input["metadata"].(map[string]any); ok {
			count, _ := strconv.Atoi(stringValue(config["count"]))
			meta["studioExpectedOutputs"] = max(count, 1)
		}
	}
	if err := s.protectTaskSecrets(input); err != nil {
		return StudioTask{}, err
	}
	encoded, err := json.Marshal(input)
	if err != nil {
		return StudioTask{}, err
	}
	task.InputJSON, task.SubmissionHash = string(encoded), studioRequestHash(req)
	task.BillingOrderID, task.AuthorizedChargeMicrocredits = order.ID, order.AmountMicrocredits
	order.ChargeLimitSet, order.ChargeLimitMicrocredits = true, order.AmountMicrocredits
	policy, err := s.RuntimePolicy()
	if err != nil {
		return StudioTask{}, err
	}
	if err := s.createTaskWithinStorageQuota(task, order, policy); err != nil {
		if previous, lookupErr := s.StudioOperation(userID, key, req); !studioNotFound(lookupErr) {
			return previous, lookupErr
		}
		if errors.Is(err, repository.ErrInsufficientCredits) {
			return StudioTask{}, studioError(http.StatusPaymentRequired, "studio_entitlement_required")
		}
		return StudioTask{}, err
	}
	s.recordActivity(userID, "task", 1)
	return s.studioTaskView(*task)
}

func studioNotFound(err error) bool {
	var failure *AppError
	return errors.As(err, &failure) && failure.Status == http.StatusNotFound
}

func studioBillableMode(mode string) bool {
	return mode == "fixed_request" || mode == "per_second" || mode == "token" || mode == imagebilling.Mode
}

type StudioTask struct {
	ID          string        `json:"id"`
	ProjectID   string        `json:"projectId,omitempty"`
	Kind        string        `json:"kind"`
	Status      string        `json:"status"`
	Error       string        `json:"error,omitempty"`
	UpdatedAt   int64         `json:"updatedAt"`
	Assets      []StudioAsset `json:"assets"`
	References  []string      `json:"references,omitempty"`
	ErrorDetail string        `json:"errorDetail,omitempty"`
	Billing     string        `json:"billing"`
}

func (s *Service) StudioTask(userID, taskID string) (StudioTask, error) {
	task, err := s.repo.TaskForUser(userID, taskID)
	if errors.Is(err, gorm.ErrRecordNotFound) || err == nil && !studioTaskKind(task.WorkbenchKind) {
		return StudioTask{}, NotFound("Studio task unavailable")
	}
	if err != nil {
		return StudioTask{}, err
	}
	return s.studioTaskView(*task)
}

func studioTaskKind(kind string) bool { return kind == "image" || kind == "video" }

func (s *Service) StudioHistory(userID string) ([]StudioTask, error) {
	items := []model.Task{}
	for _, kind := range []string{"image", "video"} {
		tasks, err := s.repo.TasksWithWorkbenchKind(userID, 40, "", false, kind)
		if err != nil {
			return nil, err
		}
		items = append(items, tasks...)
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].UpdatedAt.After(items[j].UpdatedAt) })
	result := make([]StudioTask, 0, min(40, len(items)))
	for _, task := range items[:min(40, len(items))] {
		view, err := s.studioTaskView(task)
		if err != nil {
			return nil, err
		}
		result = append(result, view)
	}
	return result, nil
}

func (s *Service) studioTaskView(task model.Task) (StudioTask, error) {
	view := StudioTask{ID: task.ID, ProjectID: task.ProjectID, Kind: task.WorkbenchKind, Status: string(task.Status),
		UpdatedAt: task.UpdatedAt.UnixMilli(), Billing: "unknown", Assets: []StudioAsset{}}
	var input canvasGenerationInput
	_ = json.Unmarshal([]byte(task.InputJSON), &input)
	if refs, ok := input.Metadata["studioReferenceIds"].([]any); ok {
		for _, ref := range refs {
			if id, ok := ref.(string); ok && supdanceOpenAIID.MatchString(id) {
				view.References = append(view.References, id)
			}
		}
	}
	if task.BillingOrderID != "" {
		order, err := s.repo.BillingOrder(task.BillingOrderID)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return view, err
		}
		if order != nil && order.UserID == task.UserID {
			switch order.Status {
			case model.BillingStatusReserved, model.BillingStatusRunning:
				view.Billing = "reserved"
			case model.BillingStatusSettled, model.BillingStatusRefunded:
				view.Billing = string(order.Status)
			}
		}
	}
	var raw any
	if json.Unmarshal([]byte(task.ResultJSON), &raw) == nil {
		ids := []string{}
		studioResultResources(raw, &ids)
		ids = uniqueNonEmpty(ids)
		for index, id := range ids[:min(len(ids), 24)] {
			resource, err := s.StudioAssetRecord(task.UserID, id)
			if err != nil || resource.Kind != view.Kind {
				continue
			}
			view.Assets = append(view.Assets, studioAssetView(resource, generationMediaAssetTitle(task, resource.Kind, index, len(ids))))
		}
	}
	if task.Status == model.TaskStatusFailed {
		view.Error = "generation_failed"
		if diagnostic := taskExecutionDiagnostic(&task); diagnostic != nil {
			view.ErrorDetail = diagnostic.SafeMessage
		}
		if len(view.Assets) > 0 {
			view.Status = "partial"
		}
	} else if task.Status == model.TaskStatusSucceeded {
		requestedCount, _ := strconv.Atoi(input.Config.Count)
		if saved, ok := input.Metadata["studioExpectedOutputs"].(float64); ok {
			requestedCount = int(saved)
		}
		count := max(requestedCount, 1)
		if len(view.Assets) < count {
			view.Status, view.Error = "failed", "outputs_missing"
			if len(view.Assets) > 0 {
				view.Status = "partial"
			}
		}
	}
	return view, nil
}

func studioResultResources(raw any, ids *[]string) {
	switch item := raw.(type) {
	case []any:
		for _, child := range item {
			studioResultResources(child, ids)
		}
	case map[string]any:
		for _, key := range []string{"url", "dataUrl", "resultUrl", "outputUrl"} {
			if id := resourceIDFromFileURL(stringValue(item[key])); id != "" {
				*ids = append(*ids, id)
			}
		}
		if id := stringValue(item["resourceId"]); supdanceOpenAIID.MatchString(id) {
			*ids = append(*ids, id)
		}
		if key := stringValue(item["storageKey"]); strings.HasPrefix(key, "resource:") {
			*ids = append(*ids, strings.TrimPrefix(key, "resource:"))
		}
		for _, key := range []string{"image", "video", "images", "videos", "output", "outputs", "result"} {
			studioResultResources(item[key], ids)
		}
	}
}
