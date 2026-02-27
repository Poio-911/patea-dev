"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

// Context to share isMobile from Root to all children
const ResponsiveDropdownMenuContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
})

const useResponsiveDropdownMenuContext = () =>
  React.useContext(ResponsiveDropdownMenuContext)

// Root: Drawer on mobile, DropdownMenu on desktop
const ResponsiveDropdownMenu = ({
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu>) => {
  const isMobile = useIsMobile()

  return (
    <ResponsiveDropdownMenuContext.Provider value={{ isMobile }}>
      {isMobile ? (
        <Drawer {...(props as React.ComponentProps<typeof Drawer>)}>
          {children}
        </Drawer>
      ) : (
        <DropdownMenu {...props}>{children}</DropdownMenu>
      )}
    </ResponsiveDropdownMenuContext.Provider>
  )
}
ResponsiveDropdownMenu.displayName = "ResponsiveDropdownMenu"

// Trigger: DrawerTrigger on mobile, DropdownMenuTrigger on desktop
const ResponsiveDropdownMenuTrigger = ({
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) => {
  const { isMobile } = useResponsiveDropdownMenuContext()

  if (isMobile) {
    return <DrawerTrigger {...(props as React.ComponentProps<typeof DrawerTrigger>)} />
  }

  return <DropdownMenuTrigger {...props} />
}
ResponsiveDropdownMenuTrigger.displayName = "ResponsiveDropdownMenuTrigger"

// Content: DrawerContent on mobile, DropdownMenuContent on desktop
const ResponsiveDropdownMenuContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) => {
  const { isMobile } = useResponsiveDropdownMenuContext()

  if (isMobile) {
    return (
      <DrawerContent>
        <div className={cn("overflow-y-auto px-2 pb-4", className)}>
          {children}
        </div>
      </DrawerContent>
    )
  }

  return (
    <DropdownMenuContent className={className} {...props}>
      {children}
    </DropdownMenuContent>
  )
}
ResponsiveDropdownMenuContent.displayName = "ResponsiveDropdownMenuContent"

// MenuItem: touch-friendly button in mobile, DropdownMenuItem on desktop
// disableAutoClose=true: drawer stays open after tap (for items that open a sub-dialog)
// disableAutoClose=false (default): drawer closes automatically via DrawerClose
type ResponsiveDropdownMenuItemProps = Omit<
  React.ComponentProps<typeof DropdownMenuItem>,
  "onSelect" | "onClick"
> & {
  disableAutoClose?: boolean
  onSelect?: (event: Event) => void
  onClick?: React.MouseEventHandler<HTMLElement>
}

const ResponsiveDropdownMenuItem = ({
  className,
  children,
  disableAutoClose = false,
  onClick,
  onSelect,
  disabled,
  inset,
  ...props
}: ResponsiveDropdownMenuItemProps) => {
  const { isMobile } = useResponsiveDropdownMenuContext()

  if (isMobile) {
    const button = (
      <button
        className={cn(
          "flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted rounded-lg text-left",
          disabled && "opacity-50 pointer-events-none",
          className
        )}
        onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
        disabled={disabled}
      >
        {children}
      </button>
    )

    if (disableAutoClose) {
      return button
    }

    return <DrawerClose asChild>{button}</DrawerClose>
  }

  return (
    <DropdownMenuItem
      className={className}
      onSelect={onSelect}
      onClick={onClick as React.MouseEventHandler<HTMLDivElement>}
      disabled={disabled}
      inset={inset}
      {...props}
    >
      {children}
    </DropdownMenuItem>
  )
}
ResponsiveDropdownMenuItem.displayName = "ResponsiveDropdownMenuItem"

// Separator: simple div on mobile, DropdownMenuSeparator on desktop
const ResponsiveDropdownMenuSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) => {
  const { isMobile } = useResponsiveDropdownMenuContext()

  if (isMobile) {
    return (
      <div
        className={cn("-mx-1 my-1 h-px bg-muted", className)}
        role="separator"
      />
    )
  }

  return <DropdownMenuSeparator className={className} {...props} />
}
ResponsiveDropdownMenuSeparator.displayName = "ResponsiveDropdownMenuSeparator"

// Label: DrawerHeader+DrawerTitle on mobile, DropdownMenuLabel on desktop
const ResponsiveDropdownMenuLabel = ({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuLabel>) => {
  const { isMobile } = useResponsiveDropdownMenuContext()

  if (isMobile) {
    return (
      <DrawerHeader className={cn("text-left pb-2", className)}>
        <DrawerTitle className="text-base">{children}</DrawerTitle>
      </DrawerHeader>
    )
  }

  return (
    <DropdownMenuLabel className={className} inset={inset} {...props}>
      {children}
    </DropdownMenuLabel>
  )
}
ResponsiveDropdownMenuLabel.displayName = "ResponsiveDropdownMenuLabel"

export {
  ResponsiveDropdownMenu,
  ResponsiveDropdownMenuTrigger,
  ResponsiveDropdownMenuContent,
  ResponsiveDropdownMenuItem,
  ResponsiveDropdownMenuSeparator,
  ResponsiveDropdownMenuLabel,
}
