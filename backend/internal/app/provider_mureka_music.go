package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"

	"yingce/backend/internal/model"
	"yingce/backend/internal/protocol"
)

const murekaSourceLimit = 10_000_000

var murekaAPIOrigin = "https://api.mureka.ai"

type murekaPrivateRequestKey struct{}

func murekaPrivateRequest(req *http.Request) bool {
	return req.Context().Value(murekaPrivateRequestKey{}) != nil || sameProviderOrigin(murekaAPIOrigin, req.URL.String())
}

type murekaTrack struct {
	URL string `json:"url"`
}
type murekaSongTask struct {
	ID      string        `json:"id"`
	Status  string        `json:"status"`
	Failure string        `json:"failed_reason"`
	Choices []murekaTrack `json:"choices"`
}

func runMurekaMusic(ctx context.Context, input canvasGenerationInput) (map[string]interface{}, error) {
	ctx = context.WithValue(ctx, murekaPrivateRequestKey{}, true)
	info, ok := ctx.Value(providerAnalyticsKey{}).(providerAnalyticsContext)
	if !ok || info.Service == nil || info.UserID == "" || info.TaskID == "" || metadataString(input.Metadata, "source") != "music-workbench" {
		return nil, errors.New("Mureka tools require an authenticated music workbench task")
	}
	base, err := url.Parse(input.Config.BaseURL)
	if err != nil || !sameProviderOrigin(murekaAPIOrigin, base.String()) || base.User != nil || base.RawQuery != "" || base.Fragment != "" || (strings.TrimRight(base.Path, "/") != "" && strings.TrimRight(base.Path, "/") != "/v1") || input.Config.APIKey == "" {
		return nil, errors.New("configure a Mureka API key and https://api.mureka.ai for this channel")
	}
	fields, _ := input.Metadata["music"].(map[string]any)
	op := metadataString(fields, "operation")
	if input.Config.Model != "mureka/"+op {
		return nil, errors.New("Mureka tool does not match the priced channel model")
	}
	switch op {
	case "reference", "persona", "remix", "region", "stems":
	default:
		return nil, errors.New("unknown Mureka operation")
	}
	config := input.Config
	id := resumedProviderRequestID(ctx)
	if id != "" {
		if op == "stems" {
			return nil, errors.New("stem archive recovery requires its original media checkpoint")
		}
		if !murekaID(id) {
			return nil, errors.New("invalid Mureka song task ID")
		}
		var state murekaSongTask
		if err := getJSON(withProviderRequestKind(ctx, "poll"), config, "/v1/song/query/"+url.PathEscape(id), &state); err != nil {
			if retryableIdempotentCreate(err) {
				return nil, detachedProtocolPending(id, "poll_retry", -1)
			}
			return nil, err
		}
		return finishMurekaSong(ctx, config, id, state)
	}
	asset, reader, err := info.Service.OpenResource(info.UserID, metadataString(fields, "sourceResourceId"))
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	if asset.Kind != "audio" || asset.Status != model.ResourceStatusReady || asset.Size <= 0 || asset.Size > murekaSourceLimit {
		return nil, errors.New("Mureka requires a ready MP3 or M4A source up to 10 MB")
	}
	data, err := io.ReadAll(io.LimitReader(reader, murekaSourceLimit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) != asset.Size || len(data) > murekaSourceLimit {
		return nil, errors.New("audio source size does not match the stored resource")
	}
	mime, ext, err := murekaSourceType(asset.MimeType, data)
	if err != nil {
		return nil, err
	}
	if err := claimMurekaDispatch(ctx, info); err != nil {
		return nil, err
	}
	if op == "stems" {
		var result struct {
			ZIP string `json:"zip_url"`
		}
		if err := postJSON(ctx, config, "/v1/song/stem", map[string]any{"url": dataURL(mime, data), "model": "audio-separation-1"}, &result); err != nil {
			return nil, err
		}
		return startMurekaStems(ctx, info, config, result.ZIP)
	}
	endpoint, body, err := murekaSongRequest(ctx, config, op, fields, data, ext)
	if err != nil {
		return nil, err
	}
	var state murekaSongTask
	if err := postJSON(ctx, config, endpoint, body, &state); err != nil {
		return nil, err
	}
	if !murekaID(state.ID) {
		return nil, errors.New("Mureka returned no valid song task ID")
	}
	if err := recordProtocolProviderTask(ctx, state.ID); err != nil {
		return nil, err
	}
	return finishMurekaSong(ctx, config, state.ID, state)
}

func claimMurekaDispatch(ctx context.Context, info providerAnalyticsContext) error {
	task, ok := ctx.Value(mediaExecutionTaskKey{}).(model.Task)
	if !ok || task.ID != info.TaskID || task.UserID != info.UserID {
		return errors.New("invalid Mureka task lease")
	}
	return info.Service.repo.WithContext(ctx).ClaimMusicToolDispatch(&task)
}

func murekaSourceType(declared string, data []byte) (string, string, error) {
	switch strings.ToLower(strings.TrimSpace(strings.Split(declared, ";")[0])) {
	case "audio/mpeg", "audio/mp3":
		if audioSignatureMatches("audio/mpeg", data) {
			return "audio/mpeg", "mp3", nil
		}
	case "audio/mp4", "audio/m4a", "audio/x-m4a":
		if len(data) >= 12 && string(data[4:8]) == "ftyp" {
			return "audio/mp4", "m4a", nil
		}
	}
	return "", "", errors.New("Mureka requires an MP3 or M4A file matching its stored media type")
}
func murekaID(id string) bool {
	if len(id) == 0 || len(id) > 256 {
		return false
	}
	for _, r := range id {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

// The precursor endpoints return a file ID or vocal ID, never a generation task ID.
func murekaSongRequest(ctx context.Context, config providerConfig, op string, fields map[string]any, data []byte, ext string) (string, map[string]any, error) {
	endpoint, purpose := "/v1/files/upload", "reference"
	switch op {
	case "persona":
		endpoint, purpose = "/v1/song/vocal-clone", ""
	case "region":
		purpose = "audio"
	case "remix":
		purpose = "remix"
	case "reference":
	default:
		return "", nil, errors.New("unsupported Mureka song operation")
	}
	upload := func() (string, error) { return uploadMurekaSource(ctx, config, endpoint, purpose, data, ext) }
	var id string
	var err error
	if op == "persona" {
		info, _ := ctx.Value(providerAnalyticsKey{}).(providerAnalyticsContext)
		if info.Service == nil || info.ChannelID == "" || info.UserID == "" {
			return "", nil, errors.New("no owner or channel for vocal profile")
		}
		id, err = info.Service.murekaVocalID(ctx, info.UserID, info.ChannelID, metadataString(fields, "sourceResourceId"), config.APIKey, upload)
	} else {
		id, err = upload()
	}
	if err != nil {
		return "", nil, err
	}
	body := map[string]any{"lyrics": metadataString(fields, "lyrics")}
	if op == "region" {
		body["upload_audio_id"], body["edit_start"], body["edit_end"] = id, fields["editStartMs"], fields["editEndMs"]
		return "/v1/song/region-edit", body, nil
	}
	body["model"], body["n"] = "mureka-9.5", 1
	switch op {
	case "persona":
		body["vocal_id"] = id
		if style := metadataString(fields, "style"); style != "" {
			body["prompt"] = style
		}
	case "remix":
		body["upload_audio_id"], body["prompt"] = id, metadataString(fields, "style")
		return "/v1/song/remix", body, nil
	case "reference":
		body["reference_id"] = id
	}
	return "/v1/song/generate", body, nil
}

func uploadMurekaSource(ctx context.Context, config providerConfig, endpoint, purpose string, data []byte, ext string) (string, error) {
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	if purpose != "" {
		if err := writer.WriteField("purpose", purpose); err != nil {
			return "", err
		}
	}
	part, err := writer.CreateFormFile("file", "source."+ext)
	if err != nil {
		return "", err
	}
	if _, err = part.Write(data); err != nil {
		return "", err
	}
	if err = writer.Close(); err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(withProviderRequestKind(ctx, "upload"), http.MethodPost, apiURL(config.BaseURL, endpoint), &buffer)
	if err != nil {
		return "", err
	}
	applyProviderAuth(req, config)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	// Do not retain a second readable body for the API-call log.
	req.GetBody = nil
	var uploaded struct {
		ID    string `json:"id"`
		Vocal string `json:"vocal_id"`
	}
	if err = doJSON(req, &uploaded); err != nil {
		return "", err
	}
	id := uploaded.ID
	if endpoint == "/v1/song/vocal-clone" {
		id = uploaded.Vocal
	}
	if !murekaID(id) {
		return "", errors.New("Mureka returned no valid resource ID")
	}
	return id, nil
}

func finishMurekaSong(ctx context.Context, config providerConfig, id string, state murekaSongTask) (map[string]interface{}, error) {
	if state.ID != id {
		return nil, errors.New("Mureka returned a different task ID")
	}
	switch state.Status {
	case "preparing", "queued", "running", "streaming":
		return nil, detachedProtocolPending(id, state.Status, -1)
	case "failed", "cancelled", "timeouted":
		return nil, protocolTaskFailure(ctx, protocol.StatusFailed, "Mureka reported "+state.Status, id)
	case "succeeded":
		if len(state.Choices) == 0 || len(state.Choices) > 3 {
			return nil, errors.New("invalid number of song results")
		}
		refs := make([]protocol.MediaReference, 0, len(state.Choices))
		for _, t := range state.Choices {
			if !murekaOutputURL(t.URL) {
				return nil, errors.New("invalid Mureka song result URL")
			}
			refs = append(refs, protocol.MediaReference{URL: t.URL, MIMEType: "audio/mpeg"})
		}
		return finishProtocolResult(ctx, config, "audio", id, &protocol.Result{Audios: refs}, declarativeProtocolPollPolicy("audio"))
	default:
		return nil, fmt.Errorf("unknown Mureka song status %q", state.Status)
	}
}

func murekaOutputURL(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "https" || sameProviderOrigin(murekaAPIOrigin, raw)) && u.Hostname() != "" && u.User == nil && u.Fragment == "" && len(raw) <= 16384
}
