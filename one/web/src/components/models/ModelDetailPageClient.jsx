'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Layers,
  RefreshCw,
  Shield,
  Zap,
} from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';
import ModelBrandLogo from './ModelBrandLogo';
import { useModelDirectory } from '@/lib/hooks/useModelDirectory';
import { inferStudioTabFromModel } from '@/lib/studio-routes';
import { getModelById } from '@/lib/modelCenter/modelScreenerData';
import { normalizeLocale, localizeStudioPath } from '@/lib/locales';

const I18N_STRINGS = {
  'zh-CN': {
    models: '模型目录',
    modelNotFound: '未找到该模型',
    modelNotFoundDesc: (id) => `模型标识 "${id}" 不存在或已下线。`,
    backToModels: '返回模型目录',
    retry: '重试',
    available: '可创作',
    unavailable: '暂不可用',
    price: '参考价格',
    free: '免费',
    creditsFrom: (p) => `${p} 算力点起`,
    usageBased: '按量计费',
    createNow: '立即创作',
    browseOther: '查看其他模型',
    maintenance: '该模型尚未上架或通道正在维护，当前无法发起生成任务。',
    kpiCalls: '24h 调用',
    kpiSuccess: '成功率',
    kpiAvgLatency: '平均耗时',
    kpiP90Latency: 'P90 耗时',
    scopeNote: '统计范围：过去 24 小时的真实生成任务；无调用时显示 “—”。',
    modelId: '模型 ID',
    provider: '厂商',
    category: '类别',
    listingStatus: '上架状态',
    listed: '已上架',
    notListed: '未上架 / 维护中',
    relatedModels: '同类模型',
    noDesc: '该模型暂无补充说明。',
  },
  'zh-TW': {
    models: '模型目錄',
    modelNotFound: '未找到該模型',
    modelNotFoundDesc: (id) => `模型標識 "${id}" 不存在或已下線。`,
    backToModels: '返回模型目錄',
    retry: '重試',
    available: '可創作',
    unavailable: '暫不可用',
    price: '參考價格',
    free: '免費',
    creditsFrom: (p) => `${p} 算力點起`,
    usageBased: '按量計費',
    createNow: '立即創作',
    browseOther: '查看其他模型',
    maintenance: '該模型尚未上架或通道正在維護，當前無法發起生成任務。',
    kpiCalls: '24h 調用',
    kpiSuccess: '成功率',
    kpiAvgLatency: '平均耗時',
    kpiP90Latency: 'P90 耗時',
    scopeNote: '統計範圍：過去 24 小時的真實生成任務；無調用時顯示 “—”。',
    modelId: '模型 ID',
    provider: '廠商',
    category: '類別',
    listingStatus: '上架狀態',
    listed: '已上架',
    notListed: '未上架 / 維護中',
    relatedModels: '同類模型',
    noDesc: '該模型暫無補充說明。',
  },
  'ja-JP': {
    models: 'モデル一覧',
    modelNotFound: 'モデルが見つかりません',
    modelNotFoundDesc: (id) => `モデル「${id}」は存在しないか削除されました。`,
    backToModels: 'モデル一覧に戻る',
    retry: '再試行',
    available: '作成可能',
    unavailable: '利用不可',
    price: '参考価格',
    free: '無料',
    creditsFrom: (p) => `${p} クレジット〜`,
    usageBased: '従量課金',
    createNow: '今すぐ作成',
    browseOther: '他のモデルを見る',
    maintenance: 'このモデルはまだ掲載されていないかメンテナンス中のため、現在生成できません。',
    kpiCalls: '24h 呼出',
    kpiSuccess: '成功率',
    kpiAvgLatency: '平均所要時間',
    kpiP90Latency: 'P90 レイテンシ',
    scopeNote: '統計範囲：過去24時間の実際の生成タスク；呼び出しがない場合は「—」を表示。',
    modelId: 'モデル ID',
    provider: 'プロバイダー',
    category: 'カテゴリ',
    listingStatus: '掲載ステータス',
    listed: '掲載中',
    notListed: '未掲載 / メンテナンス中',
    relatedModels: '関連モデル',
    noDesc: 'このモデルの追加説明はありません。',
  },
  'ko-KR': {
    models: '모델 디렉토리',
    modelNotFound: '모델을 찾을 수 없습니다',
    modelNotFoundDesc: (id) => `모델 "${id}"이(가) 존재하지 않거나 제거되었습니다.`,
    backToModels: '모델 목록으로 돌아가기',
    retry: '다시 시도',
    available: '창작 가능',
    unavailable: '사용 불가',
    price: '예상 가격',
    free: '무료',
    creditsFrom: (p) => `${p} 크레딧부터`,
    usageBased: '종량 과금',
    createNow: '지금 생성',
    browseOther: '다른 모델 보기',
    maintenance: '이 모델은 아직 등록되지 않았거나 유지보수 중이므로 현재 생성할 수 없습니다.',
    kpiCalls: '24h 호출',
    kpiSuccess: '성공률',
    kpiAvgLatency: '평균 지연 시간',
    kpiP90Latency: 'P90 지연 시간',
    scopeNote: '통계 범위: 지난 24시간 동안의 실제 생성 작업, 호출이 없으면 "—"로 표시됩니다.',
    modelId: '모델 ID',
    provider: '제공자',
    category: '카테고리',
    listingStatus: '등록 상태',
    listed: '등록됨',
    notListed: '미등록 / 유지보수 중',
    relatedModels: '관련 모델',
    noDesc: '이 모델에 대한 추가 설명이 없습니다.',
  },
  es: {
    models: 'Modelos',
    modelNotFound: 'Modelo no encontrado',
    modelNotFoundDesc: (id) => `El modelo "${id}" no existe o fue retirado.`,
    backToModels: 'Volver a modelos',
    retry: 'Reintentar',
    available: 'Disponible',
    unavailable: 'No disponible',
    price: 'Precio ref.',
    free: 'Gratis',
    creditsFrom: (p) => `desde ${p} créditos`,
    usageBased: 'Pago por uso',
    createNow: 'Crear ahora',
    browseOther: 'Explorar otros modelos',
    maintenance: 'Este modelo no está listado aún o está en mantenimiento temporal.',
    kpiCalls: 'Llamadas 24h',
    kpiSuccess: 'Tasa de éxito',
    kpiAvgLatency: 'Latencia prom.',
    kpiP90Latency: 'Latencia P90',
    scopeNote: 'Alcance: tareas reales en las últimas 24h; “—” indica sin llamadas.',
    modelId: 'ID del modelo',
    provider: 'Proveedor',
    category: 'Categoría',
    listingStatus: 'Estado',
    listed: 'Listado',
    notListed: 'No listado / mantenimiento',
    relatedModels: 'Modelos relacionados',
    noDesc: 'No hay descripción adicional disponible para este modelo.',
  },
  en: {
    models: 'Models',
    modelNotFound: 'Model Not Found',
    modelNotFoundDesc: (id) => `Model "${id}" does not exist or has been removed.`,
    backToModels: 'Back to models',
    retry: 'Retry',
    available: 'Available',
    unavailable: 'Unavailable',
    price: 'Price',
    free: 'Free',
    creditsFrom: (p) => `${p} credits from`,
    usageBased: 'Usage-based',
    createNow: 'Create now',
    browseOther: 'Browse other models',
    maintenance: 'This model is not listed yet or its channel is under maintenance, so generation is unavailable.',
    kpiCalls: '24h calls',
    kpiSuccess: 'Success rate',
    kpiAvgLatency: 'Avg latency',
    kpiP90Latency: 'P90 latency',
    scopeNote: 'Scope: actual generation tasks in the last 24 hours; “—” means no calls.',
    modelId: 'Model ID',
    provider: 'Provider',
    category: 'Category',
    listingStatus: 'Listing status',
    listed: 'Listed',
    notListed: 'Not listed / maintenance',
    relatedModels: 'Related models',
    noDesc: 'No additional description is available for this model.',
  },
};

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

