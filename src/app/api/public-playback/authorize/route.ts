import { NextResponse, type NextRequest } from "next/server";
import {
  authorizeGuestTrackPlayback,
  getGuestPlaybackCookieName,
  getGuestPlaybackCookieOptions,
  getGuestPreviewLimit,
  readGuestPlaybackState,
} from "@/lib/public-guest-playback";

export async function GET(request: NextRequest) {
  const { state, cookieValue } = readGuestPlaybackState(request);
  const response = NextResponse.json({
    limit: getGuestPreviewLimit(),
    playedTrackIds: state.playedTrackIds,
    remaining: Math.max(getGuestPreviewLimit() - state.playedTrackIds.length, 0),
  });

  response.cookies.set(getGuestPlaybackCookieName(), cookieValue, getGuestPlaybackCookieOptions());
  return response;
}

export async function POST(request: NextRequest) {
  const { trackId } = (await request.json().catch(() => ({}))) as {
    trackId?: number;
  };

  if (!Number.isInteger(trackId)) {
    return NextResponse.json({ error: "Track id is required." }, { status: 400 });
  }

  const safeTrackId = Number(trackId);
  const result = authorizeGuestTrackPlayback(request, safeTrackId);
  const response = NextResponse.json({
    allowed: result.allowed,
    limit: getGuestPreviewLimit(),
    playedTrackIds: result.playedTrackIds,
    remaining: result.remaining,
    requiresAuth: !result.allowed,
  });

  response.cookies.set(getGuestPlaybackCookieName(), result.cookieValue, getGuestPlaybackCookieOptions());
  return response;
}
