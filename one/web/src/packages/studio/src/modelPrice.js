import { getModelPricing } from './models.js';

/**
 * Presentation rule for a shelf price:
 *   flat      one published `fixed` price  -> "45 credits"
 *   from      a `formula` floor, or several variants of a family disagreeing
 *             -> "from 680 credits" (same wording the account price tab uses)
 *   missing   no published price row       -> never render a number
 */
export function priceForIds(ids) {
  // Picker families carry `variantIds` as a Set, workbenches pass a bare id
  // string, and older callers pass an array — accept all three.
  const raw = ids == null ? [] : (typeof ids === "string" || typeof ids === "number" ? [ids] : Array.from(ids));
  const list = [...new Set(raw.filter(Boolean).map(String))];
  const found = list.map((id) => getModelPricing(id)).filter(Boolean);

  if (found.length === 0) return { kind: 'missing', credits: null };
  const credits = Math.min(...found.map((row) => row.credits));
  const spread = new Set(found.map((row) => row.credits)).size > 1;
  const perUsage = found.some((row) => row.formula);
  return { kind: spread || perUsage ? 'from' : 'flat', credits };
}

export function formatModelPrice(price, copy) {
  if (!price || price.kind === 'missing') return copy?.unavailable ?? 'No price yet';
  const template = price.kind === 'from' ? copy?.creditsFrom : copy?.credits;
  return String(template ?? '').replace('{credits}', String(price.credits));
}
