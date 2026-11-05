package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/contentsafety"
)

type promptScreenerFunc func(context.Context, string) error

func (f promptScreenerFunc) Check(ctx context.Context, prompt string) error { return f(ctx, prompt) }

func TestPromptScreeningProtectsImageVideoAndPreventsAlternativeRoute(t *testing.T) {
	calls := 0
	s := &Service{promptScreener: promptScreenerFunc(func(context.Context, string) error { calls++; return &contentsafety.Error{Reason: "blocked"} })}
	for _, mode := range []string{"text", "audio"} {
		if err := s.ScreenGenerationPrompt(context.Background(), mode, "original"); err != nil {
			t.Fatal(err)
		}
	}
	if calls != 0 {
		t.Fatal("non-generation text was disclosed")
	}
	for _, mode := range []string{"image", "video"} {
		err := s.ScreenGenerationPrompt(context.Background(), mode, "original")
		var appErr *kernel.AppError
		if !errors.As(err, &appErr) || appErr.Status != 422 {
			t.Fatalf("incorrect rejection: %v", err)
		}
		next, routeErr := s.nextRouteAttemptAfterFailure(&model.Task{LogicalModelID: "logical"}, &model.RouteAttempt{DispatchState: "rejected_no_job"}, err)
		if routeErr != nil || next != nil {
			t.Fatal("screening rejection switched provider")
		}
	}
	if calls != 2 {
		t.Fatalf("screening calls=%d", calls)
	}
	if s.AuthorizeCustomRelayScreening("POST") == nil {
		t.Fatal("raw relay bypass permitted")
	}
	if s.AuthorizeCustomRelayScreening("GET") != nil {
		t.Fatal("read-only model discovery blocked")
	}
}

func TestMisconfiguredScreeningFailsClosed(t *testing.T) {
	s := &Service{promptScreenerErr: errors.New("configuration detail")}
	err := s.ScreenGenerationPrompt(context.Background(), "image", "original")
	var appErr *kernel.AppError
	if !errors.As(err, &appErr) || appErr.Status != 503 {
		t.Fatalf("incorrect configuration failure: %v", err)
	}
	next, routeErr := s.nextRouteAttemptAfterFailure(&model.Task{LogicalModelID: "logical"}, &model.RouteAttempt{DispatchState: "rejected_no_job"}, err)
	if routeErr != nil || next != nil {
		t.Fatal("invalid screening configuration switched provider")
	}
	if s.AuthorizeCustomRelayScreening("POST") == nil {
		t.Fatal("invalid screening configuration permitted relay")
	}
	if (&Service{}).AuthorizeCustomRelayScreening("POST") != nil {
		t.Fatal("disabled feature changed existing relay")
	}
}

func TestImageGenerationStopsBeforeProviderCreateWhenScreeningRejects(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	providerCalls := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		providerCalls++
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer upstream.Close()
	s := New(repository.New(newSQLiteTestDB(t)), t.TempDir())
	s.promptScreener = promptScreenerFunc(func(_ context.Context, prompt string) error {
		if prompt != "preserved prompt" {
			t.Fatalf("prompt changed: %q", prompt)
		}
		return &contentsafety.Error{Reason: "blocked"}
	})
	input, err := json.Marshal(canvasGenerationInput{Mode: "image", Prompt: "preserved prompt", Config: providerConfig{BaseURL: upstream.URL, APIKey: "fixture", APIFormat: "openai", InterfaceType: string(model.ChannelInterfaceOpenAIImage), Model: "fixture"}})
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.processCanvasGenerationTask(context.Background(), "fixture-user", "", "canvas_image", "", string(input))
	var verdict *contentsafety.Error
	if !errors.As(err, &verdict) || verdict.Reason != "blocked" || providerCalls != 0 {
		t.Fatalf("generation bypassed screening: error=%v providerCalls=%d", err, providerCalls)
	}
}
