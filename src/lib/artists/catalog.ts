import "server-only";

import { createHash } from "node:crypto";
import directorySeeds from "@/data/artist-directory.generated.json";
import { resolveTrackCategory } from "@/lib/music/categories";
import type { ArtistProfile, Track } from "@/types/models";

type ArtistSeed = {
  id: string;
  slug: string;
  name: string;
  bio?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
};

type ArtistCatalogEntry = ArtistProfile & {
  tracks: Track[];
};

const rawSeeds = directorySeeds as ArtistSeed[];

function normalizeArtistName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\bmembers?\.?$/giu, "")
    .replace(/^[\s,;/&-]+|[\s,;/&-]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function slugifyArtistName(value: string) {
  const slug = normalizeArtistName(value)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return slug || "artist";
}

function createArtistId(value: string) {
  const hash = createHash("sha1").update(normalizeArtistName(value)).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
}

function cleanupArtistToken(value: string) {
  return value
    .replace(/^and\s+/iu, "")
    .replace(/^[\s,;/&-]+|[\s,;/&-]+$/gu, "")
    .replace(/\bmembers?\.?$/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function splitArtistCredits(value: string) {
  const parts = value
    .split(/\s*(?:,|\/|&| x | feat\.? | ft\.? | featuring | with | and )\s*/giu)
    .map(cleanupArtistToken)
    .filter(Boolean);

  return [...new Set(parts)];
}

const seedByName = new Map(rawSeeds.map((seed) => [normalizeArtistName(seed.name), seed]));

function sortTracks(a: Track, b: Track) {
  const playDelta = (b.play_count ?? 0) - (a.play_count ?? 0);

  if (playDelta !== 0) {
    return playDelta;
  }

  const aTime = a.created_at ? Date.parse(a.created_at) : 0;
  const bTime = b.created_at ? Date.parse(b.created_at) : 0;
  return bTime - aTime;
}

export function buildArtistCatalog(tracks: Track[]) {
  const catalog = new Map<string, ArtistCatalogEntry>();
  const usedSlugs = new Map<string, string>();

  for (const track of tracks) {
    for (const name of splitArtistCredits(track.artist_display)) {
      const normalizedName = normalizeArtistName(name);
      const seed = seedByName.get(normalizedName);
      const id = seed?.id ?? createArtistId(name);
      const baseSlug = seed?.slug ?? slugifyArtistName(name);
      const existingSlugOwner = usedSlugs.get(baseSlug);
      const slug =
        !existingSlugOwner || existingSlugOwner === id
          ? baseSlug
          : `${baseSlug}-${id.slice(0, 8)}`;

      usedSlugs.set(slug, id);

      const existing = catalog.get(id);

      if (!existing) {
        catalog.set(id, {
          id,
          slug,
          name: seed?.name ?? name,
          bio: seed?.bio ?? null,
          image_url: seed?.imageUrl ?? null,
          source_url: seed?.sourceUrl ?? null,
          source_label: seed?.sourceLabel ?? null,
          track_count: 0,
          total_plays: 0,
          top_track_title: null,
          top_track_cover_url: null,
          categories: [],
          tracks: [],
        });
      }

      const artist = catalog.get(id)!;

      if (artist.tracks.some((entry) => entry.id === track.id)) {
        continue;
      }

      artist.tracks.push(track);
      artist.track_count += 1;
      artist.total_plays += track.play_count ?? 0;
      artist.top_track_cover_url = artist.top_track_cover_url ?? track.cover_url ?? null;
      const category = resolveTrackCategory(track);

      if (!artist.categories.includes(category)) {
        artist.categories.push(category);
      }
    }
  }

  const artists = [...catalog.values()]
    .map((artist) => {
      const sortedTracks = [...artist.tracks].sort(sortTracks);

      return {
        ...artist,
        tracks: sortedTracks,
        top_track_title: sortedTracks[0]?.title ?? null,
        top_track_cover_url: artist.image_url ?? artist.top_track_cover_url ?? null,
      };
    })
    .sort((a, b) => {
      const playDelta = b.total_plays - a.total_plays;

      if (playDelta !== 0) {
        return playDelta;
      }

      const trackDelta = b.track_count - a.track_count;

      if (trackDelta !== 0) {
        return trackDelta;
      }

      return a.name.localeCompare(b.name);
    });

  return artists;
}

export function getArtistFromCatalog(tracks: Track[], slug: string) {
  return buildArtistCatalog(tracks).find((artist) => artist.slug === slug) ?? null;
}
