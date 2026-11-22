"use client";

import { forwardRef } from "react";
import { Dialog, DropdownMenu, Popover as RadixPopover, Select as RadixSelect, Tooltip as RadixTooltip } from "radix-ui";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "./cn";
import {
  DIALOG_CLOSE_BUTTON,
  DIALOG_DESCRIPTION,
  DIALOG_FOOTER,
  DIALOG_TITLE,
  FOCUS_RING,
  MENU_ITEM,
  MENU_ITEM_INSET,
  MENU_ITEM_PAD,
  MODAL_PANEL,
  MODAL_PANEL_MOBILE,
  MODAL_SIZE,
  OVERLAY_PANEL,
  SCRIM,
  SHEET_PANEL,
  controlClasses,
  withoutRadiusUtilities,
} from "./tokens";

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

export function Select({ children, ...props }) {
  return <RadixSelect.Root {...props}>{children}</RadixSelect.Root>;
}

export const SelectValue = RadixSelect.Value;

export const SelectTrigger = forwardRef(function SelectTrigger(
  { children, className, size = "md", ...props },
  ref,
) {
  return (
    <RadixSelect.Trigger
      ref={ref}
      className={cn(
        "inline-flex w-full items-center justify-between gap-2 border border-line bg-well text-ink",
        "transition-[background-color,border-color,box-shadow] duration-fast ease-standard",
        "hover:border-line-strong data-[state=open]:border-brand",
        "disabled:cursor-not-allowed disabled:opacity-40",
        FOCUS_RING,
        controlClasses(size, { pad: "px-3" }),
        withoutRadiusUtilities(className),
      )}
      {...props}
    >
      {children ?? <RadixSelect.Value />}
      <RadixSelect.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-ink-subtle" strokeWidth={1.8} />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
});

/**
 * Radix clips an overflowing viewport, so the scroll affordances are part of
 * the recipe rather than an optional extra — a clipped list with no way to
 * reach its tail is a functional failure, not a style variance.
 */
function SelectScrollButton({ direction, ...props }) {
  const Button = direction === "up" ? RadixSelect.ScrollUpButton : RadixSelect.ScrollDownButton;
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <Button
      className="flex h-6 w-full cursor-default items-center justify-center bg-overlay text-ink-subtle"
      {...props}
    >
      <Icon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
    </Button>
  );
}

export function SelectContent({
  children,
  className,
  position = "popper",
  align = "start",
  ...props
}) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position={position}
        align={align}
        className={cn(
          OVERLAY_PANEL,
          "z-dropdown max-h-popover w-full min-w-menu animate-fade-in",
          withoutRadiusUtilities(className),
        )}
        {...props}
      >
        <SelectScrollButton direction="up" />
        <RadixSelect.Viewport className="p-1.5">{children}</RadixSelect.Viewport>
        <SelectScrollButton direction="down" />
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

/**
 * `description` renders a second line under the option. It lives *outside*
 * `ItemText` on purpose: Radix portals the selected item's `ItemText` children
 * into the trigger, so anything placed inside it would also be copied there and
 * turn a one-line trigger into a two-line one. Keep `children` a plain string.
 *
 * `h-control-sm` is dropped rather than overridden when a description is
 * present — `min-h-*` plus `h-*` in one string has no defined winner.
 */
export function SelectItem({
  children,
  description,
  value,
  className,
  ...props
}) {
  return (
    <RadixSelect.Item
      value={value}
      className={cn(
        MENU_ITEM,
        MENU_ITEM_PAD,
        description ? "min-h-control-sm gap-2 py-2" : "h-control-sm gap-2",
        withoutRadiusUtilities(className),
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <RadixSelect.ItemText className="w-full truncate">
          {children}
        </RadixSelect.ItemText>
        {description ? (
          <span className="text-caption w-full font-normal text-ink-subtle">
            {description}
          </span>
        ) : null}
      </span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <RadixSelect.ItemIndicator>
          <Check className="size-3.5 text-brand" strokeWidth={2.2} aria-hidden="true" />
        </RadixSelect.ItemIndicator>
      </span>
    </RadixSelect.Item>
  );
}

export function SelectGroup({ children }) {
  return <RadixSelect.Group>{children}</RadixSelect.Group>;
}

export function SelectLabel({ children, className }) {
  return (
    <RadixSelect.Label
      className={cn("px-2.5 pb-1 pt-2 text-label text-ink-subtle", className)}
    >
      {children}
    </RadixSelect.Label>
  );
}

export function SelectSeparator() {
  return <RadixSelect.Separator className="my-1 h-px bg-line" />;
}

/* ------------------------------------------------------------------ */
/* Dropdown menu                                                       */
/* ------------------------------------------------------------------ */

export const Menu = DropdownMenu.Root;

export const MenuTrigger = DropdownMenu.Trigger;

export const MenuContent = forwardRef(function MenuContent(
  { children, className, align = "start", sideOffset = 6, ...props },
  ref,
) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(OVERLAY_PANEL, "z-popover min-w-menu p-1.5 animate-fade-in", withoutRadiusUtilities(className))}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
});

