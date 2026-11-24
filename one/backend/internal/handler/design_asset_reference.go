package handler

import (
	"io"
	"net/http"
	"strconv"
)

func (d *Dependencies) handleDesignAssetReference(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	if d.Pool == nil {
		http.NotFound(w, r)
		return
	}
	query := r.URL.Query()
	content, meta, err := d.generationSvc(d.Pool).OpenDesignReference(
		r.Context(), pathParam(r, "job"), pathParam(r, "asset"), query.Get("expires"), query.Get("signature"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer content.Close()
	w.Header().Set("Content-Type", meta.ContentType)
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if meta.Size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(meta.Size, 10))
	}
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_, _ = io.Copy(w, content)
	}
}
