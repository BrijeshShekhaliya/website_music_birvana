"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv, hasSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getPublicSupabaseEnv();

  browserClient = createBrowserClient(url!, anonKey!, {
    auth: {
      flowType: "pkce",
    },
  });
  return browserClient;
}
