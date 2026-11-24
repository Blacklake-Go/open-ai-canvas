package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"mime/multipart"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
	"one/backend/internal/storage"
)

const feedbackMaxBytes = 30 << 20
const feedbackMaxFiles = 5

type feedbackAttachment struct {
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	MIMEType string `json:"mimeType"`
	Size     int64  `json:"sizeBytes"`
	Provider string `json:"provider"`
	Location string `json:"storageLocationId"`
	Bucket   string `json:"bucket"`
	Region   string `json:"region"`
	Key      string `json:"objectKey"`
}

type feedbackError struct {
	status        int
	code, message string
}

var feedbackFormats = map[string]string{
	".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif",
	".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
	".mp3": "audio/mpeg", ".wav": "audio/wav", ".aac": "audio/aac", ".m4a": "audio/mp4", ".flac": "audio/flac", ".ogg": "audio/ogg",
	".pdf": "application/pdf", ".zip": "application/zip", ".txt": "text/plain", ".log": "text/plain", ".json": "application/json",
}

func writeFeedbackError(w http.ResponseWriter, problem *feedbackError) {
	envelope.DomainError(w, problem.status, problem.message, problem.code)
}

func feedbackMultipartError(err error) *feedbackError {
	var limit *http.MaxBytesError
	if errors.As(err, &limit) || errors.Is(err, multipart.ErrMessageTooLarge) {
		return &feedbackError{http.StatusRequestEntityTooLarge, "FEEDBACK_ATTACHMENTS_TOO_LARGE", "附件总大小不能超过 30 MB"}
	}
	return &feedbackError{http.StatusBadRequest, "INVALID_BODY", "无法读取提交内容"}
}

func feedbackFilename(raw string) string {
	name := strings.TrimSpace(path.Base(strings.ReplaceAll(raw, "\\", "/")))
	if name == "." || name == "/" || strings.IndexFunc(name, unicode.IsControl) >= 0 || utf8.RuneCountInString(name) > 200 {
		return ""
	}
	return name
}

func feedbackMediaKind(mediaType string) string {
	kind, _, _ := strings.Cut(mediaType, "/")
	if kind == "image" || kind == "audio" || kind == "video" {
		return kind
	}
	return "file"
}

func validFeedbackFile(data []byte, mediaType string) bool {
	sniffed := strings.Split(http.DetectContentType(data), ";")[0]
	if mediaType == "text/plain" {
		return utf8.Valid(data)
	}
	if mediaType == "application/json" {
		return json.Valid(data)
	}
	if sniffed == mediaType {
		return true
	}
	if len(data) >= 12 && string(data[4:8]) == "ftyp" {
		switch mediaType {
		case "image/avif":
			return string(data[8:12]) == "avif" || string(data[8:12]) == "avis"
		case "video/mp4", "video/quicktime", "audio/mp4":
			return true
		}
	}
	switch mediaType {
	case "audio/wav":
		return sniffed == "audio/wave"
	case "audio/ogg":
		return sniffed == "application/ogg"
	case "audio/flac":
		return len(data) >= 4 && string(data[:4]) == "fLaC"
	case "audio/aac":
		return len(data) >= 7 && data[0] == 0xff && (data[1]&0xf6) == 0xf0
	case "audio/mpeg":
		return len(data) >= 4 && data[0] == 0xff && data[1]&0xe0 == 0xe0
	}
	return false
}

func storeFeedbackAttachments(ctx context.Context, svc *storage.Service, reportID, userID string, files []*multipart.FileHeader) (out []feedbackAttachment, problem *feedbackError) {
	invalid := &feedbackError{http.StatusBadRequest, "FEEDBACK_ATTACHMENT_INVALID", "附件为空、损坏或文件类型不受支持"}
	if len(files) > feedbackMaxFiles {
		return nil, &feedbackError{http.StatusBadRequest, "FEEDBACK_TOO_MANY_ATTACHMENTS", "最多上传 5 个附件"}
	}
	total := int64(0)
	for _, f := range files {
		name := feedbackFilename(f.Filename)
		if f.Size <= 0 || name == "" || feedbackFormats[strings.ToLower(path.Ext(name))] == "" {
			return nil, invalid
		}
		total += f.Size
		if total > feedbackMaxBytes {
			return nil, feedbackMultipartError(&http.MaxBytesError{Limit: feedbackMaxBytes})
		}
	}
	out = make([]feedbackAttachment, 0, len(files))
	defer func() {
		if problem != nil {
			cleanupFeedbackAttachments(ctx, svc, out)
		}
	}()
	for index, f := range files {
		name := feedbackFilename(f.Filename)
		ext := strings.ToLower(path.Ext(name))
		mediaType := feedbackFormats[ext]
		file, err := f.Open()
		if err != nil {
			return out, invalid
		}
		data, err := io.ReadAll(io.LimitReader(file, f.Size+1))
		_ = file.Close()
		if err != nil || int64(len(data)) != f.Size || !validFeedbackFile(data, mediaType) {
			return out, invalid
		}
		kind := feedbackMediaKind(mediaType)
		object, err := svc.IngestBuffer(ctx, storage.IngestInput{
			UserID: userID, Type: kind, Filename: name, ContentType: mediaType, SourceType: "feedback",
			ObjectKey: fmt.Sprintf("feedback/%s/%d%s", reportID, index, ext), Body: data,
		})
		if err != nil {
			return out, &feedbackError{http.StatusServiceUnavailable, "FEEDBACK_ATTACHMENT_STORE_FAILED", "附件暂时无法保存，请稍后重试"}
		}
		out = append(out, feedbackAttachment{
			Name: name, Kind: kind, MIMEType: mediaType, Size: object.SizeBytes,
			Provider: object.Provider, Location: object.StorageLocationID, Bucket: object.Bucket, Region: object.Region, Key: object.ObjectKey,
		})
	}
	return out, nil
}

