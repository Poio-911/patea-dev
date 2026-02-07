"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const ResponsiveTooltipProvider = ({
  children,
  ...props
}: React.ComponentProps<typeof TooltipProvider>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <>{children}</>
  }

  return <TooltipProvider {...props}>{children}</TooltipProvider>
}
ResponsiveTooltipProvider.displayName = "ResponsiveTooltipProvider"

const ResponsiveTooltip = ({
  ...props
}: React.ComponentProps<typeof Tooltip>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <Popover {...(props as React.ComponentProps<typeof Popover>)} />
  }

  return <Tooltip {...props} />
}
ResponsiveTooltip.displayName = "ResponsiveTooltip"

const ResponsiveTooltipTrigger = ({
  ...props
}: React.ComponentProps<typeof TooltipTrigger>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <PopoverTrigger {...(props as React.ComponentProps<typeof PopoverTrigger>)} />
  }

  return <TooltipTrigger {...props} />
}
ResponsiveTooltipTrigger.displayName = "ResponsiveTooltipTrigger"

const ResponsiveTooltipContent = ({
  className,
  ...props
}: React.ComponentProps<typeof TooltipContent>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <PopoverContent
        className={className ?? "max-w-xs px-3 py-1.5 text-sm"}
        {...(props as React.ComponentProps<typeof PopoverContent>)}
      />
    )
  }

  return <TooltipContent className={className} {...props} />
}
ResponsiveTooltipContent.displayName = "ResponsiveTooltipContent"

export {
  ResponsiveTooltip,
  ResponsiveTooltipTrigger,
  ResponsiveTooltipContent,
  ResponsiveTooltipProvider,
}
