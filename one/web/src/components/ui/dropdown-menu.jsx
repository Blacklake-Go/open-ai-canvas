import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function withoutRadiusUtilities(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(":") + 1)))
    .join(" ");
}

function DropdownMenu({ ...props }) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({ ...props }) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({ className, sideOffset = 6, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "popover-surface z-dropdown max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-menu overflow-y-auto p-1.5 custom-scrollbar",
          withoutRadiusUtilities(className)
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({ className, variant = "default", ...props }) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-body-sm outline-none bg-transparent",
        "transition-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        "[&_*]:bg-transparent",
        variant === "danger"
          ? "text-danger hover:bg-danger-soft focus:bg-danger-soft data-[highlighted]:bg-danger-soft"
          : "text-ink-muted hover:bg-wash-strong hover:text-ink focus:bg-wash-strong focus:text-ink data-[highlighted]:bg-wash-strong data-[highlighted]:text-ink",
        withoutRadiusUtilities(className)
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1.5 text-caption font-semibold text-ink-subtle", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-line-subtle", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
