package billing

import (
	"context"
	"errors"
	"testing"
)

type planTestRepository struct {
	*fakeBillingRepo
	plans []PlanConfig
}

func (r *planTestRepository) PlanCatalog(context.Context) ([]PlanConfig, error) {
	return r.plans, nil
}

func TestConfiguredPlanUsesPublishedPricesAndSnapshotsCredits(t *testing.T) {
	ctx := context.Background()
	fake := newFakeBillingRepo()
	repo := &planTestRepository{fakeBillingRepo: fake, plans: []PlanConfig{
		{PlanItem: PlanItem{ID: "custom", Name: "Custom", Configured: true, Enabled: true,
			MonthlyCny: 399, MonthlyUsd: 29, QuarterlyUsd: 71, QuotaBase: 1830,
			Concurrency: 3, AsyncConcurrency: 8, PortraitCapacity: 4, StorageGb: 25,
			ExclusiveFeatures: []string{"commercial_license"}}},
	}}
	svc := &Service{Repo: repo}
	catalog, err := svc.ListPlans(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if live := catalog["plans"].([]PlanItem); len(live) != 1 || live[0].ID != "custom" {
		t.Fatalf("unexpected plan catalog: %+v", live)
	}
	checkout := CheckoutInput{UserID: "member", PlanID: "custom", Provider: "stripe", BillingCycle: "quarterly"}
	quote, err := svc.CreateCheckout(ctx, checkout)
	if err != nil {
		t.Fatal(err)
	}
	if quote.AmountMinor != 7100 || quote.Currency != "USD" {
		t.Fatalf("unexpected checkout: %+v", quote)
	}
	snapshot := fake.orders[quote.OrderID]
	repo.plans[0].QuotaBase = 2000
	repo.plans[0].Enabled = false
	if units := extractCreditAmount(&snapshot); units != 5490 {
		t.Fatalf("order credited %d units, want 5490", units)
	}
	_, err = svc.CreateCheckout(ctx, checkout)
	var checkoutErr *ServiceError
	if !errors.As(err, &checkoutErr) || checkoutErr.Code != "INVALID_PLAN" || len(fake.orders) != 1 {
		t.Fatalf("hidden plan did not reject a new order: %v", err)
	}

	fake.sub = &SubscriptionInfo{PlanID: "custom", Status: "active", IsSubscribed: true}
	ent, err := svc.GetEntitlements(ctx, "member")
	if err != nil {
		t.Fatal(err)
	}
	if ent.PlanName != "Custom" || ent.MaxConcurrentTasks != 8 || ent.StorageGb != 25 {
		t.Fatalf("hidden plan lost active subscriber entitlements: %+v", ent)
	}
}
