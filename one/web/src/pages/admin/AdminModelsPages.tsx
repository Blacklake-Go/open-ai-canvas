import Link from 'next/link';
import { useLocation } from 'react-router';
import { PageHeader } from '@/components/admin/AdminUi';
import ModelNavTabs from '@/components/admin/ModelNavTabs';
import { hasPermission, PERMISSIONS } from '@/lib/admin/permissions';
import {
  CANONICAL_GROUPS,
  isOrphanVariantCandidate,
  suggestCanonicalTarget,
} from '@/lib/modelCenter/canonicalModels.js';
import FrontendConfigClient from '@/pages/admin/client/models/frontend/FrontendConfigClient';
import RoutingClient from '@/pages/admin/client/models/routing/RoutingClient';
import ProvidersManagerClient from '@/pages/admin/client/models/providers/ProvidersManagerClient';
import PublicationClient from '@/pages/admin/client/models/publication/PublicationClient';
import ModelTelemetryClient from '@/pages/admin/client/models/telemetry/ModelTelemetryClient';
import CanvasConfigClient from '@/pages/admin/client/models/canvas/CanvasConfigClient';
import {
  useAdminData,
  useAdminPermissionGuard,
  useDocumentTitle,
} from '@/pages/helpers/pageHelpers';

export function AdminModelsPage() {
  useDocumentTitle('前端模型管理 | SupDance 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.modelsRead);
  const location = useLocation();
  const initialBrand = new URLSearchParams(location.search).get('brand') || 'all';
  const { data, loading } = useAdminData<any>('/api/admin/models');

  if (redirectEl) return redirectEl;

  const canonicalMap = new Map<string, string[]>();
  (CANONICAL_GROUPS as Array<{ targetId: string; aliases?: string[] }>).forEach((g) => {
    canonicalMap.set(g.targetId, g.aliases || []);
  });

  const rawModels: any[] = Array.isArray(data) ? data : data?.models || data?.rows || [];
  const models = rawModels.map((m: any) => {
    const aliases = m.aliases || canonicalMap.get(m.id) || [];
    const isCanonical = m.is_canonical ?? canonicalMap.has(m.id);
    const isOrphan = m.is_orphan_candidate ?? isOrphanVariantCandidate(m.id, m.tier);
    const suggestedTarget =
      m.suggested_target ?? (isOrphan ? suggestCanonicalTarget(m.id) : null);
    return {
      ...m,
      aliases,
      alias_count: aliases.length,
      is_canonical: isCanonical,
      is_orphan_candidate: isOrphan,
      suggested_target: suggestedTarget,
    };
  });

  const pendingPricesCount = Number(data?.pendingPricesCount || 0);

  return (
    <>
      <div className="mb-4">
        <Link
          href="/admin/models/publication"
          className="text-sm font-medium text-brand hover:underline"
        >
          模型接入、测试与发布 →
        </Link>
      </div>
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <FrontendConfigClient
          initialModels={models}
          initialBrand={initialBrand}
          pendingPricesCount={pendingPricesCount}
          canWrite={hasPermission(user?.role, PERMISSIONS.modelsWrite)}
        />
      )}
    </>
  );
}

