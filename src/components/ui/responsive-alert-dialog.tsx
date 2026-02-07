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

const ResponsiveAlertDialog = ({
  ...props
}: React.ComponentProps<typeof AlertDialog>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <Drawer {...props} />
  }

  return <AlertDialog {...props} />
}
ResponsiveAlertDialog.displayName = "ResponsiveAlertDialog"

const ResponsiveAlertDialogTrigger = ({
  ...props
}: React.ComponentProps<typeof AlertDialogTrigger>) => {
  const isMobile = useIsMobile()

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
  const isMobile = useIsMobile()

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
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerHeader {...props} />
  }

  return <AlertDialogHeader {...props} />
}
ResponsiveAlertDialogHeader.displayName = "ResponsiveAlertDialogHeader"

const ResponsiveAlertDialogFooter = ({
  ...props
}: React.ComponentProps<typeof AlertDialogFooter>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerFooter {...props} />
  }

  return <AlertDialogFooter {...props} />
}
ResponsiveAlertDialogFooter.displayName = "ResponsiveAlertDialogFooter"

const ResponsiveAlertDialogTitle = ({
  ...props
}: React.ComponentProps<typeof AlertDialogTitle>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerTitle {...props} />
  }

  return <AlertDialogTitle {...props} />
}
ResponsiveAlertDialogTitle.displayName = "ResponsiveAlertDialogTitle"

const ResponsiveAlertDialogDescription = ({
  ...props
}: React.ComponentProps<typeof AlertDialogDescription>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerDescription {...props} />
  }

  return <AlertDialogDescription {...props} />
}
ResponsiveAlertDialogDescription.displayName = "ResponsiveAlertDialogDescription"

const ResponsiveAlertDialogAction = ({
  ...props
}: React.ComponentProps<typeof AlertDialogAction>) => {
  const isMobile = useIsMobile()

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
  const isMobile = useIsMobile()

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
