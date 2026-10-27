package adapters_test

import (
	"testing"

	"yingce/backend/internal/supdance/adapters"
	"yingce/backend/internal/supdance/domain"
)

func TestSupDanceDomainAndAdapterIsolation(t *testing.T) {
	meta := domain.DefaultMetadata()
	if meta.Namespace != "supdance" {
		t.Fatalf("unexpected namespace: %s", meta.Namespace)
	}
	if meta.UpstreamBaseline != "v1.7.1" || meta.SchemaBaseline != 71 {
		t.Fatalf("unexpected baseline: %+v", meta)
	}

	if err := domain.ValidateCustomTableName("supdance_workflows"); err != nil {
		t.Fatalf("expected valid custom table name, got: %v", err)
	}
	if err := domain.ValidateCustomTableName("users"); err == nil {
		t.Fatal("expected error for unprefixed table name colliding with upstream")
	}
	if err := domain.ValidateCustomTableName("supdance_"); err == nil {
		t.Fatal("expected error for empty suffix table name")
	}

	upstream := map[string]struct{}{
		"prompt-optimizer":      {},
		"eagle-asset-connector": {},
	}
	if err := adapters.CheckPluginManifestCompatibility("supdance-workflow-helper", "yingce.plugin/v2", upstream); err != nil {
		t.Fatalf("expected valid plugin compatibility, got: %v", err)
	}
	if err := adapters.CheckPluginManifestCompatibility("prompt-optimizer", "yingce.plugin/v2", upstream); err == nil {
		t.Fatal("expected rejection for unprefixed/colliding plugin ID")
	}
	if err := adapters.CheckPluginManifestCompatibility("supdance-workflow-helper", "yingce.plugin/v99", upstream); err == nil {
		t.Fatal("expected rejection for unsupported apiVersion")
	}
}
