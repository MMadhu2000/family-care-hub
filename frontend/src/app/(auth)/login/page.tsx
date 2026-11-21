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
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { signIn } from "@/lib/auth/auth-service"

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: LoginInput) {
    setServerError(null)
    const result = await signIn({ email: values.email, password: values.password })
    if (!result.ok) {
      setServerError(result.message)
      return
    }
    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage your family's care."
      footer={
        <>
          New to Family Care Hub?{" "}
          <Link href="/register" className="font-medium text-teal-700 hover:text-teal-800">
            Create an account
          </Link>
        </>
      }
    >
      {serverError ? <FormMessage tone="error">{serverError}</FormMessage> : null}

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

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm font-medium text-teal-700 hover:text-teal-800">
              Forgot password?
            </Link>
          </div>
          <div className="mt-2">
            <PasswordInput
              id="password"
              autoComplete="current-password"
              className="h-10"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...form.register("password")}
            />
          </div>
          {errors.password ? (
            <p id="password-error" role="alert" className="text-sm text-red-600 mt-1.5">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <LoadingButton
          type="submit"
          loading={isSubmitting}
          loadingText="Signing in…"
          className="mt-2 h-10"
        >
          Sign in
        </LoadingButton>
      </form>
    </AuthCard>
  )
}
