import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none data-[variant=minimal]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        pill: "gap-[0.45rem] rounded-none bg-transparent p-0 shadow-none ring-0 group-data-horizontal/tabs:h-auto group-data-vertical/tabs:h-auto",
        minimal:
          "writer-home-divider-bottom mb-px h-auto w-full min-w-0 shrink-0 flex-wrap items-center justify-start gap-x-8 gap-y-1 border-none bg-transparent p-0 pb-0 shadow-none ring-0 group-data-horizontal/tabs:h-auto group-data-vertical/tabs:h-auto",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-[color,background-color,border-color,box-shadow] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        "group-data-[variant=pill]/tabs-list:h-auto group-data-[variant=pill]/tabs-list:min-h-0 group-data-[variant=pill]/tabs-list:flex-none group-data-[variant=pill]/tabs-list:flex-initial group-data-[variant=pill]/tabs-list:w-auto group-data-[variant=pill]/tabs-list:rounded-full group-data-[variant=pill]/tabs-list:px-[1.125rem] group-data-[variant=pill]/tabs-list:py-[0.4375rem] group-data-[variant=pill]/tabs-list:text-[0.8125rem] group-data-[variant=pill]/tabs-list:font-normal group-data-[variant=pill]/tabs-list:tracking-wide group-data-[variant=pill]/tabs-list:shadow-none group-data-[variant=pill]/tabs-list:after:hidden group-data-[variant=pill]/tabs-list:border group-data-[variant=pill]/tabs-list:border-transparent group-data-[variant=pill]/tabs-list:bg-transparent group-data-[variant=pill]/tabs-list:text-white/62 group-data-[variant=pill]/tabs-list:data-active:!border-white/42 group-data-[variant=pill]/tabs-list:data-active:!bg-white/12 group-data-[variant=pill]/tabs-list:data-active:!text-[#fafcff] group-data-[variant=pill]/tabs-list:data-active:shadow-none group-data-[variant=pill]/tabs-list:hover:border-white/24 group-data-[variant=pill]/tabs-list:hover:text-white/92",
        "group-data-[variant=minimal]/tabs-list:h-auto group-data-[variant=minimal]/tabs-list:flex-none group-data-[variant=minimal]/tabs-list:flex-initial group-data-[variant=minimal]/tabs-list:w-auto group-data-[variant=minimal]/tabs-list:rounded-none group-data-[variant=minimal]/tabs-list:border-0 group-data-[variant=minimal]/tabs-list:bg-transparent group-data-[variant=minimal]/tabs-list:px-0 group-data-[variant=minimal]/tabs-list:py-2 group-data-[variant=minimal]/tabs-list:text-[0.9375rem] group-data-[variant=minimal]/tabs-list:font-medium group-data-[variant=minimal]/tabs-list:tracking-tight group-data-[variant=minimal]/tabs-list:shadow-none group-data-[variant=minimal]/tabs-list:after:hidden group-data-[variant=minimal]/tabs-list:data-active:after:opacity-0 group-data-[variant=minimal]/tabs-list:text-foreground/58 group-data-[variant=minimal]/tabs-list:hover:!bg-transparent group-data-[variant=minimal]/tabs-list:hover:text-foreground/82 dark:group-data-[variant=minimal]/tabs-list:text-[#eaf3ff]/60 dark:group-data-[variant=minimal]/tabs-list:hover:text-[#eaf3ff]/88 group-data-[variant=minimal]/tabs-list:data-active:!border-transparent group-data-[variant=minimal]/tabs-list:data-active:!bg-transparent group-data-[variant=minimal]/tabs-list:data-active:!text-foreground group-data-[variant=minimal]/tabs-list:data-active:shadow-none dark:group-data-[variant=minimal]/tabs-list:data-active:!text-[#fefeff]",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
