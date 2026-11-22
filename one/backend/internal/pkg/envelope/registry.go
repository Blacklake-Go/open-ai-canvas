package envelope

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed routes_manifest.json
var routesManifestBytes []byte

type RouteContract struct {
	RoutePath      string   `json:"routePath"`
	Methods        []string `json:"methods"`
	PolicyTier     string   `json:"policyTier"`
	ResponseFormat Format   `json:"responseFormat"`
	IsAPI          bool     `json:"isApi"`
	IsAdmin        bool     `json:"isAdmin"`
}

func LoadRouteContracts() ([]RouteContract, error) {
	var contracts []RouteContract
	if err := json.Unmarshal(routesManifestBytes, &contracts); err != nil {
		return nil, fmt.Errorf("decode embedded route contracts: %w", err)
	}
	for _, c := range contracts {
		if !IsValidFormat(c.ResponseFormat) {
			return nil, fmt.Errorf("route %s has unknown envelope format %q", c.RoutePath, c.ResponseFormat)
		}
		if len(c.Methods) == 0 {
			return nil, fmt.Errorf("route %s has no HTTP methods", c.RoutePath)
		}
	}
	return contracts, nil
}

// NextRouteToPattern converts Next.js App Router path notation (`/api/assets/[id]/download`,
// `/api/agents/[[...path]]`, `/api/canvas/[...path]`) to a Go ServeMux pattern + optional catch-all.
func NextRouteToPattern(nextPath string) (pattern string, isCatchAll bool) {
	parts := strings.Split(strings.TrimPrefix(nextPath, "/"), "/")
	out := make([]string, 0, len(parts))
	for i, part := range parts {
		if strings.HasPrefix(part, "[[...") && strings.HasSuffix(part, "]]") {
			name := strings.TrimSuffix(strings.TrimPrefix(part, "[[..."), "]]")
			out = append(out, "{"+name+"...}")
			isCatchAll = true
			continue
		}
		if strings.HasPrefix(part, "[...") && strings.HasSuffix(part, "]") {
			name := strings.TrimSuffix(strings.TrimPrefix(part, "[..."), "]")
			out = append(out, "{"+name+"...}")
			isCatchAll = true
			continue
		}
		if strings.HasPrefix(part, "[") && strings.HasSuffix(part, "]") {
			name := strings.TrimSuffix(strings.TrimPrefix(part, "["), "]")
			if i == len(parts)-1 {
				out = append(out, "{"+name+"}")
			} else {
				out = append(out, "{"+name+"}")
			}
			continue
		}
		out = append(out, part)
	}
	return "/" + strings.Join(out, "/"), isCatchAll
}
