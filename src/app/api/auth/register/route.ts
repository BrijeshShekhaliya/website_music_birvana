import { NextResponse, type NextRequest } from "next/server";
import { sendOtpEmail } from "@/lib/email";
import {
  getPendingSignupCookieName,
  getPendingSignupCookieOptions,
  issuePendingSignup,
} from "@/lib/auth/pending-signup";
import { hasAuthOtpSecret, hasSmtpEnv, hasSupabaseEnv } from "@/lib/env";
import { getAdminSupabase } from "@/lib/supabase/server";

type RegisterRequestBody = {
  displayName?: string;
  email?: string;
  password?: string;
  heardAbout?: string;
};

async function emailAlreadyExists(email: string) {
  const adminSupabase = await getAdminSupabase();

  if (!adminSupabase) {
    return { exists: false, error: "Authentication is not available right now." };
  }

  const { data: matchingProfile } = await adminSupabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (matchingProfile?.id) {
    return { exists: true, error: null };
  }

  const userPage = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (userPage.error) {
    return { exists: false, error: userPage.error.message };
  }

  return {
    exists: userPage.data.users.some((user) => user.email?.toLowerCase() === email),
    error: null,
  };
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSmtpEnv() || !hasAuthOtpSecret()) {
    return NextResponse.json({ error: "Authentication is not available right now." }, { status: 500 });
  }

  const { displayName, email, password, heardAbout } = (await request.json().catch(() => ({}))) as RegisterRequestBody;

  const trimmedDisplayName = displayName?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const trimmedPassword = password?.trim();
  const normalizedHeardAbout = heardAbout?.trim();

  if (!trimmedDisplayName || !normalizedEmail || !trimmedPassword || !normalizedHeardAbout) {
    return NextResponse.json({ error: "Complete every step before requesting the OTP." }, { status: 400 });
  }

  if (trimmedPassword.length < 8) {
    return NextResponse.json(
      { error: "Use at least 8 characters for your password." },
      { status: 400 },
    );
  }

  const existence = await emailAlreadyExists(normalizedEmail);

  if (existence.error) {
    return NextResponse.json({ error: existence.error }, { status: 400 });
  }

  if (existence.exists) {
    return NextResponse.json(
      { error: "An account already exists for that email address." },
      { status: 409 },
    );
  }

  const pendingSignup = issuePendingSignup({
    displayName: trimmedDisplayName,
    email: normalizedEmail,
    password: trimmedPassword,
    heardAbout: normalizedHeardAbout,
  });

  try {
    await sendOtpEmail({
      email: normalizedEmail,
      otp: pendingSignup.otp,
      mode: "signup",
      displayName: trimmedDisplayName,
    });
  } catch (sendError) {
    return NextResponse.json(
      {
        error:
          sendError instanceof Error
            ? sendError.message
            : "Unable to send the verification code right now.",
      },
      { status: 500 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    email: normalizedEmail,
  });

  response.cookies.set(
    getPendingSignupCookieName(),
    pendingSignup.cookieValue,
    getPendingSignupCookieOptions(pendingSignup.maxAge),
  );

  return response;
}
