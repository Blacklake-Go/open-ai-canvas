package protocol

import (
	"encoding/json"
	"os"
	"testing"
)

func TestRunningHubSunoResultsExcludeCoverImages(t *testing.T) {
	data, err := os.ReadFile("../../../plugin-packages/runninghub-standard/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	var manifest map[string]any
	if err := json.Unmarshal(data, &manifest); err != nil {
		t.Fatal(err)
	}
	var template any
	var findProvider func(any)
	findProvider = func(value any) {
		switch node := value.(type) {
		case map[string]any:
			if node["id"] == "runninghub-standard-audio-suno" {
				template = node["response"].(map[string]any)["audios"]
			}
			for _, child := range node {
				findProvider(child)
			}
		case []any:
			for _, child := range node {
				findProvider(child)
			}
		}
	}
	findProvider(manifest)
	if template == nil {
		t.Fatal("Suno provider response mapping missing")
	}
	results := []any{
		map[string]any{"url": "https://example.com/song-one.mp3"},
		map[string]any{"url": "https://example.com/song-two.mp3?signature=hidden"},
		map[string]any{"url": "https://example.com/cover.JPG?signature=hidden"},
		map[string]any{"url": "https://example.com/cover.png"},
		map[string]any{"url": nil, "outputType": "text", "text": "Song metadata"},
	}
	actual, err := evaluateManifestValue(template, map[string]any{"response": map[string]any{"results": results}})
	if err != nil {
		t.Fatal(err)
	}
	audios, ok := actual.([]any)
	if !ok || len(audios) != 2 {
		t.Fatalf("expected two playable audio results, got %#v", actual)
	}
	for index := range audios {
		if audios[index].(map[string]any)["url"] != results[index].(map[string]any)["url"] {
			t.Fatal("audio identity or signed URL changed")
		}
	}
}
