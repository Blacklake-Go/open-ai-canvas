import * as React from "react";
import { cn } from "cn";

function withoutRadiusUtilities(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(":") + 1)))
    .join(" ");
}

/**
 * KOYO Studio Standard Textarea Primitive
 */
const Textarea = React.forwardRef(
  ({ className, disabled = false, error = false, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={error || undefined}
        className={cn(
          "w-full bg-well text-ink placeholder:text-ink-subtle border border-line rounded-xl p-3 text-body leading-relaxed resize-y custom-scrollbar transition-[background-color,border-color,box-shadow] duration-fast ease-standard",
          "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand-ring",
          error && "border-danger focus-visible:border-danger focus-visible:ring-danger-ring",
          disabled && "opacity-45 cursor-not-allowed bg-base",
          withoutRadiusUtilities(className)
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
