"use client";

import { forwardRef, useId } from "react";
import { Switch as RadixSwitch } from "radix-ui";
import { cn } from "./cn";
import { CONTROL_HEIGHT, FOCUS_RING, FIELD_BASE, FIELD_RADIUS, controlClasses, withoutRadiusUtilities } from "./tokens";

/** Fields sit flush against their text, so they pad tighter than buttons. */
const FIELD_PAD = { xs: "px-2", sm: "px-2.5", md: "px-3", lg: "px-3.5" };

export const Input = forwardRef(function Input(
  { size = "md", invalid = false, icon: Icon, className, ...props },
  ref,
) {
  return (
    <div className="relative flex w-full items-center">
      {Icon ? (
        <Icon
          className="pointer-events-none absolute left-3 size-4 text-ink-subtle"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ) : null}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          FIELD_BASE,
          controlClasses(size, { shape: "field", pad: Icon ? "pl-9 pr-3" : FIELD_PAD[size] || FIELD_PAD.md }),
          withoutRadiusUtilities(className),
        )}
        {...props}
      />
    </div>
  );
});

/**
 * A textarea has no height contract — its size is the row count. It still
 * shares FIELD_BASE so border, colour, focus and validation can never drift
 * from `<Input>`.
 */
export const Textarea = forwardRef(function Textarea(
  { invalid = false, rows = 3, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(FIELD_BASE, FIELD_RADIUS, "px-3 py-2 text-body resize-y", withoutRadiusUtilities(className))}
      {...props}
    />
  );
});

export function Label({ children, htmlFor, className, required = false, ...props }) {
  const id = useId();
  const target = htmlFor || id;
  return (
    <label
      htmlFor={target}
      className={cn("text-label block text-ink-muted", className)}
      {...props}
    >
      {children}
      {required ? <span className="ml-1 text-danger">*</span> : null}
    </label>
  );
}

/**
 * Inline validation message. Pair with `<Input invalid>` — never rely on the
 * red border alone to communicate an error.
 */
export function FieldMessage({ tone = "muted", children, className }) {
  if (!children) return null;
  const tones = {
    muted: "text-ink-subtle",
    danger: "text-danger",
    success: "text-success",
  };
  return (
    <p
      role={tone === "danger" ? "alert" : undefined}
      className={cn("text-caption mt-1", tones[tone] || tones.muted, className)}
    >
      {children}
    </p>
  );
}

export { CONTROL_HEIGHT as FIELD_HEIGHTS };

/**
 * Boolean control. Track is 44x24 so it reads as a switch, but the hit area
 * only reaches the touch minimum when a `<Label htmlFor>` is wired to it —
 * pair the two, or pass `label`.
 *
 * Geometry is locked to the 4px grid: `p-1` + `size-4` knob + `translate-x-5`
 * travel = 4 + 16 + 20 + 4 = 44px, so the knob lands flush against the right
 * gutter without an arbitrary offset.
 */
export const Switch = forwardRef(function Switch(
  { checked = false, onCheckedChange, disabled, label, className, ...props },
  ref,
) {
  return (
    <RadixSwitch.Root
      ref={ref}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-1',
        'transition-[background-color,border-color,box-shadow] duration-base ease-standard',
        FOCUS_RING,
        'border-line-subtle bg-white/10 hover:bg-white/15',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:shadow-elevation-brand',
        'disabled:cursor-not-allowed disabled:opacity-40',
        withoutRadiusUtilities(className),
      )}
      {...props}
    >
      <RadixSwitch.Thumb
        className={cn(
          'pointer-events-none block size-4 translate-x-0 rounded-full bg-white shadow-md',
          'transition-transform duration-base ease-standard',
          'data-[state=checked]:translate-x-5',
        )}
      />
    </RadixSwitch.Root>
  );
});
