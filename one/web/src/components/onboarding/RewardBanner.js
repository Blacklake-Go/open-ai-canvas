'use client';

import { Gift, Sparkles } from 'lucide-react';

/**
 * 权益位：把「填完有什么」放在用户第一眼能看到的地方。
 * 文案讲工作室的默认配置与社区氛围，而不是「我们在采集数据」。
 */
export default function RewardBanner({ copy, credits }) {
  return (
    <section
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-warning-line bg-warning-soft px-4 py-4 sm:px-5 sm:py-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-brand-soft blur-2xl"
      />
      <div className="relative flex items-center gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-warning-line bg-surface">
          <Gift className="size-5 text-warning" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label text-warning">{copy.rewardBadge}</p>
          <p className="mt-0.5 text-display font-bold leading-none text-ink">
            +{credits}
            <span className="ml-1.5 text-card-title font-semibold text-ink-muted">{copy.rewardUnit}</span>
          </p>
          <p className="mt-2 text-caption text-ink-muted">{copy.rewardBody}</p>
        </div>
        <Sparkles aria-hidden="true" className="hidden size-5 shrink-0 text-warning sm:block" />
      </div>
      <p className="relative mt-3 border-t border-warning-line pt-2.5 text-micro text-ink-subtle">
        {copy.rewardFootnote}
      </p>
    </section>
  );
}