export function MenuItem({ children, className, inset = false, ...props }) {
  return (
    <DropdownMenu.Item
      className={cn(
        MENU_ITEM,
        "h-control-sm",
        inset ? MENU_ITEM_INSET : MENU_ITEM_PAD,
        withoutRadiusUtilities(className),
      )}
      {...props}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children, className }) {
  return (
    <DropdownMenu.Label className={cn("text-label px-2.5 py-1.5 text-ink-subtle", className)}>
      {children}
    </DropdownMenu.Label>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}

export function MenuGroup({ children }) {
  return <DropdownMenu.Group>{children}</DropdownMenu.Group>;
}

/* ------------------------------------------------------------------ */
/* Popover                                                             */
/* ------------------------------------------------------------------ */

export const PopoverTrigger = RadixPopover.Trigger;

export const PopoverContent = forwardRef(function PopoverContent(
  { children, className, sideOffset = 8, ...props },
  ref,
) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(OVERLAY_PANEL, "z-popover p-3 animate-fade-in", withoutRadiusUtilities(className))}
        {...props}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
});

export const PopoverRoot = RadixPopover.Root;
export const PopoverClose = RadixPopover.Close;
export const PopoverAnchor = RadixPopover.Anchor;

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

/**
 * Provides its own context instead of requiring every shell to mount a
 * Tooltip.Provider: `Tooltip.Root` throws without one, and a primitive that
 * depends on unseen ancestor setup is a primitive that will be misused.
 */
export function Tooltip({ children, content, side = "top" }) {
  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className={cn(
              "z-tooltip rounded-md border border-line bg-overlay px-2 py-1",
              "text-caption text-ink shadow-elevation-2 animate-fade-in",
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-overlay" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Modal / Dialog                                                      */
/* ------------------------------------------------------------------ */

function DialogCloseButton({ onClick }) {
  return (
    <Dialog.Close asChild onClick={onClick}>
      <button type="button" aria-label="Close" className={DIALOG_CLOSE_BUTTON}>
        <X className="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </Dialog.Close>
  );
}

export const Modal = Dialog.Root;

export function ModalContent({
  children,
  title,
  description,
  size = "md",
  className,
  showClose = true,
  ...props
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className={SCRIM} />
      <Dialog.Content
        className={cn(
          MODAL_PANEL,
          MODAL_PANEL_MOBILE,
          MODAL_SIZE[size] || MODAL_SIZE.md,
          withoutRadiusUtilities(className),
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Dialog.Title className={DIALOG_TITLE}>{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className={DIALOG_DESCRIPTION}>
                {description}
              </Dialog.Description>
            ) : null}
          </div>
          {showClose ? <DialogCloseButton /> : null}
        </div>
        <div className="mt-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function ModalFooter({ children, className }) {
  return <div className={cn(DIALOG_FOOTER, className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Drawer (side sheet)                                                 */
/* ------------------------------------------------------------------ */

export const Drawer = Dialog.Root;

export function DrawerContent({
  children,
  title,
  side = "right",
  className,
  onClose,
  onPointerDownOutside,
  onEscapeKeyDown,
  ...props
}) {
  const sides = {
    right:
      "right-0 top-0 h-full w-full sm:w-panel max-w-full border-l rounded-l-2xl rounded-r-none data-[state=open]:animate-drawer-in-right data-[state=closed]:animate-drawer-out-right",
    left:
      "left-0 top-0 h-full w-full sm:w-panel max-w-full border-r rounded-r-2xl rounded-l-none data-[state=open]:animate-drawer-in-left",
    bottom:
      "bottom-0 left-0 w-full max-h-drawer border-t rounded-t-2xl rounded-b-none data-[state=open]:animate-drawer-in-bottom",
  };
  return (
    <Dialog.Portal>
      <Dialog.Overlay className={SCRIM} onClick={onClose} />
      <Dialog.Content
        className={cn(SHEET_PANEL, sides[side] || sides.right, withoutRadiusUtilities(className))}
        onPointerDownOutside={(e) => {
          onClose?.();
          onPointerDownOutside?.(e);
        }}
        onEscapeKeyDown={(e) => {
          onClose?.();
          onEscapeKeyDown?.(e);
        }}
        {...props}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <Dialog.Title className={DIALOG_TITLE}>{title}</Dialog.Title>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
