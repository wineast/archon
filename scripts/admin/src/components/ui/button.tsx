import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-semibold transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-sm hover:bg-destructive/90",
        outline: "border bg-background shadow-xs hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-[#18794e] text-white border-[#18794e] hover:bg-[#146842]",
        danger: "border-[#e8b4ae] text-destructive bg-[#fef0ee] hover:bg-[#fce0db]",
        ready: "border-primary text-primary bg-accent hover:bg-[#d4ede8]",
        sync: "bg-[#e8f0fe] border-[#b0c8f5] text-[#2563eb] hover:bg-[#d8e4fb]",
        merge: "bg-[#18794e] border-[#18794e] text-white hover:bg-[#14684e]",
      },
      size: {
        default: "h-8 px-3.5 py-1.5",
        sm: "h-7 px-2.5",
        xs: "h-6 px-2 text-[10px]",
        icon: "size-7",
        "icon-xs": "size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
