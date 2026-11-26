package protocol

import (
	"context"
	"testing"
)

func TestRunningHubSeedreamProTextImageUsesPixelDimensions(t *testing.T) {
	adapter := officialPackageAdapter(t, "runninghub-standard.yingce-plugin", "runninghub-standard-image")
	for _, tc := range []struct {
		model, ratio, resolution string
		width, height            float64
	}{
		{"seedream-v5-pro/text-to-image", "1:1", "1k", 1024, 1024},
		{"seedream-v5-pro/text-to-image", "16:9", "2k", 1408, 792},
		{"seedream-v5-pro/text-to-image", "9:16", "1k", 792, 1408},
		{"seedream-v5-pro/text-to-image", "4:3", "1k", 1152, 864},
		{"seedream-v5-pro/text-to-image", "3:4", "1k", 864, 1152},
		{"seedream-v5-pro/text-to-image", "3:2", "1k", 1248, 832},
		{"seedream-v5-pro/text-to-image", "2:3", "1k", 832, 1248},
		{"seedream-v5-pro/text-to-image", "5:4", "1k", 1120, 896},
		{"seedream-v5-pro/text-to-image", "4:5", "1k", 896, 1120},
		{"seedream-v5-pro/text-to-image", "21:9", "1k", 1568, 672},
		{"seedream-v5-pro/image-to-image", "1:1", "1k", 0, 0},
		{"rhart-image-g-2-official/text-to-image", "16:9", "2k", 0, 0},
	} {
		t.Run(tc.model+"/"+tc.ratio, func(t *testing.T) {
			req := GenerationRequest{
				Capability: CapabilityImage, Model: tc.model, Prompt: "a cat after the rain",
				AspectRatio: tc.ratio, Resolution: tc.resolution, ImageCount: 1,
				ImageParameters: map[string]any{"imageResolution": tc.resolution},
			}
			spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: req})
			if err != nil {
				t.Fatal(err)
			}
			body := manifestTestBody(t, spec)
			if spec.Path != "/openapi/v2/"+tc.model || body["resolution"] != tc.resolution {
				t.Fatalf("unexpected endpoint or resolution: %s %#v", spec.Path, body)
			}
			if tc.width > 0 {
				if body["width"] != tc.width || body["height"] != tc.height || body["aspectRatio"] != nil {
					t.Fatalf("expected %gx%g, got %#v", tc.width, tc.height, body)
				}
			} else if body["width"] != nil || body["height"] != nil || body["aspectRatio"] != tc.ratio {
				t.Fatalf("other endpoints should keep their original contract: %#v", body)
			}
		})
	}
	invalid := GenerationRequest{Capability: CapabilityImage, Model: "seedream-v5-pro/text-to-image", Prompt: "a cat", AspectRatio: "10:7", Resolution: "1k"}
	if _, err := adapter.BuildCreate(context.Background(), RequestContext{Request: invalid}); err == nil {
		t.Fatal("unsupported explicit ratio reached the provider")
	}
}
