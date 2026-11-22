'use client';

import { useMemo, useState } from 'react';

const GROUPS = [
  { id: 'image', label: '图片', defaultKey: 'imageModelId' },
  { id: 'video', label: '视频', defaultKey: 'videoModelId' },
  { id:'audio',label:'语音与音频',defaultKey:'audioModelId' },
  { id:'music',label:'音乐',defaultKey:'musicModelId' },
  { id: 'text', label: '文本', defaultKey: 'textModelId' },
];

const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
const FORMATS = ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'];

const fieldBase = 'h-10 w-full border border-line bg-well px-3 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50';
const inputClass = `${fieldBase} rounded-xl`;
const selectClass = `${fieldBase} rounded-lg`;

function pickBestDefault(_groupId, availableIds) { return availableIds?.[0] || ''; }

function initialState(initialConfig, candidates) {
  const mountedModelIds = Object.fromEntries(GROUPS.map(({ id }) => [
    id,
    initialConfig?.mountedModelIds?.[id]
      ? initialConfig.mountedModelIds[id].filter((modelId) => candidates.some((model) => model.id === modelId && model.capability === id))
      : candidates.filter((model) => model.capability === id).map((model) => model.id),
  ]));

  const defaults = {
    imageModelId: '',
    videoModelId: '',
    textModelId: '',
    audioModelId: '',
    musicModelId: '',
    canvasImageCount: '1',
    audioVoice: 'alloy',
    audioFormat: 'mp3',
    audioSpeed: '1',
    audioInstructions: '',
    systemPrompt: '',
    ...initialConfig?.defaults,
  };

  for (const group of GROUPS) {
    if (!mountedModelIds[group.id]?.includes(defaults[group.defaultKey])) {
      defaults[group.defaultKey] = pickBestDefault(group.id, mountedModelIds[group.id]);
    }
  }

  return { mountedModelIds, defaults };
}

