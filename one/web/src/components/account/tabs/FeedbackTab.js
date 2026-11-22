'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FEEDBACK_KINDS, FEEDBACK_STATUS_LABELS, findFeedbackKind } from '@/lib/feedback/catalog';
import { usePathname } from 'next/navigation';
import { localizedHref } from '@/lib/client/localeSwitch';

const STATUS_TONES = {
  pending: 'neutral',
  accepted: 'accent',
  rejected: 'outline',
};

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export default function FeedbackTab() {
  const pathname = usePathname();
  const [kind, setKind] = useState(FEEDBACK_KINDS[0].id);
  const [title, setTitle] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [detail, setDetail] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('加载提交记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const activeKind = findFeedbackKind(kind);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, title, pageUrl, detail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ tone: 'error', text: data.error || '提交失败，请稍后重试' });
        return;
      }
      setFeedback({ tone: 'ok', text: data.message || '提交成功' });
      setTitle('');
      setPageUrl('');
      setDetail('');
      await loadMine();
    } catch {
      setFeedback({ tone: 'error', text: '网络异常，提交未送达' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-page-title font-bold tracking-tight text-ink">建议与漏洞提交</h1>
        <p className="mt-1 text-label text-ink-muted">
          把你发现的报错、体验问题或安全隐患写清楚，审核采纳后硬币会自动到账，可在
          <a href={localizedHref('/benefits', { pathname })} className="mx-1 text-brand hover:text-brand-hover underline underline-offset-2">硬币权益页</a>
          查看余额与兑换。
        </p>
      </div>

      <Card className="border-line bg-surface">
        <CardHeader>
          <CardTitle className="text-body font-semibold text-ink">提交内容</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {FEEDBACK_KINDS.map((item) => {
                const selected = item.id === kind;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setKind(item.id)}
                    className={`rounded-2xl border p-3 text-start transition-colors cursor-pointer ${
                      selected
                        ? 'border-brand-ring bg-wash-strong text-ink shadow-elevation-1'
                        : 'border-line bg-wash text-ink-muted hover:text-ink hover:bg-wash-press'
                    }`}
                  >
                    <p className="text-body-sm font-semibold leading-tight">{item.label}</p>
                    <p className="mt-1.5 text-micro leading-relaxed">有效采纳默认奖励 {item.rewardDefault} 枚硬币</p>
                  </button>
                );
              })}
            </div>

            {activeKind && (
              <p className="text-label text-ink-muted leading-relaxed">{activeKind.hint}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="feedback-title" className="text-label font-medium text-ink">标题</label>
              <Input
                id="feedback-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="一句话说明问题或建议"
                className="rounded-xl border-line bg-scrim text-body"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="feedback-page" className="text-label font-medium text-ink">涉及页面（选填）</label>
              <Input
                id="feedback-page"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                maxLength={500}
                placeholder="/studio 或粘贴完整地址"
                className="rounded-xl border-line bg-scrim font-mono text-label"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="feedback-detail" className="text-label font-medium text-ink">详细说明</label>
              <Textarea
                id="feedback-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={4000}
                rows={6}
                placeholder="复现步骤、期望结果与实际结果；建议类请说明解决了什么问题。写得越具体，越容易被判定有效。"
                className="rounded-xl border-line bg-scrim text-body resize-y"
              />
              <p className="text-micro text-ink-muted text-end">{detail.length} / 4000</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={submitting}
                className="h-9 rounded-xl bg-surface-inverse text-ink-on-accent font-semibold hover:bg-surface-inverse cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-4 animate-spin me-2" /> : <Send className="size-4 me-2" />}
                {submitting ? '提交中…' : '提交审核'}
              </Button>
              {feedback && (
                <p className={`text-label ${feedback.tone === 'error' ? 'text-danger' : 'text-brand-hover'}`}>
                  {feedback.text}
                </p>
              )}
            </div>

            <p className="flex items-start gap-2 text-micro text-ink-muted leading-relaxed">
              <ShieldAlert className="size-3.5 mt-0.5 shrink-0" />
              硬币仅可通过每日登录与有效采纳的提交获得，不可充值、不可提现、不可在用户间转让。漏洞提交请勿附带可直接利用的攻击细节。
            </p>
          </form>
        </CardContent>
      </Card>

      <Card className="border-line bg-surface">
        <CardHeader>
          <CardTitle className="text-body font-semibold text-ink">我的提交</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-8 text-center text-label text-ink-muted">正在加载提交记录…</p>
          ) : items.length === 0 ? (
            <p className="px-6 py-8 text-center text-label text-ink-muted">还没有提交记录，先从上面提一条开始。</p>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {items.map((item) => (
                <li key={item.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-sm font-semibold text-ink">{item.title}</span>
                    <Badge variant={STATUS_TONES[item.status] || 'neutral'} className="text-micro">
                      {FEEDBACK_STATUS_LABELS[item.status] || item.status}
                    </Badge>
                    {item.rewardCoins > 0 && (
                      <span className="text-micro font-semibold text-brand">+{item.rewardCoins} 枚硬币</span>
                    )}
                  </div>
                  <p className="mt-1 text-micro text-ink-muted">
                    {findFeedbackKind(item.kind)?.label || item.kind}
                    {item.pageUrl ? ` · ${item.pageUrl}` : ''} · {formatTime(item.createdAt)}
                  </p>
                  {item.reviewNote && (
                    <p className="mt-2 rounded-xl border border-line bg-wash px-3 py-2 text-label text-ink-muted leading-relaxed">
                      审核回复：{item.reviewNote}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
