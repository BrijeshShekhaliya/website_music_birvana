"use server";

import { randomUUID } from "node:crypto";
import { refresh, revalidatePath, updateTag } from "next/cache";
import {
  getCreatorAccessState,
  getFollowedArtistIds,
  updateBirvanaAccountMetadata,
} from "@/lib/auth/account-state";
import { deleteObjectFromR2, keyFromUrl, putObjectToR2 } from "@/lib/r2/client";
import { DATA_CACHE_TAGS } from "@/lib/cache-tags";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>;

async function requireAuthedSupabase() {
  const supabase = await getServerSupabase();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  let mutationSupabase: SupabaseClient = supabase;

  try {
    const adminSupabase = await getAdminSupabase();

    if (adminSupabase) {
      mutationSupabase = adminSupabase;
    }
  } catch {
    mutationSupabase = supabase;
  }

  return { supabase, mutationSupabase, user };
}

async function requireOwnedPlaylist(playlistId: string) {
  const { supabase, mutationSupabase, user } = await requireAuthedSupabase();
  const { data: playlist, error } = await mutationSupabase
    .from("playlists")
    .select("id, owner_id, cover_url, cover_path, name, visibility, description, song_count")
    .eq("id", playlistId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!playlist || playlist.owner_id !== user.id) {
    throw new Error("You cannot manage this playlist.");
  }

  return { supabase, mutationSupabase, user, playlist };
}

async function requireOwnedTrack(trackId: number) {
  const { supabase, mutationSupabase, user } = await requireAuthedSupabase();
  const { data: track, error } = await mutationSupabase
    .from("songs")
    .select("id, artist_id, title, artist_display, visibility, cover_url, cover_path, audio_url, audio_path")
    .eq("id", trackId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!track || track.artist_id !== user.id) {
    throw new Error("You cannot manage this track.");
  }

  return { supabase, mutationSupabase, user, track };
}

function getPlaylistCoverKey(playlist: { cover_path?: string | null; cover_url?: string | null }) {
  if (playlist.cover_path) {
    return playlist.cover_path;
  }

  if (playlist.cover_url) {
    return keyFromUrl(playlist.cover_url);
  }

  return null;
}

function getTrackCoverKey(track: { cover_path?: string | null; cover_url?: string | null }) {
  if (track.cover_path) {
    return track.cover_path;
  }

  if (track.cover_url) {
    return keyFromUrl(track.cover_url);
  }

  return null;
}

function getTrackAudioKey(track: { audio_path?: string | null; audio_url?: string | null }) {
  if (track.audio_path) {
    return track.audio_path;
  }

  if (track.audio_url) {
    return keyFromUrl(track.audio_url);
  }

  return null;
}

function updateDataTags(...tags: Array<(typeof DATA_CACHE_TAGS)[keyof typeof DATA_CACHE_TAGS]>) {
  for (const tag of tags) {
    updateTag(tag);
  }
}

function revalidateAppPaths(paths: Array<string | null | undefined>) {
  for (const path of new Set(paths.filter((value): value is string => Boolean(value)))) {
    revalidatePath(path);
  }
}

function revalidateCatalogViews(extraPaths: Array<string | null | undefined> = []) {
  revalidateAppPaths([
    "/",
    "/discover",
    "/library",
    "/liked",
    "/artists",
    "/profile",
    "/studio/tracks",
    "/studio/playlists",
    ...extraPaths,
  ]);
}

function revalidatePlaylistViews(
  playlistId: string,
  ownerId?: string | null,
  extraPaths: Array<string | null | undefined> = [],
) {
  revalidateCatalogViews([
    `/playlist/${playlistId}`,
    ownerId ? `/artist/${ownerId}` : null,
    ...extraPaths,
  ]);
}

