import {
  TaxCategory, WaffoPancake, WaffoPancakeError, WebhookEventType,
  verifyWebhook, type WebhookEventData,
} from "@waffo/pancake-ts";

type RPCRequest = {
  version?: string;
  operation?: string;
  config?: Record<string, string>;
  request?: {
    MerchantOrderNo?: string;
    AmountFen?: number;
    Currency?: string;
    ExpiresAt?: string;
    ReturnURL?: string;
  };
  headers?: Record<string, string[]>;
  bodyBase64?: string;
};

type Payment = {
  id: string;
  status: string;
  orderMerchantExternalId: string;
  onetimeOrder: {
    id: string;
    status: string;
    testMode: boolean;
    store: { id: string };
    onetimeProduct: { id: string };
  } | null;
  amount: string;
  currency: string;
};

class RPCError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const orderPattern = /^[a-f0-9]{32}$/;
const source = "supdance-payment-waffo";

function httpsURL(value: string | undefined, code: string) {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new RPCError(code, "Waffo Pancake requires a valid HTTPS URL");
  }
  if (!url || url.protocol !== "https:" || url.username || url.password) {
    throw new RPCError(code, "Waffo Pancake requires a valid HTTPS URL");
  }
  return url;
}

function configuration(config: Record<string, string> = {}) {
  const { merchantId, storeId, productId, environment, taxCategory, privateKey } = config;
  if (!/^MER_[A-Za-z0-9]{22}$/.test(merchantId) || !/^STO_[A-Za-z0-9]{22}$/.test(storeId) ||
      !/^PROD_[A-Za-z0-9]{22}$/.test(productId) || (environment !== "prod" && environment !== "test") ||
      !Object.values(TaxCategory).includes(taxCategory as TaxCategory) || !privateKey?.trim()) {
    throw new RPCError("invalid_config", "Check the Waffo merchant, store, product, key, environment and tax category");
  }
  const publicURL = httpsURL(config.publicBaseUrl, "invalid_config");
  if (publicURL.pathname !== "/" || publicURL.search || publicURL.hash) {
    throw new RPCError("invalid_config", "The public URL must be an HTTPS origin");
  }
  return { merchantId, storeId, productId, environment, taxCategory: taxCategory as TaxCategory, privateKey, publicURL } as const;
}

function currencyCode(currency: unknown) {
  if (currency !== "USD" && currency !== "CNY") {
    throw new RPCError("unsupported_currency", "Waffo Pancake wallet payments support USD and CNY");
  }
  return currency;
}

function minorUnits(amount: unknown) {
  if (typeof amount !== "string" || !/^\d{1,14}(?:\.\d{1,2})?$/.test(amount)) {
    throw new RPCError("invalid_amount", "Waffo Pancake returned an invalid amount");
  }
  const [whole, fraction = ""] = amount.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new RPCError("invalid_amount", "Waffo Pancake returned an invalid amount");
  }
  return result;
}

async function checkProduct(client: WaffoPancake, config: ReturnType<typeof configuration>, currency: string) {
  const result = await client.graphql.query<{
    onetimeProducts: { id: string; hasProdVersion: boolean; prices: { currency: string }[] }[];
  }>({
    query: `query ($storeId: String!) {
      onetimeProducts(storeId: $storeId, filter: { status: { eq: "active" } }, limit: 100) {
        id hasProdVersion prices { currency }
      }
    }`,
    variables: { storeId: config.storeId },
  });
  const product = result.data?.onetimeProducts?.find(({ id }) => id === config.productId);
  if (result.errors?.length || !product ||
      (config.environment === "prod" && product.hasProdVersion !== true) ||
      !product.prices?.some((price) => price.currency === currency)) {
    throw new RPCError("product_unavailable", "Waffo one-time product is unavailable for the configured store, environment or currency");
  }
}

async function queryOrder(client: WaffoPancake, config: ReturnType<typeof configuration>, ref: string) {
  const result = await client.graphql.query<{ payments: Payment[] }>({
    query: `query ($ref: String!) {
      payments(filter: { orderMerchantExternalId: { eq: $ref }, status: { eq: "succeeded" } }, limit: 2) {
        id status orderMerchantExternalId amount currency
        onetimeOrder { id status testMode store { id } onetimeProduct { id } }
      }
    }`,
    variables: { ref },
  });
  if (result.errors?.length || !Array.isArray(result.data?.payments)) {
    throw new RPCError("query_failed", "Waffo Pancake did not return a complete payment query");
  }
  const [payment] = result.data.payments;
  if (!payment) {
    return { merchantOrderNo: ref, providerStatus: "awaiting_payment", paid: false, closed: false };
  }
  const order = payment.onetimeOrder;
  if (result.data.payments.length !== 1 || payment.status !== "succeeded" ||
      payment.orderMerchantExternalId !== ref || !/^PAY_[A-Za-z0-9]+$/.test(payment.id) ||
      !order || !/^ORD_[A-Za-z0-9]+$/.test(order.id) || order.status !== "completed" ||
      order.testMode !== (config.environment === "test") || order.store?.id !== config.storeId ||
      order.onetimeProduct?.id !== config.productId) {
    throw new RPCError("payment_evidence_mismatch", "Waffo Pancake payment evidence did not match the configured order");
  }
  return {
    merchantOrderNo: ref, providerTradeNo: payment.id, providerStatus: order.status,
    amountFen: minorUnits(payment.amount),
    currency: currencyCode(payment.currency), paid: true, closed: false,
  };
}

