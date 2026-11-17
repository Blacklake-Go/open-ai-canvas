package app

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/payment"
	"yingce/backend/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestPaymentReconciliationSeparatesUnsupportedMissingAndFailure(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX RPC fixture")
	}
	for _, tc := range []struct {
		name, code, status  string
		unresolved, wantErr bool
	}{
		{"unsupported", "unsupported_operation", "unsupported", false, false},
		{"empty_bill", "trade_bill_not_found", "completed", false, false},
		{"missing_with_order", "trade_bill_not_found", "failed", true, true},
		{"network_failure", "transport_error", "failed", false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
			if err != nil {
				t.Fatal(err)
			}
			sqlDB, _ := db.DB()
			sqlDB.SetMaxOpenConns(1)
			t.Cleanup(func() { _ = sqlDB.Close() })
			if err := db.AutoMigrate(&model.PaymentOrder{}, &model.PaymentProviderConfig{}, &model.PaymentReconciliationRun{}, &model.PaymentReconciliationItem{}); err != nil {
				t.Fatal(err)
			}
			config := model.PaymentProviderConfig{ID: "config", ProviderID: "test", PluginID: "test", Version: 1, ConfigCipher: "{}"}
			if err := db.Create(&config).Error; err != nil {
				t.Fatal(err)
			}
			date := time.Now().In(paymentBillLocation).AddDate(0, 0, -1)
			if tc.unresolved {
				order := model.PaymentOrder{ID: "unresolved", UserID: "user", IdempotencyKey: "unresolved", MerchantOrderNo: "unresolved", ProviderID: "test", Status: model.PaymentOrderPending, CreatedAt: date, ExpiresAt: date.Add(time.Hour)}
				if err := db.Create(&order).Error; err != nil {
					t.Fatal(err)
				}
			}
			dir := t.TempDir()
			if err := os.MkdirAll(filepath.Join(dir, "backend"), 0700); err != nil {
				t.Fatal(err)
			}
			script := "#!/bin/sh\nread request\ncase \"$request\" in\n*validate_config*) printf '%s\\n' '{\"ok\":true}';;\n*) printf '%s\\n' '{\"ok\":false,\"code\":\"" + tc.code + "\",\"message\":\"fixture\"}';;\nesac\n"
			if err := os.WriteFile(filepath.Join(dir, "backend", "provider"), []byte(script), 0700); err != nil {
				t.Fatal(err)
			}
			provider, err := payment.NewRPCProvider(payment.Descriptor{ID: "test", PluginID: "test"}, dir, "backend/provider")
			if err != nil {
				t.Fatal(err)
			}
			registry, err := payment.NewRegistry(provider)
			if err != nil {
				t.Fatal(err)
			}
			s := &Service{repo: repository.New(db), paymentRegistry: registry, dataDir: t.TempDir()}
			run, err := s.runPaymentReconciliation(context.Background(), nil, "test", date.Format("2006-01-02"))
			if (err != nil) != tc.wantErr || run == nil || string(run.Status) != tc.status {
				t.Fatalf("reconciliation = %#v, error=%v; want status=%s error=%v", run, err, tc.status, tc.wantErr)
			}
			if run.TotalItems != 0 || run.RecoveredItems != 0 {
				t.Fatalf("invented reconciliation evidence: %#v", run)
			}
		})
	}
}
