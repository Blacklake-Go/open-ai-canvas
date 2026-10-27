// Package adapters provides minimal compatibility bridges between upstream contracts and SupDance domain rules.
package adapters

import (
	"fmt"
	"strings"

	"yingce/backend/internal/supdance/domain"
)

// SupportedAPIVersions lists the host plugin API versions compatible with SupDance extensions.
var SupportedAPIVersions = map[string]bool{
	"yingce.plugin/v1": true,
	"yingce.plugin/v2": true,
}

// CheckPluginManifestCompatibility verifies that a SupDance custom plugin manifest
// satisfies host API version constraints and does not collide with upstream plugin IDs.
func CheckPluginManifestCompatibility(pluginID, apiVersion string, upstreamIDs map[string]struct{}) error {
	if err := domain.ValidateCustomPluginID(pluginID); err != nil {
		return err
	}
	if !SupportedAPIVersions[strings.TrimSpace(apiVersion)] {
		return fmt.Errorf("unsupported plugin apiVersion %q", apiVersion)
	}
	if _, exists := upstreamIDs[strings.TrimSpace(pluginID)]; exists {
		return fmt.Errorf("plugin ID %q collides with an upstream plugin", pluginID)
	}
	return nil
}
