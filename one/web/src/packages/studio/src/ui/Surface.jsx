"use client";

import { forwardRef } from "react";
import { cn } from "./cn";
import { CARD_BASE, CARD_INTERACTIVE, CARD_SURFACE, STATUS_TONE, withoutRadiusUtilities } from "./tokens";

/**
 * Card. One base, four documented modifiers — do not invent a fifth.
 * `media` removes padding for image-filled cards, `flat` drops the border.
 */
export const Card = forwardRef(function Card(
  { as: As = "div", interactive = false, selected = false, flat = false, media = false, padding = "md", className, ...props },
  ref,
) {
  const paddings = { none: "", sm: "p-3", md: "p-4", lg: "p-6" };
  const pad = media ? "" : (paddings[padding] ?? paddings.md);
  const surface = selected ? CARD_SURFACE.selected : flat ? CARD_SURFACE.flat : CARD_SURFACE.default;
  return (
    <As
      ref={ref}
      data-selected={selected || undefined}
      className={cn(CARD_BASE, surface, pad, interactive && CARD_INTERACTIVE, withoutRadiusUtilities(className))}
      {...props}
    />
  );
});

export function CardHeader({ children, title, description, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="text-card-title text-ink truncate">{title}</h3>
        {description ? <p className="text-body-sm mt-0.5 text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardMedia({ src, alt, ratio = "16/9", className, children }) {
  return (
    <div
        className={cn("relative w-full overflow-hidden rounded-lg bg-well", withoutRadiusUtilities(className))}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        <img src={src} alt={alt || ""} loading="lazy" className="size-full object-cover" />
      ) : (
        children
      )}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-wash text-ink-muted border-line",
  brand: "bg-brand-soft text-brand border-brand-line",
  success: "bg-success-soft text-success border-success-line",
  warning: "bg-warning-soft text-warning border-warning-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  info: "bg-info-soft text-info border-info-line",
  outline: "bg-transparent text-ink-muted border-line",
};

export function Badge({ tone = "neutral", size = "sm", className, children, ...props }) {
  // `tone` accepts a raw recipe as well as a name, so StatusBadge can hand it
  // a STATUS_TONE without two `bg-*` utilities landing in one class string.
  const toneClass = BADGE_TONES[tone] || tone;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-caption" : "px-2 py-0.5 text-label",
        toneClass,
        withoutRadiusUtilities(className),
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Generation lifecycle badge — the seven states every studio must express. */
export function StatusBadge({ status, className, children }) {
  return (
    <Badge tone={STATUS_TONE[status] || STATUS_TONE.queued} className={className}>
      {children || status}
    </Badge>
  );
}

export { BADGE_TONES };
