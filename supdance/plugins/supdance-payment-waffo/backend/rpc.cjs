// rpc.ts
var import_node_process = require("node:process");

// node_modules/@waffo/pancake-ts/dist/index.js
var import_crypto = require("crypto");
var import_crypto2 = require("crypto");
var WaffoPancakeError = class extends Error {
  status;
  errors;
  constructor(status, errors) {
    const rootCause = errors[0]?.message ?? "Unknown error";
    super(rootCause);
    this.name = "WaffoPancakeError";
    this.status = status;
    this.errors = errors;
  }
};
var DEFAULT_BASE_URL = "https://api.waffo.ai";
var CustomerHttpClient = class {
  token;
  environment;
  baseUrl;
  _fetch;
  constructor(token, environment, config) {
    this.token = token;
    this.environment = environment;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this._fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  }
  async post(path, body, options) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
      "X-Environment": this.environment
    };
    if (options?.idempotencyKey) {
      headers["X-Idempotency-Key"] = options.idempotencyKey;
    }
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    let envelope;
    try {
      envelope = await response.json();
    } catch {
      throw new WaffoPancakeError(response.status, [{ message: `Non-JSON response from ${path}`, layer: "sdk" }]);
    }
    return { status: response.status, ...envelope };
  }
};
var PKCS8_HEADER = "-----BEGIN PRIVATE KEY-----";
var PKCS8_FOOTER = "-----END PRIVATE KEY-----";
var PKCS1_HEADER = "-----BEGIN RSA PRIVATE KEY-----";
var PKCS1_FOOTER = "-----END RSA PRIVATE KEY-----";
var SPKI_HEADER = "-----BEGIN PUBLIC KEY-----";
var SPKI_FOOTER = "-----END PUBLIC KEY-----";
var PKCS1_PUB_HEADER = "-----BEGIN RSA PUBLIC KEY-----";
var PKCS1_PUB_FOOTER = "-----END RSA PUBLIC KEY-----";
function normalizePrivateKey(raw) {
  if (!raw || !raw.trim()) {
    throw new Error("Private key is empty. Provide an RSA private key in PEM format.");
  }
  let pem = raw.replace(/\\n/g, `
`).replace(/\r\n/g, `
`);
  pem = pem.trim();
  const hasPkcs8Header = pem.includes(PKCS8_HEADER);
  const hasPkcs1Header = pem.includes(PKCS1_HEADER);
  const hasHeader = hasPkcs8Header || hasPkcs1Header;
  if (hasHeader) {
    const base64 = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "").replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "").replace(/\s+/g, "");
    if (!base64) {
      throw new Error("Private key contains PEM headers but no key data. Check the key content.");
    }
    const header = hasPkcs1Header ? PKCS1_HEADER : PKCS8_HEADER;
    const footer = hasPkcs1Header ? PKCS1_FOOTER : PKCS8_FOOTER;
    const wrapped = base64.match(/.{1,64}/g).join(`
`);
    pem = `${header}
${wrapped}
${footer}`;
  } else {
    const base64 = pem.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
      throw new Error("Private key is not valid PEM or base64. Expected an RSA private key in PEM format or raw base64.");
    }
    const wrapped = base64.match(/.{1,64}/g).join(`
`);
    pem = `${PKCS8_HEADER}
${wrapped}
${PKCS8_FOOTER}`;
  }
  try {
    import_crypto.createPrivateKey(pem);
  } catch {
    throw new Error("Private key could not be parsed. Ensure it is a valid RSA private key in PKCS#8 or PKCS#1 (PEM) format.");
  }
  return pem;
}
function normalizePublicKey(raw) {
  if (!raw || !raw.trim()) {
    throw new Error("Public key is empty. Provide an RSA public key in PEM format.");
  }
  let pem = raw.replace(/\\n/g, `
`).replace(/\r\n/g, `
`);
  pem = pem.trim();
  const hasSpkiHeader = pem.includes(SPKI_HEADER);
  const hasPkcs1PubHeader = pem.includes(PKCS1_PUB_HEADER);
  const hasHeader = hasSpkiHeader || hasPkcs1PubHeader;
  if (hasHeader) {
    const base64 = pem.replace(/-----BEGIN (?:RSA )?PUBLIC KEY-----/g, "").replace(/-----END (?:RSA )?PUBLIC KEY-----/g, "").replace(/\s+/g, "");
    if (!base64) {
      throw new Error("Public key contains PEM headers but no key data. Check the key content.");
    }
    const header = hasPkcs1PubHeader ? PKCS1_PUB_HEADER : SPKI_HEADER;
    const footer = hasPkcs1PubHeader ? PKCS1_PUB_FOOTER : SPKI_FOOTER;
    const wrapped = base64.match(/.{1,64}/g).join(`
`);
    pem = `${header}
${wrapped}
${footer}`;
  } else {
    const base64 = pem.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
      throw new Error("Public key is not valid PEM or base64. Expected an RSA public key in PEM format or raw base64.");
    }
    const wrapped = base64.match(/.{1,64}/g).join(`
`);
    pem = `${SPKI_HEADER}
${wrapped}
${SPKI_FOOTER}`;
  }
  try {
    import_crypto.createPublicKey(pem);
  } catch {
    throw new Error("Public key could not be parsed. Ensure it is a valid RSA public key in SPKI or PKCS#1 (PEM) format.");
  }
  return pem;
}
function signRequest(method, path, timestamp, body, privateKey) {
  const bodyHash = import_crypto.createHash("sha256").update(body).digest("base64");
  const canonicalRequest = `${method}
${path}
${timestamp}
${bodyHash}`;
  const sign = import_crypto.createSign("sha256");
  sign.update(canonicalRequest);
  return sign.sign(privateKey, "base64");
}
var DEFAULT_BASE_URL2 = "https://api.waffo.ai";
var HttpClient = class {
  merchantId;
  privateKey;
  baseUrl;
  _fetch;
  constructor(config) {
    this.merchantId = config.merchantId;
    this.privateKey = normalizePrivateKey(config.privateKey);
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL2).replace(/\/+$/, "");
    this._fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  }
  async post(path, body, options) {
    const bodyStr = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signRequest("POST", path, timestamp, bodyStr, this.privateKey);
    const headers = {
      "Content-Type": "application/json",
      "X-Merchant-Id": this.merchantId,
      "X-Timestamp": timestamp,
      "X-Signature": signature
    };
    if (options?.idempotencyKey) {
      headers["X-Idempotency-Key"] = options.idempotencyKey;
    }
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: bodyStr
    });
    let envelope;
    try {
      envelope = await response.json();
    } catch {
      throw new WaffoPancakeError(response.status, [{ message: `Non-JSON response from ${path}`, layer: "sdk" }]);
    }
    return { status: response.status, ...envelope };
  }
};
function unwrapAction(r) {
  if (r.errors?.length) {
    throw new WaffoPancakeError(r.status, r.errors);
  }
  return { ...r.data, ...r.warnings ? { warnings: r.warnings } : {} };
}
var SHORT_ID_REGEX = /^[A-Z]{2,5}_[0-9A-Za-z]{22}$/;
var CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;
var COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
var AMOUNT_STRING_REGEX = /^\d+(\.\d+)?$/;
var DISCOUNT_CODE_REGEX = /^[A-Za-z0-9-]{3,32}$/;
var CODE_PREFIX_REGEX = /^[A-Za-z0-9-]{1,12}$/;
var SHORT_ID_LABELS = {
  STO: "Store",
  PROD: "Product",
  ORD: "Order",
  PAY: "Payment",
  REF: "Refund",
  TKT: "Ticket",
  MER: "Merchant",
  CPN: "Coupon",
  PMC: "Promotion Code"
};
function fail(message) {
  throw new WaffoPancakeError(400, [{ message, layer: "sdk" }]);
}
function validateRequired(field, value) {
  if (value === undefined || value === null) {
    fail(`Missing required field: ${field}`);
  }
  if (typeof value === "string" && value.trim() === "") {
    fail(`${field} cannot be empty`);
  }
}
function validateShortId(field, value, prefix) {
  validateRequired(field, value);
  const label = SHORT_ID_LABELS[prefix] ?? prefix;
  if (!SHORT_ID_REGEX.test(value)) {
    fail(`Invalid ${field}: expected ${label} Short ID format (${prefix}_xxx), got "${value}"`);
  }
  if (!value.startsWith(`${prefix}_`)) {
    fail(`Invalid ${field}: expected ${prefix}_ prefix (${label}), got "${value.split("_")[0]}_"`);
  }
}
function validateCurrencyCode(field, value) {
  validateRequired(field, value);
  if (!CURRENCY_CODE_REGEX.test(value)) {
    fail(`Invalid ${field}: expected 3-letter ISO 4217 currency code (e.g., "USD"), got "${value}"`);
  }
}
function validateAmountString(field, value) {
  validateRequired(field, value);
  if (!AMOUNT_STRING_REGEX.test(value)) {
    fail(`Invalid ${field}: expected numeric string in display format (e.g., "9.99", "1000"), got "${value}"`);
  }
}
function validatePositiveAmountString(field, value) {
  validateAmountString(field, value);
  if (Number(value) <= 0) {
    fail(`Invalid ${field}: expected an amount greater than 0, got "${value}"`);
  }
}
function validateEnum(field, value, allowed) {
  validateRequired(field, value);
  if (!allowed.includes(value)) {
    fail(`Invalid ${field}: expected one of [${allowed.join(", ")}], got "${value}"`);
  }
}
function validateMaxLength(field, value, max) {
  if (value !== undefined && value.length > max) {
    fail(`${field} must be at most ${max} characters, got ${value.length}`);
  }
}
function validatePositiveInteger(field, value) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`Invalid ${field}: expected positive integer, got ${value}`);
  }
}
function validateCountryCode(field, value) {
  validateRequired(field, value);
  if (!COUNTRY_CODE_REGEX.test(value)) {
    fail(`Invalid ${field}: expected 2-letter ISO 3166-1 country code (e.g., "US"), got "${value}"`);
  }
}
function validatePrices(field, prices) {
  validateRequired(field, prices);
  const entries = Object.entries(prices);
  if (entries.length === 0) {
    fail(`${field} must contain at least one currency`);
  }
  for (const [currency, info] of entries) {
    validateCurrencyCode(`${field}.${currency} (key)`, currency);
    validateAmountString(`${field}.${currency}.amount`, info.amount);
    validateRequired(`${field}.${currency}.taxCategory`, info.taxCategory);
  }
}
function validateBillingDetail(detail) {
  validateCountryCode("billingDetail.country", detail.country);
  if (typeof detail.isBusiness !== "boolean") {
    fail(`Invalid billingDetail.isBusiness: expected boolean, got ${typeof detail.isBusiness}`);
  }
}
function validateSessionDiscount(params) {
  if (params.promotionCode !== undefined) {
    if (typeof params.promotionCode !== "string") {
      fail(`Invalid promotionCode: expected a string, got ${typeof params.promotionCode}`);
    }
    if (params.promotionCode.trim() === "") {
      fail("promotionCode cannot be empty");
    }
  }
  if (params.couponId !== undefined) {
    validateShortId("couponId", params.couponId, "CPN");
    if (params.promotionCode !== undefined) {
      fail("couponId and promotionCode are mutually exclusive: pass couponId to apply a coupon, or promotionCode to prefill a promotion code");
    }
    if (params.allowPromotionCodes !== undefined) {
      fail("couponId and allowPromotionCodes are mutually exclusive: pass couponId to apply a coupon, or allowPromotionCodes to let the customer enter a code");
    }
  }
}
function validateCheckoutCommon(params) {
  validateShortId("productId", params.productId, "PROD");
  validateCurrencyCode("currency", params.currency);
  if (params.priceSnapshot) {
    validateAmountString("priceSnapshot.amount", params.priceSnapshot.amount);
    validateRequired("priceSnapshot.taxCategory", params.priceSnapshot.taxCategory);
  }
  if (params.billingDetail) {
    validateBillingDetail(params.billingDetail);
  }
  if (params.expiresInSeconds !== undefined) {
    validatePositiveInteger("expiresInSeconds", params.expiresInSeconds);
  }
  validateMaxLength("orderMerchantExternalId", params.orderMerchantExternalId, 128);
  validateSessionDiscount(params);
}
function validatePlanChangeCommon(params) {
  validateCheckoutCommon(params);
  validateShortId("originOrderId", params.originOrderId, "ORD");
  if (params.changeAmount !== undefined) {
    validateAmountString("changeAmount", params.changeAmount);
  }
  if (params.changeCreditAmount !== undefined) {
    validateAmountString("changeCreditAmount", params.changeCreditAmount);
  }
}
function validateDiscountCode(field, value) {
  validateRequired(field, value);
  if (!DISCOUNT_CODE_REGEX.test(typeof value === "string" ? value.trim() : value)) {
    fail(`Invalid ${field}: expected 3-32 letters, digits or '-', got "${value}"`);
  }
}
function validateCodePrefix(field, value) {
  if (!CODE_PREFIX_REGEX.test(value)) {
    fail(`Invalid ${field}: expected 1-12 letters, digits or '-', got "${value}"`);
  }
}
var AuthResource = class {
  constructor(http) {
    this.http = http;
  }
  async issueSessionToken(params, options) {
    if (!params.storeId && !params.productId) {
      throw new WaffoPancakeError(400, [{ message: "Missing required field: provide storeId or productId", layer: "sdk" }]);
    }
    if (params.storeId) {
      validateShortId("storeId", params.storeId, "STO");
    }
    if (params.productId) {
      validateShortId("productId", params.productId, "PROD");
    }
    validateRequired("buyerIdentity", params.buyerIdentity);
    return unwrapAction(await this.http.post("/v1/actions/auth/issue-session-token", params, options));
  }
  async createCustomerPortalLink(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("buyerIdentity", params.buyerIdentity);
    const result = await this.http.post("/v1/actions/auth/issue-session-token", { storeId: params.storeId, buyerIdentity: params.buyerIdentity, purpose: "portal" }, options);
    const data = unwrapAction(result);
    if (typeof data.portalUrl !== "string" || data.portalUrl === "") {
      throw new WaffoPancakeError(result.status, [
        { message: 'Missing portalUrl in issue-session-token response for purpose "portal"', layer: "sdk" }
      ]);
    }
    if (typeof data.token !== "string" || data.token === "") {
      throw new WaffoPancakeError(result.status, [
        { message: 'Missing token in issue-session-token response for purpose "portal"', layer: "sdk" }
      ]);
    }
    return {
      portalUrl: `${data.portalUrl}#token=${data.token}`,
      expiresAt: data.expiresAt,
      ...data.warnings ? { warnings: data.warnings } : {}
    };
  }
};
var CheckoutAnonymousResource = class {
  constructor(http) {
    this.http = http;
  }
  async create(params, options) {
    validateCheckoutCommon(params);
    return unwrapAction(await this.http.post("/v1/actions/checkout/create-session", params, options));
  }
};
var CheckoutAuthenticatedResource = class {
  constructor(http) {
    this.http = http;
  }
  async create(params, options) {
    validateCheckoutCommon(params);
    validateRequired("buyerIdentity", params.buyerIdentity);
    const { buyerIdentity, ...sessionParams } = params;
    const [tokenResult, sessionResult] = await Promise.all([
      this.http.post("/v1/actions/auth/issue-session-token", {
        productId: params.productId,
        buyerIdentity
      }),
      this.http.post("/v1/actions/checkout/create-session", sessionParams, options)
    ]);
    const token = unwrapAction(tokenResult);
    const session = unwrapAction(sessionResult);
    const warnings = [...token.warnings ?? [], ...session.warnings ?? []];
    return {
      sessionId: session.sessionId,
      checkoutUrl: `${session.checkoutUrl}#token=${token.token}`,
      expiresAt: session.expiresAt,
      token: token.token,
      tokenExpiresAt: token.expiresAt,
      ...warnings.length > 0 ? { warnings } : {}
    };
  }
  async createPlanChange(params, options) {
    validatePlanChangeCommon(params);
    validateRequired("buyerIdentity", params.buyerIdentity);
    const { buyerIdentity, ...sessionParams } = params;
    const [tokenResult, sessionResult] = await Promise.all([
      this.http.post("/v1/actions/auth/issue-session-token", {
        productId: params.productId,
        buyerIdentity
      }),
      this.http.post("/v1/actions/checkout/create-session", sessionParams, options)
    ]);
    const token = unwrapAction(tokenResult);
    const session = unwrapAction(sessionResult);
    const warnings = [...token.warnings ?? [], ...session.warnings ?? []];
    return {
      sessionId: session.sessionId,
      checkoutUrl: `${session.checkoutUrl}#token=${token.token}`,
      expiresAt: session.expiresAt,
      token: token.token,
      tokenExpiresAt: token.expiresAt,
      ...warnings.length > 0 ? { warnings } : {}
    };
  }
};
var CheckoutResource = class {
  constructor(http) {
    this.http = http;
    this.anonymous = new CheckoutAnonymousResource(http);
    this.authenticated = new CheckoutAuthenticatedResource(http);
  }
  anonymous;
  authenticated;
  async createSession(params, options) {
    validateCheckoutCommon(params);
    return unwrapAction(await this.http.post("/v1/actions/checkout/create-session", params, options));
  }
  async createPlanChangeSession(params, options) {
    validatePlanChangeCommon(params);
    return unwrapAction(await this.http.post("/v1/actions/checkout/create-session", params, options));
  }
};
var ContentSafetyResource = class {
  constructor(http) {
    this.http = http;
  }
  async scanPrompt(params, options) {
    validateRequired("prompt", params.prompt);
    return unwrapAction(await this.http.post("/v1/actions/verification/scan-prompt", params, options));
  }
};
var TaxCategory = /* @__PURE__ */ ((TaxCategory2) => {
  TaxCategory2["DigitalGoods"] = "digital_goods";
  TaxCategory2["SaaS"] = "saas";
  TaxCategory2["Software"] = "software";
  TaxCategory2["Ebook"] = "ebook";
  TaxCategory2["OnlineCourse"] = "online_course";
  TaxCategory2["Consulting"] = "consulting";
  TaxCategory2["ProfessionalService"] = "professional_service";
  return TaxCategory2;
})(TaxCategory || {});
var CouponDiscountType = /* @__PURE__ */ ((CouponDiscountType2) => {
  CouponDiscountType2["Percentage"] = "percentage";
  CouponDiscountType2["FixedAmount"] = "fixed_amount";
  return CouponDiscountType2;
})(CouponDiscountType || {});
var CouponDuration = /* @__PURE__ */ ((CouponDuration2) => {
  CouponDuration2["Once"] = "once";
  CouponDuration2["Repeating"] = "repeating";
  CouponDuration2["Forever"] = "forever";
  return CouponDuration2;
})(CouponDuration || {});
var WebhookEventType = /* @__PURE__ */ ((WebhookEventType2) => {
  WebhookEventType2["OrderCompleted"] = "order.completed";
  WebhookEventType2["SubscriptionActivated"] = "subscription.activated";
  WebhookEventType2["SubscriptionPaymentSucceeded"] = "subscription.payment_succeeded";
  WebhookEventType2["SubscriptionRenewed"] = "subscription.renewed";
  WebhookEventType2["SubscriptionRecovered"] = "subscription.recovered";
  WebhookEventType2["SubscriptionPlanChanged"] = "subscription.plan_changed";
  WebhookEventType2["SubscriptionPlanChangeScheduled"] = "subscription.plan_change_scheduled";
  WebhookEventType2["SubscriptionPlanChangeFailed"] = "subscription.plan_change_failed";
  WebhookEventType2["SubscriptionCanceling"] = "subscription.canceling";
  WebhookEventType2["SubscriptionUncanceled"] = "subscription.uncanceled";
  WebhookEventType2["SubscriptionCanceled"] = "subscription.canceled";
  WebhookEventType2["SubscriptionPastDue"] = "subscription.past_due";
  WebhookEventType2["RefundSucceeded"] = "refund.succeeded";
  WebhookEventType2["RefundFailed"] = "refund.failed";
  return WebhookEventType2;
})(WebhookEventType || {});
var CouponsResource = class {
  constructor(http) {
    this.http = http;
  }
  async create(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("name", params.name);
    validateMaxLength("name", params.name.trim(), 64);
    const seen = /* @__PURE__ */ new Set;
    if (params.code !== undefined) {
      validateDiscountCode("code", params.code);
      seen.add(params.code.trim().toUpperCase());
    }
    if (params.promotionCodes !== undefined) {
      if (!Array.isArray(params.promotionCodes) || params.promotionCodes.length > 20) {
        throw new WaffoPancakeError(400, [{ message: "Invalid promotionCodes: expected an array of at most 20 entries", layer: "sdk" }]);
      }
      params.promotionCodes.forEach((promotionCode, index) => {
        if (promotionCode?.code === undefined)
          return;
        validateDiscountCode(`promotionCodes[${index}].code`, promotionCode.code);
        const normalized = promotionCode.code.trim().toUpperCase();
        if (seen.has(normalized)) {
          throw new WaffoPancakeError(400, [{ message: `Duplicate promotionCodes code: "${normalized}"`, layer: "sdk" }]);
        }
        seen.add(normalized);
      });
    }
    validateRequired("discount", params.discount);
    validateEnum("discount.type", params.discount.type, Object.values(CouponDiscountType));
    if (params.discount.type === "percentage") {
      validateRequired("discount.percentOff", params.discount.percentOff);
      const percentOff = params.discount.percentOff;
      if (!(percentOff > 0 && percentOff <= 100)) {
        throw new WaffoPancakeError(400, [
          { message: `Invalid discount.percentOff: expected a value above 0 and up to 100, got ${percentOff}`, layer: "sdk" }
        ]);
      }
    } else {
      const entries = Object.entries(params.discount.amountOff ?? {});
      if (entries.length === 0)
        validateRequired("discount.amountOff", undefined);
      for (const [currency, amount] of entries) {
        validateCurrencyCode(`discount.amountOff.${currency} (key)`, currency);
        validatePositiveAmountString(`discount.amountOff.${currency}`, amount);
      }
    }
    if (params.duration !== undefined)
      validateEnum("duration", params.duration, Object.values(CouponDuration));
    if (params.duration === "repeating") {
      validateRequired("durationInPeriods", params.durationInPeriods);
      validatePositiveInteger("durationInPeriods", params.durationInPeriods);
    } else if (params.durationInPeriods !== undefined && params.durationInPeriods !== null) {
      throw new WaffoPancakeError(400, [{ message: "durationInPeriods is only allowed when duration is repeating", layer: "sdk" }]);
    }
    for (const productId of params.productIds ?? [])
      validateShortId("productIds[]", productId, "PROD");
    return unwrapAction(await this.http.post("/v1/actions/coupon/create-coupon", params, options));
  }
  async update(params, options) {
    validateShortId("id", params.id, "CPN");
    validateRequired("name", params.name);
    validateMaxLength("name", params.name.trim(), 64);
    return unwrapAction(await this.http.post("/v1/actions/coupon/update-coupon", params, options));
  }
  async deactivate(params, options) {
    validateShortId("id", params.id, "CPN");
    return unwrapAction(await this.http.post("/v1/actions/coupon/deactivate-coupon", params, options));
  }
};
var CustomerSession = class {
  constructor(http) {
    this.http = http;
    this.graphql = new CustomerGraphQL(http);
  }
  graphql;
  async cancelSubscription(params, options) {
    validateShortId("orderId", params.orderId, "ORD");
    return unwrapAction(await this.http.post("/v1/actions/subscription-order/cancel-order", params, options));
  }
  async cancelOnetimeOrder(params, options) {
    validateShortId("orderId", params.orderId, "ORD");
    return unwrapAction(await this.http.post("/v1/actions/onetime-order/cancel-order", params, options));
  }
  async reactivateSubscription(params, options) {
    validateShortId("orderId", params.orderId, "ORD");
    return unwrapAction(await this.http.post("/v1/actions/subscription-order/reactivate-order", params, options));
  }
  async createRefundTicket(params, options) {
    validateShortId("paymentId", params.paymentId, "PAY");
    validateRequired("reason", params.reason);
    validateAmountString("requestedAmount.amount", params.requestedAmount.amount);
    validateCurrencyCode("requestedAmount.currency", params.requestedAmount.currency);
    validateMaxLength("refundTicketMerchantExternalId", params.refundTicketMerchantExternalId, 128);
    return unwrapAction(await this.http.post("/v1/actions/refund-ticket/create-ticket", params, options));
  }
  async resubmitRefundTicket(params, options) {
    validateShortId("ticketId", params.ticketId, "TKT");
    validateShortId("paymentId", params.paymentId, "PAY");
    validateRequired("reason", params.reason);
    validateAmountString("requestedAmount.amount", params.requestedAmount.amount);
    validateCurrencyCode("requestedAmount.currency", params.requestedAmount.currency);
    return unwrapAction(await this.http.post("/v1/actions/refund-ticket/resubmit-ticket", params, options));
  }
  async createPlanChangeSession(params, options) {
    validateShortId("originOrderId", params.originOrderId, "ORD");
    validateShortId("productId", params.productId, "PROD");
    validateCurrencyCode("currency", params.currency);
    return unwrapAction(await this.http.post("/v1/actions/checkout/create-session", params, options));
  }
};
var CustomerGraphQL = class {
  constructor(http) {
    this.http = http;
  }
  async query(params) {
    validateRequired("query", params.query);
    const result = await this.http.post("/v1/graphql", params);
    return { data: result.data, errors: result.errors, warnings: result.warnings };
  }
};
var GraphQLResource = class {
  constructor(http) {
    this.http = http;
  }
  async query(params) {
    validateRequired("query", params.query);
    const result = await this.http.post("/v1/graphql", params);
    return { data: result.data, errors: result.errors, warnings: result.warnings };
  }
};
var OnetimeProductsResource = class {
  constructor(http) {
    this.http = http;
  }
  async create(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("name", params.name);
    validatePrices("prices", params.prices);
    return unwrapAction(await this.http.post("/v1/actions/onetime-product/create-product", params, options));
  }
  async update(params, options) {
    validateShortId("id", params.id, "PROD");
    if (params.name !== undefined)
      validateRequired("name", params.name);
    if (params.prices)
      validatePrices("prices", params.prices);
    return unwrapAction(await this.http.post("/v1/actions/onetime-product/update-product", params, options));
  }
  async publish(params, options) {
    validateShortId("id", params.id, "PROD");
    return unwrapAction(await this.http.post("/v1/actions/onetime-product/publish-product", params, options));
  }
  async updateStatus(params, options) {
    validateShortId("id", params.id, "PROD");
    validateEnum("status", params.status, ["active", "inactive"]);
    return unwrapAction(await this.http.post("/v1/actions/onetime-product/update-status", params, options));
  }
};
var OrdersResource = class {
  constructor(http) {
    this.http = http;
  }
  async cancelSubscription(params, options) {
    validateShortId("orderId", params.orderId, "ORD");
    return unwrapAction(await this.http.post("/v1/actions/subscription-order/cancel-order", params, options));
  }
};
var PromotionCodesResource = class {
  constructor(http) {
    this.http = http;
  }
  async create(params, options) {
    validateShortId("couponId", params.couponId, "CPN");
    if (params.code !== undefined)
      validateDiscountCode("code", params.code);
    return unwrapAction(await this.http.post("/v1/actions/promotion-code/create-promotion-code", params, options));
  }
  async generate(params, options) {
    validateShortId("couponId", params.couponId, "CPN");
    validateRequired("count", params.count);
    if (!Number.isInteger(params.count) || params.count < 1 || params.count > 500) {
      throw new WaffoPancakeError(400, [
        { message: `Invalid count: expected integer between 1 and 500, got ${params.count}`, layer: "sdk" }
      ]);
    }
    if (params.prefix !== undefined)
      validateCodePrefix("prefix", params.prefix);
    if (params.length !== undefined && (!Number.isInteger(params.length) || params.length < 8 || params.length > 16)) {
      throw new WaffoPancakeError(400, [
        { message: `Invalid length: expected integer between 8 and 16, got ${params.length}`, layer: "sdk" }
      ]);
    }
    return unwrapAction(await this.http.post("/v1/actions/promotion-code/generate-promotion-codes", params, options));
  }
  async deactivate(params, options) {
    validateShortId("id", params.id, "PMC");
    return unwrapAction(await this.http.post("/v1/actions/promotion-code/deactivate-promotion-code", params, options));
  }
};
var StoreMerchantsResource = class {
  constructor(http) {
    this.http = http;
  }
  async add(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("email", params.email);
    validateEnum("role", params.role, ["admin", "member"]);
    return unwrapAction(await this.http.post("/v1/actions/store-merchant/add-merchant", params, options));
  }
  async remove(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateShortId("merchantId", params.merchantId, "MER");
    return unwrapAction(await this.http.post("/v1/actions/store-merchant/remove-merchant", params, options));
  }
  async updateRole(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateShortId("merchantId", params.merchantId, "MER");
    validateEnum("role", params.role, ["admin", "member"]);
    return unwrapAction(await this.http.post("/v1/actions/store-merchant/update-role", params, options));
  }
};
var StoresResource = class {
  constructor(http) {
    this.http = http;
  }
  async create(params, options) {
    validateRequired("name", params.name);
    return unwrapAction(await this.http.post("/v1/actions/store/create-store", params, options));
  }
  async update(params, options) {
    validateShortId("id", params.id, "STO");
    return unwrapAction(await this.http.post("/v1/actions/store/update-store", params, options));
  }
  async delete(params, options) {
    validateShortId("id", params.id, "STO");
    return unwrapAction(await this.http.post("/v1/actions/store/delete-store", params, options));
  }
};
var SubscriptionProductGroupsResource = class {
  constructor(http) {
    this.http = http;
  }
  async create(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("name", params.name);
    return unwrapAction(await this.http.post("/v1/actions/subscription-product-group/create-group", params, options));
  }
  async update(params, options) {
    validateRequired("id", params.id);
    return unwrapAction(await this.http.post("/v1/actions/subscription-product-group/update-group", params, options));
  }
  async delete(params, options) {
    validateRequired("id", params.id);
    return unwrapAction(await this.http.post("/v1/actions/subscription-product-group/delete-group", params, options));
  }
  async publish(params, options) {
    validateRequired("id", params.id);
    return unwrapAction(await this.http.post("/v1/actions/subscription-product-group/publish-group", params, options));
  }
};
var SubscriptionProductsResource = class {
  constructor(http) {
    this.http = http;
  }
  async create(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("name", params.name);
    validateEnum("billingPeriod", params.billingPeriod, ["weekly", "monthly", "quarterly", "yearly"]);
    validatePrices("prices", params.prices);
    return unwrapAction(await this.http.post("/v1/actions/subscription-product/create-product", params, options));
  }
  async update(params, options) {
    validateShortId("id", params.id, "PROD");
    if (params.name !== undefined)
      validateRequired("name", params.name);
    if (params.billingPeriod !== undefined)
      validateEnum("billingPeriod", params.billingPeriod, ["weekly", "monthly", "quarterly", "yearly"]);
    if (params.prices)
      validatePrices("prices", params.prices);
    return unwrapAction(await this.http.post("/v1/actions/subscription-product/update-product", params, options));
  }
  async publish(params, options) {
    validateShortId("id", params.id, "PROD");
    return unwrapAction(await this.http.post("/v1/actions/subscription-product/publish-product", params, options));
  }
  async updateStatus(params, options) {
    validateShortId("id", params.id, "PROD");
    validateEnum("status", params.status, ["active", "inactive"]);
    return unwrapAction(await this.http.post("/v1/actions/subscription-product/update-status", params, options));
  }
};
var DEFAULT_TOLERANCE_MS = 45 * 60 * 1000;
var DEFAULT_FUTURE_TOLERANCE_MS = 60 * 1000;
var TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxnmRY6yMMA3lVqmAU6ZG
b1sjL/+r/z6E+ZjkXaDAKiqOhk9rpazni0bNsGXwmftTPk9jy2wn+j6JHODD/WH/
SCnSfvKkLIjy4Hk7BuCgB174C0ydan7J+KgXLkOwgCAxxB68t2tezldwo74ZpXgn
F49opzMvQ9prEwIAWOE+kV9iK6gx/AckSMtHIHpUesoPDkldpmFHlB2qpf1vsFTZ
5kD6DmGl+2GIVK01aChy2lk8pLv0yUMu18v44sLkO5M44TkGPJD9qG09wrvVG2wp
OTVCn1n5pP8P+HRLcgzbUB3OlZVfdFurn6EZwtyL4ZD9kdkQ4EZE/9inKcp3c1h4
xwIDAQAB
-----END PUBLIC KEY-----`;
var PROD_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz+xApdTIb4ua+DgZKQ54
iBsD82ybyhGCLRETONW4Jgbb3A8DUM1LqBk6r/CmTOCHqLalTQHNigvP3R5zkDNX
iRJz6gA4MJ/+8K0+mnEE2RISQzN+Qu65TNd6svb+INm/kMaftY4uIXr6y6kchtTJ
dwnQhcKdAL2v7h7IFnkVelQsKxDdb2PqX8xX/qwd01iXvMcpCCaXovUwZsxH2QN5
ZKBTseJivbhUeyJCco4fdUyxOMHe2ybCVhyvim2uxAl1nkvL5L8RCWMCAV55LLo0
9OhmLahz/DYNu13YLVP6dvIT09ZFBYU6Owj1NxdinTynlJCFS9VYwBgmftosSE1U
dwIDAQAB
-----END PUBLIC KEY-----`;
function parseSignatureHeader(header) {
  let t = "";
  let v1 = "";
  for (const pair of header.split(",")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1)
      continue;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (key === "t")
      t = value;
    else if (key === "v1")
      v1 = value;
  }
  return { t, v1 };
}
function rsaVerify(signatureInput, v1, publicKey) {
  const verifier = import_crypto2.createVerify("RSA-SHA256");
  verifier.update(signatureInput);
  return verifier.verify(publicKey, v1, "base64");
}
function resolveKeyForEnv(env, configKeys) {
  if (typeof configKeys === "string") {
    return normalizePublicKey(configKeys);
  }
  if (configKeys?.[env]) {
    return normalizePublicKey(configKeys[env]);
  }
  const envSpecific = env === "test" ? process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY : process.env.WAFFO_WEBHOOK_PROD_PUBLIC_KEY;
  if (envSpecific) {
    return normalizePublicKey(envSpecific);
  }
  const generic = process.env.WAFFO_WEBHOOK_PUBLIC_KEY;
  if (generic) {
    return normalizePublicKey(generic);
  }
  return env === "test" ? TEST_PUBLIC_KEY : PROD_PUBLIC_KEY;
}
function verifyWebhook(payload, signatureHeader, options) {
  if (!signatureHeader) {
    throw new Error("Missing X-Waffo-Signature header");
  }
  const { t, v1 } = parseSignatureHeader(signatureHeader);
  if (!t || !v1) {
    throw new Error("Malformed X-Waffo-Signature header: missing t or v1");
  }
  const toleranceMs = options?.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  if (toleranceMs > 0) {
    const timestampMs = Number(t);
    if (Number.isNaN(timestampMs)) {
      throw new Error("Invalid timestamp in X-Waffo-Signature header");
    }
    const futureToleranceMs = options?.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS;
    const ageMs = Date.now() - timestampMs;
    if (ageMs > toleranceMs || ageMs < -futureToleranceMs) {
      throw new Error("Webhook timestamp outside tolerance window (possible replay attack)");
    }
  }
  const signatureInput = `${t}.${payload}`;
  const directKey = options?.publicKey;
  if (directKey) {
    const normalizedKey = normalizePublicKey(directKey);
    if (!rsaVerify(signatureInput, v1, normalizedKey)) {
      throw new Error("Invalid webhook signature (custom key)");
    }
  } else {
    const configKeys = options?.publicKeys;
    const env = options?.environment;
    if (env === "test" || env === "prod") {
      const key = resolveKeyForEnv(env, configKeys);
      if (!rsaVerify(signatureInput, v1, key)) {
        throw new Error(`Invalid webhook signature (${env} key)`);
      }
    } else {
      const prodKey = resolveKeyForEnv("prod", configKeys);
      if (!rsaVerify(signatureInput, v1, prodKey)) {
        const testKey = resolveKeyForEnv("test", configKeys);
        if (!rsaVerify(signatureInput, v1, testKey)) {
          throw new Error("Invalid webhook signature (tried both prod and test keys)");
        }
      }
    }
  }
  return JSON.parse(payload);
}
var WebhooksResource = class {
  constructor(http, publicKeys) {
    this.http = http;
    this.publicKeys = publicKeys;
  }
  async add(params, options) {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("channel", params.channel);
    validateRequired("url", params.url);
    return unwrapAction(await this.http.post("/v1/actions/store/add-webhook", params, options));
  }
  async update(params, options) {
    validateRequired("id", params.id);
    return unwrapAction(await this.http.post("/v1/actions/store/update-webhook", params, options));
  }
  async remove(params, options) {
    validateRequired("id", params.id);
    return unwrapAction(await this.http.post("/v1/actions/store/remove-webhook", params, options));
  }
  verify(payload, signatureHeader, options) {
    const mergedOptions = {
      ...options,
      publicKeys: options?.publicKeys ?? this.publicKeys
    };
    return verifyWebhook(payload, signatureHeader, mergedOptions);
  }
};
var WaffoPancake = class {
  http;
  config;
  auth;
  stores;
  storeMerchants;
  onetimeProducts;
  subscriptionProducts;
  subscriptionProductGroups;
  coupons;
  promotionCodes;
  orders;
  checkout;
  graphql;
  webhooks;
  contentSafety;
  constructor(config) {
    validateShortId("merchantId", config.merchantId, "MER");
    this.config = config;
    this.http = new HttpClient(config);
    this.auth = new AuthResource(this.http);
    this.stores = new StoresResource(this.http);
    this.storeMerchants = new StoreMerchantsResource(this.http);
    this.onetimeProducts = new OnetimeProductsResource(this.http);
    this.subscriptionProducts = new SubscriptionProductsResource(this.http);
    this.subscriptionProductGroups = new SubscriptionProductGroupsResource(this.http);
    this.coupons = new CouponsResource(this.http);
    this.promotionCodes = new PromotionCodesResource(this.http);
    this.orders = new OrdersResource(this.http);
    this.checkout = new CheckoutResource(this.http);
    this.graphql = new GraphQLResource(this.http);
    this.webhooks = new WebhooksResource(this.http, config.webhookPublicKey);
    this.contentSafety = new ContentSafetyResource(this.http);
  }
  customer(token, options) {
    const environment = options?.environment ?? this.config.environment;
    if (environment === undefined) {
      throw new WaffoPancakeError(400, [
        {
          message: "Missing required field: environment — set it on the client config or pass client.customer(token, { environment: 'test' | 'prod' })",
          layer: "sdk"
        }
      ]);
    }
    validateEnum("environment", environment, ["test", "prod"]);
    const customerHttp = new CustomerHttpClient(token, environment, {
      baseUrl: this.config.baseUrl,
      fetch: this.config.fetch
    });
    return new CustomerSession(customerHttp);
  }
  buyer(token, options) {
    return this.customer(token, options);
  }
};

