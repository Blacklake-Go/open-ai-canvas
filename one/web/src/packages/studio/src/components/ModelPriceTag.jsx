import { useState, useEffect } from "react";
import { resolveCopy } from "../i18nUtils";
import { priceForIds, formatModelPrice } from "../modelPrice.js";
import { applyActiveModelDirectory } from "../models.js";
import en from "../messages/en/modelPrice.json";
import zh from "../messages/zh/modelPrice.json";
import ja from "../messages/ja-JP/modelPrice.json";
import ko from "../messages/ko-KR/modelPrice.json";
import zhTw from "../messages/zh-TW/modelPrice.json";
import es from "../messages/es/modelPrice.json";

const MODEL_PRICE_MESSAGES = {
  "zh-CN": zh,
  "ja-JP": ja,
  "ko-KR": ko,
  "zh-TW": zhTw,
  es: es,
  "es-ES": es,
};

/**
 * Renders the published shelf price for one model id, or for every variant of a
 * picker family. Automatically subscribes to pricing updates and falls back to
 * fetching active models when the catalog is not yet populated.
 */
export default function ModelPriceTag({
  ids,
  multiplier = 1,
  prefix = "",
  locale = "en",
  className = "",
  showUnavailable = true,
  compact = false,
}) {
  const copy = resolveCopy(en, MODEL_PRICE_MESSAGES, locale).price;
  const [, setVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setVersion((v) => v + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("supdance-model-pricing-updated", handleUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("supdance-model-pricing-updated", handleUpdate);
      }
    };
  }, [ids]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const globalPricing = globalThis.__SUPDANCE_MODEL_PRICING_MAP__;
    if (!window.__SUPDANCE_PRICING_FETCHING__ && (!globalPricing || globalPricing.size === 0)) {
      window.__SUPDANCE_PRICING_FETCHING__ = true;
      fetch("/api/models/active?schemaVersion=2")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data?.models)) {
            applyActiveModelDirectory(data.models);
          }
        })
        .catch(() => {})
        .finally(() => {
          window.__SUPDANCE_PRICING_FETCHING__ = false;
        });
    }
  }, []);

  const rawPrice = priceForIds(ids);
  const factor = Number.isFinite(multiplier) && multiplier > 1 ? multiplier : 1;
  const price =
    rawPrice.credits != null && factor > 1
      ? { ...rawPrice, credits: rawPrice.credits * factor }
      : rawPrice;

  if (price.kind === "missing" && !showUnavailable) {
    return null;
  }

  const accessiblePrice = formatModelPrice(price, copy);
  const displayPrice = compact
    ? `${price.credits ?? accessiblePrice}${price.kind === "from" ? "+" : ""}`
    : accessiblePrice;

  return (
    <span
      className={`text-micro font-normal text-ink-subtle ${className}`}
      data-model-price={price.kind === "missing" ? "" : String(price.credits)}
      data-model-price-kind={price.kind}
      aria-label={compact ? accessiblePrice : undefined}
      title={compact ? accessiblePrice : undefined}
    >
      {prefix}{displayPrice}
    </span>
  );
}
