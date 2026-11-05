package app

import (
	"encoding/json"
	"testing"

	"yingce/backend/internal/model"
)

func TestTextTokenUsageKeepsOneHourWritesAsSubset(t *testing.T) {
	for _, raw := range []string{
		`{"input_tokens":100,"output_tokens":10,"cache_creation_input_tokens":1000,"cache_creation":{"ephemeral_5m_input_tokens":400,"ephemeral_1h_input_tokens":600}}`,
		`{"input_tokens":100,"output_tokens":10,"cache_creation":{"ephemeral_5m_input_tokens":400,"ephemeral_1h_input_tokens":600}}`,
		`{"prompt_tokens":1100,"completion_tokens":10,"prompt_tokens_details":{"cache_creation_input_tokens":1000,"cache_creation":{"ephemeral_5m_input_tokens":400,"ephemeral_1h_input_tokens":600}}}`,
		`{"prompt_tokens":1100,"completion_tokens":10,"cache_write_tokens":1000,"cache_creation":{"ephemeral_5m_input_tokens":400,"ephemeral_1h_input_tokens":600}}`,
		`{"prompt_tokens":1100,"completion_tokens":10,"cache_creation_input_tokens":1000,"cache_creation":{"ephemeral_5m_input_tokens":400,"ephemeral_1h_input_tokens":600}}`,
	} {
		var usage map[string]any
		if err := json.Unmarshal([]byte(raw), &usage); err != nil {
			t.Fatal(err)
		}
		var log model.ApiCallLog
		applyTextTokenUsage(&log, usage)
		if !log.UsageAvailable || log.InputTokens != 1100 || log.CacheWriteTokens != 1000 || log.CacheWrite1hTokens != 600 || log.OutputTokens != 10 {
			t.Fatalf("incorrect normalized usage: %+v", log)
		}
	}
}

func TestTextTokenUsageOpenAIRootCacheWritesDoNotAddInputTwice(t *testing.T) {
	var log model.ApiCallLog
	applyTextTokenUsage(&log, map[string]any{"input_tokens": json.Number("1100"), "output_tokens": json.Number("10"), "cache_write_tokens": json.Number("1000")})
	if !log.UsageAvailable || log.InputTokens != 1100 || log.CacheWriteTokens != 1000 || log.OutputTokens != 10 {
		t.Fatalf("incorrect OpenAI root cache usage: %+v", log)
	}
}
