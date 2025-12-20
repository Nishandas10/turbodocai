import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Neutral/light default input styles, flat (no shadow) and subtle focus yellow glow
          "flex h-9 w-full rounded-md border border-[#cccccc] bg-white px-3 py-1 text-sm text-gray-900 shadow-none transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F7D978]/20 focus-visible:border-[#F7D978] disabled:cursor-not-allowed disabled:opacity-50",
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