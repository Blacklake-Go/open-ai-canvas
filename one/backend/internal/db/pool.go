package db

import (
	"context"
	"fmt"
	"time"

	"one/backend/internal/config"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const SearchPath = "ai_studio, ops_bill, auth_usr, sys_core, public"

func NewPool(ctx context.Context, cfg config.Config) (*pgxpool.Pool, error) {
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	pgCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	pgCfg.MaxConns = cfg.PGMaxConns
	pgCfg.MinConns = cfg.PGMinConns
	pgCfg.MaxConnIdleTime = 30 * time.Second
	pgCfg.MaxConnLifetime = 30 * time.Minute
	pgCfg.HealthCheckPeriod = 30 * time.Second
	if pgCfg.ConnConfig.RuntimeParams == nil {
		pgCfg.ConnConfig.RuntimeParams = map[string]string{}
	}
	pgCfg.ConnConfig.RuntimeParams["search_path"] = SearchPath
	pgCfg.ConnConfig.RuntimeParams["application_name"] = "one-backend"

	pgCfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+SearchPath)
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, pgCfg)
	if err != nil {
		return nil, fmt.Errorf("create pgx pool: %w", err)
	}
	return pool, nil
}

func HealthCheck(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	var ok int
	if err := pool.QueryRow(ctx, "SELECT 1").Scan(&ok); err != nil {
		return err
	}
	if ok != 1 {
		return fmt.Errorf("unexpected health check result: %d", ok)
	}
	return nil
}
