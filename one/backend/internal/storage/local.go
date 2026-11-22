package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// LocalAdapter stores objects on the local filesystem inside a root-jailed directory.
type LocalAdapter struct {
	provider        string
	rootDir         string
	publicURLPrefix string
	pathPrefix      string
}

// NewLocalAdapter creates a root-jailed filesystem adapter.
func NewLocalAdapter(cfg AdapterConfig) (*LocalAdapter, error) {
	root := strings.TrimSpace(cfg.LocalRoot)
	if root == "" {
		root = filepath.Join(".", "data", "storage")
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("%w: resolve root: %v", ErrInvalidConfig, err)
	}
	prefix := strings.TrimRight(strings.TrimSpace(cfg.PublicURLPrefix), "/")
	if prefix == "" {
		prefix = "/uploads"
	}
	return &LocalAdapter{
		provider:        "local",
		rootDir:         absRoot,
		publicURLPrefix: prefix,
		pathPrefix:      SanitizePrefix(cfg.PathPrefix),
	}, nil
}

func (a *LocalAdapter) Provider() string { return a.provider }
func (a *LocalAdapter) Bucket() string   { return "" }
func (a *LocalAdapter) Region() string   { return "" }
func (a *LocalAdapter) Endpoint() string { return "" }

func (a *LocalAdapter) resolvePath(key string) (fullPath string, normalized string, err error) {
	// Local adapter stores directly relative to rootDir without duplicating prefixes on disk,
	// matching AmhStorageAdapter's resolvePath contract while blocking any path traversal.
	normalized, err = NormalizeObjectKey(key, "")
	if err != nil {
		return "", "", err
	}
	rel := filepath.FromSlash(normalized)
	joined := filepath.Clean(filepath.Join(a.rootDir, rel))
	if joined != a.rootDir && !strings.HasPrefix(joined, a.rootDir+string(filepath.Separator)) {
		return "", "", fmt.Errorf("%w: escapes storage root", ErrInvalidKey)
	}
	return joined, normalized, nil
}

func (a *LocalAdapter) Put(ctx context.Context, key string, body []byte, _ string) (PutResult, error) {
	if err := ctx.Err(); err != nil {
		return PutResult{}, err
	}
	fullPath, normalized, err := a.resolvePath(key)
	if err != nil {
		return PutResult{}, err
	}
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return PutResult{}, fmt.Errorf("%w: mkdir: %v", ErrUpstreamFailed, err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(fullPath), ".tmp-put-*")
	if err != nil {
		return PutResult{}, fmt.Errorf("%w: temp file: %v", ErrUpstreamFailed, err)
	}
	tmpName := tmp.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = tmp.Close()
			_ = os.Remove(tmpName)
		}
	}()
	if _, err := tmp.Write(body); err != nil {
		return PutResult{}, fmt.Errorf("%w: write: %v", ErrUpstreamFailed, err)
	}
	if err := tmp.Chmod(0o644); err != nil {
		return PutResult{}, fmt.Errorf("%w: chmod: %v", ErrUpstreamFailed, err)
	}
	if err := tmp.Close(); err != nil {
		return PutResult{}, fmt.Errorf("%w: close: %v", ErrUpstreamFailed, err)
	}
	if err := os.Rename(tmpName, fullPath); err != nil {
		return PutResult{}, fmt.Errorf("%w: rename: %v", ErrUpstreamFailed, err)
	}
	cleanup = false
	return PutResult{
		Provider: a.provider,
		Key:      normalized,
		Size:     int64(len(body)),
		ETag:     sha256HexBytes(body),
		Location: a.PublicURL(normalized),
	}, nil
}

func (a *LocalAdapter) OpenStream(ctx context.Context, key string, rangeHeader string) (io.ReadCloser, ObjectMeta, error) {
	if err := ctx.Err(); err != nil {
		return nil, ObjectMeta{}, err
	}
	fullPath, normalized, err := a.resolvePath(key)
	if err != nil {
		return nil, ObjectMeta{}, err
	}
	f, err := os.Open(fullPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, ObjectMeta{}, ErrObjectNotFound
		}
		return nil, ObjectMeta{}, fmt.Errorf("%w: open: %v", ErrUpstreamFailed, err)
	}
	st, err := f.Stat()
	if err != nil || st.IsDir() {
		_ = f.Close()
		return nil, ObjectMeta{}, ErrObjectNotFound
	}
	size := st.Size()
	meta := ObjectMeta{
		Key:          normalized,
		Provider:     a.provider,
		Size:         size,
		LastModified: st.ModTime().UTC().Format(http.TimeFormat),
		StatusCode:   http.StatusOK,
	}
	if strings.TrimSpace(rangeHeader) == "" || size == 0 {
		meta.ContentLength = size
		return f, meta, nil
	}
	start, end, ok := parseSingleByteRange(rangeHeader, size)
	if !ok {
		_ = f.Close()
		meta.StatusCode = http.StatusRequestedRangeNotSatisfiable
		return nil, meta, fmt.Errorf("%w: invalid range %q", ErrUpstreamFailed, rangeHeader)
	}
	length := end - start + 1
	if _, err := f.Seek(start, io.SeekStart); err != nil {
		_ = f.Close()
		return nil, ObjectMeta{}, fmt.Errorf("%w: seek: %v", ErrUpstreamFailed, err)
	}
	meta.StatusCode = http.StatusPartialContent
	meta.ContentLength = length
	meta.ContentRange = fmt.Sprintf("bytes %d-%d/%d", start, end, size)
	return &limitedFileReadCloser{r: io.LimitReader(f, length), f: f}, meta, nil
}

