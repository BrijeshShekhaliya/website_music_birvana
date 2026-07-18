import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  buildNativeAuthRedirectUrl,
  normalizeNativeRedirectTarget,
} from "@/lib/auth/mobile-session";
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
  const nativeRedirect = normalizeNativeRedirectTarget(
    request.nextUrl.searchParams.get("native_redirect"),
  );
  const upstreamError =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");

  if (!hasSupabaseEnv()) {
    if (nativeRedirect) {
      return NextResponse.redirect(
        buildNativeAuthRedirectUrl(nativeRedirect, {
          error: "Authentication is not available right now.",
        }),
      );
    }

    return redirectToEntry(request, entry, next, "Authentication is not available right now.");
  }

  if (upstreamError) {
    if (nativeRedirect) {
      return NextResponse.redirect(
        buildNativeAuthRedirectUrl(nativeRedirect, {
          error: upstreamError,
        }),
      );
    }

    return redirectToEntry(request, entry, next, upstreamError);
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    if (nativeRedirect) {
      return NextResponse.redirect(
        buildNativeAuthRedirectUrl(nativeRedirect, {
          error: "Google sign-in could not be completed.",
        }),
      );
    }

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
    if (nativeRedirect) {
      return NextResponse.redirect(
        buildNativeAuthRedirectUrl(nativeRedirect, {
          error: error.message,
        }),
      );
    }

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

  if (nativeRedirect) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token || !session.refresh_token) {
      return NextResponse.redirect(
        buildNativeAuthRedirectUrl(nativeRedirect, {
          error: "Google sign-in could not be completed.",
        }),
      );
    }

    response.headers.set(
      "Location",
      buildNativeAuthRedirectUrl(nativeRedirect, {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      }).toString(),
    );
  }

  return response;
}
