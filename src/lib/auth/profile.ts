import "server-only";

import type { User } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase/server";

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fallbackDisplayName(user: User) {
  const metadata = user.user_metadata ?? {};

  return (
    readString(metadata.display_name) ??
    readString(metadata.full_name) ??
    readString(metadata.name) ??
    readString(metadata.user_name) ??
    readString(metadata.preferred_username) ??
    readString(user.email?.split("@")[0]) ??
    "BIRVANA listener"
  );
}

function fallbackAvatarUrl(user: User) {
  const metadata = user.user_metadata ?? {};

  return readString(metadata.avatar_url) ?? readString(metadata.picture);
}

export async function ensureProfileForUser(user: User) {
  const adminSupabase = await getAdminSupabase();

  if (!adminSupabase) {
    return;
  }

  const { data: existingProfile } = await adminSupabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, is_artist")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await adminSupabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? existingProfile?.email ?? null,
      display_name: readString(existingProfile?.display_name) ?? fallbackDisplayName(user),
      avatar_url: readString(existingProfile?.avatar_url) ?? fallbackAvatarUrl(user),
      is_artist: existingProfile?.is_artist === true,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    throw error;
  }
}
