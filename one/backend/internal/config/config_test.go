package config

import "testing"

func TestLoadAcceptsComposeONEPrefixedEnvVars(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("ONE_MIGRATIONS_DIR", "/migrations")
	t.Setenv("ONE_AGENT_URL", "http://agent:8090")
	t.Setenv("ONE_AGENT_TOKEN", "secret-token-with-at-least-32-chars")
	t.Setenv("ONE_CSRF_ORIGIN_REQUIRED", "false")
	t.Setenv("ONE_COOKIE_DOMAIN", ".supdance.com")

	cfg := Load()
	if !cfg.IsProduction {
		t.Fatalf("expected IsProduction=true")
	}
	if cfg.MigrationsDir != "/migrations" {
		t.Fatalf("MigrationsDir = %q, want /migrations", cfg.MigrationsDir)
	}
	if cfg.AgentURL != "http://agent:8090" {
		t.Fatalf("AgentURL = %q, want http://agent:8090", cfg.AgentURL)
	}
	if cfg.AgentToken != "secret-token-with-at-least-32-chars" {
		t.Fatalf("AgentToken mismatch")
	}
	if cfg.CSRFOriginRequired {
		t.Fatalf("expected CSRFOriginRequired=false from ONE_CSRF_ORIGIN_REQUIRED=false")
	}
	if cfg.CookieDomain != ".supdance.com" {
		t.Fatalf("CookieDomain = %q, want .supdance.com", cfg.CookieDomain)
	}
	if cfg.WorkerDisabled {
		t.Fatalf("expected WorkerDisabled=false by default")
	}

	t.Setenv("ONE_WORKER_DISABLED", "true")
	if !Load().WorkerDisabled {
		t.Fatalf("expected WorkerDisabled=true when ONE_WORKER_DISABLED=true")
	}
}
