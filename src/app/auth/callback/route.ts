import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { normalizeAuthEntry, normalizeRedirectTarget } from "@/lib/auth/redirects";
import { ensureProfileForUser } from "@/lib/auth/profile";
import { getPublicSupabaseEnv, hasSupabaseEnv } from "@/lib/env";

function redirectToEntry(request: NextRequest, entry: string, next: string, error: string) {
  const redirectUrl = new URL(entry, request.url);

  if (next !== "/discover") {
    redirectUrl.searchParams.set("next", next);
  }

  redirectUrl.searchParams.set("error", error);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const next = normalizeRedirectTarget(request.nextUrl.searchParams.get("next"));
  const entry = normalizeAuthEntry(request.nextUrl.searchParams.get("from"));
  const upstreamError =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");

  if (!hasSupabaseEnv()) {
    return redirectToEntry(request, entry, next, "Authentication is not available right now.");
  }

  if (upstreamError) {
    return redirectToEntry(request, entry, next, upstreamError);
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return redirectToEntry(request, entry, next, "Google sign-in could not be completed.");
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  const { url, anonKey } = getPublicSupabaseEnv();

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToEntry(request, entry, next, error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await ensureProfileForUser(user);
    } catch (profileError) {
      console.error("Unable to initialize profile after Google sign-in", profileError);
    }
  }

  return response;
}
