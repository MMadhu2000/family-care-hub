import * as React from "react"

export function FormDivider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div role="separator" className="relative my-6 flex items-center">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="px-3 text-xs uppercase tracking-wide text-slate-500">{children}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  )
}
