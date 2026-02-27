"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"

const ResponsivePopoverContext = React.createContext<boolean>(false)

const ResponsivePopover = ({
  ...props
}: React.ComponentProps<typeof Popover>) => {
  const isMobile = useIsMobile()
  const mobile = !!isMobile

  return (
    <ResponsivePopoverContext.Provider value={mobile}>
      {mobile ? (
        <Drawer {...(props as React.ComponentProps<typeof Drawer>)} />
      ) : (
        <Popover {...props} />
      )}
    </ResponsivePopoverContext.Provider>
  )
}
ResponsivePopover.displayName = "ResponsivePopover"

const ResponsivePopoverTrigger = ({
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) => {
  const isMobile = React.useContext(ResponsivePopoverContext)

  if (isMobile) {
    return <DrawerTrigger {...props} />
  }

  return <PopoverTrigger {...props} />
}
ResponsivePopoverTrigger.displayName = "ResponsivePopoverTrigger"

const ResponsivePopoverContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) => {
  const isMobile = React.useContext(ResponsivePopoverContext)

  if (isMobile) {
    return (
      <DrawerContent className={cn(className, "!max-w-none !w-full")} {...(props as React.ComponentProps<typeof DrawerContent>)}>
        <DrawerTitle className="sr-only">Opciones</DrawerTitle>
        <DrawerDescription className="sr-only">Menú de opciones disponibles</DrawerDescription>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    )
  }

  return (
    <PopoverContent className={className} {...props}>
      {children}
    </PopoverContent>
  )
}
ResponsivePopoverContent.displayName = "ResponsivePopoverContent"

export {
  ResponsivePopover,
  ResponsivePopoverTrigger,
  ResponsivePopoverContent,
}
