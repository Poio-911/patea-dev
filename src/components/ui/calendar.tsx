
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = es,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center capitalize",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        button_previous:
          "absolute left-1 inline-flex items-center justify-center h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-md border border-input hover:bg-accent hover:text-accent-foreground",
        button_next:
          "absolute right-1 inline-flex items-center justify-center h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-md border border-input hover:bg-accent hover:text-accent-foreground",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex w-full",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          "h-9 w-9 text-center text-sm p-0 relative",
          "[&:has([aria-selected=true])]:bg-accent",
          "first:[&:has([aria-selected=true])]:rounded-l-md",
          "last:[&:has([aria-selected=true])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day_button: cn(
          "inline-flex items-center justify-center h-9 w-9 p-0 font-normal rounded-md text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "aria-selected:opacity-100 aria-selected:bg-primary aria-selected:text-primary-foreground",
          "aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground",
          "aria-selected:focus:bg-primary aria-selected:focus:text-primary-foreground"
        ),
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside:
          "[&>button]:text-muted-foreground [&>button]:opacity-50",
        disabled:
          "[&>button]:text-muted-foreground [&>button]:opacity-50",
        range_middle:
          "[&>button]:aria-selected:bg-accent [&>button]:aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") return <ChevronLeft className="h-4 w-4" />
          return <ChevronRight className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
