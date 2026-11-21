"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AuthCard } from "@/components/auth/auth-card"
import { FormMessage } from "@/components/auth/form-message"
import { LoadingButton } from "@/components/auth/loading-button"
import { PasswordInput } from "@/components/auth/password-input"
import { Label } from "@/components/ui/label"
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth"
import { updatePassword } from "@/lib/auth/auth-service"

export default function ResetPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null)
    const result = await updatePassword(values.password)
    if (!result.ok) {
      setServerError(result.message)
      return
    }
    setDone(true)
  }

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password you haven't used before."
    >
      {serverError ? <FormMessage tone="error">{serverError}</FormMessage> : null}

      {done ? (
        <div className="space-y-4">
          <FormMessage tone="success">Your password has been updated.</FormMessage>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-[#0B1F3A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#13305a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            Continue to dashboard
          </Link>
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-5">
          <div>
            <Label htmlFor="password">New password</Label>
            <div className="mt-2">
              <PasswordInput
                id="password"
                autoComplete="new-password"
                className="h-10"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : "password-hint"}
                {...form.register("password")}
              />
            </div>
            <p id="password-hint" className="mt-1.5 text-xs text-slate-500">
              At least 8 characters, with a letter and a number.
            </p>
            {errors.password ? (
              <p id="password-error" role="alert" className="text-sm text-red-600 mt-1.5">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <div className="mt-2">
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                className="h-10"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                {...form.register("confirmPassword")}
              />
            </div>
            {errors.confirmPassword ? (
              <p id="confirmPassword-error" role="alert" className="text-sm text-red-600 mt-1.5">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="Updating password…"
            className="mt-2 h-10"
          >
            Update password
          </LoadingButton>
        </form>
      )}
    </AuthCard>
  )
}
