import type { Session } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const MOBILE_CLIENT_HEADER = "x-birvana-client";
const MOBILE_CLIENT_VALUE = "mobile";

export type MobileSessionPayload = {
  access_token: string;
  expires_at: number | null;
  expires_in: number | null;
  refresh_token: string;
  token_type: string;
  user: Session["user"];
};

export function isMobileAuthRequest(request: NextRequest) {
  return (
    request.headers.get(MOBILE_CLIENT_HEADER)?.trim().toLowerCase() ===
    MOBILE_CLIENT_VALUE
  );
}

export function serializeMobileSession(
  session: Session | null | undefined,
): MobileSessionPayload | null {
  if (!session) {
    return null;
  }

  return {
    access_token: session.access_token,
    expires_at: session.expires_at ?? null,
    expires_in: session.expires_in ?? null,
    refresh_token: session.refresh_token,
    token_type: session.token_type,
    user: session.user,
  };
}

export function normalizeNativeRedirectTarget(target?: string | null) {
  const value = target?.trim();

  if (!value || !value.startsWith("birvana://")) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function buildNativeAuthRedirectUrl(
  target: URL,
  input:
    | { error: string }
    | { accessToken: string; refreshToken: string },
) {
  const redirectUrl = new URL(target.toString());

  if ("error" in input) {
    redirectUrl.searchParams.set("error", input.error);
    return redirectUrl;
  }

  redirectUrl.searchParams.set("access_token", input.accessToken);
  redirectUrl.searchParams.set("refresh_token", input.refreshToken);
  return redirectUrl;
}
