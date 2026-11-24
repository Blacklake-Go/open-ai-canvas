import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { normalizeLocale } from '@/lib/locales';
import { hasPermission } from '@/lib/admin/permissions';
import { oneApi } from '@/services/api/http';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (title && typeof document !== 'undefined') {
      document.title = title;
    }
  }, [title]);
}

export function AdminFilterForm({
  children,
  className = 'flex flex-wrap items-center gap-3',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    for (const [k, v] of formData.entries()) {
      const str = String(v || '').trim();
      if (str) sp.set(k, str);
    }
    const qs = sp.toString();
    navigate(qs ? `${location.pathname}?${qs}` : location.pathname);
  };

  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
    </form>
  );
}

export async function fetchAdminRaw(path: string): Promise<any> {
  const res = await fetch(path, { credentials: 'include', cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error?.message || json?.error || `HTTP ${res.status}`);
  }
  return json;
}

export function normalizeAdminListResponse(json: any): { rows: any[]; meta: Record<string, any> } {
  const data = json?.data ?? json;
  if (Array.isArray(data)) {
    return { rows: data, meta: json?.meta || {} };
  }
  if (data && Array.isArray(data.rows)) {
    return { rows: data.rows, meta: data.meta || json?.meta || {} };
  }
  if (data && Array.isArray(data.items)) {
    return { rows: data.items, meta: data.meta || json?.meta || {} };
  }
  return { rows: [], meta: json?.meta || {} };
}

export function getCookieLocaleClient(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const name of ['NEXT_LOCALE', 'locale']) {
    const prefix = `${name}=`;
    for (const part of cookies) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        try {
          const val = decodeURIComponent(trimmed.slice(prefix.length));
          if (val) return val;
        } catch {
          const val = trimmed.slice(prefix.length);
          if (val) return val;
        }
      }
    }
  }
  return null;
}

export function resolveEffectiveLocaleClient(userLocale?: string | null): string {
  return normalizeLocale(userLocale || getCookieLocaleClient() || 'en');
}

export interface AdminSessionValue {
  user: Record<string, any> | null;
  permissions: string[];
  loading: boolean;
  refresh: () => void;
}

export const AdminSessionContext = createContext<AdminSessionValue>({
  user: null,
  permissions: [],
  loading: true,
  refresh: () => {},
});

export function useAdminSession() {
  return useContext(AdminSessionContext);
}

export function useAdminPermissionGuard(requiredPermission?: string) {
  const { user, permissions, loading } = useAdminSession();
  const allowed = !requiredPermission || !user ? true : hasPermission(user.role, requiredPermission);
  const redirectEl =
    !loading && user && requiredPermission && !allowed ? (
      <Navigate to={`/admin/forbidden?p=${encodeURIComponent(requiredPermission)}`} replace />
    ) : null;
  return { user, permissions, loading, allowed, redirectEl };
}

export function useAdminData<T>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    oneApi
      .adminRequest<T>(path)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || '加载失败');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data, loading, error, reload };
}

export function useAdminRawData<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminRaw(path)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setResolvedPath(path);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setResolvedPath(path);
          setError(err?.message || '加载失败');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const matchesPath = path !== null && path === resolvedPath;
  return {
    data: matchesPath ? data : null,
    loading: Boolean(path) && (loading || !matchesPath),
    error: matchesPath ? error : null,
    reload,
  };
}

