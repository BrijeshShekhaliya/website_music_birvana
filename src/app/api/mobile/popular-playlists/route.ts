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
  const { playlists } = await getDiscoverData();

  const items = playlists
    .filter((playlist) => Boolean(playlist.cover_url))
    .slice(0, limit)
    .map((playlist) => ({
      artworkUrl: playlist.cover_url ?? '',
      description: playlist.description ?? '',
      id: playlist.id,
      name: playlist.name,
      playCount: playlist.play_count ?? 0,
      songCount: playlist.song_count ?? 0,
    }));

  return Response.json({ items });
}