export default function CanvasConfigClient({ initialConfig, candidates = [], canWrite }) {
  const [draft, setDraft] = useState(() => initialState(initialConfig, candidates));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [saved, setSaved] = useState(Boolean(initialConfig));
  const [search, setSearch] = useState({ image: '', video: '', text: '', audio: '', music:'' });
  const [brandFilter, setBrandFilter] = useState({ image: 'all', video: 'all', text: 'all', audio: 'all', music:'all' });

  const setDefault = (key, value) => {
    setDraft((current) => ({
      ...current,
      defaults: { ...current.defaults, [key]: value },
    }));
  };

  const toggleModel = (group, id) => {
    setDraft((current) => {
      const selected = current.mountedModelIds[group.id] || [];
      const next = selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
      const defaults = { ...current.defaults };
      if (!next.includes(defaults[group.defaultKey])) {
        defaults[group.defaultKey] = pickBestDefault(group.id, next);
      }
      return {
        mountedModelIds: { ...current.mountedModelIds, [group.id]: next },
        defaults,
      };
    });
  };

  const selectAllFiltered = (group, filteredModelIds) => {
    setDraft((current) => {
      const existing = current.mountedModelIds[group.id] || [];
      const nextSet = new Set([...existing, ...filteredModelIds]);
      const next = [...nextSet];
      const defaults = { ...current.defaults };
      if (!defaults[group.defaultKey] && next.length) {
        defaults[group.defaultKey] = pickBestDefault(group.id, next);
      }
      return {
        mountedModelIds: { ...current.mountedModelIds, [group.id]: next },
        defaults,
      };
    });
  };

  const clearAllInGroup = (group) => {
    setDraft((current) => ({
      mountedModelIds: { ...current.mountedModelIds, [group.id]: [] },
      defaults: { ...current.defaults, [group.defaultKey]: '' },
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFeedback('');
    setFeedbackError(false);
    try {
      const response = await fetch('/api/admin/canvas/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || payload?.error || '保存失败');
      setSaved(true);
      setFeedback('已保存并写入审计。无限画布拉取模型与默认配置已实时生效。');
    } catch (error) {
      setFeedbackError(true);
      setFeedback(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 按类型过滤候选
  const modelsByGroup = useMemo(() => {
    const map = {};
    for (const g of GROUPS) {
      map[g.id] = candidates.filter((m) => m.capability === g.id);
    }
    return map;
  }, [candidates]);

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-xl border border-line bg-surface p-4 text-label text-ink-muted">
        {saved ? '当前是已保存并生效的平台画布配置。' : '尚未保存平台配置；画布暂沿用默认模型目录。'}
        {' '}所有挂载模型均带品牌 Logo 标识，保存后无限画布可永久实时拉取并使用。
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {GROUPS.map((group) => {
          const models = modelsByGroup[group.id] || [];
          if (!models.length && group.id === 'text') return null; // 文本模型无候选时自动折叠

          const selected = draft.mountedModelIds[group.id] || [];
          const query = search[group.id].trim().toLowerCase();
          const selectedBrand = brandFilter[group.id];

          // 提取该分组下所有品牌
          const brandTabs = [];
          const seenBrands = new Set();
          for (const m of models) {
            if (m.brandId && !seenBrands.has(m.brandId)) {
              seenBrands.add(m.brandId);
              brandTabs.push({
                id: m.brandId,
                name: m.brandName || m.brandId,
                logoUrl: m.brandLogoUrl || '/assets/brands/other.svg',
              });
            }
          }

          // 综合过滤：搜索关键字（包含模型名、ID、品牌名、Badge） + 品牌选择器
          const visibleModels = models.filter((model) => {
            if (selectedBrand !== 'all' && model.brandId !== selectedBrand) {
              return false;
            }
            if (query) {
              const searchText = `${model.name} ${model.id} ${model.brandName || ''} ${model.brandBadge || ''} ${model.providerId || ''}`.toLowerCase();
              return searchText.includes(query);
            }
            return true;
          });

          return (
            <section key={group.id} className="rounded-2xl border border-line bg-surface p-5 shadow-elevation-2 flex flex-col justify-between">
              <div>
                {/* 头部标题与挂载计数 */}
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <h2 className="text-section-title font-semibold text-ink">{group.label}模型挂载</h2>
                    <p className="text-xs text-ink-muted mt-0.5">支持按品牌查找、多选挂载并设置进入画布的默认模型</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-wash border border-line px-3 py-1 text-label font-medium text-ink">
                      已挂载 {selected.length} / {models.length}
                    </span>
                  </div>
                </div>

                {/* 品牌快速筛选胶囊栏 */}
                {brandTabs.length > 1 && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
                    <button
                      type="button"
                      onClick={() => setBrandFilter((prev) => ({ ...prev, [group.id]: 'all' }))}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedBrand === 'all'
                          ? 'bg-ink text-surface shadow-elevation-1'
                          : 'bg-surface border border-line text-ink-muted hover:text-ink hover:bg-wash'
                      }`}
                    >
                      全部品牌 ({models.length})
                    </button>
                    {brandTabs.map((brand) => {
                      const count = models.filter((m) => m.brandId === brand.id).length;
                      return (
                        <button
                          key={brand.id}
                          type="button"
                          onClick={() => setBrandFilter((prev) => ({ ...prev, [group.id]: brand.id }))}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            selectedBrand === brand.id
                              ? 'bg-ink text-surface shadow-elevation-1'
                              : 'bg-surface border border-line text-ink-muted hover:text-ink hover:bg-wash'
                          }`}
                        >
                          <img
                            src={brand.logoUrl}
                            alt=""
                            className="size-3.5 object-contain rounded-full shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <span>{brand.name}</span>
                          <span className="opacity-70 text-[10px]">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 搜索框与批量操作按键 */}
                <div className="mb-3 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="search"
                      value={search[group.id]}
                      onChange={(event) => setSearch((current) => ({ ...current, [group.id]: event.target.value }))}
                      placeholder={`搜索${group.label}模型名称、ID 或品牌...`}
                      aria-label={`搜索${group.label}模型`}
                      className={`${inputClass} text-sm h-9 pl-3`}
                    />
                  </div>
                  {canWrite && visibleModels.length > 0 && (
                    <button
                      type="button"
                      onClick={() => selectAllFiltered(group, visibleModels.map((m) => m.id))}
                      className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-wash active:bg-well"
                    >
                      全选当前
                    </button>
                  )}
                  {canWrite && selected.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearAllInGroup(group)}
                      className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:text-danger hover:bg-wash active:bg-well"
                    >
                      清空
                    </button>
                  )}
                </div>

                {/* 模型列表 */}
                {models.length ? (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {visibleModels.map((model) => {
                      const isChecked = selected.includes(model.id);
                      return (
                        <label
                          key={model.id}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-2 text-body transition-colors ${
                            isChecked
                              ? 'border-brand/40 bg-brand/5 text-ink'
                              : 'border-line/60 bg-surface text-ink hover:bg-wash hover:border-line'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!canWrite}
                            onChange={() => toggleModel(group, model.id)}
                            className="size-4 rounded accent-brand shrink-0 ml-1"
                          />
                          <img
                            src={model.brandLogoUrl || '/assets/brands/other.svg'}
                            alt={model.brandName || ''}
                            className="size-6 shrink-0 object-contain rounded-md bg-white/5 p-0.5 border border-line/40"
                            onError={(e) => { e.currentTarget.src = '/assets/brands/other.svg'; }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-sm text-ink">{model.name}</span>
                              {model.brandName && (
                                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-normal bg-wash border border-line text-ink-muted">
                                  {model.brandName}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-ink-muted truncate font-mono mt-0.5">{model.id}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-surface border border-line/80 px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                            {model.credits} 积分
                          </span>
                        </label>
                      );
                    })}
                    {!visibleModels.length && (
                      <p className="py-6 text-center text-sm text-ink-muted">没有匹配的{group.label}模型。</p>
                    )}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-ink-muted">当前没有符合上架、定价和渠道条件的模型。</p>
                )}
              </div>

              {/* 默认模型下拉选择器 */}
              <div className="mt-5 border-t border-line pt-4">
                <label className="block text-label font-medium text-ink" htmlFor={`default-${group.id}`}>
                  默认{group.label}模型
                </label>
                <p className="text-xs text-ink-muted mt-0.5 mb-2">进入无限画布时为该生成模态预选的初始模型</p>
                <select
                  id={`default-${group.id}`}
                  value={draft.defaults[group.defaultKey]}
                  disabled={!canWrite || !selected.length}
                  onChange={(event) => setDefault(group.defaultKey, event.target.value)}
                  className={`${selectClass}`}
                >
                  {!selected.length && <option value="">未挂载任何{group.label}模型</option>}
                  {models
                    .filter((model) => selected.includes(model.id))
                    .map((model) => (
                      <option key={model.id} value={model.id}>
                        {`[${model.brandName || '品牌'}] ${model.name} (${model.credits} 积分)`}
                      </option>
                    ))}
                </select>
              </div>
            </section>
          );
        })}
      </div>

      {/* 生成偏好默认值 */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-elevation-2">
        <h2 className="text-section-title font-semibold text-ink">生成偏好默认值</h2>
        <p className="mt-1 text-body text-ink-muted">与画布偏好设置对应，用户进入后可在画布工具栏或节点属性中随时微调。</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="画布默认生图张数">
            <input
              type="number"
              min="1"
              max="15"
              required
              disabled={!canWrite}
              value={draft.defaults.canvasImageCount}
              onChange={(event) => setDefault('canvasImageCount', event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="默认音频声音">
            <select
              disabled={!canWrite}
              value={draft.defaults.audioVoice}
              onChange={(event) => setDefault('audioVoice', event.target.value)}
              className={selectClass}
            >
              {VOICES.map((voice) => (
                <option key={voice} value={voice}>{voice}</option>
              ))}
            </select>
          </Field>
          <Field label="默认音频格式">
            <select
              disabled={!canWrite}
              value={draft.defaults.audioFormat}
              onChange={(event) => setDefault('audioFormat', event.target.value)}
              className={selectClass}
            >
              {FORMATS.map((format) => (
                <option key={format} value={format}>{format.toUpperCase()}</option>
              ))}
            </select>
          </Field>
          <Field label="默认音频语速">
            <input
              type="number"
              min="0.25"
              max="4"
              step="0.05"
              required
              disabled={!canWrite}
              value={draft.defaults.audioSpeed}
              onChange={(event) => setDefault('audioSpeed', event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="默认音频指令">
            <textarea
              rows={2}
              disabled={!canWrite}
              value={draft.defaults.audioInstructions}
              onChange={(event) => setDefault('audioInstructions', event.target.value)}
              className={`${inputClass} h-auto py-3`}
            />
          </Field>
          <Field label="系统提示词">
            <textarea
              rows={4}
              disabled={!canWrite}
              value={draft.defaults.systemPrompt}
              onChange={(event) => setDefault('systemPrompt', event.target.value)}
              className={`${inputClass} h-auto py-3`}
            />
          </Field>
        </div>
      </section>

      {/* 底部保存按键与反馈 */}
      <div className="flex flex-wrap items-center justify-end gap-4 pt-2">
        {feedback && (
          <p role={feedbackError ? 'alert' : 'status'} className={`text-sm font-medium ${feedbackError ? 'text-danger' : 'text-success'}`}>
            {feedback}
          </p>
        )}
        {canWrite && (
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-lg bg-brand px-6 text-body font-semibold text-ink-on-accent hover:bg-brand-hover active:bg-brand-active focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50 transition-colors shadow-elevation-1"
          >
            {saving ? '保存中…' : '保存画布配置'}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return <label className="grid gap-2 text-label text-ink-muted">{label}{children}</label>;
}