function categoryTab(model) {
  const category = String(model?.category || '').toLowerCase();
  if (category === 'video') return 'video';
  if (category === 'audio') return 'audio';
  if (category === 'text' || category === 'llm' || category === 'multimodal') return 'agents';
  return 'image';
}

function formatPrice(model, t) {
  if (!model) return '—';
  if (model.pricingType === 'free') return t.free;
  const price = Number(model.creditsPrice);
  if (Number.isFinite(price) && price > 0) return t.creditsFrom(price);
  return t.usageBased;
}

export default function ModelDetailPageClient({ modelId, locale = 'en' }) {
  const normLocale = normalizeLocale(locale);
  const t = I18N_STRINGS[normLocale] || I18N_STRINGS.en;
  const { models, telemetryById, loading, error, reload } = useModelDirectory({ range: '24h' });
  const [copied, setCopied] = useState(false);

  const meta = getModelById(modelId);
  const active = models.find(
    (item) => String(item.id) === String(modelId) || String(item.slug) === String(modelId)
  );
  const model = active || meta;
  const stats = model ? telemetryById.get(String(model.id)) || null : null;
  const available = Boolean(active && active.isActive !== false && active.hasWorkingRoute !== false);

  const relatedModels = useMemo(() => {
    if (!active) return [];
    return models
      .filter((item) => item.category === active.category && String(item.id) !== String(active.id))
      .slice(0, 3);
  }, [models, active]);

  const handleCopyId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(String(modelId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const screenerUrl = localizeStudioPath('/models', locale);
  const targetTab = inferStudioTabFromModel(active?.id || meta?.id || modelId, categoryTab(active || meta));
  const studioUrl = localizeStudioPath(`/studio?tab=${targetTab}&model=${encodeURIComponent(modelId)}`, locale);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <StudioHeader locale={locale} activeTab="models" />
        <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-12">
          <div className="h-4 w-40 animate-pulse rounded bg-surface" />
          <div className="mt-6 h-64 animate-pulse rounded-3xl border border-line bg-surface" />
        </main>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas text-ink">
        <StudioHeader locale={locale} activeTab="models" />
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <Cpu className="h-8 w-8 text-ink-muted" />
          <h1 className="mt-4 text-2xl font-bold">{t.modelNotFound}</h1>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            {t.modelNotFoundDesc(modelId)}
          </p>
          <Link
            href={screenerUrl}
            className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-ink-on-accent"
          >
            {t.backToModels}
          </Link>
        </div>
      </div>
    );
  }

  const name = active?.displayName || meta?.name || String(modelId);
  const description = active?.description
    || (normLocale.startsWith('zh') ? meta?.description : meta?.descriptionEn)
    || t.noDesc;
  const provider = active?.provider || meta?.provider || 'SupDance';
  const category = active?.category || meta?.category || 'image';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-canvas font-sans text-ink selection:bg-brand/30">
      <StudioHeader locale={locale} activeTab="models" className="relative z-40" />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand/10 via-brand/5 to-transparent blur-[140px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 lg:px-12">
        <div className="mb-6 flex items-center gap-2 font-mono text-xs text-ink-muted">
          <Link href={screenerUrl} className="flex items-center gap-1.5 transition hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t.models}</span>
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span>{provider}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-ink">{name}</span>
        </div>

        {error ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-ink-muted">
            <span>{error}</span>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-bold text-ink-on-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t.retry}
            </button>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
              <div className="flex min-w-0 items-start gap-4">
                <ModelBrandLogo
                  providerId={provider}
                  provider={provider}
                  modelId={active?.id || modelId}
                  size="xl"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{name}</h1>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                      available
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                    }`}>
                      {available ? t.available : t.unavailable}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    {provider} · {category} · {String(modelId)}
                  </p>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-ink-muted">{t.price}</p>
                  <p className="mt-1 font-mono text-lg font-black text-ink">{formatPrice(active, t)}</p>
                </div>
                {available ? (
                  <Link
                    href={studioUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-xs font-bold text-ink-on-accent shadow-sm"
                  >
                    {t.createNow}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Link
                    href={screenerUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-xs font-bold text-ink-muted"
                  >
                    {t.browseOther}
                  </Link>
                )}
              </div>
            </div>

            {!available ? (
              <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-700">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t.maintenance}
                </span>
              </div>
            ) : null}

            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: t.kpiCalls, value: stats ? formatCalls(stats.totalCalls) : '—', icon: Activity },
                { label: t.kpiSuccess, value: stats && Number(stats.totalCalls) > 0 ? `${Number(stats.successRate).toFixed(1)}%` : '—', icon: Shield },
                { label: t.kpiAvgLatency, value: stats ? formatLatency(stats.avgDurationMs) : '—', icon: Clock },
                { label: t.kpiP90Latency, value: stats ? formatLatency(stats.p90DurationMs) : '—', icon: Zap },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-line bg-canvas p-4">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-muted">
                      <Icon className="h-3 w-3 text-brand" />
                      {item.label}
                    </p>
                    <p className="mt-2 font-mono text-xl font-black text-ink">{item.value}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-ink-muted">
              {t.scopeNote}
            </p>
          </div>

          <div className="border-t border-line bg-canvas/60 px-6 py-4 sm:px-8">
            <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-ink-muted">{t.modelId}</dt>
                <dd className="mt-1 flex items-center gap-2 font-mono text-ink">
                  <span className="truncate">{String(modelId)}</span>
                  <button type="button" onClick={handleCopyId} className="text-ink-muted transition hover:text-ink" aria-label="Copy model ID">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.provider}</dt>
                <dd className="mt-1 text-ink">{provider}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.category}</dt>
                <dd className="mt-1 text-ink">{category}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.listingStatus}</dt>
                <dd className={`mt-1 font-semibold ${available ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {available ? t.listed : t.notListed}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {relatedModels.length > 0 ? (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand" />
              <h2 className="text-lg font-bold text-ink">{t.relatedModels}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedModels.map((item) => {
                const url = localizeStudioPath(`/models/${encodeURIComponent(item.id)}`, locale);
                return (
                  <Link
                    key={item.id}
                    href={url}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ModelBrandLogo providerId={item.provider} provider={item.provider} modelId={item.id} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{item.displayName || item.name}</p>
                        <p className="truncate text-[11px] text-ink-muted">{item.provider || 'SupDance'}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-brand" />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
