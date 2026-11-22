/**
 * Client-safe Third-Party Visitor Analytics helpers.
 * Re-exports pure validation/normalization from visitorAnalyticsCore.js
 * without pulling server-only repository/DB modules into the Vite bundle.
 */

export * from './visitorAnalyticsCore.js';
import {
  DEFAULT_VISITOR_ANALYTICS,
  normalizeVisitorAnalyticsConfig,
  validateVisitorAnalyticsConfig,
} from './visitorAnalyticsCore.js';

let inMemoryVisitorAnalytics = null;

export async function getVisitorAnalyticsConfig() {
  if (inMemoryVisitorAnalytics) {
    return { ...inMemoryVisitorAnalytics };
  }
  try {
    const res = await fetch('/api/site/content-config', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      const raw = data?.visitorAnalytics || data?.data?.visitorAnalytics;
      if (raw && typeof raw === 'object') {
        const normalized = normalizeVisitorAnalyticsConfig(raw);
        inMemoryVisitorAnalytics = normalized;
        return normalized;
      }
    }
  } catch {
    // Ignore network errors when public config endpoint is unavailable
  }
  return { ...DEFAULT_VISITOR_ANALYTICS };
}

export async function saveVisitorAnalyticsConfig(arg1) {
  const config = arg1 && typeof arg1 === 'object' && 'config' in arg1 ? arg1.config : arg1;
  const validation = validateVisitorAnalyticsConfig(config);
  if (!validation.valid) {
    throw new Error(`配置校验失败: ${validation.errors.join('; ')}`);
  }
  const normalized = normalizeVisitorAnalyticsConfig(config);
  inMemoryVisitorAnalytics = normalized;
  return normalized;
}