export function AdminModelsRoutingPage() {
  useDocumentTitle('智能路由拓扑与定价策略 - SupDance 后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.modelsRead);
  const location = useLocation();
  let initialTab = new URLSearchParams(location.search).get('tab') || 'topology';
  if (initialTab === 'rules' || initialTab === 'breakdown') {
    initialTab = 'pricing';
  }

  const { data: routingData, loading: loadingRouting } = useAdminData<any>(
    '/api/admin/models/routing'
  );
  const { data: pricingData, loading: loadingPricing } = useAdminData<any>(
    '/api/admin/models/pricing'
  );
  const { data: strategyData } = useAdminData<any>('/api/admin/models/pricing/strategy');

  if (redirectEl) return redirectEl;

  const loading = loadingRouting || loadingPricing;
  const snapshot = routingData?.snapshot || {
    models: routingData?.models || [],
    providers: routingData?.providers || [],
  };
  const pricingList = Array.isArray(pricingData)
    ? pricingData
    : pricingData?.pricing || pricingData?.rows || [];
  const breakdownList = pricingData?.breakdown || [];
  const pendingPrices = pricingData?.pendingPrices || [];
  const strategy = strategyData?.strategy || strategyData;

  const initialStrategy = strategy
    ? {
        baseMultiplier: Number(strategy.baseMultiplier ?? strategy.base_multiplier ?? 1.5),
        minMarginRate: Number(strategy.minMarginRate ?? strategy.min_margin_rate ?? 0.3),
        categoryMultipliers: strategy.categoryMultipliers || strategy.category_multipliers || {},
        tierMultipliers: strategy.tierMultipliers || strategy.tier_multipliers || {},
        specMultipliers: strategy.specMultipliers || strategy.spec_multipliers || {},
      }
    : {
        baseMultiplier: 1.5,
        minMarginRate: 0.3,
        categoryMultipliers: {},
        tierMultipliers: {},
        specMultipliers: {},
      };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      <ModelNavTabs activeTab="routing" />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <RoutingClient
          initialTab={initialTab}
          initialSnapshot={snapshot}
          initialPricing={pricingList}
          initialStrategy={initialStrategy}
          initialBreakdown={breakdownList}
          initialPendingPrices={pendingPrices}
          canWrite={hasPermission(user?.role, PERMISSIONS.modelsWrite)}
        />
      )}
    </div>
  );
}

export function AdminModelsProvidersPage() {
  useDocumentTitle('供应商与通道配置 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.providersRead);
  const { data, loading } = useAdminData<any>('/api/admin/models/providers');

  if (redirectEl) return redirectEl;

  const channels = Array.isArray(data) ? data : data?.channels || data?.providers || [];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      <ModelNavTabs activeTab="providers" />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <ProvidersManagerClient initialChannels={channels} />
      )}
    </div>
  );
}

export function AdminModelsPublicationPage() {
  useDocumentTitle('模型接入与发布 | SupDance 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.modelsRead);
  const { data, loading } = useAdminData<any>('/api/admin/models');

  if (redirectEl) return redirectEl;

  const models = Array.isArray(data) ? data : data?.models || data?.rows || [];

  return (
    <>
      <PageHeader
        title="模型接入与发布"
        description="沿用现有供应商、目录、能力、价盘和路由服务，在同一流程完成检查、受预算约束的测试及发布。"
      />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <PublicationClient
          models={models}
          canWrite={hasPermission(user?.role, PERMISSIONS.modelsWrite)}
          canTest={hasPermission(user?.role, PERMISSIONS.generationsWrite)}
        />
      )}
    </>
  );
}

export function AdminModelsTelemetryPage() {
  useDocumentTitle('模型调用量与遥测大盘 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.modelsRead);
  const { data, loading } = useAdminData<any>('/api/admin/models/telemetry?timeRange=24h&limit=50');

  if (redirectEl) return redirectEl;

  return (
    <>
      <PageHeader
        eyebrow="AI 模型与路由"
        title="模型调用量与遥测大盘"
        description="实时监控全平台 AI 模型的真实调用量、成本消耗、成功率、P50/P90 响应时延及错误归因，数据 100% 直连数据库与链路追踪。"
      />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <ModelTelemetryClient initialData={data || null} initialRange="24h" />
      )}
    </>
  );
}

export function AdminModelsCanvasPage() {
  useDocumentTitle('无限画布模型与默认配置 | SupDance 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.modelsRead);
  const { data, loading } = useAdminData<any>('/api/admin/canvas/config');

  if (redirectEl) return redirectEl;

  return (
    <>
      <PageHeader
        eyebrow="AI 模型与路由"
        title="无限画布模型与默认配置"
        description="从已上架且有审核渠道的模型中选择画布可用项，并设置进入画布时的初始偏好。模型价格与实际生成路线仍由主站统一管理。"
      />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <CanvasConfigClient
          initialConfig={data?.config || data || null}
          candidates={data?.candidates || []}
          canWrite={hasPermission(user?.role, PERMISSIONS.modelsWrite)}
        />
      )}
    </>
  );
}
