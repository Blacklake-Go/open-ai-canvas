package protocol

import (
	"context"
	"os"
	"reflect"
	"testing"
)

func TestRunningHubImageEditRequestContract(t *testing.T) {
	data, err := os.ReadFile("../../../plugin-packages/runninghub-standard.yingce-plugin")
	if err != nil {
		t.Fatal(err)
	}
	pkg, err := ParsePluginPackage(data)
	if err != nil {
		t.Fatal(err)
	}
	adapters, err := LoadInstalledProviders(pkg.ManifestRaw, nil)
	if err != nil {
		t.Fatal(err)
	}
	var image Adapter
	for _, adapter := range adapters {
		if adapter.Metadata().ID == "runninghub-standard-image" {
			image = adapter
			break
		}
	}
	if image == nil {
		t.Fatal("RunningHub image provider is missing")
	}

	const first = "https://example.com/reference.png"
	const second = "https://example.com/second.png"
	const grok = "rhart-imagine-image-quality/edit"
	const flux = "rhart-image/f-2-klein-9b/edit"
	const gpt = "rhart-image-g-2/image-to-image"
	const qwen = "alibaba/qwen-image-3.0/image-edit"
	const seedream = "seedream-v5-pro/image-to-image"
	provide := func(urls ...string) []MediaReference {
		images := make([]MediaReference, 0, len(urls))
		for _, url := range urls {
			images = append(images, MediaReference{Kind: "image", URL: url})
		}
		return images
	}
	for _, tc := range []struct {
		name, model, prompt string
		images              []MediaReference
		want                map[string]any
	}{
		{"grok array", grok, "Change the color.", provide(first, second), map[string]any{"imageUrl": []any{first, second}, "resolution": "1k", "numImages": "1", "outputFormat": "jpeg"}},
		{"flux scalar", flux, "Change the color.", provide(first), map[string]any{"imageUrl": first, "outputFormat": "png"}},
		{"standard array", gpt, "Change the color.", provide(first), map[string]any{"imageUrls": []any{first}}},
		{"text to image", "rhart-image-n-pro-official/text-to-image", "Draw a circle.", nil, map[string]any{}},
		{"grok missing image", grok, "Change the color.", nil, nil},
		{"grok too many images", grok, "Change the color.", provide(first, second, first, second), nil},
		{"flux missing image", flux, "Change the color.", nil, nil},
		{"flux multiple images", flux, "Change the color.", provide(first, second), nil},
		{"gpt missing image", gpt, "Change the color.", nil, nil},
		{"qwen missing image", qwen, "Change the color.", nil, nil},
		{"seedream short prompt", seedream, "改成橙色", provide(first), nil},
		{"seedream long prompt", seedream, "请改成橙色", provide(first), map[string]any{"imageUrls": []any{first}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			spec, err := image.BuildCreate(context.Background(), RequestContext{Request: GenerationRequest{
				Capability: CapabilityImage, Model: tc.model, Prompt: tc.prompt, Images: tc.images,
			}})
			if tc.want == nil {
				if err == nil {
					t.Fatal("invalid edit request reached the upstream create path")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			wantBody := map[string]any{"prompt": tc.prompt}
			for key, value := range tc.want {
				wantBody[key] = value
			}
			if spec.Path != "/openapi/v2/"+tc.model || !reflect.DeepEqual(spec.Body, wantBody) {
				t.Fatalf("create request = %s %#v, want %#v", spec.Path, spec.Body, wantBody)
			}
		})
	}
}
