import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseEnv, hasSupabaseEnv } from "@/lib/env";

const protectedPrefixes = [
  "/library",
  "/liked",
  "/artists",
  "/artist",
  "/playlist",
  "/profile",
  "/settings",
];

const authRoutes = new Set(["/login", "/register"]);

export async function proxy(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, anonKey } = getPublicSupabaseEnv();

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const requiresAuth = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAuthRoute = authRoutes.has(pathname);

  if (!requiresAuth && !isAuthRoute) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (requiresAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/discover", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/library/:path*",
    "/liked/:path*",
    "/artists/:path*",
    "/artist/:path*",
    "/playlist/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
