"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ArtistCard } from "@/components/shared/ArtistCard";
import type { ArtistProfile } from "@/types/models";
import styles from "./ArtistDirectoryClient.module.css";

function matchesArtist(artist: ArtistProfile, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  if (artist.name.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  return (artist.song_titles ?? []).some((title) => title.toLowerCase().includes(normalizedQuery));
}

export function ArtistDirectoryClient({
  artists,
  initialFollowingIds,
  showFollowButton,
}: {
  artists: ArtistProfile[];
  initialFollowingIds: string[];
  showFollowButton: boolean;
}) {
  const [query, setQuery] = useState("");
  const followedArtistIds = useMemo(() => new Set(initialFollowingIds), [initialFollowingIds]);
  const filteredArtists = useMemo(
    () => artists.filter((artist) => matchesArtist(artist, query)),
    [artists, query],
  );

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headingRow}>
          <h1 className={styles.title}>Artists</h1>
          {query ? <span className={styles.resultMeta}>{filteredArtists.length} found</span> : null}
        </div>

        <label className={styles.searchField}>
          <Search size={17} strokeWidth={2.1} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artists or songs"
            aria-label="Search artists or songs"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} strokeWidth={2.2} />
            </button>
          ) : null}
        </label>
      </section>

      <section className={styles.directory}>
        {filteredArtists.length ? (
          <div className={styles.grid}>
            {filteredArtists.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                initialFollowing={followedArtistIds.has(artist.id)}
                showFollowButton={showFollowButton}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No artists match that search.</p>
            <p className={styles.emptyText}>Try another artist name or search with a song title instead.</p>
          </div>
        )}
      </section>
    </div>
  );
}
