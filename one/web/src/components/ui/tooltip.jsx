import * as React from "react"
import { cn } from "cn"
import { Tooltip as TooltipPrimitive } from "radix-ui"

function withoutRadiusUtilities(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(":") + 1)))
    .join(" ");
}

function TooltipProvider({
  delayDuration = 350,
  ...props
}) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "tooltip-surface z-tooltip inline-flex w-fit max-w-xs origin-[var(--radix-tooltip-content-transform-origin)] items-center gap-1.5 select-none pointer-events-none",
          "rounded-md border border-line-subtle bg-overlay px-2.5 py-1 text-caption font-medium text-ink shadow-elevation-2",
          "has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:rounded-xs",
          withoutRadiusUtilities(className)
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-tooltip size-2 translate-y-[calc(-50%_-_1px)] rotate-45 rounded-xs bg-overlay fill-overlay" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
