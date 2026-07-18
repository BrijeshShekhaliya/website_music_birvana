import { getPlaylistDetail } from '@/lib/data';

type Params = {
  params: Promise<{
    playlistId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  const { playlistId } = await params;
  const { origin } = new URL(request.url);
  const { playlist, entries } = await getPlaylistDetail(playlistId);

  if (!playlist) {
    return Response.json({ error: 'Playlist not found' }, { status: 404 });
  }

  const items = entries
    .filter((entry) => Boolean(entry.track?.audio_url && entry.track?.cover_url))
    .map((entry) => {
      const track = entry.track!;

      return {
        albumId: track.album_id ?? String(track.id),
        artist: track.artist_display,
        artworkUrl: track.cover_url ?? '',
        durationSeconds: track.duration_seconds ?? null,
        id: String(track.id),
        playCount: track.play_count ?? 0,
        position: entry.position,
        streamUrl: `${origin}/api/stream?url=${encodeURIComponent(track.audio_url ?? '')}`,
        title: track.title,
      };
    });

  return Response.json({
    playlist: {
      artworkUrl: playlist.cover_url ?? '',
      description: playlist.description ?? '',
      followerCount: playlist.follower_count ?? 0,
      id: playlist.id,
      name: playlist.name,
      playCount: playlist.play_count ?? 0,
      songCount: playlist.song_count ?? items.length,
      visibility: playlist.visibility,
    },
    tracks: items,
  });
}
