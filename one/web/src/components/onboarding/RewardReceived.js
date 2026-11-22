'use client';

import { ArrowRight, BadgeCheck, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 交卷后的权益落账页：先让用户看到积分真的到账，再放行进工作室。 */
export default function RewardReceived({ copy, credits, onEnter }) {
  return (
    <section className="rounded-2xl border border-warning-line bg-surface p-6 text-center shadow-elevation-3 sm:p-10">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-warning-line bg-warning-soft">
        <Gift className="size-7 text-warning" aria-hidden="true" />
      </span>

      <h1 className="mt-5 text-page-title">{copy.rewardReceivedTitle}</h1>
      <p className="mt-1.5 text-body-sm text-ink-muted">{copy.rewardReceivedBody}</p>

      <p className="mt-6 text-display font-bold leading-none text-warning">
        +{credits}
        <span className="ml-2 text-card-title font-semibold text-ink-muted">{copy.rewardUnit}</span>
      </p>

      <p className="mx-auto mt-6 flex items-center justify-center gap-2 rounded-xl border border-line-subtle bg-well px-3 py-2.5 text-caption text-ink-muted">
        <BadgeCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />
        <span>{copy.rewardReceivedHint}</span>
      </p>

      <div className="mt-7 flex justify-center">
        <Button variant="primary" size="lg" onClick={onEnter}>
          <span>{copy.finish}</span>
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
