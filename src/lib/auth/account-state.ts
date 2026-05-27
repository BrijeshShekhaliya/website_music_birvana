import "server-only";

import { getAdminSupabase } from "@/lib/supabase/server";

export type CreatorAccessStatus = "none" | "pending" | "approved" | "rejected";

export type CreatorAccessRequest = {
  email: string;
  fullName: string;
  youtubeHandle: string;
  location?: string | null;
  notes?: string | null;
  submittedAt: string;
  status: Exclude<CreatorAccessStatus, "none">;
};

type BirvanaAccountMetadata = {
  creatorAccessRequest?: CreatorAccessRequest | null;
  followedArtistIds?: string[] | null;
};

type AppMetadataLike = {
  app_metadata?: Record<string, unknown> | null;
};

function isCreatorAccessStatus(value: unknown): value is Exclude<CreatorAccessStatus, "none"> {
  return value === "pending" || value === "approved" || value === "rejected";
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCreatorAccessRequest(value: unknown): CreatorAccessRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const email = readString(record.email);
  const fullName = readString(record.fullName);
  const youtubeHandle = readString(record.youtubeHandle);
  const submittedAt = readString(record.submittedAt);
  const status = record.status;

  if (!email || !fullName || !youtubeHandle || !submittedAt || !isCreatorAccessStatus(status)) {
    return null;
  }

  return {
    email,
    fullName,
    youtubeHandle,
    location: readString(record.location),
    notes: readString(record.notes),
    submittedAt,
    status,
  };
}

function readBirvanaMetadata(source: AppMetadataLike | null | undefined): BirvanaAccountMetadata {
  const rawMetadata = source?.app_metadata;

  if (!rawMetadata || typeof rawMetadata !== "object") {
    return {};
  }

  const birvana = (rawMetadata as Record<string, unknown>).birvana;

  if (!birvana || typeof birvana !== "object") {
    return {};
  }

  const record = birvana as Record<string, unknown>;

  return {
    creatorAccessRequest: normalizeCreatorAccessRequest(record.creatorAccessRequest),
    followedArtistIds: Array.isArray(record.followedArtistIds)
      ? record.followedArtistIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : null,
  };
}

export function getCreatorAccessState(source: AppMetadataLike | null | undefined) {
  const metadata = readBirvanaMetadata(source);
  const request = metadata.creatorAccessRequest ?? null;

  return {
    request,
    status: request?.status ?? ("none" as CreatorAccessStatus),
    isApproved: request?.status === "approved",
    isPending: request?.status === "pending",
    hasRequest: Boolean(request),
  };
}

export function getFollowedArtistIds(source: AppMetadataLike | null | undefined) {
  const metadata = readBirvanaMetadata(source);
  return [...new Set(metadata.followedArtistIds ?? [])];
}

export async function updateBirvanaAccountMetadata(
  userId: string,
  currentAppMetadata: Record<string, unknown> | null | undefined,
  updates: Partial<BirvanaAccountMetadata>,
) {
  const adminSupabase = await getAdminSupabase();

  if (!adminSupabase) {
    throw new Error("Admin authentication is not available.");
  }

  const existingMetadata =
    currentAppMetadata && typeof currentAppMetadata === "object"
      ? { ...currentAppMetadata }
      : {};
  const birvana = readBirvanaMetadata({ app_metadata: existingMetadata });

  const nextBirvana: BirvanaAccountMetadata = {
    creatorAccessRequest:
      updates.creatorAccessRequest === undefined ? birvana.creatorAccessRequest ?? null : updates.creatorAccessRequest,
    followedArtistIds:
      updates.followedArtistIds === undefined ? birvana.followedArtistIds ?? null : updates.followedArtistIds,
  };

  const nextAppMetadata = {
    ...existingMetadata,
    birvana: nextBirvana,
  };

  const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
    app_metadata: nextAppMetadata,
  });

  if (error) {
    throw new Error(error.message);
  }

  return nextBirvana;
}
