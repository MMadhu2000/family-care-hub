import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(100, "Full name is too long."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: "You must accept the terms to continue.",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
