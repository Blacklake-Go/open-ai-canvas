import Link from 'next/link';
import { Navigate, useLocation, useParams } from 'react-router';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { buildRedirectTarget, serializeSearchParams } from '@/lib/admin/navigation';
import { useAdminData, useAdminPermissionGuard, useDocumentTitle } from '@/pages/helpers/pageHelpers';
import { hasPermission, PERMISSIONS } from '@/lib/admin/permissions';
import BrandsManagerClient from '@/pages/admin/client/models/brands/BrandsManagerClient';
import PricingManagerClient from '@/pages/admin/client/models/pricing/PricingManagerClient';

export function AdminLegacyRedirectPage({
  to,
  preserveQuery = true,
  requiredPermission,
}: {
  to: string;
  preserveQuery?: boolean;
  requiredPermission?: string;
}) {
  const location = useLocation();
  const { redirectEl } = useAdminPermissionGuard(requiredPermission);

  if (redirectEl) return redirectEl;

  if (!preserveQuery) {
    return <Navigate to={to} replace />;
  }
  const sp = Object.fromEntries(new URLSearchParams(location.search).entries());
  const qs = serializeSearchParams(sp);
  return <Navigate to={buildRedirectTarget(to, qs)} replace />;
}

export function AdminSystemCatchallRedirectPage() {
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const tab = sp.get('tab');
  const qs = serializeSearchParams(Object.fromEntries(sp.entries()));
  if (tab === 'email') {
    return <Navigate to={buildRedirectTarget('/admin/system/email', qs)} replace />;
  }
  return <Navigate to={buildRedirectTarget('/admin/system/login', qs)} replace />;
}

export function AdminBrandsPage() {
  useDocumentTitle('品牌与供应商管理 | SupDance 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.modelsRead);
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const brandId = sp.get('brand') || sp.get('provider') || 'all';
  const { data, loading } = useAdminData<any>('/api/admin/models/providers');

  if (redirectEl) return redirectEl;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <BrandsManagerClient
          initialData={data || {}}
          canWrite={hasPermission(user?.role, PERMISSIONS.modelsWrite)}
          initialProviderId={brandId}
        />
      )}
    </div>
  );
}
export const AdminBrandsRedirectPage = AdminBrandsPage;

export function AdminPricingPage() {
  useDocumentTitle('模型定价与价盘策略 | SupDance 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.modelsRead);
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const tab = sp.get('tab') || 'rules';
  const { data: pricingData, loading: l1 } = useAdminData<any>('/api/admin/models/pricing');
  const { data: strategyData, loading: l2 } = useAdminData<any>('/api/admin/models/pricing/strategy');

  if (redirectEl) return redirectEl;

  const loading = l1 || l2;
  const pricingList = Array.isArray(pricingData) ? pricingData : pricingData?.pricing || pricingData?.rows || [];
  const breakdownList = pricingData?.breakdown || [];
  const pendingPrices = pricingData?.pendingPrices || [];
  const strategy = strategyData?.strategy || strategyData || {};

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <PricingManagerClient
          initialTab={tab}
          initialPricing={pricingList}
          initialStrategy={strategy}
          initialBreakdown={breakdownList}
          initialPendingPrices={pendingPrices}
          canWrite={hasPermission(user?.role, PERMISSIONS.modelsWrite)}
        />
      )}
    </div>
  );
}
export const AdminPricingRedirectPage = AdminPricingPage;

export function AdminForbiddenPage() {
  useDocumentTitle('无权限访问 | 管理后台');
  const location = useLocation();
  const raw = new URLSearchParams(location.search).get('p');
  const permission = raw && /^[a-z][a-z_.-]{0,63}$/.test(raw) ? raw : null;

  return (
    <div className="flex min-h-96 items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-danger-line bg-base p-8 text-center shadow-elevation-4 backdrop-blur-md">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-danger-line bg-danger-soft text-danger">
          <ShieldX className="size-7" />
        </div>
        <p className="mt-5 text-caption font-semibold uppercase tracking-widest text-danger">
          403 · 无权限访问
        </p>
        <h1 className="mt-2 text-section-title text-ink">当前角色不具备该页面的访问权限</h1>
        <p className="mt-2.5 text-body-sm leading-6 text-ink-muted">
          该功能需要权限
          {permission ? (
            <span className="mx-1 rounded border border-line bg-wash px-1.5 py-0.5 font-mono text-label text-ink">
              {permission}
            </span>
          ) : null}
          ，如需开通请联系超级管理员调整角色授权。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/admin"
            className="inline-flex h-control-md items-center gap-1.5 rounded-lg bg-brand px-4 text-label font-semibold text-ink-on-accent transition-colors duration-base hover:bg-brand-hover active:scale-95"
          >
            <ArrowLeft className="size-3.5" />
            返回运营概览
          </Link>
        </div>
      </div>
    </div>
  );
}

// Keep unused import check happy if useParams is imported later
export { useParams };
