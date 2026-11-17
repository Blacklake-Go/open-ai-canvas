package emailtpl

import (
	"fmt"
	"strings"
	"yingce/backend/internal/supdance/maillocale"
)

// Reuse the exact integer rounding of FormatCredits; localization only changes separators.
func FormatCreditsLocale(micro int64, locale string) string {
	value := FormatCredits(micro)
	separator, decimal := ",", "."
	switch maillocale.Resolve(locale) {
	case "de-DE", "es-ES":
		separator, decimal = ".", ","
	case "fr-FR":
		separator, decimal = "\u202f", ","
	}
	parts := strings.SplitN(value, ".", 2)
	result := strings.ReplaceAll(parts[0], ",", separator)
	if len(parts) == 2 {
		result += decimal + parts[1]
	}
	return result
}
func formatDecimalLocale(value float64, precision int, locale string) string {
	formatted := fmt.Sprintf("%.*f", precision, value)
	switch maillocale.Resolve(locale) {
	case "de-DE", "es-ES", "fr-FR":
		formatted = strings.ReplaceAll(formatted, ".", ",")
	}
	return formatted
}