type limitedFileReadCloser struct {
	r io.Reader
	f *os.File
}

func (l *limitedFileReadCloser) Read(p []byte) (int, error) { return l.r.Read(p) }
func (l *limitedFileReadCloser) Close() error               { return l.f.Close() }

func (a *LocalAdapter) Head(ctx context.Context, key string) (ObjectMeta, error) {
	if err := ctx.Err(); err != nil {
		return ObjectMeta{}, err
	}
	fullPath, normalized, err := a.resolvePath(key)
	if err != nil {
		return ObjectMeta{}, err
	}
	st, err := os.Stat(fullPath)
	if err != nil || st.IsDir() {
		if errors.Is(err, os.ErrNotExist) {
			return ObjectMeta{}, ErrObjectNotFound
		}
		return ObjectMeta{}, ErrObjectNotFound
	}
	return ObjectMeta{
		Key:          normalized,
		Provider:     a.provider,
		Size:         st.Size(),
		LastModified: st.ModTime().UTC().Format(http.TimeFormat),
	}, nil
}

func (a *LocalAdapter) Exists(ctx context.Context, key string) (bool, error) {
	_, err := a.Head(ctx, key)
	if errors.Is(err, ErrObjectNotFound) {
		return false, nil
	}
	return err == nil, err
}

func (a *LocalAdapter) Delete(ctx context.Context, key string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	fullPath, _, err := a.resolvePath(key)
	if err != nil {
		return err
	}
	if err := os.Remove(fullPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("%w: remove: %v", ErrUpstreamFailed, err)
	}
	return nil
}

func (a *LocalAdapter) PublicURL(key string) string {
	_, norm, err := a.resolvePath(key)
	if err != nil {
		return ""
	}
	return a.publicURLPrefix + "/" + norm
}

func (a *LocalAdapter) SignedURL(key string, _ string, _ time.Duration) (string, error) {
	return a.PublicURL(key), nil
}

func (a *LocalAdapter) TestConnection(ctx context.Context) (int64, error) {
	started := time.Now()
	testKey := fmt.Sprintf(".storage-tests/%d.txt", time.Now().UnixNano())
	payload := []byte("one-storage-test")
	if _, err := a.Put(ctx, testKey, payload, "text/plain"); err != nil {
		return 0, err
	}
	defer func() { _ = a.Delete(context.Background(), testKey) }()
	rc, _, err := a.OpenStream(ctx, testKey, "")
	if err != nil {
		return 0, err
	}
	got, err := io.ReadAll(rc)
	_ = rc.Close()
	if err != nil {
		return 0, err
	}
	if !bytes.Equal(got, payload) {
		return 0, fmt.Errorf("%w: read mismatch", ErrUpstreamFailed)
	}
	return time.Since(started).Milliseconds(), nil
}

func parseSingleByteRange(header string, size int64) (start, end int64, ok bool) {
	trimmed := strings.TrimSpace(header)
	if !strings.HasPrefix(strings.ToLower(trimmed), "bytes=") || size <= 0 {
		return 0, 0, false
	}
	spec := strings.TrimSpace(trimmed[6:])
	if strings.Contains(spec, ",") {
		return 0, 0, false
	}
	parts := strings.SplitN(spec, "-", 2)
	if len(parts) != 2 {
		return 0, 0, false
	}
	startStr, endStr := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
	if startStr == "" {
		suffix, err := strconv.ParseInt(endStr, 10, 64)
		if err != nil || suffix <= 0 {
			return 0, 0, false
		}
		start = size - suffix
		if start < 0 {
			start = 0
		}
		return start, size - 1, true
	}
	var err error
	start, err = strconv.ParseInt(startStr, 10, 64)
	if err != nil || start < 0 || start >= size {
		return 0, 0, false
	}
	if endStr == "" {
		return start, size - 1, true
	}
	end, err = strconv.ParseInt(endStr, 10, 64)
	if err != nil || end < start {
		return 0, 0, false
	}
	if end >= size {
		end = size - 1
	}
	return start, end, true
}
