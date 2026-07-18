import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isMobileAuthRequest,
  serializeMobileSession,
} from "@/lib/auth/mobile-session";
import { ensureProfileForUser } from "@/lib/auth/profile";
import { getPublicSupabaseEnv, hasSmtpEnv, hasSupabaseEnv } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSmtpEnv()) {
    return NextResponse.json({ error: "Authentication is not available right now." }, { status: 500 });
  }

  const { email, token } = (await request.json().catch(() => ({}))) as {
    email?: string;
    token?: string;
  };

  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedToken = token?.replace(/\s+/gu, "");

  if (!normalizedEmail || !normalizedToken) {
    return NextResponse.json({ error: "Enter your email and the verification code." }, { status: 400 });
  }

  const mobileClient = isMobileAuthRequest(request);
  const response = NextResponse.json({ ok: true });
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

  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: "email",
  });

  if (error) {
    return NextResponse.json({ error: "OTP is invalid. Request a new OTP and try again." }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await ensureProfileForUser(user);
    } catch (profileError) {
      console.error("Unable to initialize profile after OTP sign-in", profileError);
    }
  }

  if (mobileClient) {
    return NextResponse.json({
      ok: true,
      session: serializeMobileSession(data.session),
    });
  }

  return response;
}
