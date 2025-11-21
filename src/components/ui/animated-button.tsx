"use client"

import * as React from "react"
import { motion, HTMLMotionProps } from "framer-motion"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { type VariantProps } from "class-variance-authority"

export interface AnimatedButtonProps
    extends HTMLMotionProps<"button">,
    VariantProps<typeof buttonVariants> {
    enableScale?: boolean
    enableGlow?: boolean
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
    ({ className, variant, size, enableScale = true, enableGlow = false, children, ...props }, ref) => {
        return (
            <motion.button
                ref={ref}
                whileHover={enableScale ? { scale: 1.02 } : undefined}
                whileTap={enableScale ? { scale: 0.95 } : undefined}
                className={cn(
                    buttonVariants({ variant, size, className }),
                    "transition-all duration-200",
                    enableGlow && "hover:shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                )}
                {...props}
            >
                {children}
            </motion.button>
        )
    }
)
AnimatedButton.displayName = "AnimatedButton"

export { AnimatedButton }
