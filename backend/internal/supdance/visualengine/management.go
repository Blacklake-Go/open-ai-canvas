package visualengine

const BundledVersion = "2.0.1"
const LifecycleSettingKey = "supdance_visual_engine_lifecycle"
const PermissionsSettingKey = "supdance_visual_engine_permissions"

var PermissionNames = []string{"view", "edit", "preview", "publish", "rollback", "lifecycle"}

type PermissionPolicy struct {
	Grants map[string][]string `json:"grants"`
}
type LifecycleState struct {
	Installed        bool   `json:"installed"`
	Version          string `json:"version"`
	AvailableVersion string `json:"availableVersion"`
	UpdatedAt        string `json:"updatedAt"`
	UpdatedBy        string `json:"updatedBy"`
	ConfigRetained   bool   `json:"configRetained"`
}
