"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import {
  FIELD_RADIUS,
  PILL_SEGMENT_ACTIVE,
  PILL_SEGMENT_IDLE,
  PILL_SEGMENT_TRACK,
  PROMPT_PANEL,
  FOCUS_RING,
  pillControlClasses,
  withoutRadiusUtilities,
} from "../../ui/tokens";
import { Button } from "../../ui/Button";

const DEFAULT_POSITION_CLASS =
  "absolute bottom-4 w-full max-w-[95%] lg:max-w-4xl z-sticky transition-[min-height] duration-expand ease-fluid will-change-[min-height]";

const DEFAULT_PANEL_CLASS = PROMPT_PANEL;

const DEFAULT_TEXTAREA_CLASS =
  `w-full bg-transparent border-none text-ink text-body placeholder:text-ink-subtle focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none shadow-none resize-none pt-1 leading-relaxed min-h-[48px] max-h-composer md:max-h-composer-lg overflow-y-auto custom-scrollbar disabled:opacity-40 rounded-xl transition-[min-height] duration-expand ease-fluid`;

const CONTROL_LAYOUT_CLASS =
  "h-control-md flex items-center gap-2 rounded-lg transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-press border group whitespace-nowrap control-focus select-none text-label font-medium";

const CONTROL_IDLE_CLASS =
  "text-ink-muted bg-wash hover:bg-wash-strong hover:text-ink border-line";

const CONTROL_ACTIVE_CLASS =
  "text-ink bg-brand-soft hover:bg-brand-pressed border-brand-line";

const MEDIA_CONTROL_LAYOUT_CLASS =
  "size-control-md shrink-0 rounded-lg border transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.96] active:duration-press flex items-center justify-center relative overflow-hidden group control-focus";

const DEFAULT_POPOVER_POSITION_CLASS =
  "absolute bottom-[calc(100%+10px)] left-0 z-popover";

const DEFAULT_POPOVER_CLASS =
  "popover-surface p-2 min-w-popover max-h-popover overflow-y-auto custom-scrollbar animate-popover-in";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function promptControlClassName({
  active = false,
  compact = false,
  iconOnly = false,
  className = "",
} = {}) {
  return joinClasses(
    CONTROL_LAYOUT_CLASS,
    iconOnly
      ? "w-control-md px-0 justify-center"
      : compact
        ? "px-2"
        : "px-3",
    active ? CONTROL_ACTIVE_CLASS : CONTROL_IDLE_CLASS,
    withoutRadiusUtilities(className),
  );
}

export function promptMediaButtonClassName({
  active = false,
  className = "",
} = {}) {
  return joinClasses(
    MEDIA_CONTROL_LAYOUT_CLASS,
    active
      ? "border-brand-line bg-brand-soft text-brand"
      : "border-line bg-wash text-ink-muted hover:text-ink hover:bg-wash-strong hover:border-line-strong",
    withoutRadiusUtilities(className),
  );
}

export const PROMPT_MEDIA_PREVIEW_CLASS =
  "relative size-control-md shrink-0 rounded-xl border border-line overflow-hidden shadow-elevation-1 group";

export const PROMPT_CONTROL_LABEL_CLASS =
  "text-label font-medium text-current opacity-80 group-hover:opacity-100 transition-opacity";

