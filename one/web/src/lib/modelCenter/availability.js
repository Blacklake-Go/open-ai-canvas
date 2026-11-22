import { isModelAudienceAllowed, isModelPublishedToSite } from './publicationPolicy.js';

/**
 * Single source of truth for "may this logical model be shown, quoted or run".
 *
 * Directory, Canvas descriptor and order-time assertion all evaluate the same
 * checks here. Callers may add site/user context, but the base admission rule
 * must never diverge again: a model is only usable when it is an active,
 * visible, core-tier model with an auto-routable verified provider line and a
 * positive credit price.
 */
export const MODEL_AVAILABILITY_REASON = Object.freeze({
  NOT_FOUND: 'MODEL_NOT_FOUND',
  INACTIVE: 'MODEL_INACTIVE',
  HIDDEN: 'MODEL_HIDDEN',
  TIER_RESTRICTED: 'MODEL_TIER_RESTRICTED',
  NOT_ROUTABLE: 'MODEL_NOT_ROUTABLE',
  NO_VERIFIED_ROUTE: 'NO_VERIFIED_ROUTE',
  PRICE_MISSING: 'MODEL_PRICE_MISSING',
  SITE_RESTRICTED: 'MODEL_SITE_RESTRICTED',
  AUDIENCE_RESTRICTED: 'MODEL_AUDIENCE_RESTRICTED',
});

const REASON_MESSAGES = Object.freeze({
  [MODEL_AVAILABILITY_REASON.NOT_FOUND]: '模型不存在或已被删除',
  [MODEL_AVAILABILITY_REASON.INACTIVE]: '模型已停用',
  [MODEL_AVAILABILITY_REASON.HIDDEN]: '模型未在公开目录中展示',
  [MODEL_AVAILABILITY_REASON.TIER_RESTRICTED]: '模型不在公开目录层级',
  [MODEL_AVAILABILITY_REASON.NOT_ROUTABLE]: '模型未启用自动路由',
  [MODEL_AVAILABILITY_REASON.NO_VERIFIED_ROUTE]: '模型没有通过验证的可用线路',
  [MODEL_AVAILABILITY_REASON.PRICE_MISSING]: '模型尚未配置有效的积分价格',
  [MODEL_AVAILABILITY_REASON.SITE_RESTRICTED]: '模型未向当前站点发布',
  [MODEL_AVAILABILITY_REASON.AUDIENCE_RESTRICTED]: '当前账户不在模型的发布范围内',
});

function hasPositiveCredits(model) {
  return Number.isFinite(Number(model.credits_price)) && Number(model.credits_price) > 0;
}

/**
 * Evaluate every admission check and keep the passing ones too, so admin
 * surfaces can explain what a model already satisfies, not only what blocks it.
 * Site and audience checks only run when a site/user context is supplied;
 * callers that intentionally list a whole catalogue keep that responsibility.
 */
export function modelAvailabilityChecks(model, { site = null, userId = null, isPaid = false } = {}) {
  const check = (code, ok) => ({ code, ok, message: REASON_MESSAGES[code] });
  if (!model) return [check(MODEL_AVAILABILITY_REASON.NOT_FOUND, false)];
  const checks = [
    check(MODEL_AVAILABILITY_REASON.INACTIVE, model.is_active === true),
    check(MODEL_AVAILABILITY_REASON.HIDDEN, model.is_visible === true),
    check(MODEL_AVAILABILITY_REASON.TIER_RESTRICTED, model.tier === 'core'),
    check(MODEL_AVAILABILITY_REASON.NOT_ROUTABLE, model.auto_route_eligible === true),
    check(MODEL_AVAILABILITY_REASON.NO_VERIFIED_ROUTE, model.hasWorkingRoute === true),
    check(MODEL_AVAILABILITY_REASON.PRICE_MISSING, hasPositiveCredits(model)),
  ];
  if (site) checks.push(check(MODEL_AVAILABILITY_REASON.SITE_RESTRICTED, isModelPublishedToSite(model, site)));
  if (userId) checks.push(check(MODEL_AVAILABILITY_REASON.AUDIENCE_RESTRICTED, isModelAudienceAllowed(model, { userId, isPaid })));
  return checks;
}

export function evaluateModelAvailability(model, options = {}) {
  const failed = modelAvailabilityChecks(model, options).filter((check) => !check.ok);
  return {
    available: failed.length === 0,
    state: failed.length === 0 ? 'enabled' : 'disabled',
    reasonCodes: failed.map((check) => check.code),
    reasons: failed.map((check) => check.message),
  };
}

export function isModelAvailable(model, options = {}) {
  return evaluateModelAvailability(model, options).available;
}
