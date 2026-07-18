import { getDiscoverData } from '@/lib/data';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 40;

function parseLimit(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);

  if (!Number.isFinite(raw)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(raw)));
}

export async function GET(request: Request) {
  const limit = parseLimit(request);
  const { origin } = new URL(request.url);
  const { tracks } = await getDiscoverData();

  const items = tracks
    .filter((track) => Boolean(track.cover_url && track.audio_url))
    .sort((left, right) => (right.play_count ?? 0) - (left.play_count ?? 0))
    .slice(0, limit)
    .map((track) => ({
      albumId: track.album_id ?? String(track.id),
      artist: track.artist_display,
      artworkUrl: track.cover_url ?? '',
      durationSeconds: track.duration_seconds ?? null,
      id: String(track.id),
      playCount: track.play_count ?? 0,
      streamUrl: `${origin}/api/stream?url=${encodeURIComponent(track.audio_url)}`,
      title: track.title,
    }));

  return Response.json({ items });
}
