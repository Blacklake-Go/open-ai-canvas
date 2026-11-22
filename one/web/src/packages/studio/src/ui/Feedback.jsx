"use client";

import { forwardRef } from "react";
import { Toaster } from "react-hot-toast";
import { cn } from "./cn";

/**
 * Loading, placeholder, status-message and empty-state primitives.
 *
 * Every one of these is decorative: none of them may ever be the only
 * carrier of meaning, so each accepts an accessible label.
 */

const SPINNER_SIZE = {
  xs: "size-3 border",
  sm: "size-3.5 border-2",
  md: "size-4 border-2",
  lg: "size-5 border-2",
};

export function Spinner({ size = "md", className, label = "Loading" }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center justify-center", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "animate-spin rounded-full border-brand-line border-t-brand",
          SPINNER_SIZE[size] || SPINNER_SIZE.md,
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export const Skeleton = forwardRef(function Skeleton({ className, ...props }, ref) {
  return (
    <span ref={ref} aria-hidden="true" className={cn("skeleton block rounded-md", className)} {...props} />
  );
});

const BAR_HEIGHT = {
  xs: "h-1",
  sm: "h-1.5",
  md: "h-2",
};

export function Progress({
  value = 0,
  size = "md",
  label,
  showValue = false,
  tone = "brand",
  className,
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const fills = {
    brand: "bg-brand",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  };
  return (
    <div className={cn("w-full", className)}>
      {label || showValue ? (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-label text-ink-muted">
          <span className="truncate">{label}</span>
          {showValue ? <span className="text-mono shrink-0">{pct}%</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
        className={cn("w-full overflow-hidden rounded-full bg-wash", BAR_HEIGHT[size] || BAR_HEIGHT.md)}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-base ease-standard", fills[tone] || fills.brand)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const ALERT_TONES = {
  info: "bg-info-soft border-info-line text-ink",
  success: "bg-success-soft border-success-line text-ink",
  warning: "bg-warning-soft border-warning-line text-ink",
  danger: "bg-danger-soft border-danger-line text-ink",
};

const ALERT_ICON_TONES = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function Alert({ tone = "info", icon, title, children, action, className, ...props }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3",
        ALERT_TONES[tone] || ALERT_TONES.info,
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className={cn("mt-0.5 shrink-0", ALERT_ICON_TONES[tone])}>{icon}</span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="text-body-sm font-medium text-ink">{title}</p> : null}
        {children ? <div className="text-body-sm mt-0.5 text-ink-muted">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Empty state. PART 22 requires an action, never decoration alone:
 * pass `action` and keep `description` a next step, not a shrug.
 *
 * `size="lg"` is for a studio canvas — the whole right pane is empty, so a
 * 14px line reads as a bug rather than an invitation. `compact` stays the
 * dense inline variant for a panel with no results.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
  compact = false,
}) {
  const iconTile = {
    md: "size-10 rounded-lg",
    lg: "size-12 rounded-lg",
  };
  const titleClass = {
    md: "text-body font-medium text-ink",
    lg: "text-card-title text-ink",
  };
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        compact ? "gap-2 py-6" : size === "lg" ? "gap-4 py-16" : "gap-3 py-12",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex items-center justify-center bg-wash text-ink-subtle",
            iconTile[size] || iconTile.md,
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className={titleClass[size] || titleClass.md}>{title}</p>
        {description ? (
          <p className="text-body-sm mx-auto max-w-md text-ink-subtle">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/**
 * The single toast host. react-hot-toast is styled through an inline style
 * object, so every studio that mounted its own `<Toaster>` re-declared the
 * same hex palette and the same oversized `zIndex`. Both now resolve from the
 * token layer, so a toast can no longer drift away from the dialog it sits
 * above — the z ladder is fixed by tokens.
 */
const TOAST_STYLE = {
  background: 'var(--bg-overlay)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-elevation-4)',
  fontSize: 'var(--text-body-sm)',
  maxWidth: 'var(--toast-w)',
  padding: 'var(--space-3) var(--space-4)',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
};

export function ToastHost({ position = 'top-right', duration = 5000, containerStyle, toastOptions = {}, ...props }) {
  const { success, error, duration: optionDuration, ...sharedOptions } = toastOptions;
  return (
    <Toaster
      {...props}
      position={position}
      containerStyle={{ ...containerStyle, zIndex: 'var(--z-toast)' }}
      toastOptions={{
        ...sharedOptions,
        duration: optionDuration ?? duration,
        style: TOAST_STYLE,
        success: { ...success, style: { ...TOAST_STYLE, border: '1px solid var(--success-line)' } },
        error: { ...error, style: { ...TOAST_STYLE, border: '1px solid var(--danger-line)' } },
      }}
    />
  );
}
