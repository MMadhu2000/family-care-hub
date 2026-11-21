"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  isSupabaseConfigured,
  AUTH_NOT_CONFIGURED_MESSAGE,
} from "@/lib/supabase/config";
import type { ActionResult, AuthUser } from "./types";

type SupabaseUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function toAuthUser(user: SupabaseUserLike): AuthUser {
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  };
}

function toMessage(error: { message: string } | null): string {
  const message = error?.message ?? "";

  if (message === "Invalid login credentials") {
    return "Incorrect email or password.";
  }
  if (message === "Email not confirmed") {
    return "Please confirm your email before signing in.";
  }
  if (message === "User already registered") {
    return "An account with this email already exists.";
  }
  if (message.startsWith("Password should be at least")) {
    return "Password does not meet the minimum requirements.";
  }
  return "Something went wrong. Please try again.";
}

export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<ActionResult<{ requiresEmailConfirmation: boolean }>> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: AUTH_NOT_CONFIGURED_MESSAGE };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return { ok: false, message: toMessage(error) };
  }

  return { ok: true, data: { requiresEmailConfirmation: !data.session } };
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ userId: string }>> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: AUTH_NOT_CONFIGURED_MESSAGE };
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error || !data.user) {
    return { ok: false, message: toMessage(error) };
  }

  return { ok: true, data: { userId: data.user.id } };
}

export async function signOut(): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: AUTH_NOT_CONFIGURED_MESSAGE };
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { ok: false, message: toMessage(error) };
  }

  return { ok: true, data: undefined };
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: AUTH_NOT_CONFIGURED_MESSAGE };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { ok: false, message: toMessage(error) };
  }

  return { ok: true, data: undefined };
}

export async function updatePassword(password: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: AUTH_NOT_CONFIGURED_MESSAGE };
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { ok: false, message: toMessage(error) };
  }

  return { ok: true, data: undefined };
}

export async function getCurrentUser(): Promise<ActionResult<AuthUser | null>> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: AUTH_NOT_CONFIGURED_MESSAGE };
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { ok: true, data: null };
  }

  return { ok: true, data: toAuthUser(data.user) };
}

export function onAuthStateChange(
  callback: (user: AuthUser | null) => void,
): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const supabase = createSupabaseBrowserClient();
  const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    callback(session?.user ? toAuthUser(session.user) : null);
  });

  return () => data.subscription.unsubscribe();
}
