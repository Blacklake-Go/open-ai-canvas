package model

import "errors"

// TokenPriceBand applies to the entire request once its total input reaches the
// threshold. Providers such as GPT Pro change both input and output rates.
type TokenPriceBand struct {
	MinInputTokens                     int64  `json:"minInputTokens"`
	InputTokenPriceMicrocredits        int64  `json:"inputTokenPriceMicrocredits"`
	OutputTokenPriceMicrocredits       int64  `json:"outputTokenPriceMicrocredits"`
	CachedTokenPriceMicrocredits       int64  `json:"cachedTokenPriceMicrocredits"`
	CacheWriteTokenPriceMicrocredits   int64  `json:"cacheWriteTokenPriceMicrocredits"`
	CacheWrite1hTokenPriceMicrocredits *int64 `json:"cacheWrite1hTokenPriceMicrocredits,omitempty"`
}

func ValidateTokenPriceBands(bands []TokenPriceBand) error {
	if len(bands) > 16 {
		return errors.New("too many token price bands")
	}
	for index, band := range bands {
		if band.MinInputTokens < 0 || band.MinInputTokens > 9_007_199_254_740_991 || index == 0 && band.MinInputTokens != 0 || index > 0 && band.MinInputTokens <= bands[index-1].MinInputTokens {
			return errors.New("token price bands must start at zero with strictly increasing thresholds")
		}
		for _, price := range []int64{band.InputTokenPriceMicrocredits, band.OutputTokenPriceMicrocredits, band.CachedTokenPriceMicrocredits, band.CacheWriteTokenPriceMicrocredits} {
			if price < 0 {
				return errors.New("token price band has an invalid price")
			}
		}
		if band.CacheWrite1hTokenPriceMicrocredits != nil && *band.CacheWrite1hTokenPriceMicrocredits < 0 {
			return errors.New("negative one-hour cache write price")
		}
	}
	return nil
}

func CloneTokenPriceBands(bands []TokenPriceBand) []TokenPriceBand {
	copy := append([]TokenPriceBand(nil), bands...)
	for index := range copy {
		if copy[index].CacheWrite1hTokenPriceMicrocredits != nil {
			price := *copy[index].CacheWrite1hTokenPriceMicrocredits
			copy[index].CacheWrite1hTokenPriceMicrocredits = &price
		}
	}
	return copy
}

// SelectTokenPriceBand reads only the order's immutable policy at settlement;
// an administrator changing today's rates must not change an existing order.
func SelectTokenPriceBand(inputTokens int64, base TokenPriceBand, bands []TokenPriceBand) (TokenPriceBand, error) {
	if inputTokens < 0 {
		return TokenPriceBand{}, errors.New("negative input token usage")
	}
	if err := ValidateTokenPriceBands(bands); err != nil {
		return TokenPriceBand{}, err
	}
	selected := base
	for _, band := range bands {
		if inputTokens < band.MinInputTokens {
			break
		}
		selected = band
	}
	return selected, nil
}
