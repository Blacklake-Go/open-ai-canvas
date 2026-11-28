package integration_test

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"yingce/backend/internal/auth"
	"yingce/backend/internal/database"
	"yingce/backend/internal/handler"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/service"
)

func TestStripePackageAndWebhookHTTP(t *testing.T) {
	packagePath := os.Getenv("SUPDANCE_STRIPE_PLUGIN_PACKAGE")
	if packagePath == "" {
		t.Skip("set SUPDANCE_STRIPE_PLUGIN_PACKAGE to a Stripe package built for this host")
	}
	data, err := os.ReadFile(packagePath)
	if err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	t.Setenv("CANVAS_OFFICIAL_PLUGIN_DIR", t.TempDir())
	dir := t.TempDir()
	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "stripe-test.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := database.MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	admin := &model.User{ID: "admin", Username: "admin", Email: "admin@example.invalid", Status: model.UserStatusActive, Role: model.UserRoleAdmin}
	reviewer := &model.User{ID: "reviewer", Username: "reviewer", Email: "reviewer@example.invalid", Status: model.UserStatusActive, Role: model.UserRoleUser}
	other := &model.User{ID: "other", Username: "other", Email: "other@example.invalid", Status: model.UserStatusActive, Role: model.UserRoleUser}
	for _, actor := range []*model.User{admin, reviewer, other} {
		if err := db.Create(actor).Error; err != nil {
			t.Fatal(err)
		}
		session := model.AuthSession{ID: actor.ID, UserID: actor.ID, TokenHash: auth.HashToken("token"), ExpiresAt: time.Now().Add(time.Hour)}
		if err := db.Create(&session).Error; err != nil {
			t.Fatal(err)
		}
	}
	svc := service.New(repository.New(db), filepath.Join(dir, "runtime"))
	t.Cleanup(func() { _ = svc.Close() })
	handler.ConfigureRuntime(svc)
	t.Cleanup(func() { handler.ConfigureRuntime(nil) })
	plugin, err := svc.InstallPluginForAdmin(admin, data, filepath.Base(packagePath))
	if err != nil || plugin.Manifest.ID != "supdance-payment-stripe" || plugin.Status != "enabled" {
		t.Fatalf("install Stripe package: id=%q status=%q err=%v", plugin.Manifest.ID, plugin.Status, err)
	}
	router := gin.New()
	handler.RegisterPaymentRoutes(router.Group("/api"), svc)
	call := func(method, path, actor, signature string, body []byte, status int) []byte {
		t.Helper()
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		if len(body) != 0 {
			req.Header.Set("Content-Type", "application/json")
		}
		if actor != "" {
			req.AddCookie(&http.Cookie{Name: service.SessionCookieName, Value: actor + ".token"})
		}
		if signature != "" {
			req.Header.Set("Stripe-Signature", signature)
		}
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		if response.Code != status {
			t.Fatalf("%s %s = %d, want %d: %s", method, path, response.Code, status, response.Body.String())
		}
		return response.Body.Bytes()
	}
	jsonBody := func(value any) []byte {
		t.Helper()
		body, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		return body
	}
	const apiKey = "rk_test_" + "integration_fixture"
	const firstSecret = "whsec_" + "integration_fixture"
	const currentSecret = "whsec_" + "rotated_integration_fixture"
	const configPath = "/api/admin/payments/providers/stripe/config"
	settings := service.UpdatePaymentProviderConfigRequest{Enabled: true, CloseAfterMinutes: 45, Values: map[string]string{
		"mode": "test", "apiKey": apiKey, "webhookSigningSecret": firstSecret,
		"publicBaseUrl": "https://qa.example.invalid", "settlementCurrency": "USD", "allowedUserId": reviewer.ID,
	}}
	call(http.MethodPut, configPath, reviewer.ID, "", jsonBody(settings), http.StatusForbidden)
	configResponse := call(http.MethodPut, configPath, admin.ID, "", jsonBody(settings), http.StatusOK)
	var enabled struct {
		Data struct {
			Provider service.AdminPaymentProviderView
		}
	}
	if err := json.Unmarshal(configResponse, &enabled); err != nil {
		t.Fatal(err)
	}
	config := enabled.Data.Provider
	if !config.Enabled || config.ConfigID == "" || !config.SecretConfigured["apiKey"] || !config.SecretConfigured["webhookSigningSecret"] ||
		bytes.Contains(configResponse, []byte(apiKey)) || bytes.Contains(configResponse, []byte(firstSecret)) {
		t.Fatal("Stripe configuration was not enabled or leaked secrets")
	}
	product, err := svc.CreateTopupProduct(admin, service.TopupProductRequest{
		Name: "Stripe QA credits", Kind: model.TopupProductKindCredits, Currency: "USD", AmountFen: 125, CreditsMicrocredits: 12_000_000, Enabled: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := call("GET", "/api/payments/products", reviewer.ID, "", nil, http.StatusOK); !bytes.Contains(got, []byte(product.ID)) {
		t.Fatal("Stripe QA product not available in the wallet")
	}
	if got := call("GET", "/api/payments/providers", reviewer.ID, "", nil, http.StatusOK); !bytes.Contains(got, []byte(`"id":"stripe"`)) {
		t.Fatal("Stripe unavailable for configured reviewer")
	}
	if got := call("GET", "/api/payments/providers", other.ID, "", nil, http.StatusOK); bytes.Contains(got, []byte(`"id":"stripe"`)) {
		t.Fatal("Stripe available outside sandbox reviewer scope")
	}
	orderBody := jsonBody(service.CreatePaymentOrderRequest{ProductID: product.ID, ProviderID: "stripe", IdempotencyKey: "order"})
	call("POST", "/api/payments/orders", other.ID, "", orderBody, http.StatusForbidden)
	session := "cs_test_integration_session"
	order := model.PaymentOrder{
		ID: "integration-order", UserID: reviewer.ID, MerchantOrderNo: "integration-merchant", IdempotencyKey: "order", ProductID: product.ID, ProductName: product.Name,
		ProductKind: product.Kind, ProviderID: "stripe", PluginID: plugin.Manifest.ID, PluginVersion: plugin.Manifest.Version, ProviderConfigID: config.ConfigID,
		ProviderConfigVersion: config.Version, ProviderTradeNo: &session, AmountFen: product.AmountFen, CreditsMicrocredits: product.CreditsMicrocredits,
		ChargeAmountFen: product.AmountFen, ChargeCurrency: "USD", Currency: "USD", Status: model.PaymentOrderPending, ExpiresAt: time.Now().Add(45 * time.Minute),
		CheckoutMode: "redirect", CheckoutValue: "https://checkout.stripe.com/c/pay/integration",
	}
	if err := db.Create(&order).Error; err != nil {
		t.Fatal(err)
	}
	call("GET", "/api/payments/orders/"+order.ID+"/checkout", reviewer.ID, "", nil, http.StatusFound)
	settings.Values["webhookSigningSecret"] = currentSecret
	delete(settings.Values, "apiKey")
	call(http.MethodPut, configPath, admin.ID, "", jsonBody(settings), http.StatusOK)

	const webhookPath = "/api/payments/notify/stripe/webhook"
	notify := func(eventID, eventType, paymentStatus, trade, configID, secret string, amount int64, want int) {
		t.Helper()
		now := time.Now()
		body := jsonBody(map[string]any{
			"id": eventID, "object": "event", "type": "checkout.session." + eventType, "created": now.Unix(),
			"data": map[string]any{"object": map[string]any{
				"id": trade, "object": "checkout.session", "mode": "payment", "status": "complete", "payment_status": paymentStatus,
				"client_reference_id": order.MerchantOrderNo, "amount_total": amount, "currency": "usd",
				"metadata": map[string]string{"supdance_payment_config": configID},
			}},
		})
		mac := hmac.New(sha256.New, []byte(secret))
		fmt.Fprintf(mac, "%d.", now.Unix())
		mac.Write(body)
		signature := fmt.Sprintf("t=%d,v1=%x", now.Unix(), mac.Sum(nil))
		call(http.MethodPost, webhookPath, "", signature, body, want)
	}
	notify("evt_pending", "completed", "unpaid", session, config.ConfigID, currentSecret, 125, http.StatusNoContent)
	notify("evt_wrong_amount", "completed", "paid", session, config.ConfigID, currentSecret, 500, http.StatusBadRequest)
	notify("evt_wrong_trade", "completed", "paid", "cs_test_other", config.ConfigID, currentSecret, 125, http.StatusBadRequest)
	notify("evt_wrong_signature", "completed", "paid", session, config.ConfigID, firstSecret, 125, http.StatusBadRequest)
	notify("evt_foreign_install", "completed", "paid", session, "another-install", currentSecret, 125, http.StatusNoContent)
	checkGrants := func(want int64) {
		t.Helper()
		var grantCount int64
		if err := db.Model(&model.CreditLedgerEntry{}).Where("payment_order_id = ? AND type = ?", order.ID, model.CreditLedgerPaymentTopup).Count(&grantCount).Error; err != nil || grantCount != want {
			t.Fatalf("Stripe credit grants = %d, want %d, err=%v", grantCount, want, err)
		}
	}
	checkGrants(0)
	notify("evt_paid", "async_payment_succeeded", "paid", session, config.ConfigID, currentSecret, 125, http.StatusNoContent)
	notify("evt_paid", "async_payment_succeeded", "paid", session, config.ConfigID, currentSecret, 125, http.StatusNoContent)
	notify("evt_second_paid", "completed", "paid", session, config.ConfigID, currentSecret, 125, http.StatusNoContent)
	checkGrants(1)
	var notifications []model.PaymentNotification
	if err := db.Where("payment_order_id = ?", order.ID).Find(&notifications).Error; err != nil || len(notifications) != 3 {
		t.Fatalf("Stripe inbox count = %d, err=%v", len(notifications), err)
	}
	for _, event := range notifications {
		if event.ProviderConfigID != config.ConfigID || event.Status != model.PaymentNotificationProcessed || event.PayloadCipher == "" || strings.Contains(event.PayloadCipher, `"checkout.session"`) {
			t.Fatalf("unexpected Stripe inbox event state: %s", event.Status)
		}
	}
	if got := call("GET", "/api/payments/orders/"+order.ID, reviewer.ID, "", nil, http.StatusOK); !bytes.Contains(got, []byte(`"status":"credited"`)) {
		t.Fatal("wallet did not show the Stripe order as credited")
	}
}
