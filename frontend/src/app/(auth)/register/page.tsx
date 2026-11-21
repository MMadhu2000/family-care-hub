"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AuthCard } from "@/components/auth/auth-card"
import { FormMessage } from "@/components/auth/form-message"
import { LoadingButton } from "@/components/auth/loading-button"
import { PasswordInput } from "@/components/auth/password-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerSchema, type RegisterInput } from "@/lib/validations/auth"
import { signUp } from "@/lib/auth/auth-service"

export default function RegisterPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: RegisterInput) {
    setServerError(null)
    const result = await signUp({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
    })
    if (!result.ok) {
      setServerError(result.message)
      return
    }
    if (result.data.requiresEmailConfirmation) {
      setSuccessMessage(
        "Account created. Check your email to confirm your address, then sign in."
      )
      form.reset()
      return
    }
    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <AuthCard
      title="Create your account"
      description="Set up your family care workspace in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal-700 hover:text-teal-800">
            Sign in
          </Link>
        </>
      }
    >
      {serverError ? <FormMessage tone="error">{serverError}</FormMessage> : null}

      {successMessage ? (
        <div className="space-y-4">
          <FormMessage tone="success">{successMessage}</FormMessage>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-md bg-[#0B1F3A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#13305a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            Go to sign in
          </Link>
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-5">
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              className="mt-2 h-10"
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
              {...form.register("fullName")}
            />
            {errors.fullName ? (
              <p id="fullName-error" role="alert" className="text-sm text-red-600 mt-1.5">
                {errors.fullName.message}
              </p>
            ) : null}
          </div>

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

          <div>
            <Label htmlFor="password">Password</Label>
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
            <Label htmlFor="confirmPassword">Confirm password</Label>
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

          <div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="acceptTerms"
                aria-invalid={!!errors.acceptTerms}
                aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
                {...form.register("acceptTerms")}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600"
              />
              <Label htmlFor="acceptTerms" className="font-normal text-slate-600">
                I agree to the Terms of Service and Privacy Policy.
              </Label>
            </div>
            {errors.acceptTerms ? (
              <p id="acceptTerms-error" role="alert" className="text-sm text-red-600 mt-1.5">
                {errors.acceptTerms.message}
              </p>
            ) : null}
          </div>

          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText="Creating account…"
            className="mt-2 h-10"
          >
            Create account
          </LoadingButton>
        </form>
      )}
    </AuthCard>
  )
}
