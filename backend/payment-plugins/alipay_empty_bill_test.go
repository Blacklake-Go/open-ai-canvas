package paymentplugins

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAlipaySignedNoBillDataPreservesMissingBillMeaning(t *testing.T) {
	private, public := testRSAKeyPair(t)
	raw := `{"code":"40004","sub_code":"NO_BILL_DATA","sub_msg":"no bill"}`
	signature, err := rsaSHA256Sign(private, []byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"alipay_data_dataservice_bill_downloadurl_query_response":%s,"sign":%q}`, raw, signature)
	}))
	defer server.Close()
	p := NewAlipayProvider(server.Client())
	config := Config{"appId": "app", "merchantPrivateKey": testPrivatePEM(private), "alipayPublicKey": testPublicPEM(public), "gateway": server.URL}
	err = p.callJSON(context.Background(), config, "alipay.data.dataservice.bill.downloadurl.query", map[string]any{"bill_type": "trade", "bill_date": "2026-11-16"}, nil)
	if !errors.Is(err, ErrTradeBillNotFound) {
		t.Fatalf("empty bill treated as failure: %T %v", err, err)
	}
}
