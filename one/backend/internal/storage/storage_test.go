package storage

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"one/backend/internal/config"
)

func TestLocalAdapterPutStreamRangeAndTraversal(t *testing.T) {
	root := t.TempDir()
	a, err := NewLocalAdapter(AdapterConfig{Provider: "local", LocalRoot: root, PublicURLPrefix: "/uploads"})
	if err != nil {
		t.Fatalf("NewLocalAdapter: %v", err)
	}
	ctx := context.Background()
	payload := []byte("0123456789abcdef")
	res, err := a.Put(ctx, "images/2026/01/01/sample.png", payload, "image/png")
	if err != nil {
		t.Fatalf("Put: %v", err)
	}
	if res.Location != "/uploads/images/2026/01/01/sample.png" {
		t.Fatalf("unexpected location %q", res.Location)
	}

	rc, meta, err := a.OpenStream(ctx, "images/2026/01/01/sample.png", "bytes=4-7")
	if err != nil {
		t.Fatalf("OpenStream range: %v", err)
	}
	got, _ := io.ReadAll(rc)
	_ = rc.Close()
	if meta.StatusCode != http.StatusPartialContent || meta.ContentRange != "bytes 4-7/16" || string(got) != "4567" {
		t.Fatalf("unexpected range result: code=%d range=%q body=%q", meta.StatusCode, meta.ContentRange, string(got))
	}

	if _, _, err := a.OpenStream(ctx, "../../etc/passwd", ""); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("expected ErrInvalidKey on traversal, got %v", err)
	}
	if lat, err := a.TestConnection(ctx); err != nil || lat < 0 {
		t.Fatalf("TestConnection failed: %v", err)
	}
}

func newMockObjectServer(t *testing.T, checkAuth func(r *http.Request) bool) *httptest.Server {
	t.Helper()
	var mu sync.Mutex
	objects := map[string][]byte{}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !checkAuth(r) {
			http.Error(w, "missing signature", http.StatusForbidden)
			return
		}
		key := r.URL.Path
		switch r.Method {
		case http.MethodPut:
			b, _ := io.ReadAll(r.Body)
			mu.Lock()
			objects[key] = b
			mu.Unlock()
			w.Header().Set("ETag", `"mock-etag"`)
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			mu.Lock()
			b, ok := objects[key]
			mu.Unlock()
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/plain")
			w.Header().Set("Content-Length", itoa(len(b)))
			_, _ = w.Write(b)
		case http.MethodHead:
			mu.Lock()
			b, ok := objects[key]
			mu.Unlock()
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Length", itoa(len(b)))
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			mu.Lock()
			delete(objects, key)
			mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func TestS3OSSCOSWireSigningAndTestConnection(t *testing.T) {
	ctx := context.Background()

	s3Srv := newMockObjectServer(t, func(r *http.Request) bool {
		return strings.HasPrefix(r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 ")
	})
	defer s3Srv.Close()
	s3Adp, err := NewS3Adapter(AdapterConfig{
		Provider: "s3", Endpoint: s3Srv.URL, Region: "us-east-1", Bucket: "bkt",
		AccessKeyID: "ak", AccessKeySecret: "sk", PathStyle: true, AllowedHosts: []string{"127.0.0.1"},
	}, s3Srv.Client())
	if err != nil {
		t.Fatalf("NewS3Adapter: %v", err)
	}
	if _, err := s3Adp.TestConnection(ctx); err != nil {
		t.Fatalf("S3 TestConnection: %v", err)
	}
	if u, err := s3Adp.SignedURL("a/b.png", "attachment", 0); err != nil || !strings.Contains(u, "X-Amz-Signature=") {
		t.Fatalf("unexpected S3 signed url: %q err=%v", u, err)
	}

	ossSrv := newMockObjectServer(t, func(r *http.Request) bool {
		return strings.HasPrefix(r.Header.Get("Authorization"), "OSS ak:")
	})
	defer ossSrv.Close()
	ossAdp, err := NewOSSAdapter(AdapterConfig{
		Provider: "oss", Endpoint: ossSrv.URL, Region: "cn-hangzhou", Bucket: "bkt",
		AccessKeyID: "ak", AccessKeySecret: "sk", PathStyle: true, AllowedHosts: []string{"127.0.0.1"},
	}, ossSrv.Client())
	if err != nil {
		t.Fatalf("NewOSSAdapter: %v", err)
	}
	if _, err := ossAdp.TestConnection(ctx); err != nil {
		t.Fatalf("OSS TestConnection: %v", err)
	}
	if u, err := ossAdp.SignedURL("a/b.png", "inline", 0); err != nil || !strings.Contains(u, "OSSAccessKeyId=ak") {
		t.Fatalf("unexpected OSS signed url: %q err=%v", u, err)
	}

	cosSrv := newMockObjectServer(t, func(r *http.Request) bool {
		return strings.Contains(r.Header.Get("Authorization"), "q-sign-algorithm=sha1")
	})
	defer cosSrv.Close()
	cosAdp, err := NewCOSAdapter(AdapterConfig{
		Provider: "cos", Endpoint: cosSrv.URL, Region: "ap-guangzhou", Bucket: "bkt",
		AccessKeyID: "ak", AccessKeySecret: "sk", AllowedHosts: []string{"127.0.0.1"},
	}, cosSrv.Client())
	if err != nil {
		t.Fatalf("NewCOSAdapter: %v", err)
	}
	if _, err := cosAdp.TestConnection(ctx); err != nil {
		t.Fatalf("COS TestConnection: %v", err)
	}
	if u, err := cosAdp.SignedURL("a/b.png", "attachment", 0); err != nil || !strings.Contains(u, "q-signature=") {
		t.Fatalf("unexpected COS signed url: %q err=%v", u, err)
	}
}

func TestServiceIngestDataURLAndSSRFBlock(t *testing.T) {
	svc := &Service{
		Config: config.Config{StorageLocalRoot: t.TempDir()},
	}
	pngBytes := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00}
	res, err := svc.IngestRemoteURL(context.Background(), "data:image/png;base64,"+base64.StdEncoding.EncodeToString(pngBytes), "usr_1", "image", "test.png")
	if err != nil {
		t.Fatalf("IngestRemoteURL data url: %v", err)
	}
	if res.MIMEType != "image/png" || !strings.HasPrefix(res.ObjectKey, "generated/") {
		t.Fatalf("unexpected data url ingest result: %+v", res)
	}

	localSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("secret-metadata"))
	}))
	defer localSrv.Close()
	if _, err := svc.IngestRemoteURL(context.Background(), localSrv.URL+"/latest/meta-data", "usr_1", "image", "evil.png"); err == nil {
		t.Fatal("expected SSRF private loopback download to fail")
	}

	m, ext := DetectMIME(bytes.Repeat([]byte{0xff, 0xd8, 0xff, 0xe0}, 4), "", "pic.bin")
	if m != "image/jpeg" || ext != "jpg" {
		t.Fatalf("unexpected DetectMIME: %s %s", m, ext)
	}
}
