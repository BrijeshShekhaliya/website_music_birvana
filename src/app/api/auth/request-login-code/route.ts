import { NextResponse, type NextRequest } from "next/server";
import { sendOtpEmail } from "@/lib/email";
import { ensureProfileForUser } from "@/lib/auth/profile";
import { hasSmtpEnv, hasSupabaseEnv } from "@/lib/env";
import { getAdminSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSmtpEnv()) {
    return NextResponse.json({ error: "Authentication is not available right now." }, { status: 500 });
  }

  const { email } = (await request.json().catch(() => ({}))) as {
    email?: string;
  };

  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return NextResponse.json({ error: "Enter your email first." }, { status: 400 });
  }

  const adminSupabase = await getAdminSupabase();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Authentication is not available right now." }, { status: 500 });
  }

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id,display_name,email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  let displayName =
    typeof profile?.display_name === "string" && profile.display_name.trim()
      ? profile.display_name.trim()
      : undefined;

  let authUserId = profile?.id ?? null;

  if (!authUserId) {
    const userPage = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (userPage.error) {
      return NextResponse.json({ error: userPage.error.message }, { status: 400 });
    }

    const existingUser = userPage.data.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );

    if (!existingUser) {
      return NextResponse.json({ error: "No account was found for that email address." }, { status: 404 });
    }

    authUserId = existingUser.id;
    displayName =
      typeof existingUser.user_metadata?.display_name === "string"
        ? existingUser.user_metadata.display_name
        : displayName;

    try {
      await ensureProfileForUser(existingUser);
    } catch (profileError) {
      console.error("Unable to initialize profile before OTP sign-in", profileError);
    }
  }

  if (!authUserId) {
    return NextResponse.json({ error: "No account was found for that email address." }, { status: 404 });
  }

  const generated = await adminSupabase.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
  });

  if (generated.error || !generated.data?.properties.email_otp) {
    return NextResponse.json(
      { error: generated.error?.message || "Unable to generate the sign-in code." },
      { status: 400 },
    );
  }

  try {
    await sendOtpEmail({
      email: normalizedEmail,
      otp: generated.data.properties.email_otp,
      mode: "login",
      displayName,
    });
  } catch (sendError) {
    return NextResponse.json(
      {
        error:
          sendError instanceof Error
            ? sendError.message
            : "Unable to send the sign-in code right now.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
