import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap border-2 border-black text-sm font-mono font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    {
        variants: {
            variant: {
                default:
                    "bg-[#D4A76A] text-black shadow-[2px_2px_0px_#000] hover:bg-[#B98A5E] hover:text-[#F5E6C8]",
                destructive:
                    "bg-[#9B4F3A] text-[#F5E6C8] shadow-[2px_2px_0px_#000] hover:bg-[#7A3D2D] hover:text-[#F5E6C8]",
                outline:
                    "bg-transparent shadow-sm hover:bg-[#F5E6C8] hover:text-black",
                secondary:
                    "bg-[#7C8B6F] text-[#F5E6C8] shadow-[2px_2px_0px_#000] hover:bg-[#6A7A5E] hover:text-[#F5E6C8]",
                ghost: "hover:bg-[#F5E6C8] hover:text-black",
                link: "text-[#B98A5E] underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2",
                sm: "h-7 px-3 text-xs",
                lg: "h-10 px-8",
                icon: "h-9 w-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
        (<Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props} />)
    );
})
Button.displayName = "Button"

export { Button, buttonVariants }
