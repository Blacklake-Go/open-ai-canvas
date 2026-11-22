'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Cpu,
  RefreshCw,
  Search,
} from 'lucide-react';
import ModelBrandLogo from './ModelBrandLogo';
import { useModelDirectory } from '@/lib/hooks/useModelDirectory';
import { inferStudioTabFromModel } from '@/lib/studio-routes';

import { normalizeLocale, localizeStudioPath } from '@/lib/locales';

const CATEGORY_LABELS = {
  'zh-CN': { image: '图像', video: '视频', audio: '音频', text: '文本', llm: '文本', multimodal: '多模态', default: '通用' },
  'zh-TW': { image: '圖像', video: '影片', audio: '音訊', text: '文字', llm: '文字', multimodal: '多模態', default: '通用' },
  'ja-JP': { image: '画像', video: '動画', audio: '音声', text: 'テキスト', llm: 'テキスト', multimodal: 'マルチモーダル', default: '汎用' },
  'ko-KR': { image: '이미지', video: '비디오', audio: '오디오', text: '텍스트', llm: '텍스트', multimodal: '멀티모달', default: '일반' },
  es: { image: 'Imagen', video: 'Vídeo', audio: 'Audio', text: 'Texto', llm: 'Texto', multimodal: 'Multimodal', default: 'General' },
  en: { image: 'Image', video: 'Video', audio: 'Audio', text: 'Text', llm: 'Text', multimodal: 'Multimodal', default: 'General' },
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

function formatPrice(model, norm) {
  if (model.pricingType === 'free') {
    if (norm === 'zh-CN') return '免费';
    if (norm === 'zh-TW') return '免費';
    if (norm === 'ja-JP') return '無料';
    if (norm === 'ko-KR') return '무료';
    if (norm === 'es') return 'Gratis';
    return 'Free';
  }
  const price = Number(model.creditsPrice);
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

function categoryLabel(model, norm) {
  const key = String(model.category || '').toLowerCase();
  const dict = CATEGORY_LABELS[norm] || CATEGORY_LABELS.en;
  return dict[key] || model.category || dict.default;
}

function categoryTab(model) {
  const category = String(model?.category || '').toLowerCase();
  if (category === 'video') return 'video';
  if (category === 'audio') return 'audio';
  if (category === 'text' || category === 'llm' || category === 'multimodal') return 'agents';
  return 'image';
}

function modelStats(telemetryById, model) {
  return telemetryById.get(String(model.id)) || null;
}

const TABLE_COPY = {
  'zh-CN': (telemetry, models) => ({
    title: '全部已上架模型',
    subtitle: `调用量、成功率与耗时来自过去 ${telemetry.range || '24h'} 的真实生成记录。`,
    syncing: '同步中',
    availableModels: `${models.length} 个可用模型`,
    search: '搜索模型、厂商或能力…',
    all: '全部',
    sortOptions: [
      { id: 'calls', label: '调用量优先' },
      { id: 'success', label: '成功率优先' },
      { id: 'latency', label: '耗时优先' },
      { id: 'name', label: '名称排序' },
    ],
    loadError: '模型数据暂时无法加载',
    retry: '重试',
    emptyTitle: '没有匹配的模型',
    emptyHint: '试试清空搜索词或切换分类。',
    headers: ['模型', '类别', '24h 调用', '成功率', '平均耗时', '价格', '状态', '操作'],
    available: '可创作',
    maintenance: '通道维护中',
    details: '详情',
    create: '创作',
    mobileCalls: '24h 调用',
    mobileSuccess: '成功率',
    mobileLatency: '平均耗时',
    mobileDetails: '查看详情',
    mobileCreate: '去创作',
  }),
  'zh-TW': (telemetry, models) => ({
    title: '全部已上架模型',
    subtitle: `調用量、成功率與耗時來自過去 ${telemetry.range || '24h'} 的真實生成記錄。`,
    syncing: '同步中',
    availableModels: `${models.length} 個可用模型`,
    search: '搜尋模型、廠商或能力…',
    all: '全部',
    sortOptions: [
      { id: 'calls', label: '調用量優先' },
      { id: 'success', label: '成功率優先' },
      { id: 'latency', label: '耗時優先' },
      { id: 'name', label: '名稱排序' },
    ],
    loadError: '模型數據暫時無法加載',
    retry: '重試',
    emptyTitle: '沒有匹配的模型',
    emptyHint: '試試清空搜尋詞或切換分類。',
    headers: ['模型', '類別', '24h 調用', '成功率', '平均耗時', '價格', '狀態', '操作'],
    available: '可創作',
    maintenance: '通道維護中',
    details: '詳情',
    create: '創作',
    mobileCalls: '24h 調用',
    mobileSuccess: '成功率',
    mobileLatency: '平均耗時',
    mobileDetails: '查看詳情',
    mobileCreate: '去創作',
  }),
  'ja-JP': (telemetry, models) => ({
    title: '全掲載モデル',
    subtitle: `呼び出し数、成功率、所要時間は過去 ${telemetry.range || '24h'} の実生成記録に基づきます。`,
    syncing: '同期中',
    availableModels: `${models.length} 個の利用可能モデル`,
    search: 'モデル、プロバイダー、機能を検索…',
    all: 'すべて',
    sortOptions: [
      { id: 'calls', label: '呼び出し数順' },
      { id: 'success', label: '成功率順' },
      { id: 'latency', label: '速度順' },
      { id: 'name', label: '名前順' },
    ],
    loadError: 'モデルデータを読み込めませんでした',
    retry: '再試行',
    emptyTitle: '該当するモデルがありません',
    emptyHint: '検索語句をクリアするか、カテゴリを切り替えてください。',
    headers: ['モデル', 'カテゴリ', '24h 呼出', '成功率', '平均所要時間', '料金', '状態', '操作'],
    available: '作成可能',
    maintenance: 'メンテナンス中',
    details: '詳細',
    create: '作成',
    mobileCalls: '24h 呼出',
    mobileSuccess: '成功率',
    mobileLatency: '平均所要時間',
    mobileDetails: '詳細',
    mobileCreate: '作成',
  }),
  'ko-KR': (telemetry, models) => ({
    title: '모든 등록 모델',
    subtitle: `호출량, 성공률 및 지연 시간은 지난 ${telemetry.range || '24h'} 동안의 실제 생성 기록을 기반으로 합니다.`,
    syncing: '동기화 중',
    availableModels: `${models.length}개 이용 가능한 모델`,
    search: '모델, 제공업체 또는 기능 검색…',
    all: '전체',
    sortOptions: [
      { id: 'calls', label: '호출량 순' },
      { id: 'success', label: '성공률 순' },
      { id: 'latency', label: '빠른 속도순' },
      { id: 'name', label: '이름순' },
    ],
    loadError: '모델 데이터를 불러올 수 없습니다',
    retry: '다시 시도',
    emptyTitle: '일치하는 모델이 없습니다',
    emptyHint: '검색어를 지우거나 카테고리를 변경해 보세요.',
    headers: ['모델', '카테고리', '24h 호출', '성공률', '평균 지연', '가격', '상태', '작업'],
    available: '생성 가능',
    maintenance: '점검 중',
    details: '상세',
    create: '생성',
    mobileCalls: '24h 호출',
    mobileSuccess: '성공률',
    mobileLatency: '평균 지연',
    mobileDetails: '상세 보기',
    mobileCreate: '생성하기',
  }),
  es: (telemetry, models) => ({
    title: 'Todos los modelos listados',
    subtitle: `Volumen de llamadas, tasa de éxito y latencia de registros reales de las últimas ${telemetry.range || '24h'}.`,
    syncing: 'Sincronizando',
    availableModels: `${models.length} modelos disponibles`,
    search: 'Buscar modelos, proveedores o funciones…',
    all: 'Todos',
    sortOptions: [
      { id: 'calls', label: 'Más llamadas' },
      { id: 'success', label: 'Mayor éxito' },
      { id: 'latency', label: 'Menor latencia' },
      { id: 'name', label: 'Nombre' },
    ],
    loadError: 'Los datos del modelo no están disponibles temporalmente',
    retry: 'Reintentar',
    emptyTitle: 'No hay modelos coincidentes',
    emptyHint: 'Borra la búsqueda o cambia de categoría.',
    headers: ['Modelo', 'Categoría', 'Llamadas 24h', 'Éxito', 'Latencia prom.', 'Precio', 'Estado', 'Acciones'],
    available: 'Disponible',
    maintenance: 'En mantenimiento',
    details: 'Detalles',
    create: 'Crear',
    mobileCalls: 'Llamadas 24h',
    mobileSuccess: 'Éxito',
    mobileLatency: 'Latencia prom.',
    mobileDetails: 'Detalles',
    mobileCreate: 'Crear',
  }),
  en: (telemetry, models) => ({
    title: 'All listed models',
    subtitle: `Call volume, success rate, and latency come from actual generation records in the last ${telemetry.range || '24h'}.`,
    syncing: 'Syncing',
    availableModels: `${models.length} available models`,
    search: 'Search models, providers, or capabilities…',
    all: 'All',
    sortOptions: [
      { id: 'calls', label: 'Most calls' },
      { id: 'success', label: 'Best success rate' },
      { id: 'latency', label: 'Lowest latency' },
      { id: 'name', label: 'Name' },
    ],
    loadError: 'Model data is temporarily unavailable',
    retry: 'Retry',
    emptyTitle: 'No matching models',
    emptyHint: 'Clear the search or switch category.',
    headers: ['Model', 'Category', '24h calls', 'Success', 'Avg latency', 'Price', 'Status', 'Actions'],
    available: 'Available',
    maintenance: 'Channel maintenance',
    details: 'Details',
    create: 'Create',
    mobileCalls: '24h calls',
    mobileSuccess: 'Success',
    mobileLatency: 'Avg latency',
    mobileDetails: 'Details',
    mobileCreate: 'Create',
  }),
};

export default function ModelScreenerTable({
  locale = 'zh-CN',
  models: providedModels,
  telemetry: providedTelemetry,
  telemetryById: providedTelemetryById,
  loading: providedLoading,
  error: providedError,
  onRetry,
}) {
  const norm = normalizeLocale(locale);
  const directory = useModelDirectory({ enabled: providedModels === undefined });
  const models = providedModels ?? directory.models;
  const telemetry = providedTelemetry ?? directory.telemetry;
  const telemetryById = providedTelemetryById ?? directory.telemetryById;
  const loading = providedLoading ?? directory.loading;
  const error = providedError ?? directory.error;
  const retry = onRetry ?? directory.reload;

  const modelsRoot = norm === 'zh-CN' ? '/zh/models' : '/models';
  const studioRoot = localizeStudioPath(norm);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('calls');

  const copyFn = TABLE_COPY[norm] || TABLE_COPY.en;
  const copy = copyFn(telemetry, models);

  const categories = useMemo(() => {
    const found = new Map();
    for (const model of models) {
      const key = String(model.category || 'other').toLowerCase();
      if (!found.has(key)) found.set(key, categoryLabel(model, norm));
    }
    return [...found.entries()].map(([id, label]) => ({ id, label }));
  }, [models, norm]);

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = models.filter((model) => {
      if (category !== 'all' && String(model.category || '').toLowerCase() !== category) {
        return false;
      }
      if (!keyword) return true;
      return [model.name, model.displayName, model.id, model.provider, model.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });

    return filtered.sort((left, right) => {
      const leftStats = modelStats(telemetryById, left);
      const rightStats = modelStats(telemetryById, right);
      if (sort === 'name') {
        return String(left.displayName || left.name || '').localeCompare(
          String(right.displayName || right.name || ''),
          norm
        );
      }
      if (sort === 'success') {
        return (rightStats?.successRate ?? -1) - (leftStats?.successRate ?? -1);
      }
      if (sort === 'latency') {
        const leftLatency = leftStats?.avgDurationMs > 0 ? leftStats.avgDurationMs : Number.POSITIVE_INFINITY;
        const rightLatency = rightStats?.avgDurationMs > 0 ? rightStats.avgDurationMs : Number.POSITIVE_INFINITY;
        return leftLatency - rightLatency;
      }
      return (rightStats?.totalCalls ?? -1) - (leftStats?.totalCalls ?? -1);
    });
  }, [models, query, category, sort, telemetryById, norm]);

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">Model inventory</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">{copy.title}</h2>
          <p className="mt-1 text-xs text-ink-muted">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-muted">
          <Cpu className="h-3.5 w-3.5 text-brand" />
          {loading ? copy.syncing : copy.availableModels}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            className="w-full rounded-xl border border-line bg-canvas py-2.5 pl-9 pr-3 text-xs text-ink outline-none transition focus:border-brand"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
              category === 'all' ? 'bg-brand text-ink-on-accent' : 'bg-canvas text-ink-muted hover:text-ink'
            }`}
          >
            {copy.all}
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                category === item.id ? 'bg-brand text-ink-on-accent' : 'bg-canvas text-ink-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-[11px] text-ink-muted">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="bg-transparent text-[11px] font-semibold text-ink outline-none"
          >
            {copy.sortOptions.map((option) => (
              <option key={option.id} value={option.id} className="bg-surface text-ink">
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm font-semibold text-ink">{copy.loadError}</p>
          <p className="mt-1 text-xs text-ink-muted">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-ink-on-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {copy.retry}
          </button>
        </div>
      ) : loading ? (
        <div className="overflow-hidden rounded-2xl border border-line">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex animate-pulse items-center gap-4 border-b border-line bg-surface p-4 last:border-b-0">
              <div className="h-10 w-10 rounded-xl bg-canvas" />
              <div className="h-4 w-40 rounded bg-canvas" />
              <div className="ml-auto h-4 w-20 rounded bg-canvas" />
              <div className="h-4 w-20 rounded bg-canvas" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
          <Search className="mx-auto h-6 w-6 text-ink-muted" />
          <p className="mt-3 text-sm font-semibold text-ink">{copy.emptyTitle}</p>
          <p className="mt-1 text-xs text-ink-muted">{copy.emptyHint}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-canvas text-[11px] uppercase tracking-wider text-ink-muted">
                  {copy.headers.map((header, index) => (
                    <th key={header} className={`px-4 py-3 font-semibold ${index === copy.headers.length - 1 ? 'text-right' : ''}`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((model) => {
                  const stats = modelStats(telemetryById, model);
                  const available = model.isActive !== false && model.hasWorkingRoute !== false;
                  const studioTab = inferStudioTabFromModel(model.id, categoryTab(model));
                  return (
                    <tr key={model.id} className="border-b border-line bg-surface last:border-b-0 hover:bg-canvas/60">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <ModelBrandLogo providerId={model.provider} provider={model.provider} modelId={model.id} />
                          <div className="min-w-0">
                            <Link href={`${modelsRoot}/${encodeURIComponent(model.id)}`} className="block truncate text-sm font-bold text-ink hover:text-brand">
                              {model.displayName || model.name}
                            </Link>
                            <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                              {model.provider || 'SupDance'} · {model.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                          {categoryLabel(model, norm)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-ink">
                        {stats ? formatCalls(stats.totalCalls) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        {stats && Number(stats.totalCalls) > 0 ? (
                          <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
                            stats.successRate >= 99 ? 'text-emerald-500' : stats.successRate >= 95 ? 'text-amber-500' : 'text-red-500'
                          }`}>
                            <Activity className="h-3 w-3" />
                            {Number(stats.successRate).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-muted">
                          <Clock className="h-3 w-3" />
                          {stats ? formatLatency(stats.avgDurationMs) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-ink-muted">{formatPrice(model, norm)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${available ? 'text-emerald-500' : 'text-amber-500'}`}>
                          <CheckCircle2 className="h-3 w-3" />
                          {available ? copy.available : copy.maintenance}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`${modelsRoot}/${encodeURIComponent(model.id)}`}
                            className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-muted transition hover:text-ink"
                          >
                            {copy.details}
                          </Link>
                          {available ? (
                            <Link
                              href={`${studioRoot}?tab=${studioTab}&model=${encodeURIComponent(model.id)}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-bold text-ink-on-accent"
                            >
                              {copy.create}
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {rows.map((model) => {
              const stats = modelStats(telemetryById, model);
              const available = model.isActive !== false && model.hasWorkingRoute !== false;
              const studioTab = inferStudioTabFromModel(model.id, categoryTab(model));
              return (
                <article key={model.id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <ModelBrandLogo providerId={model.provider} provider={model.provider} modelId={model.id} />
                    <div className="min-w-0 flex-1">
                      <Link href={`${modelsRoot}/${encodeURIComponent(model.id)}`} className="block truncate text-sm font-bold text-ink">
                        {model.displayName || model.name}
                      </Link>
                      <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                        {model.provider || 'SupDance'} · {categoryLabel(model, norm)}
                      </p>
                    </div>
                    <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                      {formatPrice(model, norm)}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-canvas p-2">
                      <p className="text-[10px] text-ink-muted">{copy.mobileCalls}</p>
                      <p className="mt-1 font-mono text-xs font-bold text-ink">{stats ? formatCalls(stats.totalCalls) : '—'}</p>
                    </div>
                    <div className="rounded-xl bg-canvas p-2">
                      <p className="text-[10px] text-ink-muted">{copy.mobileSuccess}</p>
                      <p className="mt-1 font-mono text-xs font-bold text-ink">{stats && Number(stats.totalCalls) > 0 ? `${Number(stats.successRate).toFixed(1)}%` : '—'}</p>
                    </div>
                    <div className="rounded-xl bg-canvas p-2">
                      <p className="text-[10px] text-ink-muted">{copy.mobileLatency}</p>
                      <p className="mt-1 font-mono text-xs font-bold text-ink">{stats ? formatLatency(stats.avgDurationMs) : '—'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`${modelsRoot}/${encodeURIComponent(model.id)}`}
                      className="flex-1 rounded-xl border border-line px-3 py-2 text-center text-[11px] font-semibold text-ink-muted"
                    >
                      {copy.mobileDetails}
                    </Link>
                    {available ? (
                      <Link
                        href={`${studioRoot}?tab=${studioTab}&model=${encodeURIComponent(model.id)}`}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand px-3 py-2 text-[11px] font-bold text-ink-on-accent"
                      >
                        {copy.mobileCreate}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
