package compactpicker

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"yingce/backend/internal/protocol"
)

func TestSupDanceCompactPickerManifest(t *testing.T) {
	filename := filepath.Join("..", "..", "..", "..", "supdance", "plugins", PluginID, "manifest.json")
	contents, err := os.ReadFile(filename)
	if err != nil {
		t.Fatal(err)
	}
	var manifest protocol.Manifest
	if err := json.Unmarshal(contents, &manifest); err != nil {
		t.Fatal(err)
	}
	if err := protocol.ValidateManifest(manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.Metadata.ID != PluginID || len(manifest.Permissions) != 0 || len(manifest.Contributes.Commands) != 1 {
		t.Fatalf("unexpected compact picker manifest: %s", contents)
	}
}
