'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Eye, Image as ImageIcon, LoaderCircle, Pencil, RefreshCw, Search, Star, Video, X } from 'lucide-react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';

const EMPTY_FORM = {
  id: '',
  title: '',
  description: '',
  modelName: '',
  tags: '',
  status: 'published',
  isFeatured: false,
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusTone(status) {
  if (status === 'published') return 'good';
  if (status === 'banned') return 'danger';
  return 'warn';
}

function statusLabel(status) {
  return { published: '已发布', hidden: '已隐藏', banned: '已封禁' }[status] || status;
}

function mediaLabel(type) {
  if (type === 'video') return { label: '视频', Icon: Video };
  return { label: '图像', Icon: ImageIcon };
}

export default function CommunityCasesManager({ canWrite }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, published: 0, hidden: 0, featured: 0 });
  const [filters, setFilters] = useState({ q: '', status: '', mediaType: '', featured: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const response = await fetch(`/api/admin/community/posts?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || '读取社区作品失败');
      setRows(payload?.data?.rows || []);
      setSummary(payload?.data?.summary || {});
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const visibleHint = useMemo(() => {
    if (filters.featured === 'true') return '当前显示精选案例';
    if (filters.status === 'hidden') return '当前显示已隐藏作品';
    return '按最近更新时间排序';
  }, [filters]);

  const openEditor = (row) => setEditing({
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    modelName: row.model_name || '',
    tags: Array.isArray(row.tags) ? row.tags.join(', ') : '',
    status: row.status || 'published',
    isFeatured: Boolean(row.is_featured),
  });

  const save = async (event) => {
    event.preventDefault();
    if (!editing || !canWrite) return;
    setSaving(true);
    setFeedback({ type: '', message: '' });
    try {
      const response = await fetch(`/api/admin/community/posts/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          title: editing.title,
          description: editing.description,
          modelName: editing.modelName,
          tags: editing.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          status: editing.status,
          isFeatured: editing.isFeatured,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || '保存失败');
      setFeedback({ type: 'success', message: editing.isFeatured ? '已保存，并已进入前台精选案例展示。' : '作品信息已保存。' });
      setEditing(null);
      await load();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback.message && (
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${feedback.type === 'error' ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`} role="status">
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback({ type: '', message: '' })} aria-label="关闭提示"><X className="size-4" /></button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['社区作品', summary.total || 0, '全部作品', 'neutral'],
          ['已发布', summary.published || 0, '前台可见', 'good'],
          ['精选案例', summary.featured || 0, '进入案例展示位', 'info'],
          ['已隐藏', summary.hidden || 0, '不在前台展示', 'warn'],
        ].map(([label, value, hint, tone]) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-semibold text-gray-400">{label}</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${tone === 'good' ? 'text-emerald-400' : tone === 'info' ? 'text-brand' : tone === 'warn' ? 'text-amber-300' : 'text-white'}`}>{value}</p>
            <p className="mt-1 text-xs text-gray-500">{hint}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1 xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
              <input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="搜索标题、作者、模型" className="h-10 w-full rounded-lg border border-white/10 bg-black/25 pl-9 pr-3 text-sm text-white outline-none focus:border-brand/50" />
            </label>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-10 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs text-gray-300 outline-none focus:border-brand/50">
              <option value="">全部状态</option><option value="published">已发布</option><option value="hidden">已隐藏</option><option value="banned">已封禁</option>
            </select>
            <select value={filters.mediaType} onChange={(event) => setFilters((current) => ({ ...current, mediaType: event.target.value }))} className="h-10 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs text-gray-300 outline-none focus:border-brand/50">
              <option value="">全部类型</option><option value="image">图像</option><option value="video">视频</option><option value="audio">音乐</option><option value="workflow">工作流</option>
            </select>
            <select value={filters.featured} onChange={(event) => setFilters((current) => ({ ...current, featured: event.target.value }))} className="h-10 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs text-gray-300 outline-none focus:border-brand/50">
              <option value="">精选状态</option><option value="true">仅精选案例</option><option value="false">未精选</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-gray-500 xl:justify-end">
            <span>{visibleHint}</span>
            <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-gray-300 transition hover:border-brand/40 hover:text-brand"><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />刷新</button>
          </div>
        </div>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-surface/90 shadow-xl shadow-black/40">
        <table className="w-full min-w-[980px] text-left">
          <thead className="border-b border-white/[0.08] bg-white/[0.02] text-xs font-semibold text-gray-400">
            <tr><th className="px-4 py-3.5">作品</th><th className="px-4 py-3.5">作者 / 类型</th><th className="px-4 py-3.5">互动数据</th><th className="px-4 py-3.5">状态</th><th className="px-4 py-3.5">更新时间</th><th className="px-4 py-3.5 text-right">操作</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-16 text-center text-sm text-gray-500"><LoaderCircle className="mx-auto mb-2 size-5 animate-spin text-brand" />正在加载社区作品…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-16 text-center text-sm text-gray-500">没有匹配的社区作品</td></tr>
            ) : rows.map((row) => {
              const media = mediaLabel(row.media_type);
              const MediaIcon = media.Icon;
              return (
                <tr key={row.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3.5"><div className="flex items-center gap-3"><div className="size-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">{row.cover_url || row.media_url ? <img src={row.cover_url || row.media_url} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-gray-600"><ImageIcon className="size-5" /></div>}</div><div className="min-w-0"><p className="max-w-[300px] truncate text-sm font-semibold text-white">{row.title || '未命名作品'}</p><p className="mt-1 max-w-[340px] truncate text-xs text-gray-500">{row.description || row.prompt || '暂无描述'}</p>{row.is_featured && <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300"><Star className="size-3 fill-current" />精选案例</span>}</div></div></td>
                  <td className="px-4 py-3.5"><p className="max-w-[170px] truncate text-xs text-gray-200">{row.author_name || row.author_username || row.author_email || '未知作者'}</p><p className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-500"><MediaIcon className="size-3" />{media.label}</p></td>
                  <td className="px-4 py-3.5 text-xs text-gray-400"><div>♥ {row.likes_count || 0} · ◉ {row.views_count || 0}</div><div className="mt-1 text-amber-300/80">🪙 {row.coins_count || 0} · ↗ {row.remix_count || 0}</div></td>
                  <td className="px-4 py-3.5"><StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge></td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">{formatDate(row.updated_at || row.created_at)}</td>
                  <td className="px-4 py-3.5"><div className="flex items-center justify-end gap-2"><Link href={`/community/${row.id}`} target="_blank" className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition hover:border-brand/40 hover:text-brand" aria-label="前台预览"><Eye className="size-4" /></Link>{canWrite && <button type="button" onClick={() => openEditor(row)} className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition hover:border-brand/40 hover:text-brand" aria-label="编辑作品"><Pencil className="size-4" /></button>}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="编辑社区作品">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="关闭编辑" onClick={() => !saving && setEditing(null)} />
          <form onSubmit={save} className="relative flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-surface-raised shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">案例运营</p><h2 className="mt-1 text-xl font-bold text-white">编辑作品与展示状态</h2><p className="mt-1 text-xs text-gray-500">保存后前台社区会读取最新状态。</p></div><button type="button" onClick={() => !saving && setEditing(null)} className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white" aria-label="关闭"><X className="size-5" /></button></div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-300">作品标题</span><input required maxLength={255} value={editing.title} onChange={(event) => setEditing((current) => ({ ...current, title: event.target.value }))} className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-brand/50" /></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-300">案例说明</span><textarea maxLength={2000} rows={5} value={editing.description} onChange={(event) => setEditing((current) => ({ ...current, description: event.target.value }))} placeholder="说明创作背景、适用场景或值得复用的方法" className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-white outline-none focus:border-brand/50" /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-semibold text-gray-300">使用模型</span><input maxLength={120} value={editing.modelName} onChange={(event) => setEditing((current) => ({ ...current, modelName: event.target.value }))} className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-brand/50" /></label><label className="block"><span className="mb-2 block text-xs font-semibold text-gray-300">发布状态</span><select value={editing.status} onChange={(event) => setEditing((current) => ({ ...current, status: event.target.value }))} className="h-11 w-full rounded-lg border border-white/10 bg-surface-raised px-3 text-sm text-white outline-none focus:border-brand/50"><option value="published">已发布 · 前台可见</option><option value="hidden">已隐藏 · 暂不展示</option><option value="banned">已封禁 · 违规内容</option></select></label></div>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-gray-300">精选标签 <span className="font-normal text-gray-500">用逗号分隔，最多 10 个</span></span><input value={editing.tags} onChange={(event) => setEditing((current) => ({ ...current, tags: event.target.value }))} placeholder="产品广告, 超现实, Seedream" className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-brand/50" /></label>
              <label className={`flex items-start gap-3 rounded-xl border p-4 ${editing.isFeatured ? 'border-amber-400/30 bg-amber-400/[0.08]' : 'border-white/10 bg-white/[0.02]'}`}><input type="checkbox" checked={editing.isFeatured} onChange={(event) => setEditing((current) => ({ ...current, isFeatured: event.target.checked }))} className="mt-0.5 size-4 accent-amber-300" /><span><span className="flex items-center gap-1.5 text-sm font-semibold text-white"><Star className="size-4 text-amber-300" />加入精选案例展示</span><span className="mt-1 block text-xs leading-5 text-gray-500">仅当作品为“已发布”时，才会在社区顶部案例位显示。</span></span></label>
              <div className="rounded-xl border border-brand/20 bg-brand/[0.05] p-4 text-xs leading-5 text-ink-muted"><Check className="mb-1 size-4 text-brand" /><p>前台案例展示会保留原作品媒体、提示词、模型参数、点赞、评论和“做同款”链路。这里的编辑只维护运营文案与可见性，不会修改原始生成资产。</p></div>
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-4"><span className="text-[11px] text-gray-500">ID: {editing.id}</span><div className="flex gap-2"><button type="button" onClick={() => setEditing(null)} disabled={saving} className="h-10 rounded-lg border border-white/10 px-4 text-xs font-semibold text-gray-300 hover:bg-white/5">取消</button><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-60 transition-colors">{saving && <LoaderCircle className="size-3.5 animate-spin" />}{saving ? '保存中…' : '保存并发布'}</button></div></div>
          </form>
        </div>
      )}
    </div>
  );
}
