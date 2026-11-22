'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/admin/AdminUi';

export default function SmartMatchModal({ isOpen, onClose, initialModel, allModels = [], activeCategory = 'all' }) {
  const [modelId, setModelId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setModelId(initialModel?.id || '');
  }, [isOpen, initialModel]);

  useEffect(() => {
    if (!isOpen || !modelId) return;
    const controller = new AbortController();
    const model = allModels.find((item) => item.id === modelId);
    setLoading(true);
    setError('');
    setCandidates([]);
    fetch('/api/admin/models/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'match_channel_candidates', modelId, category: model?.category, limit: 6 }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || '候选查询失败');
        setCandidates(Array.isArray(body.data?.candidates) ? body.data.candidates : []);
      })
      .catch((cause) => { if (cause.name !== 'AbortError') setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen, modelId, allModels]);

  if (!isOpen) return null;
  const selectableModels = allModels.filter((model) => activeCategory === 'all' || model.category === activeCategory);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/75 p-4" role="presentation">
      <section aria-label="渠道候选核对" aria-modal="true" role="dialog"
        className="w-full max-w-2xl rounded-2xl border border-line-strong bg-overlay p-5 shadow-elevation-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-card-title font-semibold text-ink">渠道候选核对</h2>
            <p className="mt-1 text-body-sm text-ink-muted">匹配分数仅帮助查找。模型身份、端点、能力和价格仍需人工核实并审核。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg p-2 text-ink-muted hover:bg-wash-strong hover:text-ink"><X className="size-4" /></button>
        </div>
        <label htmlFor="candidate-model" className="mt-5 block text-label text-ink-muted">规范模型</label>
        <select id="candidate-model" value={modelId} onChange={(event) => setModelId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-line-strong bg-well px-3 py-2 text-body-sm text-ink">
          <option value="">请选择模型</option>
          {selectableModels.map((model) => <option key={model.id} value={model.id}>{model.display_name || model.name} · {model.id}</option>)}
        </select>
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto scrollbar-rail" aria-live="polite">
          {loading && <p className="text-body-sm text-ink-muted">正在查询候选…</p>}
          {error && <p className="text-body-sm text-danger">{error}</p>}
          {!loading && !error && modelId && candidates.length === 0 && <p className="text-body-sm text-ink-muted">没有候选。请到渠道目录手动核实。</p>}
          {candidates.map((candidate, index) => (
            <div key={`${candidate.providerId}-${candidate.providerModelId}-${index}`} className="rounded-xl border border-line-subtle bg-raised p-3">
              <div className="flex items-center gap-2 text-body-sm text-ink"><Search className="size-4 text-ink-muted" />{candidate.providerName || candidate.providerId}</div>
              <p className="mt-1 break-all font-mono text-caption text-ink-muted">{candidate.providerModelId}</p>
              <p className="mt-1 text-caption text-ink-subtle">候选匹配 {Math.round(Number(candidate.confidence || 0) * 100)}% · {candidate.reason || '需人工核对'}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-line-subtle pt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>关闭</Button>
          <a href="/admin/models/routing" className="inline-flex items-center rounded-lg border border-brand-line bg-brand px-3 text-label font-medium text-ink-on-accent">前往映射审核</a>
        </div>
      </section>
    </div>
  );
}
