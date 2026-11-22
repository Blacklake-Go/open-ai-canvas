'use client';

import { useState } from 'react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';

export default function ModelsManagerClient({ initialModels }) {
  const [models, setModels] = useState(initialModels);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', cost_usd: 0, credits_price: 1 });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleToggleActive = async (model) => {
    setBusy(true);
    const newStatus = !model.is_active;
    try {
      const res = await fetch(`/api/admin/models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ is_active: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || '更新失败');

      setModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, is_active: newStatus ? 1 : 0 } : m))
      );
      showToast(`模型 ${model.name} 已${newStatus ? '开启上线' : '暂停服务'}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (model) => {
    setEditingId(model.id);
    setEditForm({
      name: model.name,
      cost_usd: model.cost_usd,
      credits_price: model.credits_price,
    });
  };

  const saveEdit = async (id) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || '保存失败');

      setModels((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                name: editForm.name,
                cost_usd: Number(editForm.cost_usd),
                credits_price: Number(editForm.credits_price),
              }
            : m
        )
      );
      setEditingId(null);
      showToast('模型参数与成本定价已保存');
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-brand/30 bg-black/90 px-4 py-3 text-sm text-brand shadow-2xl backdrop-blur">
          {toast}
        </div>
      )}

      <div className="grid gap-4">
        {models.map((m) => {
          const isEditing = editingId === m.id;
          return (
            <Card key={m.id} className="p-5 transition hover:border-white/20">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* 模型名称与标识 */}
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        m.is_active ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-white/20'
                      }`}
                    />
                    {isEditing ? (
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="rounded-lg border border-white/20 bg-black/50 px-3 py-1 text-sm font-bold text-white outline-none focus:border-brand"
                      />
                    ) : (
                      <h3 className="text-base font-bold text-white">{m.name}</h3>
                    )}
                    <span className="rounded-md border border-brand/20 bg-brand/10 px-2 py-0.5 text-[10px] font-mono text-brand">
                      {m.type === 'video' ? '🎬 视频' : m.type === 'image' ? '📷 图像' : '🎵 音频'}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-white/40">{m.id} · 供应商: {m.provider.toUpperCase()}</p>
                </div>

                {/* 成本价与 Credits 扣除 */}
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[11px] text-white/40">单次官方成本 (USD)</p>
                    {isEditing ? (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-white/40">$</span>
                        <input
                          type="number"
                          step="0.001"
                          value={editForm.cost_usd}
                          onChange={(e) => setEditForm({ ...editForm, cost_usd: e.target.value })}
                          className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1 text-xs font-mono text-white outline-none focus:border-brand"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 font-mono text-sm font-semibold text-amber-200">${Number(m.cost_usd || 0).toFixed(3)}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] text-white/40">用户扣除额度 (Credits)</p>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editForm.credits_price}
                        onChange={(e) => setEditForm({ ...editForm, credits_price: e.target.value })}
                        className="mt-1 w-16 rounded-lg border border-white/20 bg-black/50 px-2 py-1 text-xs font-mono text-brand outline-none focus:border-brand"
                      />
                    ) : (
                      <p className="mt-1 font-mono text-sm font-bold text-brand">{m.credits_price} 点</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] text-white/40">当前状态</p>
                    <div className="mt-1">
                      <StatusBadge tone={m.is_active ? 'good' : 'neutral'}>
                        {m.is_active ? '正常上线' : '已暂停'}
                      </StatusBadge>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => saveEdit(m.id)}
                        className="rounded-xl bg-brand hover:bg-brand-hover px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition"
                      >
                        配置定价
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(m)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                          m.is_active
                            ? 'border border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20'
                            : 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'
                        }`}
                      >
                        {m.is_active ? '暂停下架' : '一键启用'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
