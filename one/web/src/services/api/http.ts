export type ResponseContractKind = 'admin' | 'success' | 'domain';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly contract: ResponseContractKind;

  constructor(opts: {
    message: string;
    status: number;
    code?: string;
    requestId?: string;
    contract: ResponseContractKind;
  }) {
    super(opts.message);
    this.name = 'ApiClientError';
    this.status = opts.status;
    this.code = opts.code || 'HTTP_ERROR';
    this.requestId = opts.requestId;
    this.contract = opts.contract;
  }
}

export interface AdminEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  meta?: { requestId?: string; [k: string]: unknown };
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  contract?: ResponseContractKind;
}

async function parseJSONSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, contract = 'domain', ...rest } = options;
  const initHeaders = new Headers(headers);
  let serializedBody: BodyInit | undefined;

  if (body !== undefined) {
    if (body instanceof FormData || typeof body === 'string') {
      serializedBody = body;
    } else {
      if (!initHeaders.has('Content-Type')) {
        initHeaders.set('Content-Type', 'application/json');
      }
      serializedBody = JSON.stringify(body);
    }
  }

  const res = await fetch(path, {
    credentials: 'include',
    ...rest,
    headers: initHeaders,
    body: serializedBody,
  });

  const payload = await parseJSONSafe(res);

  if (contract === 'admin') {
    const env = (payload ?? {}) as AdminEnvelope<T>;
    if (!res.ok || env.ok === false) {
      throw new ApiClientError({
        status: res.status,
        code: env.error?.code || `HTTP_${res.status}`,
        message: env.error?.message || res.statusText || 'Admin API error',
        requestId: env.meta?.requestId,
        contract,
      });
    }
    return env.data as T;
  }

  if (contract === 'success') {
    const obj = (payload ?? {}) as Record<string, unknown>;
    if (!res.ok || obj.success === false) {
      throw new ApiClientError({
        status: res.status,
        code: typeof obj.code === 'string' ? obj.code : `HTTP_${res.status}`,
        message: typeof obj.error === 'string' ? obj.error : res.statusText || 'Request failed',
        contract,
      });
    }
    return payload as T;
  }

  // direct_domain_json
  if (!res.ok) {
    const obj = (payload ?? {}) as Record<string, unknown>;
    throw new ApiClientError({
      status: res.status,
      code: typeof obj.code === 'string' ? obj.code : `HTTP_${res.status}`,
      message: typeof obj.error === 'string' ? obj.error : res.statusText || 'Request failed',
      contract,
    });
  }

  return payload as T;
}

export interface BrandingResponse {
  brand: {
    brandName: string;
    siteTitle: string;
    brandSlogan: string;
    logoHref: string;
  };
  navigation: Array<{
    id: string;
    label: string;
    href: string;
    enabled: boolean;
  }>;
}

export interface ContentConfigResponse {
  banner: {
    id: string;
    enabled: boolean;
    message: string;
  };
  motion: {
    motionLevel: string;
  };
  features: Record<string, boolean>;
}

export interface SubscriptionFAQResponse {
  notice: string;
  supportEmail: string;
  items: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}

export interface I18nResponse {
  locale: string;
  messages: Record<string, unknown>;
  catalog: Record<string, unknown>;
}

export interface AuthMeResponse {
  user: {
    id: string;
    userNumber: string;
    displayName: string;
    role: string;
    credits: number;
  } | null;
  entitlements: Record<string, unknown> | null;
}

export interface ActiveModelsResponse {
  success: boolean;
  schemaVersion: number;
  launchScope: Record<string, unknown>;
  models: Array<{
    id: string;
    name: string;
    displayName: string;
    category: string;
    type: string;
    tier: string;
  }>;
}

export const oneApi = {
  getBranding: (signal?: AbortSignal) =>
    apiRequest<BrandingResponse>('/api/site/branding', { contract: 'domain', signal }),
  getContentConfig: (signal?: AbortSignal) =>
    apiRequest<ContentConfigResponse>('/api/site/content-config', { contract: 'domain', signal }),
  getSubscriptionFAQ: (signal?: AbortSignal) =>
    apiRequest<SubscriptionFAQResponse>('/api/site/subscription-faq', { contract: 'domain', signal }),
  getI18n: (locale: string, signal?: AbortSignal) =>
    apiRequest<I18nResponse>(`/api/i18n?locale=${encodeURIComponent(locale)}`, {
      contract: 'domain',
      signal,
    }),
  getAuthMe: (signal?: AbortSignal) =>
    apiRequest<AuthMeResponse>('/api/auth/me', { contract: 'domain', signal }),
  getActiveModels: (schemaVersion: 1 | 2 = 2, signal?: AbortSignal) =>
    apiRequest<ActiveModelsResponse>(`/api/models/active?schemaVersion=${schemaVersion}`, {
      contract: 'success',
      signal,
    }),
  adminRequest: <T>(path: string, options: Omit<RequestOptions, 'contract'> = {}) =>
    apiRequest<T>(path, { ...options, contract: 'admin' }),
};
