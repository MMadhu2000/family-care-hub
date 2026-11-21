import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  loading?: boolean
  loadingText?: string
}) {
  return (
    <Button
      disabled={loading || disabled}
      aria-busy={loading}
      className={cn("w-full bg-[#0B1F3A] hover:bg-[#13305a] text-white", className)}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
