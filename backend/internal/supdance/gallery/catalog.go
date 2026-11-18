package gallery

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"yingce/backend/internal/kernel"
)

var catalogSources = []string{"seedance", "haohaoxue", "youmind"}

//go:embed originals.json
var originalJSON []byte

func originalCatalog() ([]Entry, error) {
	var entries []Entry
	err := json.Unmarshal(originalJSON, &entries)
	return entries, err
}

type cachedPack struct {
	info    os.FileInfo
	entries []Entry
}

// Cache parsed source data, never publication decisions or rendered responses.
type archiveCache struct {
	mu    sync.Mutex
	packs map[string]cachedPack
}

func (s Service) readPack(name string) ([]Entry, error) {
	file := filepath.Join(s.Dir, "inspirations", name)
	var info os.FileInfo
	if s.archive != nil {
		s.archive.mu.Lock()
		defer s.archive.mu.Unlock()
		var err error
		info, err = os.Stat(file)
		if err != nil {
			return nil, err
		}
		if cached, ok := s.archive.packs[name]; ok && os.SameFile(cached.info, info) && cached.info.Size() == info.Size() && cached.info.ModTime().Equal(info.ModTime()) {
			return cached.entries, nil
		}
	}
	var pack struct {
		Entries []Entry `json:"entries"`
	}
	if err := s.readJSON(name, &pack); err != nil {
		return nil, err
	}
	if pack.Entries == nil {
		return nil, fmt.Errorf("inspiration catalog %s has no entries array", name)
	}
	for _, entry := range pack.Entries {
		if ID(entry) == "" {
			return nil, fmt.Errorf("inspiration catalog %s contains an entry without an ID", name)
		}
	}
	if s.archive != nil {
		s.archive.packs[name] = cachedPack{info, pack.Entries}
	}
	return pack.Entries, nil
}

func (s Service) readJSON(name string, dest any) error {
	data, err := os.ReadFile(filepath.Join(s.Dir, "inspirations", name))
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

// LegacyPack serves the original catalog URLs through the same publication
// policy as thumbnails and feeds, while keeping the raw archive out of web.
func (s Service) LegacyPack(name string) (any, error) {
	if err := s.requirePublic(name == "gallery-pool.json"); err != nil {
		return nil, err
	}
	reviews, err := s.reviews()
	if err != nil {
		return nil, err
	}
	doc, err := s.publishedCuration()
	if err != nil {
		return nil, err
	}
	switch name {
	case "original.json":
		entries, err := originalCatalog()
		if err != nil {
			return nil, err
		}
		return map[string]any{"entries": filterEntries(doc.applyGalleryOrder(entries), reviews)}, nil
	case "seedance.json", "haohaoxue.json", "youmind.json":
		pack, err := s.readPack(name)
		if err != nil {
			return nil, err
		}
		return map[string]any{"entries": filterEntries(doc.applyGalleryOrder(pack), reviews)}, nil
	case "gallery-pool.json", "manifest.json",
		"translations/en-US.json", "translations/zh-TW.json", "translations/ja-JP.json",
		"translations/ko-KR.json", "translations/es-ES.json", "translations/fr-FR.json", "translations/de-DE.json":
		entries, err := s.catalogEntries()
		if err != nil {
			return nil, err
		}
		visible := filterEntries(doc.applyGalleryOrder(entries), reviews)
		switch name {
		case "gallery-pool.json":
			return s.publicPool(doc, visible)
		case "manifest.json":
			return s.publicManifest(visible)
		default:
			return s.publicTranslations(name, visible)
		}
	default:
		return nil, kernel.NotFound("目录不存在")
	}
}

func (s Service) publicPool(doc *CurationDocument, visible []Entry) (map[string]any, error) {
	if entries, err := s.editorialPool(doc); err != nil {
		return nil, err
	} else if entries != nil {
		return map[string]any{"entries": entries}, nil
	}
	pool, err := s.readPack("gallery-pool.json")
	if err != nil {
		return nil, err
	}
	byID := make(map[string]Entry, len(visible))
	for _, e := range visible {
		byID[ID(e)] = e
	}
	out := []Entry{}
	for _, entry := range visible {
		if entry["sourceId"] == "original" || entry["sourceId"] == "chatgpt-prompts" {
			out = append(out, entry)
		}
	}
	for _, item := range pool {
		if entry, ok := byID[ID(item)]; ok {
			out = append(out, entry)
		}
	}
	return map[string]any{"entries": out}, nil
}

func (s Service) publicManifest(visible []Entry) (any, error) {
	type source struct {
		Revision   string            `json:"revision,omitempty"`
		Count      int               `json:"count"`
		Categories map[string]string `json:"categories"`
	}
	var original struct {
		GeneratedAt string            `json:"generatedAt"`
		Sources     map[string]source `json:"sources"`
	}
	if err := s.readJSON("manifest.json", &original); err != nil {
		return nil, err
	}
	sources := make(map[string]source, len(catalogSources))
	for _, id := range catalogSources {
		sources[id] = source{Revision: original.Sources[id].Revision, Categories: map[string]string{}}
	}
	for _, entry := range visible {
		id, _ := entry["sourceId"].(string)
		item, ok := sources[id]
		if !ok {
			continue
		}
		item.Count++
		code, _ := entry["category"].(string)
		if label := original.Sources[id].Categories[code]; label != "" {
			item.Categories[code] = label
		}
		sources[id] = item
	}
	return map[string]any{"generatedAt": original.GeneratedAt, "sources": sources}, nil
}

func (s Service) publicTranslations(name string, visible []Entry) (any, error) {
	var pack map[string]json.RawMessage
	if err := s.readJSON(name, &pack); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, kernel.NotFound("未提供此语言的灵感翻译")
		}
		return nil, err
	}
	out := map[string]json.RawMessage{}
	for _, entry := range visible {
		if text, ok := pack[ID(entry)]; ok {
			out[ID(entry)] = text
		}
	}
	return out, nil
}