func cleanupFeedbackAttachments(ctx context.Context, svc *storage.Service, items []feedbackAttachment) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()
	for _, item := range items {
		if err := svc.DeleteObject(ctx, item.Provider, item.Location, item.Bucket, item.Region, item.Key); err != nil {
			slog.Warn("feedback attachment rollback failed", "objectKey", item.Key)
		}
	}
}

func parseFeedbackAttachments(value any) ([]feedbackAttachment, error) {
	var items []feedbackAttachment
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(raw, &items)
	return items, err
}

func feedbackAttachmentMetadata(id string, value any, admin bool) ([]map[string]any, error) {
	items, err := parseFeedbackAttachments(value)
	if err != nil {
		return nil, err
	}
	prefix := "/api/feedback/"
	if admin {
		prefix = "/api/admin/feedback/"
	}
	result := make([]map[string]any, 0, len(items))
	for index, item := range items {
		dto := map[string]any{"name": item.Name, "kind": item.Kind, "mimeType": item.MIMEType, "sizeBytes": item.Size}
		if validFeedbackObject(id, item) {
			route := fmt.Sprintf("%s%s/attachments/%d", prefix, id, index)
			dto["url"] = route
			if item.Kind != "file" {
				dto["previewUrl"] = route + "?inline=1"
			}
		}
		result = append(result, dto)
	}
	return result, nil
}

func validFeedbackObject(id string, item feedbackAttachment) bool {
	return item.Provider != "" && strings.HasPrefix(item.Key, "feedback/"+id+"/") &&
		item.MIMEType != "" && feedbackFormats[strings.ToLower(path.Ext(item.Name))] == item.MIMEType
}

func feedbackOwnerAttachment(w http.ResponseWriter, r *http.Request, d *Dependencies, u *middleware.SessionUser) {
	if u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "请先登录", "UNAUTHENTICATED")
		return
	}
	if problem := writeFeedbackAttachment(w, r, d, u.ID); problem != nil {
		writeFeedbackError(w, problem)
	}
}

func writeFeedbackAttachment(w http.ResponseWriter, r *http.Request, d *Dependencies, owner string) *feedbackError {
	notFound := &feedbackError{http.StatusNotFound, "FEEDBACK_ATTACHMENT_NOT_FOUND", "附件不可用"}
	index, err := strconv.Atoi(pathParam(r, "index"))
	if err != nil || index < 0 || index >= feedbackMaxFiles {
		return notFound
	}
	if d.Pool == nil {
		return &feedbackError{http.StatusServiceUnavailable, "DB_UNAVAILABLE", "附件暂时无法读取"}
	}
	id := pathParam(r, "id")
	var raw json.RawMessage
	err = d.Pool.QueryRow(r.Context(), `SELECT attachments FROM ops_bill.feedback_reports WHERE id=$1 AND ($2='' OR user_id=$2)`, id, owner).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound
	}
	unavailable := &feedbackError{http.StatusServiceUnavailable, "FEEDBACK_ATTACHMENT_UNAVAILABLE", "附件暂时无法读取"}
	if err != nil {
		return unavailable
	}
	items, err := parseFeedbackAttachments(raw)
	if err != nil {
		return unavailable
	}
	if index >= len(items) || !validFeedbackObject(id, items[index]) {
		return notFound
	}
	item := items[index]
	reader, meta, err := d.storageSvc(d.Pool).OpenStream(r.Context(), item.Provider, item.Location, item.Bucket, item.Region, item.Key, r.Header.Get("Range"))
	if err != nil {
		if meta.StatusCode == http.StatusRequestedRangeNotSatisfiable {
			coreWrite416(r, w, item.Size)
			return nil
		}
		return unavailable
	}
	defer reader.Close()
	disposition := "attachment"
	if r.URL.Query().Get("inline") == "1" && feedbackMediaKind(item.MIMEType) != "file" {
		disposition = "inline"
	}
	w.Header().Set("Content-Type", item.MIMEType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": item.Name}))
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Accept-Ranges", "bytes")
	if meta.ContentLength > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(meta.ContentLength, 10))
	}
	if meta.ContentRange != "" {
		w.Header().Set("Content-Range", meta.ContentRange)
	}
	status := meta.StatusCode
	if status == 0 {
		status = http.StatusOK
	}
	w.WriteHeader(status)
	_, _ = io.Copy(w, reader)
	return nil
}
