import { cn } from "cn"

function withoutRadiusUtilities(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(":") + 1)))
    .join(" ");
}

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", withoutRadiusUtilities(className))}
      {...props}
    />
  )
}

export { Skeleton }
