package repository

import (
	"fmt"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

func TestExpiredUnresolvedPaymentsDoNotBlockNewCheckout(t *testing.T) {
	db := openPaymentTestDB(t)
	repo := New(db)
	for i := 0; i < 5; i++ {
		id := fmt.Sprintf("expired-%d", i)
		order := model.PaymentOrder{ID: id, UserID: "member", IdempotencyKey: id, MerchantOrderNo: id, ProviderID: "waffo-pancake", PluginID: "pancake", PluginVersion: "1.0.0", Status: model.PaymentOrderClosing, ExpiresAt: time.Now().Add(-24 * time.Hour)}
		if err := db.Create(&order).Error; err != nil {
			t.Fatal(err)
		}
	}
	count, err := repo.ActivePaymentOrderCount("member")
	if err != nil || count != 0 {
		t.Fatalf("expired orders still block checkout: count=%d err=%v", count, err)
	}
	// Runtime protection must still retain the old plugin for late payments.
	protected, err := repo.ActivePaymentOrderCountForPlugin("pancake", "1.0.0")
	if err != nil || protected != 5 {
		t.Fatalf("lost unresolved plugin protection: count=%d err=%v", protected, err)
	}
	for i := 0; i < 5; i++ {
		id := fmt.Sprintf("payable-%d", i)
		if err := db.Create(&model.PaymentOrder{ID: id, UserID: "member", IdempotencyKey: id, MerchantOrderNo: id, Status: model.PaymentOrderPending, ExpiresAt: time.Now().Add(time.Hour)}).Error; err != nil {
			t.Fatal(err)
		}
	}
	count, err = repo.ActivePaymentOrderCount("member")
	if err != nil || count != 5 {
		t.Fatalf("payable-order limit weakened: count=%d err=%v", count, err)
	}
}

func TestExpiredOrderStillAcceptsVerifiedLatePaymentExactlyOnce(t *testing.T) {
	db := openPaymentTestDB(t)
	repo := New(db)
	order := model.PaymentOrder{ID: "late", UserID: "member", IdempotencyKey: "late", MerchantOrderNo: "late", ProviderID: "waffo-pancake", Status: model.PaymentOrderPending, AmountFen: 1000, Currency: "USD", ChargeAmountFen: 1000, ChargeCurrency: "USD", CreditsMicrocredits: 1000000, ExpiresAt: time.Now().Add(-time.Hour)}
	if err := db.Create(&order).Error; err != nil {
		t.Fatal(err)
	}
	evidence := PaymentEvidence{ProviderTradeNo: "trade-late", ProviderStatus: "succeeded", AmountFen: 1000, Currency: "USD", PaidAt: time.Now()}
	for i := 0; i < 2; i++ {
		saved, granted, err := repo.CompletePaymentOrder(order.ProviderID, order.MerchantOrderNo, evidence)
		if err != nil || saved.Status != model.PaymentOrderCredited || granted != (i == 0) {
			t.Fatalf("late payment attempt %d: %#v granted=%v err=%v", i, saved, granted, err)
		}
	}
	var count int64
	if err := db.Model(&model.CreditLedgerEntry{}).Where("payment_order_id = ?", order.ID).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("late payment ledger count=%d err=%v", count, err)
	}
}