export function PromptChevronIcon({ className = "" }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={joinClasses(
        "text-current opacity-50 group-hover:opacity-100 flex-shrink-0 transition-opacity",
        className,
      )}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PromptAspectRatioIcon({ className = "" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={joinClasses("text-current opacity-60 flex-shrink-0", className)}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  );
}

export function PromptDurationIcon({ className = "" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={joinClasses("text-current opacity-60 flex-shrink-0", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function PromptQualityIcon({ className = "" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={joinClasses("text-current opacity-60 flex-shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M6.5 3.5h11L22 9 12 21 2 9l4.5-5.5Z" />
      <path d="M2 9h20" />
      <path d="m6.5 3.5 3 5.5L12 21" />
      <path d="m17.5 3.5-3 5.5L12 21" />
    </svg>
  );
}

export const PromptPopover = forwardRef(function PromptPopover(
  {
    children,
    className = "",
    positionClassName = DEFAULT_POPOVER_POSITION_CLASS,
    fitViewport = false,
    solid = false,
    glass = false,
    ...props
  },
  ref,
) {
  const popoverRef = useRef(null);
  useImperativeHandle(ref, () => popoverRef.current);
  useLayoutEffect(() => {
    if (!fitViewport) return;
    const position = () => {
      const popover = popoverRef.current;
      if (!popover) return;
      popover.style.translate = "";
      popover.style.height = "";
      let left = 16;
      let right = window.innerWidth - 16;
      let top = 16;
      for (let parent = popover.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const clipsX = /auto|scroll|hidden|clip/.test(style.overflowX);
        const clipsY = /auto|scroll|hidden|clip/.test(style.overflowY);
        if (!clipsX && !clipsY) continue;
        const bounds = parent.getBoundingClientRect();
        if (clipsX) {
          left = Math.max(left, bounds.left + 16);
          right = Math.min(right, bounds.right - 16);
        }
        if (clipsY) top = Math.max(top, bounds.top + 16);
      }
      const bounds = popover.getBoundingClientRect();
      const shift = Math.max(left - bounds.left, Math.min(0, right - bounds.right));
      popover.style.translate = `${shift}px 0`;
      if (bounds.top < top) popover.style.height = `${Math.max(0, bounds.bottom - top)}px`;
    };
    position();
    const popover = popoverRef.current;
    if (popover) popover.addEventListener("toggle", position, true);
    window.addEventListener("resize", position);
    return () => {
      if (popover) popover.removeEventListener("toggle", position, true);
      window.removeEventListener("resize", position);
    };
  }, [fitViewport, children]);
  return (
    <div
      {...props}
      ref={popoverRef}
      className={joinClasses(
        positionClassName,
        DEFAULT_POPOVER_CLASS,
        solid ? "bg-surface-raised" : glass ? "glass-popover" : "bg-overlay-glass backdrop-blur-md",
        withoutRadiusUtilities(className),
      )}
    >
      {children}
    </div>
  );
});

export function PromptPopoverHeader({ children, className = "" }) {
  return (
    <div
      className={joinClasses(
        "text-caption font-semibold text-ink-subtle uppercase tracking-wide pb-2 border-b border-line-subtle mb-1.5 px-1",
        withoutRadiusUtilities(className),
      )}
    >
      {children}
    </div>
  );
}

export function PromptMenuList({ children, className = "" }) {
  return (
    <div role="menu" className={joinClasses("flex flex-col gap-0.5", className)}>
      {children}
    </div>
  );
}

export function PromptMenuItem({
  children,
  description,
  wrapDescription = false,
  selected = false,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      aria-checked={selected}
      role="menuitemradio"
      className={joinClasses(
        "w-full min-h-10 flex items-center justify-between gap-3 px-3 py-2 rounded-md text-left cursor-pointer transition-none group/menu-item select-none",
        selected
          ? "bg-wash-press text-ink font-medium"
          : "text-ink-muted hover:bg-wash-strong hover:text-ink focus:bg-wash-strong focus:text-ink",
        "control-focus",
        withoutRadiusUtilities(className),
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-label">{children}</span>
        {description && (
          <span className={joinClasses(
            "block mt-0.5",
            wrapDescription
              ? "text-micro leading-relaxed whitespace-normal text-ink-subtle group-hover/menu-item:text-ink-muted"
              : "text-micro text-ink-subtle truncate group-hover/menu-item:text-ink-muted",
          )}>
            {description}
          </span>
        )}
      </span>
      {selected && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="flex-shrink-0 text-ink-muted"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

export function PromptSegmentedControl({ children, className = "" }) {
  return (
    <div
      className={joinClasses(
        PILL_SEGMENT_TRACK,
        withoutRadiusUtilities(className),
      )}
    >
      {children}
    </div>
  );
}

export function PromptSegmentOption({
  children,
  selected = false,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={selected}
      className={joinClasses(
        "font-medium transition-[background-color,color,box-shadow,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant flex items-center justify-center gap-1.5 select-none",
        FOCUS_RING,
        selected
          ? `${PILL_SEGMENT_ACTIVE} font-semibold`
          : PILL_SEGMENT_IDLE,
        pillControlClasses("xs", { pad: "px-2.5", text: "text-label" }),
        withoutRadiusUtilities(className),
      )}
    >
      {children}
    </button>
  );
}

export const PromptComposer = forwardRef(function PromptComposer({
  children,
  className = "",
  panelClassName = "",
  positionClassName = DEFAULT_POSITION_CLASS,
  style = { animationDelay: "0.15s" },
  expanded = false,
  flush = false,
  minHeightClassName = "min-h-[70px] focus-within:min-h-[184px]",
}, ref) {
  return (
    <div ref={ref} className={joinClasses(positionClassName, className)} style={style}>
      <div
        className={joinClasses(
          flush
            ? "w-full prompt-composer-spatial backdrop-blur-xl rounded-composer flex flex-col gap-0 p-0"
            : DEFAULT_PANEL_CLASS,
          minHeightClassName,
          "transition-[min-height] duration-expand ease-fluid",
          expanded ? "min-h-[184px]" : "",
          withoutRadiusUtilities(panelClassName),
        )}
      >
        {children}
      </div>
    </div>
  );
});

export const PromptTextarea = forwardRef(function PromptTextarea(
  {
    value,
    onChange,
    onInput,
    className = "",
    maxHeightMobile = 150,
    maxHeightDesktop = 250,
    rows = 1,
    ...props
  },
  forwardedRef,
) {
  const internalRef = useRef(null);

  useImperativeHandle(forwardedRef, () => internalRef.current);

  const resize = useCallback(
    (element = internalRef.current) => {
      if (!element) return;

      element.style.height = "auto";
      const maxHeight =
        window.innerWidth < 768 ? maxHeightMobile : maxHeightDesktop;
      element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    },
    [maxHeightDesktop, maxHeightMobile],
  );

  useEffect(() => {
    resize();
  }, [resize, value]);

  const handleChange = (event) => {
    onChange?.(event);
    resize(event.currentTarget);
  };

  const handleInput = (event) => {
    onInput?.(event);
    resize(event.currentTarget);
  };

  return (
    <textarea
      {...props}
      ref={internalRef}
      value={value}
      onChange={handleChange}
      onInput={handleInput}
      rows={rows}
      className={joinClasses(DEFAULT_TEXTAREA_CLASS, withoutRadiusUtilities(className))}
    />
  );
});

export function PromptFooter({ children, className = "", bordered = true }) {
  return (
    <div
      className={joinClasses(
        bordered
          ? "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-line-subtle relative"
          : "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const PromptControls = forwardRef(function PromptControls(
  { children, className = "" },
  ref,
) {
  return (
    <div
      ref={ref}
      className={joinClasses(
        "flex items-center gap-2 relative flex-wrap pb-0.5 sm:pb-0",
        className,
      )}
    >
      {children}
    </div>
  );
});

export const PromptAction = forwardRef(function PromptAction(
  {
    children,
    className = "",
    type = "button",
    shape = "control",
    circular = false,
    size = "lg",
    ...props
  },
  ref,
) {
  return (
    <Button
      ref={ref}
      type={type}
      variant="primary"
      size={size}
      shape={circular ? "pill" : shape}
      className={joinClasses(
        circular
          ? "size-control-lg !p-0 rounded-full shrink-0 flex items-center justify-center hover:scale-105 active:scale-95"
          : "w-full sm:w-auto",
        withoutRadiusUtilities(className),
      )}
      {...props}
    >
      {children}
    </Button>
  );
});
