import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isMobileAuthRequest,
  serializeMobileSession,
} from "@/lib/auth/mobile-session";
import { ensureProfileForUser } from "@/lib/auth/profile";
import {
  getPendingSignupCookieName,
  getPendingSignupCookieOptions,
  isPendingSignupOtpValid,
  readPendingSignup,
} from "@/lib/auth/pending-signup";
import {
  getPublicSupabaseEnv,
  hasAuthOtpSecret,
  hasSmtpEnv,
  hasSupabaseEnv,
} from "@/lib/env";
import { getAdminSupabase } from "@/lib/supabase/server";

function clearPendingSignupCookie(response: NextResponse) {
  response.cookies.set(getPendingSignupCookieName(), "", getPendingSignupCookieOptions(0));
}

function jsonWithClearedPendingSignupCookie(
  body: { error: string },
  status: number,
) {
  const response = NextResponse.json(body, { status });
  clearPendingSignupCookie(response);
  return response;
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSmtpEnv() || !hasAuthOtpSecret()) {
    return NextResponse.json({ error: "Authentication is not available right now." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    pendingSignupToken?: string;
    token?: string;
  };
  const mobileClient = isMobileAuthRequest(request);
  const { token } = body;

  const normalizedToken = token?.replace(/\s+/gu, "");

  if (!normalizedToken) {
    return NextResponse.json({ error: "Enter the OTP to continue." }, { status: 400 });
  }

  const pendingSignup = readPendingSignup(
    body.pendingSignupToken ??
      request.cookies.get(getPendingSignupCookieName())?.value,
  );

  if (!pendingSignup) {
    return NextResponse.json(
      { error: "Your verification session expired. Start registration again." },
      { status: 400 },
    );
  }

  if (!isPendingSignupOtpValid(pendingSignup, normalizedToken)) {
    return NextResponse.json(
      { error: "OTP is invalid. Request a new OTP and try again." },
      { status: 400 },
    );
  }

  const adminSupabase = await getAdminSupabase();

  if (!adminSupabase) {
    return NextResponse.json({ error: "Authentication is not available right now." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });

  const createdUser = await adminSupabase.auth.admin.createUser({
    email: pendingSignup.email,
    password: pendingSignup.password,
    email_confirm: true,
    user_metadata: {
      display_name: pendingSignup.displayName,
      heard_about_us: pendingSignup.heardAbout,
    },
  });

  if (createdUser.error || !createdUser.data.user) {
    return jsonWithClearedPendingSignupCookie(
      {
        error:
          createdUser.error?.message?.includes("already")
            ? "An account already exists for that email address."
            : createdUser.error?.message || "Unable to complete registration.",
      },
      400,
    );
  }

  try {
    await ensureProfileForUser(createdUser.data.user);
  } catch (profileError) {
    console.error("Unable to initialize profile after OTP verification", profileError);
  }

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

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: pendingSignup.email,
    password: pendingSignup.password,
  });

  clearPendingSignupCookie(response);

  if (signInError) {
    return jsonWithClearedPendingSignupCookie(
      { error: "Your email is verified, but we could not sign you in automatically." },
      400,
    );
  }

  if (mobileClient) {
    return NextResponse.json({
      ok: true,
      session: serializeMobileSession(signInData.session),
    });
  }

  return response;
}