export async function toggleSongLikeAction(songId: number, shouldLike: boolean) {
  const { mutationSupabase, user } = await requireAuthedSupabase();

  if (shouldLike) {
    const { error } = await mutationSupabase.from("liked_songs").upsert(
      {
        user_id: user.id,
        song_id: songId,
      },
      {
        onConflict: "user_id,song_id",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await mutationSupabase
      .from("liked_songs")
      .delete()
      .eq("user_id", user.id)
      .eq("song_id", songId);

    if (error) {
      throw new Error(error.message);
    }
  }

  updateDataTags(DATA_CACHE_TAGS.engagement, DATA_CACHE_TAGS.liked);
  refresh();
}

export async function togglePlaylistSaveAction(playlistId: string, shouldSave: boolean) {
  const { mutationSupabase, user } = await requireAuthedSupabase();

  if (shouldSave) {
    const { error } = await mutationSupabase.from("saved_playlists").upsert(
      {
        user_id: user.id,
        playlist_id: playlistId,
      },
      {
        onConflict: "user_id,playlist_id",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await mutationSupabase
      .from("saved_playlists")
      .delete()
      .eq("user_id", user.id)
      .eq("playlist_id", playlistId);

    if (error) {
      throw new Error(error.message);
    }
  }

  updateDataTags(DATA_CACHE_TAGS.engagement, DATA_CACHE_TAGS.library);
  refresh();
}

export async function toggleArtistFollowAction(artistId: string, shouldFollow: boolean) {
  const { user } = await requireAuthedSupabase();
  const followedArtistIds = new Set(getFollowedArtistIds(user));

  if (shouldFollow) {
    followedArtistIds.add(artistId);
  } else {
    followedArtistIds.delete(artistId);
  }

  await updateBirvanaAccountMetadata(user.id, user.app_metadata, {
    followedArtistIds: [...followedArtistIds].toSorted(),
  });

  updateDataTags(DATA_CACHE_TAGS.artists, DATA_CACHE_TAGS.profile);
  refresh();
}

export async function submitCreatorAccessRequestAction(formData: FormData) {
  const { user } = await requireAuthedSupabase();
  const creatorAccess = getCreatorAccessState(user);

  if (creatorAccess.hasRequest) {
    return creatorAccess.request;
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? user.email ?? "").trim().toLowerCase();
  const youtubeHandle = String(formData.get("youtubeHandle") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error("A valid email address is required.");
  }

  if (!youtubeHandle) {
    throw new Error("YouTube handle is required.");
  }

  const request = {
    fullName,
    email,
    youtubeHandle,
    location: location || null,
    notes: notes || null,
    submittedAt: new Date().toISOString(),
    status: "pending" as const,
  };

  await updateBirvanaAccountMetadata(user.id, user.app_metadata, {
    creatorAccessRequest: request,
  });

  updateDataTags(DATA_CACHE_TAGS.profile, DATA_CACHE_TAGS.studio);
  revalidateAppPaths(["/profile", "/studio", "/studio/upload", "/studio/tracks", "/studio/playlists"]);
  refresh();

  return request;
}

export async function updateProfileAction(formData: FormData) {
  const { mutationSupabase, user } = await requireAuthedSupabase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const usernameInput = String(formData.get("username") ?? "").trim().toLowerCase();
  const bio = String(formData.get("bio") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (displayName.length > 80) {
    throw new Error("Display name must be 80 characters or less.");
  }

  if (usernameInput && !/^[a-z0-9_]{3,30}$/u.test(usernameInput)) {
    throw new Error("Username must be 3-30 characters using letters, numbers, or underscores.");
  }

  if (bio.length > 220) {
    throw new Error("Bio must be 220 characters or less.");
  }

  if (avatarUrl) {
    try {
      const parsedUrl = new URL(avatarUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Avatar URL must start with http:// or https://.");
      }
    } catch {
      throw new Error("Avatar URL must be a valid URL.");
    }
  }

  const { error } = await mutationSupabase
    .from("profiles")
    .update({
      display_name: displayName,
      username: usernameInput || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  updateDataTags(DATA_CACHE_TAGS.profile, DATA_CACHE_TAGS.artists, DATA_CACHE_TAGS.studio);
  revalidateAppPaths(["/profile", "/settings", "/artists", `/artist/${user.id}`]);
  refresh();
}

export async function createPlaylistAction(formData: FormData) {
  const { mutationSupabase, user } = await requireAuthedSupabase();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Playlist name is required.");
  }

  const { data: playlist, error } = await mutationSupabase
    .from("playlists")
    .insert({
      owner_id: user.id,
      name,
      description: null,
      visibility: "private",
    })
    .select("id")
    .single();

  if (error || !playlist) {
    throw new Error(error?.message ?? "Playlist was created, but could not be opened.");
  }

  updateDataTags(DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
  revalidateCatalogViews([`/artist/${user.id}`]);
  refresh();
  return playlist;
}

export async function addTrackToPlaylistAction(playlistId: string, songId: number) {
  const { mutationSupabase, user } = await requireOwnedPlaylist(playlistId);

  const [{ data: existingTrack }, { data: maxPositionRow }] = await Promise.all([
    mutationSupabase
      .from("playlist_songs")
      .select("id")
      .eq("playlist_id", playlistId)
      .eq("song_id", songId)
      .maybeSingle(),
    mutationSupabase
      .from("playlist_songs")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (existingTrack) {
    return null;
  }

  const nextPosition = (maxPositionRow?.position ?? 0) + 1;
  const { data, error } = await mutationSupabase
    .from("playlist_songs")
    .insert({
      playlist_id: playlistId,
      song_id: songId,
      position: nextPosition,
      added_by: user.id,
    })
    .select("id, position")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  updateDataTags(DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
  revalidatePlaylistViews(playlistId, user.id);
  refresh();
  return data;
}

export async function removeTrackFromPlaylistAction(playlistTrackId: number) {
  const { mutationSupabase, user } = await requireAuthedSupabase();
  const { data: playlistTrack, error: trackError } = await mutationSupabase
    .from("playlist_songs")
    .select("id, playlist_id, song_id, position, playlists!inner(owner_id)")
    .eq("id", playlistTrackId)
    .maybeSingle();

  if (trackError) {
    throw new Error(trackError.message);
  }

  const ownerId = (playlistTrack?.playlists as { owner_id: string } | undefined)?.owner_id;

  if (!playlistTrack || ownerId !== user.id) {
    throw new Error("You cannot manage this playlist.");
  }

  const { error: deleteError } = await mutationSupabase
    .from("playlist_songs")
    .delete()
    .eq("id", playlistTrackId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { data: remainingRows, error: remainingError } = await mutationSupabase
    .from("playlist_songs")
    .select("id, position")
    .eq("playlist_id", playlistTrack.playlist_id)
    .order("position", { ascending: true });

  if (remainingError) {
    throw new Error(remainingError.message);
  }

  await Promise.all(
    ((remainingRows as Array<{ id: number; position: number }> | null) ?? []).map((row, index) =>
      mutationSupabase.from("playlist_songs").update({ position: index + 1 }).eq("id", row.id),
    ),
  );

  updateDataTags(DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
  revalidatePlaylistViews(playlistTrack.playlist_id, ownerId);
  refresh();
  return { songId: playlistTrack.song_id };
}

export async function movePlaylistTrackAction(playlistTrackId: number, direction: "up" | "down") {
  const { mutationSupabase, user } = await requireAuthedSupabase();
  const { data: playlistTrack, error: trackError } = await mutationSupabase
    .from("playlist_songs")
    .select("id, playlist_id, position, playlists!inner(owner_id)")
    .eq("id", playlistTrackId)
    .maybeSingle();

  if (trackError) {
    throw new Error(trackError.message);
  }

  const ownerId = (playlistTrack?.playlists as { owner_id: string } | undefined)?.owner_id;

  if (!playlistTrack || ownerId !== user.id) {
    throw new Error("You cannot manage this playlist.");
  }

  const targetPosition = direction === "up" ? playlistTrack.position - 1 : playlistTrack.position + 1;

  if (targetPosition < 1) {
    updateDataTags(DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
    refresh();
    return;
  }

  const { data: swapTrack, error: swapError } = await mutationSupabase
    .from("playlist_songs")
    .select("id, position")
    .eq("playlist_id", playlistTrack.playlist_id)
    .eq("position", targetPosition)
    .maybeSingle();

  if (swapError) {
    throw new Error(swapError.message);
  }

  if (!swapTrack) {
    updateDataTags(DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
    revalidatePlaylistViews(playlistTrack.playlist_id, ownerId);
    refresh();
    return;
  }

  const temporaryPosition = 2147483647;
  const { error: firstUpdateError } = await mutationSupabase
    .from("playlist_songs")
    .update({ position: temporaryPosition })
    .eq("id", playlistTrack.id);

  if (firstUpdateError) {
    throw new Error(firstUpdateError.message);
  }

  const { error: secondUpdateError } = await mutationSupabase
    .from("playlist_songs")
    .update({ position: playlistTrack.position })
    .eq("id", swapTrack.id);

  if (secondUpdateError) {
    throw new Error(secondUpdateError.message);
  }

  const { error: finalUpdateError } = await mutationSupabase
    .from("playlist_songs")
    .update({ position: targetPosition })
    .eq("id", playlistTrack.id);

  if (finalUpdateError) {
    throw new Error(finalUpdateError.message);
  }

  updateDataTags(DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
  revalidatePlaylistViews(playlistTrack.playlist_id, ownerId);
  refresh();
}

export async function reorderPlaylistTracksAction(playlistId: string, orderedTrackIds: number[]) {
  const { mutationSupabase, playlist } = await requireOwnedPlaylist(playlistId);

  if (!orderedTrackIds.length) {
    updateDataTags(DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
    revalidatePlaylistViews(playlistId, playlist.owner_id);
    refresh();
    return;
  }

  const { data: rows, error } = await mutationSupabase
    .from("playlist_songs")
    .select("id")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const existingIds = ((rows as Array<{ id: number }> | null) ?? []).map((row) => row.id);

  if (
    existingIds.length !== orderedTrackIds.length ||
    existingIds.some((id) => !orderedTrackIds.includes(id))
  ) {
    throw new Error("Playlist order is out of sync.");
  }

  await Promise.all(
    orderedTrackIds.map((playlistTrackId, index) =>
      mutationSupabase
        .from("playlist_songs")
        .update({ position: index + 1 })
        .eq("id", playlistTrackId),
    ),
  );

  updateDataTags(DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
  revalidatePlaylistViews(playlistId, playlist.owner_id);
  refresh();
}

export async function updatePlaylistDetailsAction(formData: FormData) {
  const playlistId = String(formData.get("playlistId") ?? "");
  const { mutationSupabase, playlist } = await requireOwnedPlaylist(playlistId);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? playlist.visibility) as
    | "private"
    | "public"
    | "unlisted";
  const removeCover = String(formData.get("removeCover") ?? "") === "true";
  const coverFile = formData.get("cover");

  if (!name) {
    throw new Error("Playlist name is required.");
  }

  if (!["private", "public", "unlisted"].includes(visibility)) {
    throw new Error("Invalid playlist visibility.");
  }

  if (visibility === "public" && (playlist.song_count ?? 0) < 3) {
    throw new Error("A playlist needs at least 3 songs before it can be public.");
  }

  let nextCoverUrl = playlist.cover_url ?? null;
  let nextCoverPath = playlist.cover_path ?? null;
  let uploadedCoverKey: string | null = null;

  if (coverFile instanceof File && coverFile.size > 0) {
    if (!coverFile.type.startsWith("image/")) {
      throw new Error("Playlist cover must be an image.");
    }

    const extension = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const key = `covers/playlists/${playlistId}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await coverFile.arrayBuffer());
    const coverUrl = await putObjectToR2({
      key,
      body: buffer,
      contentType: coverFile.type || "image/jpeg",
    });

    uploadedCoverKey = key;
    nextCoverUrl = coverUrl;
    nextCoverPath = key;
  } else if (removeCover) {
    nextCoverUrl = null;
    nextCoverPath = null;
  }

  const { error } = await mutationSupabase
    .from("playlists")
    .update({
      name,
      description: description || null,
      visibility,
      cover_url: nextCoverUrl,
      cover_path: nextCoverPath,
    })
    .eq("id", playlistId);

  if (error) {
    if (uploadedCoverKey) {
      await deleteObjectFromR2(uploadedCoverKey).catch(() => undefined);
    }
    throw new Error(error.message);
  }

  const previousCoverKey = getPlaylistCoverKey(playlist);
  if (uploadedCoverKey && previousCoverKey && previousCoverKey !== uploadedCoverKey) {
    await deleteObjectFromR2(previousCoverKey).catch(() => undefined);
  }

  if (removeCover && previousCoverKey) {
    await deleteObjectFromR2(previousCoverKey).catch(() => undefined);
  }

  updateDataTags(DATA_CACHE_TAGS.discover, DATA_CACHE_TAGS.library, DATA_CACHE_TAGS.playlists, DATA_CACHE_TAGS.studio);
  revalidatePlaylistViews(playlistId, playlist.owner_id);
  refresh();
}

export async function deletePlaylistAction(playlistId: string) {
  const { mutationSupabase, playlist } = await requireOwnedPlaylist(playlistId);
  const previousCoverKey = getPlaylistCoverKey(playlist);

  const [savedRows, trackRows] = await Promise.all([
    mutationSupabase.from("saved_playlists").delete().eq("playlist_id", playlistId),
    mutationSupabase.from("playlist_songs").delete().eq("playlist_id", playlistId),
  ]);

  if (savedRows.error) {
    throw new Error(savedRows.error.message);
  }

  if (trackRows.error) {
    throw new Error(trackRows.error.message);
  }

  const { error } = await mutationSupabase.from("playlists").delete().eq("id", playlistId);

  if (error) {
    throw new Error(error.message);
  }

  if (previousCoverKey) {
    await deleteObjectFromR2(previousCoverKey).catch(() => undefined);
  }

  updateDataTags(
    DATA_CACHE_TAGS.discover,
    DATA_CACHE_TAGS.engagement,
    DATA_CACHE_TAGS.library,
    DATA_CACHE_TAGS.playlists,
    DATA_CACHE_TAGS.studio,
  );
  revalidatePlaylistViews(playlistId, playlist.owner_id);
  refresh();
}

export async function updateTrackDetailsAction(formData: FormData) {
  const trackId = Number(formData.get("trackId"));

  if (!Number.isInteger(trackId) || trackId <= 0) {
    throw new Error("Invalid track.");
  }

  const { mutationSupabase, track } = await requireOwnedTrack(trackId);
  const title = String(formData.get("title") ?? "").trim();
  const artistDisplay = String(formData.get("artistDisplay") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? track.visibility) as
    | "private"
    | "public"
    | "unlisted";
  const removeCover = String(formData.get("removeCover") ?? "") === "true";
  const coverFile = formData.get("cover");

  if (!title) {
    throw new Error("Track title is required.");
  }

  if (!artistDisplay) {
    throw new Error("Artist name is required.");
  }

  if (!["private", "public", "unlisted"].includes(visibility)) {
    throw new Error("Invalid track visibility.");
  }

  const { data: playlistRefs, error: playlistRefsError } = await mutationSupabase
    .from("playlist_songs")
    .select("playlist_id")
    .eq("song_id", trackId);

  if (playlistRefsError) {
    throw new Error(playlistRefsError.message);
  }

  let nextCoverUrl = track.cover_url ?? null;
  let nextCoverPath = track.cover_path ?? null;
  let uploadedCoverKey: string | null = null;

  if (coverFile instanceof File && coverFile.size > 0) {
    if (!coverFile.type.startsWith("image/")) {
      throw new Error("Track cover must be an image.");
    }

    const extension = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const key = `covers/${track.artist_id}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await coverFile.arrayBuffer());
    const coverUrl = await putObjectToR2({
      key,
      body: buffer,
      contentType: coverFile.type || "image/jpeg",
    });

    uploadedCoverKey = key;
    nextCoverUrl = coverUrl;
    nextCoverPath = key;
  } else if (removeCover) {
    nextCoverUrl = null;
    nextCoverPath = null;
  }

  const { error } = await mutationSupabase
    .from("songs")
    .update({
      title,
      artist_display: artistDisplay,
      visibility,
      cover_url: nextCoverUrl,
      cover_path: nextCoverPath,
    })
    .eq("id", trackId);

  if (error) {
    if (uploadedCoverKey) {
      await deleteObjectFromR2(uploadedCoverKey).catch(() => undefined);
    }
    throw new Error(error.message);
  }

  const previousCoverKey = getTrackCoverKey(track);
  if (uploadedCoverKey && previousCoverKey && previousCoverKey !== uploadedCoverKey) {
    await deleteObjectFromR2(previousCoverKey).catch(() => undefined);
  }

  if (removeCover && previousCoverKey) {
    await deleteObjectFromR2(previousCoverKey).catch(() => undefined);
  }

  updateDataTags(
    DATA_CACHE_TAGS.addableTracks,
    DATA_CACHE_TAGS.artists,
    DATA_CACHE_TAGS.catalog,
    DATA_CACHE_TAGS.discover,
    DATA_CACHE_TAGS.library,
    DATA_CACHE_TAGS.profile,
    DATA_CACHE_TAGS.studio,
    DATA_CACHE_TAGS.tracks,
  );
  revalidateCatalogViews([
    `/artist/${track.artist_id}`,
    ...(((playlistRefs as Array<{ playlist_id: string }> | null) ?? []).map((row) => `/playlist/${row.playlist_id}`)),
  ]);
  refresh();
}

export async function deleteTrackAction(trackId: number) {
  const { mutationSupabase, track } = await requireOwnedTrack(trackId);
  const coverKey = getTrackCoverKey(track);
  const audioKey = getTrackAudioKey(track);
  const { data: playlistRefs, error: playlistRefsError } = await mutationSupabase
    .from("playlist_songs")
    .select("playlist_id")
    .eq("song_id", trackId);

  if (playlistRefsError) {
    throw new Error(playlistRefsError.message);
  }

  const [playlistRows, likeRows] = await Promise.all([
    mutationSupabase.from("playlist_songs").delete().eq("song_id", trackId),
    mutationSupabase.from("liked_songs").delete().eq("song_id", trackId),
  ]);

  if (playlistRows.error) {
    throw new Error(playlistRows.error.message);
  }

  if (likeRows.error) {
    throw new Error(likeRows.error.message);
  }

  const { error } = await mutationSupabase.from("songs").delete().eq("id", trackId);

  if (error) {
    throw new Error(error.message);
  }

  await Promise.allSettled(
    [coverKey, audioKey]
      .filter((key): key is string => Boolean(key))
      .map((key) => deleteObjectFromR2(key)),
  );

  updateDataTags(
    DATA_CACHE_TAGS.addableTracks,
    DATA_CACHE_TAGS.artists,
    DATA_CACHE_TAGS.catalog,
    DATA_CACHE_TAGS.discover,
    DATA_CACHE_TAGS.engagement,
    DATA_CACHE_TAGS.library,
    DATA_CACHE_TAGS.liked,
    DATA_CACHE_TAGS.playlists,
    DATA_CACHE_TAGS.profile,
    DATA_CACHE_TAGS.studio,
    DATA_CACHE_TAGS.tracks,
  );
  revalidateCatalogViews([
    `/artist/${track.artist_id}`,
    ...(((playlistRefs as Array<{ playlist_id: string }> | null) ?? []).map((row) => `/playlist/${row.playlist_id}`)),
  ]);
  refresh();
}
