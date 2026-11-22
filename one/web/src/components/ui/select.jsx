import * as React from "react";
import { cn } from "cn";
import { Select as SelectPrimitive } from "radix-ui";
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react";

function withoutRadiusUtilities(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(":") + 1)))
    .join(" ");
}

function Select({ ...props }) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ className, ...props }) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  );
}

function SelectValue({ ...props }) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

const TRIGGER_SHAPE = {
  soft: "rounded-lg border border-transparent bg-wash-strong hover:border-line hover:bg-wash-press",
  pill: "rounded-full border border-line-subtle bg-well hover:border-line hover:bg-wash",
  field: "rounded-xl border border-line bg-transparent hover:border-line-strong",
};

const TRIGGER_SIZE = {
  sm: "h-control-sm px-2.5 text-label",
  default: "h-control-md px-3 text-body",
  md: "h-control-md px-3 text-body",
  lg: "h-control-lg px-4 text-body",
};

function SelectTrigger({ className, size = "default", shape = "soft", children, ...props }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "group/select flex w-fit items-center justify-between gap-2 text-ink control-focus select-none",
        "transition-[background-color,border-color,color] duration-fast ease-standard",
        "disabled:cursor-not-allowed disabled:opacity-45",
        TRIGGER_SHAPE[shape] || TRIGGER_SHAPE.soft,
        TRIGGER_SIZE[size] || TRIGGER_SIZE.default,
        withoutRadiusUtilities(className)
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-3.5 shrink-0 text-ink-subtle transition-transform duration-product-state ease-standard group-data-[state=open]/select:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, position = "popper", align = "start", ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "popover-surface relative z-dropdown max-h-[var(--radix-select-content-available-height)] min-w-popover overflow-hidden text-ink custom-scrollbar",
          position === "popper" && "translate-y-1",
          withoutRadiusUtilities(className)
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-label font-semibold text-ink-subtle", className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-10 w-full cursor-pointer items-center rounded-md py-2 pr-8 pl-3 text-body-sm outline-none select-none text-ink-muted",
        "transition-none",
        "hover:bg-wash-strong hover:text-ink",
        "focus:bg-wash-strong focus:text-ink data-[state=checked]:bg-wash-press data-[state=checked]:text-ink data-[state=checked]:font-medium",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        withoutRadiusUtilities(className)
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5 text-ink-muted" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-line-subtle", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1 text-ink-subtle", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1 text-ink-subtle", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
