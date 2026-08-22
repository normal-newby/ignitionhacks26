import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
    return (
        (<input
            type={type}
            className={cn(
                "flex h-9 w-full border-2 border-black bg-[#F5E6C8] px-3 py-1 text-base shadow-[2px_2px_0px_#000] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-black/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B98A5E] disabled:cursor-not-allowed disabled:opacity-50 font-mono",
                className
            )}
            ref={ref}
            {...props} />)
    );
})
Input.displayName = "Input"

export { Input }
