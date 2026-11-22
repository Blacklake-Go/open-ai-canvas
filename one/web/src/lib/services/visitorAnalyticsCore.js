/**
 * Third-Party Visitor Analytics Core
 * Pure JavaScript constants, schemas, validation, normalization, and script descriptors.
 * Free of server-only and database imports so it can be safely used in Client Components.
 */

export const DEFAULT_VISITOR_ANALYTICS = {
  googleAnalytics: {
    enabled: false,
    measurementId: '',
    propertyId: '',
    serviceAccountEmail: '',
    serviceAccountPrivateKey: '',
  },
  baiduTongji: {
    enabled: false,
    siteId: '',
  },
  microsoftClarity: {
    enabled: false,
    projectId: '',
  },
  customScript: {
    enabled: false,
    code: '',
  },
};

export const OFFICIAL_CONSOLE_LINKS = {
  googleAnalytics: {
    name: 'Google Analytics 4',
    consoleUrl: 'https://analytics.google.com/',
    dashboardUrl: 'https://analytics.google.com/analytics/web/#/realtime',
    docsUrl: 'https://support.google.com/analytics/answer/9304153',
  },
  baiduTongji: {
    name: '百度统计',
    consoleUrl: 'https://tongji.baidu.com/',
    dashboardUrl: 'https://tongji.baidu.com/web/welcome/login',
    docsUrl: 'https://tongji.baidu.com/help/getstart/code.html',
  },
  microsoftClarity: {
    name: 'Microsoft Clarity',
    consoleUrl: 'https://clarity.microsoft.com/',
    dashboardUrl: 'https://clarity.microsoft.com/projects',
    docsUrl: 'https://learn.microsoft.com/en-us/clarity/',
  },
};

const GA4_REGEX = /^G-[A-Za-z0-9]+$/;
const BAIDU_SITE_ID_REGEX = /^[0-9a-fA-F]{32}$/;
const CLARITY_PROJECT_ID_REGEX = /^[0-9a-zA-Z]{8,16}$/;
const MAX_CUSTOM_SCRIPT_LENGTH = 10000;

/**
 * Validates visitor analytics configuration against format specifications
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateVisitorAnalyticsConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['配置对象必须为有效对象'] };
  }

  if (config.googleAnalytics?.enabled) {
    const id = config.googleAnalytics.measurementId?.trim() || '';
    if (!id || !GA4_REGEX.test(id)) {
      errors.push('Google Analytics 4 衡量 ID 格式错误，必须形如 G-XXXXXXXXXX');
    }
  }

  if (config.googleAnalytics?.propertyId) {
    const pid = String(config.googleAnalytics.propertyId).trim();
    if (pid && !/^\d+$/.test(pid)) {
      errors.push('GA4 媒体资源 ID (Property ID) 格式错误，必须为纯数字（例如 558360595）');
    }
  }

  if (config.baiduTongji?.enabled) {
    const siteId = config.baiduTongji.siteId?.trim() || '';
    if (!siteId || !BAIDU_SITE_ID_REGEX.test(siteId)) {
      errors.push('百度统计站点 ID 格式错误，必须为 32 位十六进制哈希');
    }
  }

  if (config.microsoftClarity?.enabled) {
    const projectId = config.microsoftClarity.projectId?.trim() || '';
    if (!projectId || !CLARITY_PROJECT_ID_REGEX.test(projectId)) {
      errors.push('Microsoft Clarity 项目 ID 格式错误，必须为 8-16 位字母数字组合');
    }
  }

  if (config.customScript?.enabled) {
    const code = config.customScript.code ?? config.customScript.customCode ?? '';
    if (typeof code !== 'string') {
      errors.push('自定义统计代码必须为字符串');
    } else if (code.length > MAX_CUSTOM_SCRIPT_LENGTH) {
      errors.push(`自定义统计代码超出上限（最大 ${MAX_CUSTOM_SCRIPT_LENGTH} 字符，当前 ${code.length} 字符）`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normalizes input visitor analytics configuration
 * @param {Object} input
 * @returns {typeof DEFAULT_VISITOR_ANALYTICS}
 */
export function normalizeVisitorAnalyticsConfig(input) {
  const c = input || {};
  return {
    googleAnalytics: {
      enabled: Boolean(c.googleAnalytics?.enabled),
      measurementId: String(c.googleAnalytics?.measurementId || '').trim(),
      propertyId: String(c.googleAnalytics?.propertyId || '').trim(),
      serviceAccountEmail: String(c.googleAnalytics?.serviceAccountEmail || '').trim(),
      serviceAccountPrivateKey: String(c.googleAnalytics?.serviceAccountPrivateKey || '').trim(),
    },
    baiduTongji: {
      enabled: Boolean(c.baiduTongji?.enabled),
      siteId: String(c.baiduTongji?.siteId || '').trim(),
    },
    microsoftClarity: {
      enabled: Boolean(c.microsoftClarity?.enabled),
      projectId: String(c.microsoftClarity?.projectId || '').trim(),
    },
    customScript: {
      enabled: Boolean(c.customScript?.enabled),
      code: String(c.customScript?.code ?? c.customScript?.customCode ?? ''),
    },
  };
}

/**
 * Generates script descriptor specifications for script loaders and tests
 * @param {Object} config
 * @returns {Array<Object>}
 */
export function renderAnalyticsScripts(config) {
  const norm = normalizeVisitorAnalyticsConfig(config);
  const scripts = [];

  if (norm.googleAnalytics.enabled && norm.googleAnalytics.measurementId) {
    scripts.push({
      id: 'ga4-src',
      type: 'external',
      strategy: 'afterInteractive',
      src: `https://www.googletagmanager.com/gtag/js?id=${norm.googleAnalytics.measurementId}`,
    });
    scripts.push({
      id: 'ga4-inline',
      type: 'inline',
      strategy: 'afterInteractive',
      content: `gtag('config', '${norm.googleAnalytics.measurementId}');`,
    });
  }

  if (norm.baiduTongji.enabled && norm.baiduTongji.siteId) {
    scripts.push({
      id: 'baidu-tongji',
      type: 'external',
      strategy: 'afterInteractive',
      src: `https://hm.baidu.com/hm.js?${norm.baiduTongji.siteId}`,
    });
  }

  if (norm.microsoftClarity.enabled && norm.microsoftClarity.projectId) {
    scripts.push({
      id: 'clarity-src',
      type: 'inline',
      strategy: 'lazyOnload',
      content: `clarity('init', '${norm.microsoftClarity.projectId}');`,
    });
  }

  if (norm.customScript.enabled && norm.customScript.code) {
    scripts.push({
      id: 'custom-script',
      type: 'custom',
      strategy: 'afterInteractive',
      content: norm.customScript.code,
    });
  }

  return scripts;
}
