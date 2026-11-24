package billing

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type PlanConfig struct {
	PlanItem
	Revision string `json:"revision"`
}

type PlanChanges struct {
	ID                string    `json:"id"`
	PlanID            string    `json:"planId"`
	Revision          string    `json:"revision"`
	Name              *string   `json:"name"`
	Badge             *string   `json:"badge"`
	MonthlyCny        *int      `json:"monthlyCny"`
	MonthlyUsd        *int      `json:"monthlyUsd"`
	QuarterlyCny      *int      `json:"quarterlyCny"`
	QuarterlyUsd      *int      `json:"quarterlyUsd"`
	YearlyCny         *int      `json:"yearlyCny"`
	YearlyUsd         *int      `json:"yearlyUsd"`
	QuotaBase         *int64    `json:"quotaBase"`
	Concurrency       *int      `json:"concurrency"`
	AsyncConcurrency  *int      `json:"asyncConcurrency"`
	PortraitCapacity  *int      `json:"portraitCapacity"`
	StorageGb         *int      `json:"storageGb"`
	DisplayOrder      *int      `json:"displayOrder"`
	Enabled           *bool     `json:"enabled"`
	ExclusiveFeatures *[]string `json:"exclusiveFeatures"`
	Features          *[]string `json:"features"`
}

