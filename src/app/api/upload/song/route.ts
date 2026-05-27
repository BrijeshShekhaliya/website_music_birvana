import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getCreatorAccessState } from "@/lib/auth/account-state";
import { DATA_CACHE_TAGS } from "@/lib/cache-tags";
import { processAudioUpload } from "@/lib/media/processAudioUpload";
import { deleteObjectFromR2, putObjectToR2 } from "@/lib/r2/client";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function toBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

function extensionFromName(filename: string, fallback: string) {
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || fallback;
}

function expireDataTags(...tags: Array<(typeof DATA_CACHE_TAGS)[keyof typeof DATA_CACHE_TAGS]>) {
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 500 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!getCreatorAccessState(user).isApproved) {
      return NextResponse.json(
        { error: "Song uploads are not available right now." },
        { status: 403 },
      );
    }

    let mutationSupabase = supabase;

    try {
      const adminSupabase = await getAdminSupabase();

      if (adminSupabase) {
        mutationSupabase = adminSupabase;
      }
    } catch {
      mutationSupabase = supabase;
    }

    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const artistDisplay = String(formData.get("artist") || "").trim();
    const rawVisibility = String(formData.get("visibility") || "public").trim();
    const audio = formData.get("audio");
    const cover = formData.get("cover");
    const visibility = rawVisibility === "private" || rawVisibility === "unlisted" ? rawVisibility : "public";

    if (!(audio instanceof File) || !(cover instanceof File)) {
      return NextResponse.json({ error: "Audio and cover are required." }, { status: 400 });
    }

    if (!title || !artistDisplay) {
      return NextResponse.json({ error: "Title and artist display are required." }, { status: 400 });
    }

    const id = randomUUID();
    const coverExt = extensionFromName(cover.name, ".jpg");
    const coverKey = `covers/${user.id}/${id}${coverExt}`;
    const [processedAudio, coverBuffer] = await Promise.all([
      processAudioUpload({
        fileName: audio.name,
        buffer: await toBuffer(audio),
      }),
      toBuffer(cover),
    ]);
    const audioKey = `songs/${user.id}/${id}${processedAudio.extension}`;

    const [audioUrl, coverUrl] = await Promise.all([
      putObjectToR2({
        key: audioKey,
        body: processedAudio.buffer,
        contentType: processedAudio.contentType,
      }),
      putObjectToR2({
        key: coverKey,
        body: coverBuffer,
        contentType: cover.type || "image/jpeg",
      }),
    ]);

    const { data: existingProfile } = await mutationSupabase
      .from("profiles")
      .select("id, display_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const displayName =
      typeof existingProfile?.display_name === "string" && existingProfile.display_name.trim()
        ? existingProfile.display_name
        : artistDisplay;

    const { error: profileError } = await mutationSupabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? existingProfile?.email ?? null,
        display_name: displayName,
        is_artist: true,
      },
      {
        onConflict: "id",
      },
    );

    if (profileError) {
      await Promise.allSettled([deleteObjectFromR2(audioKey), deleteObjectFromR2(coverKey)]);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { error } = await mutationSupabase.from("songs").insert({
      artist_id: user.id,
      title,
      artist_display: artistDisplay,
      visibility,
      status: "ready",
      audio_url: audioUrl,
      audio_path: audioKey,
      cover_url: coverUrl,
      cover_path: coverKey,
      mime_type: processedAudio.contentType,
      duration_seconds: processedAudio.durationSeconds,
      size_bytes: processedAudio.buffer.byteLength,
    });

    if (error) {
      await Promise.allSettled([deleteObjectFromR2(audioKey), deleteObjectFromR2(coverKey)]);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidatePath("/");
    revalidatePath("/discover");
    revalidatePath("/library");
    revalidatePath("/liked");
    revalidatePath("/artists");
    revalidatePath("/profile");
    expireDataTags(
      DATA_CACHE_TAGS.addableTracks,
      DATA_CACHE_TAGS.artists,
      DATA_CACHE_TAGS.catalog,
      DATA_CACHE_TAGS.discover,
      DATA_CACHE_TAGS.library,
      DATA_CACHE_TAGS.profile,
      DATA_CACHE_TAGS.studio,
      DATA_CACHE_TAGS.tracks,
    );

    return NextResponse.json(
      {
        ok: true,
        processingMode: processedAudio.processingMode,
        sourceCodec: processedAudio.sourceCodec,
        sourceContainer: processedAudio.sourceContainer,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
