"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

// NEW: Context to share the isMobile state from the Root to all children
const ResponsiveAlertDialogContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
})

const useResponsiveAlertDialogContext = () => {
  const context = React.useContext(ResponsiveAlertDialogContext)
  // We don't throw an error here to allow loose usage if strictly necessary, 
  // but logically it should be used within the Root.
  return context
}

const ResponsiveAlertDialog = ({
  children,
  ...props
}: React.ComponentProps<typeof AlertDialog>) => {
  const isMobile = useIsMobile()

  return (
    <ResponsiveAlertDialogContext.Provider value={{ isMobile }}>
      {isMobile ? (
        <Drawer {...props}>{children}</Drawer>
      ) : (
        <AlertDialog {...props}>{children}</AlertDialog>
      )}
    </ResponsiveAlertDialogContext.Provider>
  )
}
ResponsiveAlertDialog.displayName = "ResponsiveAlertDialog"

const ResponsiveAlertDialogTrigger = ({
  ...props
}: React.ComponentProps<typeof AlertDialogTrigger>) => {
  const { isMobile } = useResponsiveAlertDialogContext()

  if (isMobile) {
    return <DrawerTrigger {...props} />
  }

  return <AlertDialogTrigger {...props} />
}
ResponsiveAlertDialogTrigger.displayName = "ResponsiveAlertDialogTrigger"

const ResponsiveAlertDialogContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogContent>) => {
  const { isMobile } = useResponsiveAlertDialogContext()

  if (isMobile) {
    return (
      <DrawerContent className={className} {...(props as React.ComponentProps<typeof DrawerContent>)}>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    )
  }

  return (
    <AlertDialogContent className={className} {...props}>
      {children}
    </AlertDialogContent>
  )
}
ResponsiveAlertDialogContent.displayName = "ResponsiveAlertDialogContent"

const ResponsiveAlertDialogHeader = ({
  ...props
}: React.ComponentProps<typeof AlertDialogHeader>) => {
  const { isMobile } = useResponsiveAlertDialogContext()

  if (isMobile) {
    return <DrawerHeader {...props} />
  }

  return <AlertDialogHeader {...props} />
}
ResponsiveAlertDialogHeader.displayName = "ResponsiveAlertDialogHeader"

const ResponsiveAlertDialogFooter = ({
  ...props
}: React.ComponentProps<typeof AlertDialogFooter>) => {
  const { isMobile } = useResponsiveAlertDialogContext()

  if (isMobile) {
    return <DrawerFooter {...props} />
  }

  return <AlertDialogFooter {...props} />
}
ResponsiveAlertDialogFooter.displayName = "ResponsiveAlertDialogFooter"

const ResponsiveAlertDialogTitle = ({
  ...props
}: React.ComponentProps<typeof AlertDialogTitle>) => {
  const { isMobile } = useResponsiveAlertDialogContext()

  if (isMobile) {
    return <DrawerTitle {...props} />
  }

  return <AlertDialogTitle {...props} />
}
ResponsiveAlertDialogTitle.displayName = "ResponsiveAlertDialogTitle"

const ResponsiveAlertDialogDescription = ({
  ...props
}: React.ComponentProps<typeof AlertDialogDescription>) => {
  const { isMobile } = useResponsiveAlertDialogContext()

  if (isMobile) {
    return <DrawerDescription {...props} />
  }

  return <AlertDialogDescription {...props} />
}
ResponsiveAlertDialogDescription.displayName = "ResponsiveAlertDialogDescription"

const ResponsiveAlertDialogAction = ({
  ...props
}: React.ComponentProps<typeof AlertDialogAction>) => {
  const { isMobile } = useResponsiveAlertDialogContext()

  if (isMobile) {
    return (
      <DrawerClose asChild>
        <Button {...(props as React.ComponentProps<typeof Button>)} />
      </DrawerClose>
    )
  }

  return <AlertDialogAction {...props} />
}
ResponsiveAlertDialogAction.displayName = "ResponsiveAlertDialogAction"

const ResponsiveAlertDialogCancel = ({
  ...props
}: React.ComponentProps<typeof AlertDialogCancel>) => {
  const { isMobile } = useResponsiveAlertDialogContext()

  if (isMobile) {
    return (
      <DrawerClose asChild>
        <Button variant="outline" {...(props as React.ComponentProps<typeof Button>)} />
      </DrawerClose>
    )
  }

  return <AlertDialogCancel {...props} />
}
ResponsiveAlertDialogCancel.displayName = "ResponsiveAlertDialogCancel"

export {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogTrigger,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
}
