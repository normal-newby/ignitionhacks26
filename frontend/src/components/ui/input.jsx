import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
    return (
        (<input
            type={type}
            className={cn(
                "flex h-9 w-full border-2 border-[#1e40af] bg-[#e2e8f0] px-3 py-1 text-base shadow-[2px_2px_0px_#1e40af] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#252525]/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6] disabled:cursor-not-allowed disabled:opacity-50 font-mono",
                className
            )}
            ref={ref}
            {...props} />)
    );
})
Input.displayName = "Input"

export { Input }
