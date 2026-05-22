import { cn } from "@/lib/utils"

function Skeleton({
  className,
  shimmer,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { shimmer?: boolean }) {
  return (
    <div
      className={cn(
        shimmer ? "atom-skeleton" : "animate-pulse rounded-md bg-muted",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
