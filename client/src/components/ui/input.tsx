import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * AntimatterAI shared text input.
 * – h-10, rounded-lg, lavender outlined border, dark surface
 * – lavender focus ring + subtle glow
 * – placeholder text matches body hierarchy (no oversized text)
 * Override via className when a specific page needs a tweak.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "atom-field flex h-10 w-full rounded-lg border bg-[#14141c] px-3.5 py-2",
          "text-sm font-medium text-[#f6f6fd]",
          "border-[rgba(199,200,242,0.16)]",
          "placeholder:text-[rgba(246,246,253,0.4)] placeholder:font-normal",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
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
  }
)
Input.displayName = "Input"

export { Input }
