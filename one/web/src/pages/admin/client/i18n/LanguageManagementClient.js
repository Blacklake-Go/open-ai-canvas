'use client';

import { useMemo, useState } from 'react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';

const STATUS_LABELS = {
  source: 'English 基准',
  translated: '已翻译',
  missing: '缺失',
  fallback: 'English fallback',
  'format-error': '格式错误',
  invalid: '无效',
};

function tone(status) {
  if (status === 'translated' || status === 'source') return 'good';
  if (status === 'fallback' || status === 'missing') return 'warn';
  return 'danger';
}

export default function LanguageManagementClient({ initialSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [locale, setLocale] = useState('ja-JP');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const selected = snapshot?.catalogs?.[locale];
  const fields = useMemo(() => (selected?.fields || []).filter((field) => {
    const matchesQuery = !query || `${field.key} ${field.english} ${field.value}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'all' || field.status === status;
    return matchesQuery && matchesStatus;
  }), [query, selected, status]);

  async function refresh() {
    const response = await fetch('/api/admin/i18n', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || '刷新失败');
    setSnapshot(payload.data);
  }

  async function saveField(field, action = 'draft') {
    const value = drafts[field.key] ?? field.value;
    setBusy(true);
    setFeedback('');
    try {
      const response = await fetch('/api/admin/i18n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ locale, key: field.key, value, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || '保存失败');
      await refresh();
      setDrafts((current) => { const next = { ...current }; delete next[field.key]; return next; });
      setFeedback(action === 'publish' ? '字段已保存并发布' : '草稿已保存');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function publishLocale() {
    setBusy(true);
    setFeedback('');
    try {
      const response = await fetch('/api/admin/i18n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ locale, action: 'publish-locale' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || '发布失败');
      await refresh();
      setFeedback(`已发布 ${locale}`);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  const baseSummary = snapshot?.locales?.find((item) => item.locale === 'en') || snapshot?.locales?.[0];

  return (
    <div className="space-y-6">
      {/* 全站字符串资产库真实指标总览 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl border border-white/[0.08] bg-black/30 backdrop-blur-xl">
        <div>
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">基准语言 (Canonical)</p>
          <p className="mt-1 text-lg font-bold font-mono text-brand">English (en)</p>
          <p className="mt-0.5 text-[11px] text-white/40">100% 完整词条基准</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">全站总词条 (Total Keys)</p>
          <p className="mt-1 text-lg font-bold font-mono text-white">{baseSummary?.totalKeys || baseSummary?.total || 0}</p>
          <p className="mt-0.5 text-[11px] text-white/40">覆盖全站 771 个前端文件</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">基准源字符数 (Source Chars)</p>
          <p className="mt-1 text-lg font-bold font-mono text-white">{baseSummary?.totalCharacters ? baseSummary.totalCharacters.toLocaleString() : 0}</p>
          <p className="mt-0.5 text-[11px] text-white/40">英文词条总字符量</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">支持语言 (Launch Locales)</p>
          <p className="mt-1 text-lg font-bold font-mono text-emerald-400">{snapshot?.locales?.length || 6} 种语言</p>
          <p className="mt-0.5 text-[11px] text-white/40">en, zh-CN, ja-JP, ko-KR, zh-TW, es</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {(snapshot?.locales || []).map((item) => (
          <button key={item.locale} type="button" onClick={() => setLocale(item.locale)} className={`text-left transition-all ${locale === item.locale ? 'ring-2 ring-brand/80 scale-[1.02]' : 'opacity-90 hover:opacity-100'}`}>
            <Card className="h-full p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white truncate">{item.name}</p>
                <StatusBadge tone={(item.charCoverage ?? item.coverage) >= 99 ? 'good' : 'warn'}>
                  {(item.charCoverage ?? item.coverage).toFixed(1)}%
                </StatusBadge>
              </div>
              <p className="mt-1 font-mono text-[11px] text-white/40">{item.locale}</p>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/55">字符覆盖</span>
                  <span className="font-mono font-bold text-brand">{(item.charCoverage ?? item.coverage).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/55">词条覆盖</span>
                  <span className="font-mono text-white/80">{item.completed}/{item.totalKeys || item.total} ({(item.keyCoverage ?? item.coverage).toFixed(1)}%)</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/55">已译字符</span>
                  <span className="font-mono text-white/80">{item.completedCharacters ? item.completedCharacters.toLocaleString() : item.completed}</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-white/35 border-t border-white/[0.06] pt-2">
                缺失 {item.missing} · 回退 {item.fallback} · 格式错误 {item.formatErrors}
              </p>
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-bold text-white">{selected?.name} 字段</h2>
            <p className="mt-1 text-xs text-white/40">真实翻译才计入覆盖率；English fallback 只作为运行时安全回退。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 key 或文案" className="w-56 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-brand/50" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2 text-xs text-white outline-none">
              <option value="all">全部状态</option>
              {Object.entries(STATUS_LABELS).filter(([key]) => key !== 'source').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <button type="button" disabled={busy} onClick={publishLocale} className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-50 transition-colors">发布当前语言</button>
          </div>
        </div>

        {feedback && <p role="status" className="mt-4 rounded-xl border border-brand/20 bg-brand/10 px-3 py-2 text-xs text-brand">{feedback}</p>}

        <div className="mt-4 space-y-3">
          {fields.map((field) => (
            <div key={field.key} className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all font-mono text-xs text-ink font-semibold">{field.key}</p>
                  <p className="mt-1 text-xs text-white/45">English：{field.english}</p>
                </div>
                <StatusBadge tone={tone(field.status)}>{STATUS_LABELS[field.status] || field.status}</StatusBadge>
              </div>
              {locale !== 'en' && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 text-xs text-white/50">
                    {selected.name} 文案
                    <textarea value={drafts[field.key] ?? field.value ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [field.key]: event.target.value }))} rows={2} className="mt-1 w-full rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm text-white outline-none focus:border-brand/60" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => saveField(field)} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 disabled:opacity-50">保存草稿</button>
                    <button type="button" disabled={busy} onClick={() => saveField(field, 'publish')} className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-50 transition-colors">发布字段</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!fields.length && <p className="py-10 text-center text-sm text-white/45">没有符合筛选条件的字段</p>}
        </div>
      </Card>
    </div>
  );
}
