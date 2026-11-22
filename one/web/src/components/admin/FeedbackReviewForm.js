'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const RESOLUTIONS = [
  {
    id: 'accepted',
    label: '采纳并发放硬币',
    hint: '确认问题或建议有效，硬币会立即计入提交人账户。',
    Icon: CheckCircle2,
  },
  {
    id: 'rejected',
    label: '不予采纳',
    hint: '无效、重复或无法复现时选择，不会扣减任何额度。',
    Icon: XCircle,
  },
];

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `feedback-review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function FeedbackReviewForm({ feedbackId, defaultReward = 0 }) {
  const router = useRouter();
  const [resolution, setResolution] = useState('accepted');
  const [rewardCoins, setRewardCoins] = useState(String(defaultReward || 0));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const amount = Number(rewardCoins);
    if (resolution === 'accepted' && (!Number.isFinite(amount) || amount <= 0)) {
      setMessage({ tone: 'error', text: '采纳时必须填写大于 0 的硬币数量' });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(feedbackId)}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': createIdempotencyKey(),
        },
        body: JSON.stringify({
          resolution,
          rewardCoins: resolution === 'accepted' ? Math.trunc(amount) : 0,
          note: note.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage({
          tone: 'error',
          text: data?.error?.message || data?.error || '裁决失败，请刷新后重试',
        });
        return;
      }

      const rewarded = Number(data?.data?.rewardedCoins || 0);
      setMessage({
        tone: 'success',
        text:
          resolution === 'accepted'
            ? `已采纳，${rewarded} 枚硬币已发放。页面即将刷新。`
            : '已驳回，页面即将刷新。',
      });
      setTimeout(() => router.refresh(), 700);
    } catch {
      setMessage({ tone: 'error', text: '网络异常，裁决未送达，请重试' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="text-label font-medium text-ink">裁决结论</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {RESOLUTIONS.map((item) => {
            const selected = resolution === item.id;
            const Icon = item.Icon;
            return (
              <label key={item.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="feedback-resolution"
                  value={item.id}
                  checked={selected}
                  onChange={() => {
                    setResolution(item.id);
                    setMessage(null);
                  }}
                  className="peer sr-only"
                />
                <span
                  className={`flex h-full flex-col rounded-xl border p-3.5 transition-colors duration-fast peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ring ${
                    selected
                      ? 'border-brand-ring bg-brand-soft'
                      : 'border-line bg-well hover:border-line-strong hover:bg-wash'
                  }`}
                >
                  <span className="flex items-center gap-2 text-body-sm font-semibold text-ink">
                    <Icon className={`size-4 ${selected ? 'text-brand' : 'text-ink-muted'}`} />
                    {item.label}
                  </span>
                  <span className="mt-1.5 text-caption leading-relaxed text-ink-muted">{item.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {resolution === 'accepted' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="feedback-reward-coins" className="text-label font-medium text-ink">
            发放硬币数量
          </label>
          <Input
            id="feedback-reward-coins"
            type="number"
            min="1"
            step="1"
            value={rewardCoins}
            onChange={(event) => setRewardCoins(event.target.value)}
            aria-describedby="feedback-reward-help"
          />
          <p id="feedback-reward-help" className="text-micro text-ink-muted">
            默认值为该类型的建议奖励，可按实际价值调整。
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="feedback-review-note" className="text-label font-medium text-ink">
          审核备注（选填）
        </label>
        <Textarea
          id="feedback-review-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={4}
          placeholder="会展示给提交人，说明采纳原因或驳回理由。"
          aria-describedby="feedback-review-note-count"
        />
        <span id="feedback-review-note-count" className="text-end text-micro text-ink-muted tabular-nums">
          {note.length} / 500
        </span>
      </div>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`text-body-sm ${message.tone === 'error' ? 'text-danger' : 'text-success'}`}
        >
          {message.text}
        </p>
      )}

      <Button type="submit" variant="primary" size="md" loading={busy} disabled={busy}>
        {busy ? '提交裁决…' : '提交裁决'}
      </Button>
    </form>
  );
}