export async function handleRPC(input: RPCRequest, fetcher: typeof fetch = fetch, verify = verifyWebhook) {
  try {
    if (input?.version !== "yingce.payment/v1") throw new RPCError("unsupported_version", "Unsupported payment RPC version");
    const config = configuration(input.config);
    const { operation, request } = input;
    if (operation === "verify_notification") {
      const signatures = Object.entries(input.headers ?? {})
        .filter(([name]) => name.toLowerCase() === "x-waffo-signature").flatMap(([, values]) => values);
      if (signatures.length !== 1 || !signatures[0] || !input.bodyBase64) {
        throw new RPCError("invalid_notification", "Missing or ambiguous Waffo signature");
      }
      let event;
      try {
        const rawBody = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
          .decode(Buffer.from(input.bodyBase64, "base64"));
        event = verify<WebhookEventData>(rawBody, signatures[0], { environment: config.environment });
      } catch {
        throw new RPCError("invalid_notification", "Waffo Pancake signature verification failed");
      }
      const data = event.data;
      const ref = data?.orderMerchantExternalId;
      if (event.eventType !== WebhookEventType.OrderCompleted || event.mode !== config.environment ||
          event.storeId !== config.storeId || !event.id || !/^PAY_[A-Za-z0-9]+$/.test(event.eventId) ||
          !/^ORD_[A-Za-z0-9]+$/.test(data?.orderId) || !ref || !orderPattern.test(ref) ||
          data.orderMetadata?.source !== source || data.orderMetadata?.productId !== config.productId ||
          !Number.isFinite(Date.parse(event.timestamp))) {
        throw new RPCError("invalid_notification", "Waffo Pancake event does not match this payment channel");
      }
      return { ok: true, data: {
        eventId: event.id, merchantOrderNo: ref, providerTradeNo: event.eventId,
        providerStatus: "completed", amountFen: minorUnits(data.chargedAmount),
        currency: currencyCode(data.currency), paid: true, closed: false, paidAt: event.timestamp,
      } };
    }
    let client: WaffoPancake;
    try {
      client = new WaffoPancake({
        merchantId: config.merchantId, privateKey: config.privateKey, environment: config.environment,
        fetch: (url, init) => fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) }),
      });
    } catch {
      throw new RPCError("invalid_config", "Invalid Waffo Pancake RSA private key");
    }
    if (operation === "validate_config") return { ok: true };
    if (operation === "download_trade_bill") {
      throw new RPCError("unsupported_operation", "Waffo Pancake trade bill download is unavailable");
    }
    const ref = request?.MerchantOrderNo;
    if (!ref || !orderPattern.test(ref)) throw new RPCError("invalid_request", "Invalid merchant order number");
    if (operation === "query_order" || operation === "close_order") {
      const data = await queryOrder(client, config, ref);
      if (operation === "close_order" && !data.paid) {
        throw new RPCError("unsupported_operation", "Waffo Pancake does not expose merchant-side cancellation for this checkout");
      }
      return { ok: true, data };
    }
    if (operation !== "create_order") throw new RPCError("unsupported_operation", "Unknown payment operation");
    const currency = currencyCode(request.Currency);
    const amount = request.AmountFen;
    const expiresInSeconds = Math.floor((Date.parse(request.ExpiresAt ?? "") - Date.now()) / 1000);
    const returnURL = httpsURL(request.ReturnURL, "invalid_request");
    if (returnURL.origin !== config.publicURL.origin || !Number.isSafeInteger(amount) || amount === undefined ||
        amount < 1 || !Number.isFinite(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 86400) {
      throw new RPCError("invalid_request", "Invalid Waffo checkout amount, expiry or return URL");
    }
    const minor = BigInt(amount);
    const displayAmount = `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
    await checkProduct(client, config, currency);
    const session = await client.checkout.createSession({
      productId: config.productId, currency, successUrl: returnURL.href, expiresInSeconds,
      priceSnapshot: { amount: displayAmount, taxCategory: config.taxCategory },
      orderMerchantExternalId: ref, metadata: { source, productId: config.productId },
      allowPromotionCodes: false,
    }, { idempotencyKey: `supdance-checkout-${ref}` });
    httpsURL(session.checkoutUrl, "invalid_checkout");
    const expiresAt = Date.parse(session.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new RPCError("invalid_checkout", "Waffo Pancake returned an invalid checkout expiry");
    }
    return { ok: true, data: { Mode: "redirect", Value: session.checkoutUrl, ExpiresAt: new Date(expiresAt).toISOString() } };
  } catch (error) {
    if (error instanceof RPCError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof WaffoPancakeError) {
      return { ok: false, code: "waffo_api_error", message: `Waffo Pancake API rejected the request (HTTP ${error.status})` };
    }
    return { ok: false, code: "provider_error", message: "Waffo Pancake request failed" };
  }
}
