"use client";

import { Search, X } from "lucide-react";
import { startTransition, useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import styles from "./DiscoverWorkspace.module.css";
import { EmptyState } from "@/components/shared/EmptyState";
import { PlaylistCard } from "@/components/shared/PlaylistCard";
import { TrackCard } from "@/components/shared/TrackCard";
import { resolveTrackCategory, type MusicCategory } from "@/lib/music/categories";
import { searchPlaylists, searchTracks } from "@/lib/search";
import type { Playlist, Track } from "@/types/models";

type DiscoverCategory = "all" | MusicCategory;
type DiscoverTrackCategory = Exclude<DiscoverCategory, "all">;

const shelfLimit = 10;
const playlistLimit = 8;

const browseCategories: Array<{
  id: DiscoverCategory;
  title: string;
  eyebrow: string;
}> = [
  { id: "all", title: "Everything", eyebrow: "Full catalog" },
  { id: "hindi", title: "Bollywood", eyebrow: "Hindi" },
  { id: "punjabi", title: "Punjabi", eyebrow: "High energy" },
  { id: "english", title: "Global", eyebrow: "Worldwide" },
  { id: "south", title: "South", eyebrow: "Regional" },
  { id: "devotional", title: "Bhakti", eyebrow: "Reflective" },
  { id: "other", title: "Indie", eyebrow: "Unexpected" },
];

function getCreatedTime(track: Track) {
  if (!track.created_at) {
    return 0;
  }

  const time = Date.parse(track.created_at);
  return Number.isNaN(time) ? 0 : time;
}

function sortByPlaysThenRecent(a: Track, b: Track) {
  const playDelta = (b.play_count ?? 0) - (a.play_count ?? 0);

  if (playDelta !== 0) {
    return playDelta;
  }

  return getCreatedTime(b) - getCreatedTime(a);
}

function TrackShelf({
  title,
  meta,
  tracks,
  queueKey,
  likedSet,
  canEngage,
  actionLabel,
  onAction,
}: {
  title: string;
  meta?: string;
  tracks: Track[];
  queueKey: string;
  likedSet: Set<number>;
  canEngage: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  if (!tracks.length) {
    return null;
  }

  return (
    <section className={styles.shelf}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {meta ? <p className={styles.sectionMeta}>{meta}</p> : null}
        </div>

        {actionLabel && onAction ? (
          <button type="button" className={styles.textButton} onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>

      <div className={styles.railViewport}>
        {tracks.map((track, index) => (
          <TrackCard
            key={track.id}
            track={track}
            tracks={tracks}
            index={index}
            queueKey={queueKey}
            variant="discover"
            initialLiked={likedSet.has(track.id)}
            showLikeButton={canEngage}
          />
        ))}
      </div>
    </section>
  );
}

function PlaylistShelf({
  title,
  meta,
  playlists,
  savedSet,
  canEngage,
  currentUserId,
}: {
  title: string;
  meta?: string;
  playlists: Playlist[];
  savedSet: Set<string>;
  canEngage: boolean;
  currentUserId?: string;
}) {
  if (!playlists.length) {
    return null;
  }

  return (
    <section className={styles.shelf}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {meta ? <p className={styles.sectionMeta}>{meta}</p> : null}
        </div>
      </div>

      <div className={`${styles.railViewport} ${styles.playlistViewport}`}>
        {playlists.map((playlist) => (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            size="discover"
            initialSaved={savedSet.has(playlist.id)}
            showSaveButton={canEngage && playlist.owner_id !== currentUserId}
          />
        ))}
      </div>
    </section>
  );
}

export function DiscoverWorkspace({
  tracks,
  playlists,
  likedSongIds,
  savedPlaylistIds,
  canEngage,
  currentUserId,
}: {
  tracks: Track[];
  playlists: Playlist[];
  likedSongIds: number[];
  savedPlaylistIds: string[];
  canEngage: boolean;
  currentUserId?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<DiscoverCategory>("all");
  const deferredQuery = useDeferredValue(query);
  const likedSet = useMemo(() => new Set(likedSongIds), [likedSongIds]);
  const savedSet = useMemo(() => new Set(savedPlaylistIds), [savedPlaylistIds]);
  const normalizedQuery = deferredQuery.trim();
  const searching = normalizedQuery.length > 0;

  const tracksByCategory = useMemo(() => {
    return tracks.reduce<Record<DiscoverTrackCategory, Track[]>>(
      (grouped, track) => {
        const category = resolveTrackCategory(track);
        grouped[category].push(track);
        return grouped;
      },
      {
        hindi: [],
        english: [],
        south: [],
        punjabi: [],
        devotional: [],
        other: [],
      },
    );
  }, [tracks]);

  const categorySummaries = useMemo(() => {
    return browseCategories.map((category) => ({ ...category }));
  }, []);
  const visibleCategorySummaries = categorySummaries.filter((category) => category.id !== "all");

  const allCatalogTracks = useMemo(() => [...tracks].sort(sortByPlaysThenRecent), [tracks]);
  const featuredPlaylists = useMemo(() => playlists.slice(0, playlistLimit), [playlists]);

  const focusedTracks = useMemo(() => {
    if (activeCategory === "all") {
      return allCatalogTracks;
    }

    return [...tracksByCategory[activeCategory]].sort(sortByPlaysThenRecent).slice(0, shelfLimit);
  }, [activeCategory, allCatalogTracks, tracksByCategory]);

  const filteredTracks = useMemo(
    () => (searching ? searchTracks(tracks, normalizedQuery) : []),
    [normalizedQuery, searching, tracks],
  );

  const filteredPlaylists = useMemo(
    () => (searching ? searchPlaylists(playlists, normalizedQuery) : []),
    [normalizedQuery, playlists, searching],
  );
  const hasCatalogContent = tracks.length > 0 || playlists.length > 0;

  const activeCategorySummary =
    categorySummaries.find((category) => category.id === activeCategory) ?? categorySummaries[0];
  const quickTracks = focusedTracks.slice(0, 5);

  const selectCategory = (categoryId: DiscoverCategory) => {
    startTransition(() => {
      setQuery("");
      setActiveCategory(categoryId);
    });
  };

  return (
    <div className={styles.page}>
      <section className={styles.commandDeck} aria-label="Discover search">
        <label className={styles.commandBar}>
          <Search size={17} strokeWidth={2.1} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search songs, artists, or playlists"
            aria-label="Search songs or playlists"
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

      {searching ? (
        <section className={styles.searchResults} aria-label="Search results">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Search results</h2>
              <p className={styles.sectionMeta}>
                {`${filteredTracks.length + filteredPlaylists.length} matches for "${normalizedQuery}"`}
              </p>
            </div>
            <button type="button" className={styles.textButton} onClick={() => setQuery("")}>
              Clear
            </button>
          </div>

          {filteredTracks.length ? (
            <TrackShelf
              title="Songs"
              meta="Matching tracks"
              tracks={filteredTracks}
              queueKey={`discover-search:${normalizedQuery}`}
              likedSet={likedSet}
              canEngage={canEngage}
            />
          ) : null}

          {filteredPlaylists.length ? (
            <PlaylistShelf
              title="Playlists"
              meta="Matching collections"
              playlists={filteredPlaylists}
              savedSet={savedSet}
              canEngage={canEngage}
              currentUserId={currentUserId}
            />
          ) : null}

          {!filteredTracks.length && !filteredPlaylists.length ? (
            <EmptyState
              title="No matches found"
              description="Try a shorter title, an artist name, or a different spelling."
            />
          ) : null}
        </section>
      ) : (
        <>
          {!hasCatalogContent ? (
            <section className={styles.searchResults} aria-label="Discover status">
              <EmptyState
                title="Discovery is still syncing."
                description="The catalog has not loaded into this view yet. Refresh in a moment or head back to the home page while the latest songs and playlists are fetched."
                actionLabel="Open home"
                actionHref="/"
              />
            </section>
          ) : null}

          <section className={styles.laneSection} id="discover-lanes">
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Browse lanes</h2>
              </div>
            </div>

            {hasCatalogContent ? (
              <div className={styles.categoryRail}>
                {visibleCategorySummaries.map((category) => {
                  const active = activeCategory === category.id;
                  const categoryPreviewTrack =
                    category.id === "all"
                      ? allCatalogTracks[0]
                      : [...tracksByCategory[category.id]].sort(sortByPlaysThenRecent)[0];

                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`${styles.categoryCard} ${active ? styles.categoryCardActive : ""}`}
                      style={
                        categoryPreviewTrack?.cover_url
                          ? ({ "--category-image": `url(${categoryPreviewTrack.cover_url})` } as CSSProperties)
                          : undefined
                      }
                      data-has-image={categoryPreviewTrack?.cover_url ? "true" : "false"}
                      onClick={() => selectCategory(category.id)}
                    >
                      <span className={styles.categoryOverlay}>
                        <span className={styles.categoryEyebrow}>{category.eyebrow}</span>
                        <strong className={styles.categoryTitle}>{category.title}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          {hasCatalogContent ? (
            <section className={styles.mainColumn}>
              <TrackShelf
                title="Made for you"
                tracks={quickTracks}
                queueKey={`discover-quick:${activeCategory}`}
                likedSet={likedSet}
                canEngage={canEngage}
              />

              <PlaylistShelf
                title="Featured collections"
                playlists={featuredPlaylists}
                savedSet={savedSet}
                canEngage={canEngage}
                currentUserId={currentUserId}
              />

              <TrackShelf
                title={activeCategory === "all" ? "Everything" : `${activeCategorySummary.title} songs`}
                tracks={focusedTracks}
                queueKey={`discover-focus:${activeCategory}`}
                likedSet={likedSet}
                canEngage={canEngage}
                actionLabel={activeCategory !== "all" ? "Show all" : undefined}
                onAction={activeCategory !== "all" ? () => selectCategory("all") : undefined}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
