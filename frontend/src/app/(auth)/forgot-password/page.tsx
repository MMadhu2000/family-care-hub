"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import { AuthCard } from "@/components/auth/auth-card"
import { FormMessage } from "@/components/auth/form-message"
import { LoadingButton } from "@/components/auth/loading-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth"
import { requestPasswordReset } from "@/lib/auth/auth-service"

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: ForgotPasswordInput) {
    setServerError(null)
    const result = await requestPasswordReset(values.email)
    if (!result.ok) {
      setServerError(result.message)
      return
    }
    setSentTo(values.email)
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a secure link to choose a new password."
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {serverError ? <FormMessage tone="error">{serverError}</FormMessage> : null}

      {sentTo ? (
        <FormMessage tone="success">
          If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.
        </FormMessage>
      ) : (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-2 h-10"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...form.register("email")}
            />
            {errors.email ? (
              <p id="email-error" role="alert" className="text-sm text-red-600 mt-1.5">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="Sending link…"
            className="mt-2 h-10"
          >
            Send reset link
          </LoadingButton>
        </form>
      )}
    </AuthCard>
  )
}
