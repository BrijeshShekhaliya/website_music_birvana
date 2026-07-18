import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isMobileAuthRequest,
  serializeMobileSession,
} from "@/lib/auth/mobile-session";
import { ensureProfileForUser } from "@/lib/auth/profile";
import { getPublicSupabaseEnv, hasSupabaseEnv } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Authentication is not available right now." }, { status: 500 });
  }

  const { email, password } = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await ensureProfileForUser(user);
    } catch (profileError) {
      console.error("Unable to initialize profile after password sign-in", profileError);
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
