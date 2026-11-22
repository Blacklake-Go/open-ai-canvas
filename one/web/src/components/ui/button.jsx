import * as React from "react";
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "cn";

/**
 * KOYO Studio Standard Button Primitive
 * Variants: primary, secondary, ghost, outline, danger
 * Sizes: sm (32px), md (38px), lg (44px), icon-sm (32px), icon-md (38px), icon-lg (44px)
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center font-medium whitespace-nowrap select-none control-focus",
    "transition-[background-color,border-color,color,transform] duration-fast ease-standard",
    "disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed",
    "aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-ink-on-accent font-semibold border border-transparent hover:bg-brand-hover-solid active:bg-brand-active-solid",
        secondary:
          "bg-raised text-ink border border-line hover:bg-overlay hover:border-line-strong active:bg-wash-press active:border-line-strong",
        ghost:
          "bg-transparent text-ink-muted border border-transparent hover:bg-wash hover:text-ink active:bg-wash-press",
        tertiary:
          "bg-transparent text-ink-muted border border-transparent hover:bg-wash hover:text-ink active:bg-wash-press",
        outline:
          "bg-transparent text-ink border border-line hover:bg-wash hover:border-line-strong active:bg-wash-press",
        danger:
          "bg-danger-soft text-danger border border-danger-line hover:bg-danger-hover hover:border-danger active:bg-danger-pressed",
        default:
          "bg-raised text-ink border border-line hover:bg-overlay hover:border-line-strong active:bg-wash-press active:border-line-strong",
        destructive:
          "bg-danger-soft text-danger border border-danger-line hover:bg-danger-hover hover:border-danger active:bg-danger-pressed",
        link: "text-brand-text underline-offset-4 hover:underline border border-transparent active:scale-100",
      },
      size: {
        xs: "h-control-xs px-2.5 text-caption gap-1.5 [&_svg]:size-3.5 active:scale-[0.98] active:duration-press",
        sm: "h-control-sm px-3 text-label gap-1.5 [&_svg]:size-3.5 active:scale-[0.98] active:duration-press",
        md: "h-control-md px-3.5 text-body gap-2 [&_svg]:size-4 active:scale-[0.98] active:duration-press",
        lg: "h-control-lg px-4 text-body gap-2 [&_svg]:size-4 active:scale-[0.98] active:duration-press",
        default: "h-control-md px-3.5 text-body gap-2 [&_svg]:size-4 active:scale-[0.98] active:duration-press",
        icon: "size-control-md p-0 active:scale-[0.96] active:duration-press",
        "icon-xs": "size-control-xs p-0 active:scale-[0.96] active:duration-press",
        "icon-sm": "size-control-sm p-0 active:scale-[0.96] active:duration-press",
        "icon-md": "size-control-md p-0 active:scale-[0.96] active:duration-press",
        "icon-lg": "size-control-lg p-0 active:scale-[0.96] active:duration-press",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

const SIZE_RADIUS = {
  xs: "rounded-md",
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-lg",
  default: "rounded-lg",
  icon: "rounded-lg",
  "icon-xs": "rounded-md",
  "icon-sm": "rounded-md",
  "icon-md": "rounded-lg",
  "icon-lg": "rounded-lg",
};

function withoutRadiusUtilities(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(":") + 1)))
    .join(" ");
}

const Button = React.forwardRef(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      shape = "control",
      as: As = "button",
      asChild = false,
      loading = false,
      disabled = false,
      fullWidth = false,
      children,
      type = "button",
      tabIndex,
      ...props
    },
    ref
  ) => {
    const variantAliases = { default: "secondary", destructive: "danger", link: "tertiary" };
    const sizeAliases = { default: "md", icon: "icon-md" };
    const supportedVariants = ["primary", "secondary", "ghost", "tertiary", "outline", "danger"];
    const resolvedVariant = variantAliases[variant] || (supportedVariants.includes(variant) ? variant : "secondary");
    const resolvedSize = sizeAliases[size] || size;
    const Component = asChild ? Slot.Root : As;
    const isDisabled = disabled || loading;

    return (
      <Component
        ref={ref}
        type={Component === "button" ? type : undefined}
        disabled={Component === "button" ? isDisabled : undefined}
        aria-disabled={Component === Slot.Root && isDisabled ? true : undefined}
        aria-busy={loading || undefined}
        tabIndex={Component === Slot.Root && isDisabled ? -1 : tabIndex}
        className={cn(
          buttonVariants({
            variant: resolvedVariant,
            size: resolvedSize,
            className: withoutRadiusUtilities(className),
          }),
          shape === "pill" ? "rounded-full" : SIZE_RADIUS[resolvedSize] || SIZE_RADIUS.md,
          fullWidth && "w-full",
          loading && "cursor-progress",
          isDisabled && Component === Slot.Root && "pointer-events-none cursor-not-allowed opacity-45",
        )}
        {...props}
      >
        {asChild ? children : loading ? (
          <>
            <svg
              className="animate-spin -ml-0.5 mr-1.5 h-4 w-4 text-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Component>
    );
  }
);
Button.displayName = "Button";

/**
 * KOYO Studio Accessible Icon-Only Button
 * Enforces minimum 28px/32px/38px/44px touch targets and square geometry.
 * Complies with WCAG 2.5.3 (label or aria-label required).
 * Active press state: active:scale-[0.96] (80ms press-duration mechanical feedback).
 */
const IconButton = React.forwardRef(
  (
    {
      icon: Icon,
      variant = "ghost",
      size = "md",
      shape = "control",
      label,
      "aria-label": ariaLabel,
      className,
      disabled = false,
      loading = false,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const accessibleLabel = label || ariaLabel;
    if (!accessibleLabel && process.env.NODE_ENV !== "production") {
      console.warn("[IconButton] `label` or `aria-label` is required for accessibility (WCAG 2.5.3).");
    }

    const sizeMap = {
      xs: "icon-xs",
      sm: "icon-sm",
      md: "icon-md",
      lg: "icon-lg",
      icon: "icon-md",
      "icon-xs": "icon-xs",
      "icon-sm": "icon-sm",
      "icon-md": "icon-md",
      "icon-lg": "icon-lg",
    };
    const resolvedSize = sizeMap[size] || "icon-md";

    return (
      <Button
        ref={ref}
        type={type}
        variant={variant}
        size={resolvedSize}
        shape={shape}
        disabled={disabled}
        loading={loading}
        aria-label={accessibleLabel}
        className={cn(
          "pointer-events-auto",
          resolvedSize === "icon-xs" || resolvedSize === "icon-sm"
            ? "[&_svg]:size-3.5"
            : "[&_svg]:size-4",
          className
        )}
        {...props}
      >
        {Icon ? (
          <Icon
            className={resolvedSize === "icon-xs" || resolvedSize === "icon-sm" ? "size-3.5" : "size-4"}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        ) : children}
      </Button>
    );
  }
);
IconButton.displayName = "IconButton";

export { Button, IconButton, buttonVariants, withoutRadiusUtilities };
export default Button;
