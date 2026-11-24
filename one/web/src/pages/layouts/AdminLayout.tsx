import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from '@/lib/admin/permissions';
import AdminShell from '@/components/admin/AdminShell';
import { AdminSessionContext, useDocumentTitle } from '@/pages/helpers/pageHelpers';
import AdminErrorBoundary from '@/pages/boundaries/AdminErrorBoundary';
import { oneApi } from '@/services/api/http';

export default function AdminLayout() {
  useDocumentTitle('管理后台 | SupDance AI Studio');
  const { pathname, search, hash } = useLocation();
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    oneApi
      .getAuthMe()
      .then((res) => {
        if (!cancelled) {
          setUser(res?.user || null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(`${pathname}${search}${hash}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (!hasPermission(user.role, PERMISSIONS.dashboardRead)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.10] bg-surface/95 p-8 text-center shadow-2xl shadow-black/60 backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">
            SupDance AI Studio
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.02em] leading-8 text-white">
            暂无后台访问权限
          </h1>
          <p className="mt-3 text-sm leading-6 tracking-[-0.005em] text-gray-400">
            当前登录账户身份为普通用户（{user.email}），无权访问运营管理后台。
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a
              href="/"
              className="inline-flex h-[38px] items-center rounded-xl bg-brand hover:bg-brand-hover px-4 text-xs font-semibold text-white transition-all active:scale-[0.98] shadow-sm"
            >
              返回主页
            </a>
            <a
              href="/account"
              className="inline-flex h-[38px] items-center rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 text-xs font-medium text-gray-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
            >
              切换账号
            </a>
          </div>
        </div>
      </div>
    );
  }

  const permissions = Array.from((ROLE_PERMISSIONS as Record<string, Set<string>>)[user.role] || []);

  return (
    <AdminSessionContext.Provider value={{ user, permissions, loading, refresh }}>
      <AdminShell user={user} permissions={permissions}>
        <AdminErrorBoundary>
          <Outlet />
        </AdminErrorBoundary>
      </AdminShell>
    </AdminSessionContext.Provider>
  );
}
