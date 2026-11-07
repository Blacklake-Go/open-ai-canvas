import { expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyWebhook } from "@waffo/pancake-ts";
import { handleRPC } from "./waffo";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = {
  merchantId: "MER_" + "M".repeat(22), storeId: "STO_" + "S".repeat(22), productId: "PROD_" + "P".repeat(22),
  privateKey: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  environment: "prod", taxCategory: "digital_goods", publicBaseUrl: "https://wallet.example",
};
const version = "yingce.payment/v1";
const ref = "a".repeat(32);
const expiresAt = new Date(Date.now() + 300_000).toISOString();
const create = {
  version, config, operation: "create_order",
  request: { MerchantOrderNo: ref, Currency: "USD", AmountFen: 999, ExpiresAt: expiresAt, ReturnURL: config.publicBaseUrl + "/return" },
};

test("checkout signs requests and binds the amount and idempotency key to the host order", async () => {
  const paths: string[] = [];
  const fetcher = async (url: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    expect(new Headers(options?.headers).get("x-merchant-id")).toBe(config.merchantId);
    expect(options?.redirect).toBe("error");
    const body = JSON.parse(String(options?.body));
    if (path === "/v1/graphql") {
      expect(body.variables).toEqual({ storeId: config.storeId });
      return Response.json({ data: { onetimeProducts: [{ id: config.productId, hasProdVersion: true, prices: [{ currency: "USD" }] }] } });
    }
    expect(new Headers(options?.headers).get("x-idempotency-key")).toBe("supdance-checkout-" + ref);
    expect(body).toMatchObject({
      productId: config.productId, currency: "USD", orderMerchantExternalId: ref,
      priceSnapshot: { amount: "9.99", taxCategory: "digital_goods" }, allowPromotionCodes: false,
    });
    return Response.json({ data: { checkoutUrl: "https://checkout.example/pay", expiresAt } });
  };
  expect(await handleRPC(create, fetcher as typeof fetch)).toEqual({
    ok: true, data: { Mode: "redirect", Value: "https://checkout.example/pay", ExpiresAt: expiresAt },
  });
  expect(paths).toEqual(["/v1/graphql", "/v1/actions/checkout/create-session"]);
});

test("unavailable store product prevents the SDK from opening checkout", async () => {
  const fetcher = async (url: RequestInfo | URL) => {
    expect(new URL(String(url)).pathname).toBe("/v1/graphql");
    return Response.json({ data: { onetimeProducts: [] } });
  };
  expect(await handleRPC(create, fetcher as typeof fetch)).toMatchObject({ ok: false, code: "product_unavailable" });
});

test("verified raw webhook yields the actual amount and rejects tampering or another environment", async () => {
  const webhook = {
    id: "delivery-id", eventId: "PAY_Example", eventType: "order.completed", mode: "prod",
    timestamp: new Date().toISOString(), storeId: config.storeId,
    data: {
      orderId: "ORD_Example", orderMerchantExternalId: ref, currency: "USD", chargedAmount: "9.99",
      orderMetadata: { source: "supdance-payment-waffo", productId: config.productId },
    },
  };
  const body = JSON.stringify(webhook, null, 2);
  const timestamp = Date.now();
  const signature = sign("RSA-SHA256", Buffer.from(`${timestamp}.${body}`), keys.privateKey).toString("base64");
  const input = {
    version, config, operation: "verify_notification",
    headers: { "X-Waffo-Signature": [`t=${timestamp},v1=${signature}`] },
    bodyBase64: Buffer.from(body).toString("base64"),
  };
  const verify: typeof verifyWebhook = (raw, header, options) => verifyWebhook(raw, header, {
    ...options, publicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
  });
  expect(await handleRPC(input, fetch, verify)).toMatchObject({ ok: true, data: {
    eventId: webhook.id, merchantOrderNo: ref, providerTradeNo: webhook.eventId, paid: true, amountFen: 999,
  } });
  for (const changed of [
    { ...input, bodyBase64: Buffer.from(JSON.stringify(webhook)).toString("base64") },
    { ...input, config: { ...config, environment: "test" } },
    { ...input, config: { ...config, storeId: "STO_" + "X".repeat(22) } },
  ]) {
    expect(await handleRPC(changed, fetch, verify)).toMatchObject({ ok: false, code: "invalid_notification" });
  }
  expect(await handleRPC(input)).toMatchObject({ ok: false, code: "invalid_notification" });
});

test("query requires unique, scoped evidence and keeps an unconfirmed checkout open", async () => {
  const payment = {
    id: "PAY_Example", status: "succeeded", orderMerchantExternalId: ref,
    onetimeOrder: {
      id: "ORD_Example", status: "completed", testMode: false,
      store: { id: config.storeId }, onetimeProduct: { id: config.productId },
    },
    currency: "USD", amount: "9.99",
  };
  const query = { version, config, operation: "query_order", request: { MerchantOrderNo: ref } };
  const gateway = (payments: unknown[]) => (async () => Response.json({ data: { payments } })) as typeof fetch;
  expect(await handleRPC(query, gateway([payment]))).toMatchObject({
    ok: true, data: { paid: true, amountFen: 999, providerTradeNo: payment.id },
  });
  expect(await handleRPC(query, gateway([payment, payment]))).toMatchObject({ ok: false, code: "payment_evidence_mismatch" });
  expect(await handleRPC(query, gateway([]))).toMatchObject({ ok: true, data: { paid: false, closed: false } });
  expect(await handleRPC({ ...query, operation: "close_order" }, gateway([]))).toMatchObject({
    ok: false, code: "unsupported_operation",
  });
});
