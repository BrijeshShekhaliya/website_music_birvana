import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireServerEnv } from "@/lib/env";

const GUEST_PREVIEW_COOKIE = "birvana-guest-preview";
const GUEST_PREVIEW_LIMIT = 5;
const GUEST_PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const GUEST_MEMORY_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type GuestPlaybackCookie = {
  sessionId: string;
  fingerprint: string;
  playedTrackIds: number[];
  updatedAt: number;
};

type GuestPlaybackMemoryRecord = {
  playedTrackIds: number[];
  updatedAt: number;
};

type GuestPlaybackStore = Map<string, GuestPlaybackMemoryRecord>;

declare global {
  var __birvanaGuestPlaybackStore: GuestPlaybackStore | undefined;
}

function getStore() {
  if (!globalThis.__birvanaGuestPlaybackStore) {
    globalThis.__birvanaGuestPlaybackStore = new Map();
  }

  return globalThis.__birvanaGuestPlaybackStore;
}

function getKey() {
  return createHash("sha256").update(requireServerEnv("AUTH_OTP_SECRET")).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decrypt(value: string) {
  const [encodedIv, encodedTag, encodedPayload] = value.split(".");

  if (!encodedIv || !encodedTag || !encodedPayload) {
    throw new Error("Malformed guest playback cookie.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encodedPayload, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function createFingerprint(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const acceptLanguage = request.headers.get("accept-language") ?? "unknown";

  return createHash("sha256")
    .update([forwardedFor, userAgent, acceptLanguage].join("|"))
    .digest("base64url");
}

function pruneStore(store: GuestPlaybackStore) {
  const cutoff = Date.now() - GUEST_MEMORY_TTL_MS;

  for (const [key, value] of store.entries()) {
    if (value.updatedAt < cutoff) {
      store.delete(key);
    }
  }
}

function parseCookie(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decrypt(value)) as Partial<GuestPlaybackCookie>;

    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.fingerprint !== "string" ||
      !Array.isArray(parsed.playedTrackIds) ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      fingerprint: parsed.fingerprint,
      playedTrackIds: parsed.playedTrackIds.filter((value) => Number.isInteger(value)).slice(0, GUEST_PREVIEW_LIMIT),
      updatedAt: parsed.updatedAt,
    } satisfies GuestPlaybackCookie;
  } catch {
    return null;
  }
}

function buildCookieValue(payload: GuestPlaybackCookie) {
  return encrypt(JSON.stringify(payload));
}

export function getGuestPlaybackCookieName() {
  return GUEST_PREVIEW_COOKIE;
}

export function getGuestPlaybackCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_PREVIEW_MAX_AGE_SECONDS,
    priority: "high" as const,
  };
}

export function readGuestPlaybackState(request: NextRequest) {
  const fingerprint = createFingerprint(request);
  const cookieState = parseCookie(request.cookies.get(GUEST_PREVIEW_COOKIE)?.value);
  const store = getStore();
  pruneStore(store);

  const memoryState = store.get(fingerprint);
  const mergedTrackIds = [
    ...(cookieState?.fingerprint === fingerprint ? cookieState.playedTrackIds : []),
    ...(memoryState?.playedTrackIds ?? []),
  ].filter((value, index, array) => array.indexOf(value) === index).slice(0, GUEST_PREVIEW_LIMIT);

  const sessionId = cookieState?.sessionId ?? randomUUID();

  const nextState: GuestPlaybackCookie = {
    sessionId,
    fingerprint,
    playedTrackIds: mergedTrackIds,
    updatedAt: Date.now(),
  };

  store.set(fingerprint, { playedTrackIds: mergedTrackIds, updatedAt: nextState.updatedAt });

  return {
    cookieValue: buildCookieValue(nextState),
    state: nextState,
  };
}

export function authorizeGuestTrackPlayback(request: NextRequest, trackId: number) {
  const { state, cookieValue } = readGuestPlaybackState(request);
  const alreadyUnlocked = state.playedTrackIds.includes(trackId);

  if (alreadyUnlocked) {
    return {
      allowed: true,
      remaining: Math.max(GUEST_PREVIEW_LIMIT - state.playedTrackIds.length, 0),
      playedTrackIds: state.playedTrackIds,
      cookieValue,
    };
  }

  if (state.playedTrackIds.length >= GUEST_PREVIEW_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      playedTrackIds: state.playedTrackIds,
      cookieValue,
    };
  }

  const nextPlayedTrackIds = [...state.playedTrackIds, trackId];
  const nextState: GuestPlaybackCookie = {
    ...state,
    playedTrackIds: nextPlayedTrackIds,
    updatedAt: Date.now(),
  };

  getStore().set(state.fingerprint, {
    playedTrackIds: nextPlayedTrackIds,
    updatedAt: nextState.updatedAt,
  });

  return {
    allowed: true,
    remaining: Math.max(GUEST_PREVIEW_LIMIT - nextPlayedTrackIds.length, 0),
    playedTrackIds: nextPlayedTrackIds,
    cookieValue: buildCookieValue(nextState),
  };
}

export function getGuestPreviewLimit() {
  return GUEST_PREVIEW_LIMIT;
}
