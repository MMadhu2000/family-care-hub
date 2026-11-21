import * as React from "react"

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8">
      <div className="h-1 w-12 rounded-full bg-teal-600 mb-6" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1.5 text-sm text-slate-600">{description}</p>

      <div className="mt-6">{children}</div>

      {footer ? (
        <div className="mt-6 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