// waffo.ts
class RPCError extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
var orderPattern = /^[a-f0-9]{32}$/;
var source = "supdance-payment-waffo";
function httpsURL(value, code) {
  let url;
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
function configuration(config = {}) {
  const { merchantId, storeId, productId, environment, taxCategory, privateKey } = config;
  if (!/^MER_[A-Za-z0-9]{22}$/.test(merchantId) || !/^STO_[A-Za-z0-9]{22}$/.test(storeId) || !/^PROD_[A-Za-z0-9]{22}$/.test(productId) || environment !== "prod" && environment !== "test" || !Object.values(TaxCategory).includes(taxCategory) || !privateKey?.trim()) {
    throw new RPCError("invalid_config", "Check the Waffo merchant, store, product, key, environment and tax category");
  }
  const publicURL = httpsURL(config.publicBaseUrl, "invalid_config");
  if (publicURL.pathname !== "/" || publicURL.search || publicURL.hash) {
    throw new RPCError("invalid_config", "The public URL must be an HTTPS origin");
  }
  return { merchantId, storeId, productId, environment, taxCategory, privateKey, publicURL };
}
function currencyCode(currency) {
  if (currency !== "USD" && currency !== "CNY") {
    throw new RPCError("unsupported_currency", "Waffo Pancake wallet payments support USD and CNY");
  }
  return currency;
}
function minorUnits(amount) {
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
async function checkProduct(client, config, currency) {
  const result = await client.graphql.query({
    query: `query ($storeId: String!) {
      onetimeProducts(storeId: $storeId, filter: { status: { eq: "active" } }, limit: 100) {
        id hasProdVersion prices { currency }
      }
    }`,
    variables: { storeId: config.storeId }
  });
  const product = result.data?.onetimeProducts?.find(({ id }) => id === config.productId);
  if (result.errors?.length || !product || config.environment === "prod" && product.hasProdVersion !== true || !product.prices?.some((price) => price.currency === currency)) {
    throw new RPCError("product_unavailable", "Waffo one-time product is unavailable for the configured store, environment or currency");
  }
}
async function queryOrder(client, config, ref) {
  const result = await client.graphql.query({
    query: `query ($ref: String!) {
      payments(filter: { orderMerchantExternalId: { eq: $ref }, status: { eq: "succeeded" } }, limit: 2) {
        id status orderMerchantExternalId amount { amount currency }
        onetimeOrder { id status testMode store { id } onetimeProduct { id } }
      }
    }`,
    variables: { ref }
  });
  if (result.errors?.length || !Array.isArray(result.data?.payments)) {
    throw new RPCError("query_failed", "Waffo Pancake did not return a complete payment query");
  }
  const [payment] = result.data.payments;
  if (!payment) {
    return { merchantOrderNo: ref, providerStatus: "awaiting_payment", paid: false, closed: false };
  }
  const order = payment.onetimeOrder;
  if (result.data.payments.length !== 1 || payment.status !== "succeeded" || payment.orderMerchantExternalId !== ref || !/^PAY_[A-Za-z0-9]+$/.test(payment.id) || !order || !/^ORD_[A-Za-z0-9]+$/.test(order.id) || order.status !== "completed" || order.testMode !== (config.environment === "test") || order.store?.id !== config.storeId || order.onetimeProduct?.id !== config.productId) {
    throw new RPCError("payment_evidence_mismatch", "Waffo Pancake payment evidence did not match the configured order");
  }
  return {
    merchantOrderNo: ref,
    providerTradeNo: payment.id,
    providerStatus: order.status,
    amountFen: minorUnits(payment.amount?.amount),
    currency: currencyCode(payment.amount?.currency),
    paid: true,
    closed: false
  };
}
async function handleRPC(input, fetcher = fetch, verify = verifyWebhook) {
  try {
    if (input?.version !== "yingce.payment/v1")
      throw new RPCError("unsupported_version", "Unsupported payment RPC version");
    const config = configuration(input.config);
    const { operation, request } = input;
    if (operation === "verify_notification") {
      const signatures = Object.entries(input.headers ?? {}).filter(([name]) => name.toLowerCase() === "x-waffo-signature").flatMap(([, values]) => values);
      if (signatures.length !== 1 || !signatures[0] || !input.bodyBase64) {
        throw new RPCError("invalid_notification", "Missing or ambiguous Waffo signature");
      }
      let event;
      try {
        const rawBody = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.from(input.bodyBase64, "base64"));
        event = verify(rawBody, signatures[0], { environment: config.environment });
      } catch {
        throw new RPCError("invalid_notification", "Waffo Pancake signature verification failed");
      }
      const data = event.data;
      const ref = data?.orderMerchantExternalId;
      if (event.eventType !== WebhookEventType.OrderCompleted || event.mode !== config.environment || event.storeId !== config.storeId || !event.id || !/^PAY_[A-Za-z0-9]+$/.test(event.eventId) || !/^ORD_[A-Za-z0-9]+$/.test(data?.orderId) || !ref || !orderPattern.test(ref) || data.orderMetadata?.source !== source || data.orderMetadata?.productId !== config.productId || !Number.isFinite(Date.parse(event.timestamp))) {
        throw new RPCError("invalid_notification", "Waffo Pancake event does not match this payment channel");
      }
      return { ok: true, data: {
        eventId: event.id,
        merchantOrderNo: ref,
        providerTradeNo: event.eventId,
        providerStatus: "completed",
        amountFen: minorUnits(data.chargedAmount),
        currency: currencyCode(data.currency),
        paid: true,
        closed: false,
        paidAt: event.timestamp
      } };
    }
    let client;
    try {
      client = new WaffoPancake({
        merchantId: config.merchantId,
        privateKey: config.privateKey,
        environment: config.environment,
        fetch: (url, init) => fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(1e4) })
      });
    } catch {
      throw new RPCError("invalid_config", "Invalid Waffo Pancake RSA private key");
    }
    if (operation === "validate_config")
      return { ok: true };
    if (operation === "download_trade_bill") {
      throw new RPCError("unsupported_operation", "Waffo Pancake trade bill download is unavailable");
    }
    const ref = request?.MerchantOrderNo;
    if (!ref || !orderPattern.test(ref))
      throw new RPCError("invalid_request", "Invalid merchant order number");
    if (operation === "query_order" || operation === "close_order") {
      const data = await queryOrder(client, config, ref);
      if (operation === "close_order" && !data.paid) {
        throw new RPCError("unsupported_operation", "Waffo Pancake does not expose merchant-side cancellation for this checkout");
      }
      return { ok: true, data };
    }
    if (operation !== "create_order")
      throw new RPCError("unsupported_operation", "Unknown payment operation");
    const currency = currencyCode(request.Currency);
    const amount = request.AmountFen;
    const expiresInSeconds = Math.floor((Date.parse(request.ExpiresAt ?? "") - Date.now()) / 1000);
    const returnURL = httpsURL(request.ReturnURL, "invalid_request");
    if (returnURL.origin !== config.publicURL.origin || !Number.isSafeInteger(amount) || amount === undefined || amount < 1 || !Number.isFinite(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 86400) {
      throw new RPCError("invalid_request", "Invalid Waffo checkout amount, expiry or return URL");
    }
    const minor = BigInt(amount);
    const displayAmount = `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
    await checkProduct(client, config, currency);
    const session = await client.checkout.createSession({
      productId: config.productId,
      currency,
      successUrl: returnURL.href,
      expiresInSeconds,
      priceSnapshot: { amount: displayAmount, taxCategory: config.taxCategory },
      orderMerchantExternalId: ref,
      metadata: { source, productId: config.productId },
      allowPromotionCodes: false
    }, { idempotencyKey: `supdance-checkout-${ref}` });
    httpsURL(session.checkoutUrl, "invalid_checkout");
    const expiresAt = Date.parse(session.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new RPCError("invalid_checkout", "Waffo Pancake returned an invalid checkout expiry");
    }
    return { ok: true, data: { Mode: "redirect", Value: session.checkoutUrl, ExpiresAt: new Date(expiresAt).toISOString() } };
  } catch (error) {
    if (error instanceof RPCError)
      return { ok: false, code: error.code, message: error.message };
    if (error instanceof WaffoPancakeError) {
      return { ok: false, code: "waffo_api_error", message: `Waffo Pancake API rejected the request (HTTP ${error.status})` };
    }
    return { ok: false, code: "provider_error", message: "Waffo Pancake request failed" };
  }
}

// rpc.ts
var maxBytes = 2 << 20;
async function main() {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of import_node_process.stdin) {
      size += chunk.length;
      if (size > maxBytes)
        throw new Error("Request too large");
      chunks.push(chunk);
    }
    const response = await handleRPC(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    import_node_process.stdout.write(JSON.stringify(response) + `
`);
  } catch {
    import_node_process.stdout.write(`{"ok":false,"code":"invalid_request","message":"Invalid payment RPC request"}
`);
  }
}
main();
