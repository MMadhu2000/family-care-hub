"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = React.useState(false)
  const { className, ...rest } = props

  return (
    <div className="relative">
      <Input
        {...rest}
        type={show ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500 hover:text-slate-900"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        onClick={() => setShow((prev) => !prev)}
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </Button>
    </div>
  )
}
