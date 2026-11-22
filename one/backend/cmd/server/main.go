package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/db"
	"one/backend/internal/domain/admin"
	"one/backend/internal/domain/assets"
	"one/backend/internal/domain/auth"
	"one/backend/internal/domain/billing"
	"one/backend/internal/domain/canvas"
	"one/backend/internal/domain/community"
	"one/backend/internal/domain/federation"
	"one/backend/internal/domain/finance"
	"one/backend/internal/domain/generation"
	"one/backend/internal/domain/site"
	"one/backend/internal/domain/user"
	"one/backend/internal/handler"
	"one/backend/internal/middleware"
	"one/backend/internal/notify"
	"one/backend/internal/platform/coordination"
	"one/backend/internal/queue"
	"one/backend/internal/storage"
	"one/backend/internal/worker"
)

func main() {
	migrateOnly := flag.Bool("migrate", false, "verify/apply pending SQL migrations and exit")
	applyMigrations := flag.Bool("apply-migrations", false, "apply pending SQL migrations on startup")
	healthcheckOnly := flag.Bool("healthcheck", false, "probe local /api/ready endpoint and exit")
	flag.Parse()

	cfg := config.Load()
	if *healthcheckOnly {
		os.Exit(runHealthcheck(cfg.Port))
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pgPool, poolErr := db.NewPool(ctx, cfg)
	if cfg.DatabaseURL != "" && poolErr != nil {
		log.Fatalf("database init failed: %v", poolErr)
	}
	if pgPool != nil {
		defer pgPool.Close()
		if err := db.HealthCheck(ctx, pgPool); err != nil {
			log.Fatalf("database ping failed: %v", err)
		}
		if *migrateOnly || *applyMigrations {
			status, err := db.VerifyAndApplyMigrations(ctx, pgPool, cfg.MigrationsDir, true)
			if err != nil {
				log.Fatalf("migrations failed: %v", err)
			}
			log.Printf("migrations verified: applied=%d pending=%d drifted=%d", len(status.Applied), len(status.Pending), len(status.Drifted))
			if *migrateOnly {
				return
			}
		} else if cfg.MigrationsDir != "" {
			status, err := db.VerifyAndApplyMigrations(ctx, pgPool, cfg.MigrationsDir, false)
			if err != nil {
				log.Fatalf("migration checksum verification failed: %v", err)
			}
			if len(status.Drifted) > 0 {
				log.Fatalf("migration checksum drift detected: %v", status.Drifted)
			}
			log.Printf("migrations ledger ok: applied=%d pending=%d", len(status.Applied), len(status.Pending))
		}
	} else if *migrateOnly {
		log.Fatal("DATABASE_URL is required for -migrate")
	}

	hub := queue.NewEventHub()
	if pgPool != nil {
		go func() {
			if err := hub.ListenLoop(ctx, pgPool); err != nil && !errors.Is(err, context.Canceled) {
				log.Printf("LISTEN/NOTIFY hub stopped: %v", err)
			}
		}()
	}

	var dbCheck handler.HealthChecker
	if pgPool != nil {
		dbCheck = func(checkCtx context.Context) error {
			return db.HealthCheck(checkCtx, pgPool)
		}
	}

	coord, coordErr := coordination.New(coordination.Options{
		RedisURL:      cfg.RedisURL,
		RedisPassword: cfg.RedisPassword,
		Pool:          pgPool,
	})
	if coordErr != nil {
		log.Fatalf("coordination init failed: %v", coordErr)
	}
	defer func() { _ = coord.Close() }()

	authRepo := &auth.PGRepository{Pool: pgPool}
	userRepo := &user.PGRepository{Pool: pgPool}
	financeRepo := &finance.PGRepository{Pool: pgPool}
	billingRepo := &billing.PGRepository{Pool: pgPool}
	sessionLookup := &middleware.PGSessionLookup{Pool: pgPool}

	financeSvc := &finance.Service{
		Repo:  financeRepo,
		Coord: coord,
	}
	billingSvc := &billing.Service{
		Repo:    billingRepo,
		Finance: financeSvc,
		Coord:   coord,
		Config:  cfg,
		Gateway: billing.NewHTTPGateway(cfg, pgPool, nil),
	}
	notifySvc := &notify.Service{
		Pool:   pgPool,
		Config: cfg,
	}
	authSvc := &auth.Service{
		Entitlements: entitlementsAdapter{svc: billingSvc},
		Repo:         authRepo,
		Sessions:     sessionLookup,
		Coord:        coord,
		Config:       cfg,
		Sender:       notifySvc,
	}
	userSvc := &user.Service{
		Repo:     userRepo,
		AuthRepo: authRepo,
		Sender:   notifySvc,
		Coord:    coord,
		Secret:   cfg.AuthVerificationCodeSecret,
	}

	storageSvc := &storage.Service{
		Pool:   pgPool,
		Config: cfg,
		Entitlements: func(checkCtx context.Context, userID string) (int64, error) {
			ent, err := billingSvc.GetEntitlements(checkCtx, userID)
			if err != nil {
				return 0, err
			}
			plan := billing.FindPlanByID(ent.PlanID)
			if plan == nil {
				return 1, nil
			}
			gb := int64(plan.StorageGb)
			if gb <= 0 {
				gb = 1
			}
			return gb, nil
		},
	}

	wakeupCh := make(chan struct{}, 64)
	genSvc := &generation.Service{
		Repo:    &generation.PGModelRepository{Pool: pgPool},
		Pool:    pgPool,
		Storage: storageSvc,
		Events:  hub,
		Config:  cfg,
		Wakeup:  wakeupCh,
	}

	workerDone := make(chan struct{})
	if pgPool != nil && !cfg.WorkerDisabled {
		workerMgr := &worker.Manager{
			Pool:       pgPool,
			Generation: genSvc,
			Storage:    storageSvc,
			Billing:    billingSvc,
			Wakeup:     wakeupCh,
		}
		go func() {
			defer close(workerDone)
			workerMgr.Run(ctx)
		}()
	} else {
		if cfg.WorkerDisabled {
			log.Printf("background worker disabled via ONE_WORKER_DISABLED")
		}
		close(workerDone)
	}

	deps := handler.Dependencies{
		Config:      cfg,
		SessionAuth: sessionLookup,
		Pool:        pgPool,
		Coord:       coord,
		Admin:       &admin.Service{Repo: &admin.PGRepository{Pool: pgPool}},
		Assets:      &assets.Service{Repo: &assets.PGRepository{Pool: pgPool}},
		Canvas:      &canvas.Service{Repo: &canvas.PGRepository{Pool: pgPool}},
		Community:   &community.Service{Repo: &community.PGRepository{Pool: pgPool}},
		Federation:  &federation.Service{Repo: &federation.PGRepository{Pool: pgPool}},
		Site:        &site.Service{Repo: &site.PGRepository{Pool: pgPool}},
		Auth:        authSvc,
		User:        userSvc,
		Finance:     financeSvc,
		Billing:     billingSvc,
		Generation:  genSvc,
		Storage:     storageSvc,
		Notify:      notifySvc,
		Events:      hub,
		DBCheck:     dbCheck,
	}

	router, err := handler.NewRouter(deps)
	if err != nil {
		log.Fatalf("router init failed: %v", err)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("one-backend listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	select {
	case <-workerDone:
	case <-shutdownCtx.Done():
	}
}

type entitlementsAdapter struct {
	svc *billing.Service
}

func (a entitlementsAdapter) GetEntitlements(ctx context.Context, userID string) (map[string]any, error) {
	return a.svc.GetEntitlementsMap(ctx, userID)
}

func runHealthcheck(port string) int {
	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/api/ready")
	if err != nil {
		return 1
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
