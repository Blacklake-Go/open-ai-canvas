package main

import (
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestRunHealthcheckStatusCodes(t *testing.T) {
	okSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/ready" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer okSrv.Close()
	okURL, _ := url.Parse(okSrv.URL)
	if code := runHealthcheck(okURL.Port()); code != 0 {
		t.Fatalf("expected exit 0 on 200 /api/ready, got %d", code)
	}

	failSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer failSrv.Close()
	failURL, _ := url.Parse(failSrv.URL)
	if code := runHealthcheck(failURL.Port()); code != 1 {
		t.Fatalf("expected exit 1 on 503 /api/ready, got %d", code)
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	closedPort := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	_ = closedPort
	if code := runHealthcheck(okURL.Port() + "0"); code != 1 {
		t.Fatalf("expected exit 1 on unreachable port, got %d", code)
	}
}
