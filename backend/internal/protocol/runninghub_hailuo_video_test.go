package protocol

import (
	"context"
	"testing"
)

func TestRunningHubHailuoMaxVideoUsesEndpointRatio(t *testing.T) {
	adapter := officialPackageAdapter(t, "runninghub-standard.yingce-plugin", "runninghub-standard-video")
	for _, test := range []struct {
		model, present, absent, resolution string
	}{
		{"minimax/hailuo-h3-max/text-to-video", "ratio", "aspectRatio", "768P"},
		{"wan-2.2/text-to-video", "aspectRatio", "ratio", "768p"},
	} {
		t.Run(test.model, func(t *testing.T) {
			request := GenerationRequest{Model: test.model, Prompt: "A paper boat floats downstream.", AspectRatio: "9:16", Resolution: "768p", Duration: 5}
			spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request})
			if err != nil {
				t.Fatal(err)
			}
			body := manifestTestBody(t, spec)
			if spec.Path != "/openapi/v2/"+test.model || body[test.present] != "9:16" || body["duration"] != "5" || body["resolution"] != test.resolution {
				t.Fatalf("create path=%s body=%#v", spec.Path, body)
			}
			if _, exists := body[test.absent]; exists {
				t.Fatalf("unexpected %s in %#v", test.absent, body)
			}
		})
	}
}

func TestRunningHubYouchuanV81UsesStandardPriceSpec(t *testing.T) {
	adapter := officialPackageAdapter(t, "runninghub-standard.yingce-plugin", "runninghub-standard-image")
	request := GenerationRequest{Model: "youchuan/text-to-image-v81", Prompt: "A ceramic cup on a table.", Quality: "medium"}
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	body := manifestTestBody(t, spec)
	if spec.Path != "/openapi/v2/"+request.Model || body["quality"] != "1" || body["hd"] != false {
		t.Fatalf("create path=%s body=%#v", spec.Path, body)
	}
	request.Model = "rhart-image-g-2-official/text-to-image"
	spec, err = adapter.BuildCreate(context.Background(), RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	body = manifestTestBody(t, spec)
	if _, exists := body["hd"]; exists || body["quality"] != "medium" {
		t.Fatalf("unrelated endpoint body=%#v", body)
	}
}

func TestRunningHubFlux3UsesPublicPriceTier(t *testing.T) {
	adapter := officialPackageAdapter(t, "runninghub-standard.yingce-plugin", "runninghub-standard-image")
	request := GenerationRequest{Model: "rhart-image-flux3/text-to-image", Prompt: "A paper boat.", AspectRatio: "3:2"}
	spec, err := adapter.BuildCreate(context.Background(), RequestContext{Request: request})
	if err != nil {
		t.Fatal(err)
	}
	body := manifestTestBody(t, spec)
	if spec.Path != "/openapi/v2/"+request.Model || body["resolution"] != "768sq" || body["aspectRatio"] != "3:2" {
		t.Fatalf("create path=%s body=%#v", spec.Path, body)
	}
}
