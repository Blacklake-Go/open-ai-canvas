package generation

import "strings"

// PromptAllowed applies the same generation content policy to HTTP and worker submissions.
func PromptAllowed(prompt string) bool {
	lower := strings.ToLower(strings.TrimSpace(prompt))
	for _, prohibited := range []string{"child porn", "child sexual", "csam", "minor nude", "teen nude", "rape", "incest", "bestiality", "snuff", "terrorist attack", "make a bomb", "how to make a bomb"} {
		if strings.Contains(lower, prohibited) {
			return false
		}
	}
	return true
}