var commercialPlanID = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,39}$`)

func managedPlanID(id string) bool {
	return commercialPlanID.MatchString(id) && id != "free" &&
		!strings.HasPrefix(id, "credit_") && !strings.HasPrefix(id, "exclusive_")
}

var exclusivePlanFeatures = []string{
	"no_watermark", "vip_speed_queue", "export_4k", "exclusive_latest_models",
	"canvas_premium_tools", "commercial_license", "dedicated_support",
}

func setPlanField[T any](field *T, value *T) {
	if value != nil {
		*field = *value
	}
}

func applyPlanChanges(plan PlanItem, changes PlanChanges) (PlanItem, error) {
	setPlanField(&plan.Name, changes.Name)
	setPlanField(&plan.Badge, changes.Badge)
	for _, price := range []struct {
		field *float64
		value *int
	}{
		{&plan.MonthlyCny, changes.MonthlyCny}, {&plan.MonthlyUsd, changes.MonthlyUsd},
		{&plan.QuarterlyCny, changes.QuarterlyCny}, {&plan.QuarterlyUsd, changes.QuarterlyUsd},
		{&plan.YearlyCny, changes.YearlyCny}, {&plan.YearlyUsd, changes.YearlyUsd},
	} {
		if price.value != nil {
			*price.field = float64(*price.value)
		}
		if *price.field < 0 || *price.field > 10_000_000 {
			return PlanItem{}, svcErr(http.StatusUnprocessableEntity, "INVALID_PLAN_PRICE", "价格必须在 0 到 10,000,000 之间")
		}
	}
	setPlanField(&plan.QuotaBase, changes.QuotaBase)
	setPlanField(&plan.Concurrency, changes.Concurrency)
	setPlanField(&plan.AsyncConcurrency, changes.AsyncConcurrency)
	setPlanField(&plan.PortraitCapacity, changes.PortraitCapacity)
	setPlanField(&plan.StorageGb, changes.StorageGb)
	setPlanField(&plan.DisplayOrder, changes.DisplayOrder)
	setPlanField(&plan.Enabled, changes.Enabled)
	setPlanField(&plan.ExclusiveFeatures, changes.ExclusiveFeatures)
	setPlanField(&plan.Features, changes.Features)
	plan.Name, plan.Badge = strings.TrimSpace(plan.Name), strings.TrimSpace(plan.Badge)
	if plan.Name == "" || utf8.RuneCountInString(plan.Name) > 100 || utf8.RuneCountInString(plan.Badge) > 40 {
		return PlanItem{}, svcErr(http.StatusUnprocessableEntity, "INVALID_PLAN_LABEL", "请填写 100 字以内的名称，角标最多 40 字")
	}
	if plan.QuotaBase < 0 || plan.QuotaBase > 100_000_000 ||
		plan.Concurrency < 1 || plan.Concurrency > 1000 || plan.AsyncConcurrency < 1 || plan.AsyncConcurrency > 1000 ||
		plan.PortraitCapacity < 0 || plan.PortraitCapacity > 100_000 || plan.StorageGb < 1 || plan.StorageGb > 100_000 ||
		plan.DisplayOrder < 0 || plan.DisplayOrder > 100_000 {
		return PlanItem{}, svcErr(http.StatusUnprocessableEntity, "INVALID_PLAN_QUOTA", "请检查积分、容量、并发与排序的取值范围")
	}
	if plan.Enabled && (plan.QuotaBase == 0 || (plan.MonthlyCny == 0 && plan.MonthlyUsd == 0)) {
		return PlanItem{}, svcErr(http.StatusUnprocessableEntity, "PLAN_NOT_READY", "发布前请设置月度积分和至少一种有效月付价格")
	}
	benefits := []string{}
	for _, code := range plan.ExclusiveFeatures {
		if !slices.Contains(exclusivePlanFeatures, code) {
			return PlanItem{}, svcErr(http.StatusUnprocessableEntity, "INVALID_PLAN_BENEFIT", "包含无法识别的权益")
		}
		if !slices.Contains(benefits, code) {
			benefits = append(benefits, code)
		}
	}
	features := []string{}
	for _, line := range plan.Features {
		value := strings.TrimSpace(line)
		if value == "" {
			continue
		}
		if len(features) == 40 || utf8.RuneCountInString(value) > 200 {
			return PlanItem{}, svcErr(http.StatusUnprocessableEntity, "INVALID_PLAN_FEATURES", "最多填写 40 条权益说明，每条最多 200 字")
		}
		features = append(features, value)
	}
	plan.ExclusiveFeatures, plan.Features = benefits, features
	plan.MonthlyCredits = plan.QuotaBase
	plan.Configured = true
	return plan, nil
}

func standardPlanConfigs() map[string]PlanConfig {
	configs := make(map[string]PlanConfig)
	for i, defaults := range CommercialPlans() {
		defaults.Enabled = true
		defaults.DisplayOrder = i + 1
		defaults.Features = []string{}
		configs[defaults.ID] = PlanConfig{PlanItem: defaults, Revision: "default"}
	}
	return configs
}

func sortedPlans(configs map[string]PlanConfig) []PlanConfig {
	plans := make([]PlanConfig, 0, len(configs))
	for _, plan := range configs {
		plans = append(plans, plan)
	}
	sort.Slice(plans, func(i, j int) bool {
		if plans[i].DisplayOrder != plans[j].DisplayOrder {
			return plans[i].DisplayOrder < plans[j].DisplayOrder
		}
		return plans[i].ID < plans[j].ID
	})
	return plans
}

type planCatalogSource interface {
	PlanCatalog(context.Context) ([]PlanConfig, error)
}

func (s *Service) planCatalog(ctx context.Context) ([]PlanConfig, error) {
	if repo, ok := s.Repo.(planCatalogSource); ok {
		return repo.PlanCatalog(ctx)
	}
	return sortedPlans(standardPlanConfigs()), nil
}

func (s *Service) findCatalogPlan(ctx context.Context, id string) (*PlanConfig, error) {
	if repo, ok := s.Repo.(*PGRepository); ok {
		return readPlanConfig(ctx, repo.Pool, id)
	}
	plans, err := s.planCatalog(ctx)
	if err != nil {
		return nil, err
	}
	for _, plan := range plans {
		if plan.ID == id {
			return &plan, nil
		}
	}
	return nil, nil
}

func (s *Service) applyPlanEntitlements(ctx context.Context, sub *SubscriptionInfo) (*SubscriptionInfo, error) {
	if sub == nil {
		return nil, nil
	}
	plan, err := s.findCatalogPlan(ctx, sub.PlanID)
	if err != nil {
		return nil, err
	}
	if plan != nil && (plan.Configured || plan.Enabled) {
		sub.PlanName = plan.Name
		sub.MaxConcurrentTasks = plan.AsyncConcurrency
		sub.ModelConcurrency = plan.Concurrency
		sub.PortraitCapacity = plan.PortraitCapacity
		sub.StorageGb = plan.StorageGb
		sub.ExclusiveFeatures = plan.ExclusiveFeatures
		sub.PriorityQueue = slices.Contains(plan.ExclusiveFeatures, "vip_speed_queue")
	} else if sub.MaxConcurrentTasks == 0 {
		sub.MaxConcurrentTasks = 2
	}
	return sub, nil
}

const planConfigColumns = `id, name, monthly_cny, monthly_usd, display_order, features_json, updated_at`

func scanPlanConfig(row pgx.Row, defaults map[string]PlanConfig) (PlanConfig, error) {
	var plan PlanConfig
	var monthlyCny, monthlyUsd int
	var updated time.Time
	var raw []byte
	if err := row.Scan(&plan.ID, &plan.Name, &monthlyCny, &monthlyUsd, &plan.DisplayOrder, &raw, &updated); err != nil {
		return PlanConfig{}, err
	}
	if !managedPlanID(plan.ID) {
		return plan, nil
	}
	var config struct {
		Current *PlanItem `json:"oneCatalog"`
		Items   []string  `json:"items"`
	}
	if len(raw) != 0 {
		if raw[0] == '[' {
			if err := json.Unmarshal(raw, &config.Items); err != nil {
				return PlanConfig{}, err
			}
		} else if err := json.Unmarshal(raw, &config); err != nil {
			return PlanConfig{}, err
		}
	}
	id := plan.ID
	switch {
	case config.Current != nil:
		plan.PlanItem = *config.Current
	case defaults[id].ID != "":
		plan.PlanItem = defaults[id].PlanItem
	default:
		plan.MonthlyCny, plan.MonthlyUsd = float64(monthlyCny), float64(monthlyUsd)
		plan.Concurrency, plan.AsyncConcurrency, plan.StorageGb = 1, 1, 1
		plan.Features = config.Items
		plan.ExclusiveFeatures = []string{}
	}
	plan.ID = id
	plan.Revision = updated.UTC().Format(time.RFC3339Nano)
	return plan, nil
}

func (r *PGRepository) PlanCatalog(ctx context.Context) ([]PlanConfig, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	return readPlanCatalog(ctx, r.Pool)
}

type planConfigQuerier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func readPlanConfig(ctx context.Context, db planConfigQuerier, id string) (*PlanConfig, error) {
	if !managedPlanID(id) {
		return nil, nil
	}
	defaults := standardPlanConfigs()
	plan, err := scanPlanConfig(db.QueryRow(ctx, `SELECT `+planConfigColumns+` FROM ops_bill.plans_config WHERE id=$1`, id), defaults)
	if errors.Is(err, pgx.ErrNoRows) {
		plan = defaults[id]
		if plan.ID == "" {
			return nil, nil
		}
	} else if err != nil {
		return nil, err
	}
	return &plan, nil
}

type planCatalogQuerier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func readPlanCatalog(ctx context.Context, db planCatalogQuerier) ([]PlanConfig, error) {
	configs := standardPlanConfigs()
	rows, err := db.Query(ctx, `SELECT `+planConfigColumns+` FROM ops_bill.plans_config`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		plan, err := scanPlanConfig(rows, configs)
		if err != nil {
			return nil, err
		}
		if managedPlanID(plan.ID) {
			configs[plan.ID] = plan
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return sortedPlans(configs), nil
}

func (r *PGRepository) SavePlan(ctx context.Context, id string, changes PlanChanges, create bool) (PlanConfig, PlanConfig, error) {
	if create {
		id = firstStr(strings.TrimSpace(changes.ID), strings.TrimSpace(changes.PlanID))
	}
	if !managedPlanID(id) {
		return PlanConfig{}, PlanConfig{}, svcErr(http.StatusUnprocessableEntity, "INVALID_PLAN_ID", "请使用有效的套餐标识")
	}

	var before, after PlanConfig
	err := pgx.BeginFunc(ctx, r.Pool, func(tx pgx.Tx) error {
		defaults := standardPlanConfigs()
		row := tx.QueryRow(ctx, `SELECT `+planConfigColumns+` FROM ops_bill.plans_config WHERE id=$1 FOR UPDATE`, id)
		current, err := scanPlanConfig(row, defaults)
		found := err == nil
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if !found {
			current = defaults[id]
		}
		if create && current.ID != "" {
			return svcErr(http.StatusConflict, "PLAN_EXISTS", "套餐标识已存在")
		}
		if !create && current.ID == "" {
			return svcErr(http.StatusNotFound, "PLAN_NOT_FOUND", "套餐不存在")
		}
		if !create && (changes.Revision == "" || changes.Revision != current.Revision) {
			return svcErr(http.StatusConflict, "PLAN_CHANGED", "套餐已被更新，请读取最新版本后再保存")
		}
		before = current
		if create {
			current.PlanItem = PlanItem{ID: id, Concurrency: 1, AsyncConcurrency: 1, StorageGb: 1, DisplayOrder: 50}
		}
		plan, err := applyPlanChanges(current.PlanItem, changes)
		if err != nil {
			return err
		}
		if plan.CodeName == "" {
			plan.CodeName = strings.ToUpper(id)
		}
		raw, err := json.Marshal(plan)
		if err != nil {
			return err
		}
		args := []any{id, plan.Name, int(plan.MonthlyCny), int(plan.MonthlyUsd), plan.QuotaBase, plan.DisplayOrder, plan.Enabled, raw}
		if found {
			row = tx.QueryRow(ctx, `
				UPDATE ops_bill.plans_config
				SET name=$2, monthly_cny=$3, monthly_usd=$4, price_cny=$3, price_usd=$4, credits_included=$5,
				    display_order=$6, sort_order=$6, enabled=$7, is_active=$7, updated_at=clock_timestamp(),
				    features_json=(CASE jsonb_typeof(features_json)
					WHEN 'object' THEN features_json ELSE '{}'::jsonb END)
					|| jsonb_build_object('oneCatalog',$8::jsonb,'items',$8::jsonb->'features')
				WHERE id=$1 RETURNING `+planConfigColumns, args...)
		} else {
			row = tx.QueryRow(ctx, `
				INSERT INTO ops_bill.plans_config
				(id, name, monthly_cny, monthly_usd, price_cny, price_usd, credits_included,
				 display_order, sort_order, enabled, is_active, features_json, updated_at)
				VALUES ($1,$2,$3,$4,$3,$4,$5,$6,$6,$7,$7,
				        jsonb_build_object('oneCatalog',$8::jsonb,'items',$8::jsonb->'features'),clock_timestamp())
				RETURNING `+planConfigColumns, args...)
		}
		after, err = scanPlanConfig(row, defaults)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return svcErr(http.StatusConflict, "PLAN_EXISTS", "套餐标识已存在")
		}
		return err
	})
	return before, after, err
}
