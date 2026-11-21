import * as React from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success"
  children: React.ReactNode
}) {
  if (tone === "error") {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle aria-hidden="true" />
        <AlertDescription>{children}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert
      role="status"
      className="border-emerald-200 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-600"
    >
      <CheckCircle2 aria-hidden="true" />
      <AlertDescription className="text-emerald-900/80">{children}</AlertDescription>
    </Alert>
  )
}
