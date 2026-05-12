import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * AntimatterAI shared textarea.
 * Matches Input visually (border, surface, focus state); just multi-line.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "atom-field flex min-h-[88px] w-full rounded-lg border bg-[#14141c] px-3.5 py-2.5",
        "text-sm font-medium text-[#f6f6fd] leading-relaxed resize-none",
        "border-[rgba(199,200,242,0.16)]",
        "placeholder:text-[rgba(246,246,253,0.4)] placeholder:font-normal",
        "transition-[border-color,box-shadow,background-color] duration-150",
        "hover:border-[rgba(133,135,227,0.55)]",
        "focus-visible:outline-none focus-visible:border-[rgba(133,135,227,0.85)]",
        "focus-visible:ring-2 focus-visible:ring-[rgba(105,106,172,0.28)]",
        "focus-visible:shadow-[0_0_0_1px_rgba(133,135,227,0.45),0_0_16px_rgba(105,106,172,0.18)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
