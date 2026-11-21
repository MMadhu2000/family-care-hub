import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (!isSupabaseConfigured()) {
    if (path.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  const { response, isAuthenticated } = await updateSession(request);

  if (path.startsWith("/dashboard") && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (
    isAuthenticated &&
    ["/login", "/register", "/forgot-password"].includes(path)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // /reset-password is deliberately not redirected: a recovery link creates a session.
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
