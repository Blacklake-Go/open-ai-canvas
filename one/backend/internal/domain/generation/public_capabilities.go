package generation

import (
	"encoding/json"
	"math"
	"slices"
	"strconv"
)

type publicModelOptions struct {
	aspectRatios json.RawMessage
	resolutions  json.RawMessage
	durations    json.RawMessage
	inputTypes   json.RawMessage
	outputTypes  json.RawMessage
}

type publicGenerationCapability struct {
	TaskType     string    `json:"taskType"`
	InputTypes   []string  `json:"inputTypes,omitempty"`
	OutputTypes  []string  `json:"outputTypes,omitempty"`
	AspectRatios []string  `json:"aspectRatios,omitempty"`
	Resolutions  []string  `json:"resolutions,omitempty"`
	Durations    []float64 `json:"durations,omitempty"`
	Qualities    []string  `json:"qualities,omitempty"`
	Parameters   []string  `json:"parameters,omitempty"`
}

var studioTaskMedia = map[string]struct{ input, output string }{
	"t2i": {input: "text", output: "image"},
	"i2i": {input: "image", output: "image"},
	"t2v": {input: "text", output: "video"},
	"i2v": {input: "image", output: "video"},
	"v2v": {input: "video", output: "video"},
}

func (m ActiveModel) publicCapabilities() []publicGenerationCapability {
	var declared struct {
		Modes      []string `json:"modes"`
		Parameters []string `json:"parameters"`
		Qualities  []string `json:"quality_values"`
	}
	_ = json.Unmarshal(m.GenerationCapabilities, &declared)

	contract := make([]publicGenerationCapability, 0, len(declared.Modes))
	seen := make(map[string]bool, len(declared.Modes))
	inputTypes := publicStrings(m.options.inputTypes)
	outputTypes := publicStrings(m.options.outputTypes)
	for _, mode := range declared.Modes {
		if mode == "" || seen[mode] {
			continue
		}
		seen[mode] = true
		capability := publicGenerationCapability{TaskType: mode}
		if media, ok := studioTaskMedia[mode]; ok {
			// The declared task type specifies its required media. Published
			// restrictions can narrow it but cannot enable a conflicting task.
			if (len(inputTypes) > 0 && !slices.Contains(inputTypes, media.input)) ||
				(len(outputTypes) > 0 && !slices.Contains(outputTypes, media.output)) {
				continue
			}
			capability.InputTypes = inputTypes
			if len(capability.InputTypes) == 0 {
				capability.InputTypes = []string{media.input}
			}
			capability.OutputTypes = []string{media.output}
			capability.AspectRatios = publicStrings(m.options.aspectRatios)
			capability.Resolutions = publicStrings(m.options.resolutions)
			capability.Durations = publicDurations(m.options.durations)
			capability.Qualities = declared.Qualities
			capability.Parameters = declared.Parameters
		}
		contract = append(contract, capability)
	}
	return contract
}

func publicStrings(raw json.RawMessage) []string {
	var values []string
	_ = json.Unmarshal(raw, &values)
	return slices.DeleteFunc(values, func(value string) bool { return value == "" })
}

func publicDurations(raw json.RawMessage) []float64 {
	var values []json.RawMessage
	_ = json.Unmarshal(raw, &values)
	var durations []float64
	for _, value := range values {
		seconds := string(value)
		if len(value) > 0 && value[0] == '"' {
			if err := json.Unmarshal(value, &seconds); err != nil {
				continue
			}
		}
		duration, err := strconv.ParseFloat(seconds, 64)
		if err == nil && duration > 0 && !math.IsInf(duration, 0) && !slices.Contains(durations, duration) {
			durations = append(durations, duration)
		}
	}
	return durations
}
