package visualengine

import (
	"encoding/json"
	"testing"
)

func TestDecodeConfigRejectsIncompleteAndUnknownValues(t *testing.T) {
	baseline, err := json.Marshal(DefaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := DecodeConfig(baseline); err != nil {
		t.Fatal(err)
	}
	cases := map[string]func(map[string]any){
		"missing boolean": func(config map[string]any) { delete(config["motion"].(map[string]any), "enabled") },
		"null number":     func(config map[string]any) { config["overlays"].(map[string]any)["modalBackdropBlur"] = nil },
		"unknown field":   func(config map[string]any) { config["unknown"] = true },
		"invalid shadow": func(config map[string]any) {
			config["elevations"].(map[string]any)["E2"].(map[string]any)["shadowDark"] = "rgba()"
		},
		"unknown mode": func(config map[string]any) {
			tokens := config["tokens"].(map[string]any)
			tokens["unknown"] = tokens["dark"]
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			var config map[string]any
			if err := json.Unmarshal(baseline, &config); err != nil {
				t.Fatal(err)
			}
			mutate(config)
			raw, err := json.Marshal(config)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := DecodeConfig(raw); err == nil {
				t.Fatal("accepted invalid configuration")
			}
		})
	}
}
