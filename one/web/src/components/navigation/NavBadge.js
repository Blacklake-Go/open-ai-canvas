import React from 'react';
import { withoutRadiusUtilities } from 'studio/ui/tokens';

/**
 * 导航与模型专属高亮角标组件 (严格遵循 UI_DESIGN_SYSTEM.md 规范)
 */
export default function NavBadge({ badge, className = '' }) {
  if (!badge) return null;

  const b = String(badge).toUpperCase();

  let colorStyle = 'bg-wash-strong text-ink-muted border-line';

  if (b === 'TOP') {
    colorStyle = 'bg-brand text-ink-on-accent font-bold';
  } else if (b === 'NEW') {
    colorStyle = 'bg-brand-soft text-brand-text border border-brand-line font-bold';
  } else if (b === 'HOT') {
    colorStyle = 'bg-brand text-ink-on-accent font-bold';
  } else if (b === 'FREE') {
    colorStyle = 'bg-brand-soft text-brand-text border border-brand-line font-bold';
  } else if (b === 'SOON') {
    colorStyle = 'bg-wash-strong text-ink-subtle border border-line-subtle font-medium';
  } else if (b === 'BETA') {
    colorStyle = 'bg-brand-soft text-brand-text border border-brand-line font-bold';
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-micro font-bold font-jost uppercase tracking-wider select-none ${colorStyle} ${withoutRadiusUtilities(className)}`}
      aria-label={`Tag: ${b}`}
    >
      {b}
    </span>
  );
}
