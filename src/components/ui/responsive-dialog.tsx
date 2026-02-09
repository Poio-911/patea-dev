"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

interface ResponsiveDialogProps extends React.ComponentProps<typeof Dialog> {
  handleOnly?: boolean
}

const ResponsiveDialog = ({ handleOnly, ...props }: ResponsiveDialogProps) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <Drawer handleOnly={handleOnly} {...props} />
  }

  return <Dialog {...props} />
}
ResponsiveDialog.displayName = "ResponsiveDialog"

const ResponsiveDialogTrigger = ({
  ...props
}: React.ComponentProps<typeof DialogTrigger>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerTrigger {...props} />
  }

  return <DialogTrigger {...props} />
}
ResponsiveDialogTrigger.displayName = "ResponsiveDialogTrigger"

const ResponsiveDialogContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerContent className={cn(className, "!max-w-none !w-full")} {...(props as React.ComponentProps<typeof DrawerContent>)}>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    )
  }

  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  )
}
ResponsiveDialogContent.displayName = "ResponsiveDialogContent"

const ResponsiveDialogHeader = ({
  ...props
}: React.ComponentProps<typeof DialogHeader>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerHeader {...props} />
  }

  return <DialogHeader {...props} />
}
ResponsiveDialogHeader.displayName = "ResponsiveDialogHeader"

const ResponsiveDialogFooter = ({
  ...props
}: React.ComponentProps<typeof DialogFooter>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerFooter {...props} />
  }

  return <DialogFooter {...props} />
}
ResponsiveDialogFooter.displayName = "ResponsiveDialogFooter"

const ResponsiveDialogTitle = ({
  ...props
}: React.ComponentProps<typeof DialogTitle>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerTitle {...props} />
  }

  return <DialogTitle {...props} />
}
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle"

const ResponsiveDialogDescription = ({
  ...props
}: React.ComponentProps<typeof DialogDescription>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerDescription {...props} />
  }

  return <DialogDescription {...props} />
}
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription"

const ResponsiveDialogClose = ({
  ...props
}: React.ComponentProps<typeof DialogClose>) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <DrawerClose {...props} />
  }

  return <DialogClose {...props} />
}
ResponsiveDialogClose.displayName = "ResponsiveDialogClose"

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
}
