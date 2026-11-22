'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Cpu,
  Layers,
  RefreshCw,
  Zap,
} from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';
import ModelScreenerTable from './ModelScreenerTable';
import ModelBrandLogo from './ModelBrandLogo';
import { useModelDirectory } from '@/lib/hooks/useModelDirectory';

function formatCalls(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return '—';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  return count.toLocaleString('en-US');
}

function formatLatency(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

import { normalizeLocale } from '@/lib/locales';

const I18N_STRINGS = {
  'zh-CN': {
    statsBadge: '真实调用统计 · 24h',
    title: '模型总览',
    description: '已上架模型与过去 24 小时的调用量、成功率、耗时和价格。所有统计均来自实际生成任务记录。',
    kpiCalls: '24h 总调用',
    kpiSuccess: '成功率',
    kpiActive: '活跃模型',
    kpiLatency: 'P90 耗时',
    topTitle: '24h 调用领先模型',
    topSubtitle: '按实际调用量排序，仅展示已上架模型。',
    viewAll: '查看全部',
    retry: '重试',
    empty: '暂时没有可展示的模型',
    callsPrefix: '24h 调用',
    noRecord: '暂无记录',
    avgLatency: '平均耗时',
  },
  'zh-TW': {
    statsBadge: '真實調用統計 · 24h',
    title: '模型總覽',
    description: '已上架模型與過去 24 小時的調用量、成功率、耗時和價格。所有統計均來自實際生成任務記錄。',
    kpiCalls: '24h 總調用',
    kpiSuccess: '成功率',
    kpiActive: '活躍模型',
    kpiLatency: 'P90 耗時',
    topTitle: '24h 調用領先模型',
    topSubtitle: '按實際調用量排序，僅展示已上架模型。',
    viewAll: '查看全部',
    retry: '重試',
    empty: '暫時沒有可展示的模型',
    callsPrefix: '24h 調用',
    noRecord: '暫無記錄',
    avgLatency: '平均耗時',
  },
  'ja-JP': {
    statsBadge: '実際呼出統計 · 24h',
    title: 'モデル一覧',
    description: '掲載モデルと過去24時間の呼び出し数、成功率、レイテンシ、料金。すべて実際の生成タスク記録に基づきます。',
    kpiCalls: '24h 総呼出',
    kpiSuccess: '成功率',
    kpiActive: 'アクティブモデル',
    kpiLatency: 'P90 レイテンシ',
    topTitle: '24時間人気トップモデル',
    topSubtitle: '実際の呼び出し数順、掲載中モデルのみ表示。',
    viewAll: 'すべて見る',
    retry: '再試行',
    empty: '表示可能なモデルがありません',
    callsPrefix: '24h 呼出',
    noRecord: '記録なし',
    avgLatency: '平均所要時間',
  },
  'ko-KR': {
    statsBadge: '실제 호출 통계 · 24h',
    title: '모델 디렉토리',
    description: '등록된 모델과 지난 24시간의 호출량, 성공률, 지연 시간 및 가격입니다. 모든 통계는 실제 생성 기록을 기반으로 합니다.',
    kpiCalls: '24h 총 호출',
    kpiSuccess: '성공률',
    kpiActive: '활성 모델',
    kpiLatency: 'P90 지연 시간',
    topTitle: '24시간 최다 호출 모델',
    topSubtitle: '실제 호출 수 순위, 등록된 모델만 표시됩니다.',
    viewAll: '모두 보기',
    retry: '다시 시도',
    empty: '표시할 모델이 없습니다',
    callsPrefix: '24h 호출',
    noRecord: '기록 없음',
    avgLatency: '평균 지연 시간',
  },
  es: {
    statsBadge: 'Estadísticas reales · 24h',
    title: 'Directorio de Modelos',
    description: 'Modelos disponibles con llamadas en las últimas 24h, tasa de éxito, latencia y precios basados en registros reales.',
    kpiCalls: 'Llamadas 24h',
    kpiSuccess: 'Tasa de éxito',
    kpiActive: 'Modelos activos',
    kpiLatency: 'Latencia P90',
    topTitle: 'Más usados en 24h',
    topSubtitle: 'Ordenados por llamadas reales entre modelos listados.',
    viewAll: 'Ver todos',
    retry: 'Reintentar',
    empty: 'No hay modelos disponibles',
    callsPrefix: 'Llamadas 24h',
    noRecord: 'Sin llamadas',
    avgLatency: 'Latencia prom.',
  },
  en: {
    statsBadge: 'Actual usage · 24h',
    title: 'Model Directory',
    description: 'Listed models with actual 24-hour calls, success rate, latency, and pricing from real generation records.',
    kpiCalls: '24h calls',
    kpiSuccess: 'Success rate',
    kpiActive: 'Active models',
    kpiLatency: 'P90 latency',
    topTitle: 'Most used in 24h',
    topSubtitle: 'Ranked by actual calls among listed models.',
    viewAll: 'View all',
    retry: 'Retry',
    empty: 'No models available yet',
    callsPrefix: '24h calls',
    noRecord: 'No calls',
    avgLatency: 'Avg latency',
  },
};

function formatPrice(model, norm) {
  if (model?.pricingType === 'free') {
    if (norm === 'zh-CN') return '免费';
    if (norm === 'zh-TW') return '免費';
    if (norm === 'ja-JP') return '無料';
    if (norm === 'ko-KR') return '무료';
    if (norm === 'es') return 'Gratis';
    return 'Free';
  }
  const price = Number(model?.creditsPrice);
  if (Number.isFinite(price) && price > 0) {
    if (norm === 'zh-CN') return `${price} 算力点起`;
    if (norm === 'zh-TW') return `${price} 算力點起`;
    if (norm === 'ja-JP') return `${price} クレジット〜`;
    if (norm === 'ko-KR') return `${price} 크레딧부터`;
    if (norm === 'es') return `Desde ${price} créditos`;
    return `${price} credits from`;
  }
  if (norm === 'zh-CN') return '按量计费';
  if (norm === 'zh-TW') return '按量計費';
  if (norm === 'ja-JP') return '従量課金';
  if (norm === 'ko-KR') return '종량제 과금';
  if (norm === 'es') return 'Pago por uso';
  return 'Usage-based';
}

export default function ModelsScreenerPageClient({ locale = 'en' }) {
  const norm = normalizeLocale(locale);
  const copy = I18N_STRINGS[norm] || I18N_STRINGS.en;
  const { models, telemetry, telemetryById, loading, error, reload } = useModelDirectory({ range: '24h' });

  const activeById = useMemo(() => {
    const map = new Map();
    for (const model of models) {
      if (model.id) map.set(String(model.id), model);
      if (model.slug) map.set(String(model.slug), model);
    }
    return map;
  }, [models]);

  const topModels = useMemo(() => {
    const ranked = telemetry.models
      .map((item) => ({ stats: item, model: activeById.get(String(item.id)) }))
      .filter((item) => item.model)
      .slice(0, 4);
    if (ranked.length > 0) return ranked;
    return models.slice(0, 4).map((model) => ({ stats: null, model }));
  }, [telemetry.models, activeById, models]);

  const kpi = telemetry.kpi || {};
  const summaryCards = [
    {
      label: copy.kpiCalls,
      value: loading ? '…' : error ? '—' : formatCalls(kpi.totalCalls),
      icon: BarChart3,
    },
    {
      label: copy.kpiSuccess,
      value: loading ? '…' : error ? '—' : Number(kpi.totalCalls) > 0 ? `${Number(kpi.successRate || 0).toFixed(1)}%` : '—',
      icon: Activity,
    },
    {
      label: copy.kpiActive,
      value: loading ? '…' : error ? '—' : String(kpi.activeModelsCount || 0),
      icon: Layers,
    },
    {
      label: copy.kpiLatency,
      value: loading ? '…' : error ? '—' : formatLatency(kpi.p90DurationMs),
      icon: Zap,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-canvas font-sans text-ink selection:bg-brand/30">
      <StudioHeader locale={locale} activeTab="models" className="relative z-40" />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand/10 via-brand/5 to-transparent blur-[140px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-6 lg:px-12">
        <div className="mb-10 flex flex-col justify-between gap-6 border-b border-line pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-mono text-brand">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>{copy.statsBadge}</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl lg:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-muted sm:text-sm">
              {copy.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="min-w-[126px] rounded-xl border border-line bg-surface px-4 py-3">
                  <span className="flex items-center gap-1.5 text-[10px] uppercase text-ink-muted">
                    <Icon className="h-3 w-3 text-brand" />
                    {card.label}
                  </span>
                  <span className="mt-1 block text-lg font-black text-ink">{card.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-12">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">{copy.topTitle}</h2>
              <p className="mt-1 text-xs text-ink-muted">
                {copy.topSubtitle}
              </p>
            </div>
            <Link href="#model-table" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
              {copy.viewAll}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-ink-muted">
              <span>{error}</span>
              <button
                type="button"
                onClick={reload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-bold text-ink-on-accent"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {copy.retry}
              </button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-40 animate-pulse rounded-2xl border border-line bg-surface" />
              ))}
            </div>
          ) : topModels.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
              <Cpu className="mx-auto h-6 w-6 text-ink-muted" />
              <p className="mt-3 text-sm font-semibold text-ink">
                {copy.empty}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
              {topModels.map(({ stats, model }) => {
                const modelUrl = norm === 'zh-CN'
                  ? `/zh/models/${encodeURIComponent(model.id)}`
                  : `/models/${encodeURIComponent(model.id)}`;
                return (
                  <Link
                    key={model.id}
                    href={modelUrl}
                    className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand/40"
                  >
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <ModelBrandLogo
                            providerId={model.provider}
                            provider={model.provider}
                            modelId={model.id}
                            size="md"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold leading-tight text-ink transition-colors group-hover:text-brand">
                              {model.displayName || model.name}
                            </div>
                            <div className="truncate text-[11px] font-mono text-ink-muted">
                              {model.provider || 'SupDance'}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                          {model.category || 'model'}
                        </span>
                      </div>

                      <div className="text-2xl font-black tracking-tight text-ink">{formatPrice(model, norm)}</div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
                        <span>
                          {copy.callsPrefix}:{' '}
                          <strong className="font-semibold text-ink">{stats ? formatCalls(stats.totalCalls) : '—'}</strong>
                        </span>
                        <span className={stats && Number(stats.totalCalls) > 0 && stats.successRate >= 95 ? 'text-emerald-500' : 'text-ink-muted'}>
                          {stats && Number(stats.totalCalls) > 0 ? `${Number(stats.successRate).toFixed(1)}%` : copy.noRecord}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px] text-ink-muted">
                      <span>{copy.avgLatency}: {stats ? formatLatency(stats.avgDurationMs) : '—'}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-brand transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div id="model-table" className="mb-16 scroll-mt-24">
          <ModelScreenerTable
            locale={locale}
            models={models}
            telemetry={telemetry}
            telemetryById={telemetryById}
            loading={loading}
            error={error}
            onRetry={reload}
          />
        </div>
      </main>
    </div>
  );
}
