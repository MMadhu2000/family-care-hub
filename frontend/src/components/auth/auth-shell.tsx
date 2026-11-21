import * as React from "react"
import { ShieldCheck } from "lucide-react"

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1F3A] shadow-sm">
          <ShieldCheck className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <p className="mt-3 text-lg font-semibold text-[#0B1F3A]">Family Care Hub</p>
        <p className="text-sm text-slate-600">Caregiving, coordinated.</p>
      </div>

      <div className="w-full max-w-md">{children}</div>

      <footer className="mt-8 text-center text-xs text-slate-500">© Family Care Hub</footer>
    </div>
  )
}
