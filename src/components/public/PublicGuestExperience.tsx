"use client";

import Link from "next/link";
import {
  Lock,
  Pause,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { PlaylistCard } from "@/components/shared/PlaylistCard";
import { TrackCard } from "@/components/shared/TrackCard";
import { AppFooter } from "@/components/shared/AppFooter";
import { BrandLockup } from "@/components/shared/BrandLockup";
import { EmptyState } from "@/components/shared/EmptyState";
import { ThemeToggleButton } from "@/components/shared/ThemeToggleButton";
import { usePlayer } from "@/components/player/PlayerProvider";
import { formatDuration } from "@/lib/format";
import { resolveTrackCategory, type MusicCategory } from "@/lib/music/categories";
import { searchPlaylists, searchTracks } from "@/lib/search";
import type { Playlist, Track } from "@/types/models";
import styles from "./PublicGuestExperience.module.css";

type PublicCategory = "all" | MusicCategory;
type PublicTrackCategory = Exclude<PublicCategory, "all">;
type PublicBrowseCategory = {
  id: PublicTrackCategory;
  title: string;
  eyebrow: string;
};

const topTrackLimit = 10;
const playlistLimit = 8;
const guestLimitFallback = 5;

const browseCategories: Array<{
  id: PublicCategory;
  title: string;
  eyebrow: string;
}> = [
  { id: "all", title: "Everything", eyebrow: "Full catalog" },
  { id: "hindi", title: "Bollywood", eyebrow: "Hindi picks" },
  { id: "punjabi", title: "Punjabi", eyebrow: "High energy" },
  { id: "english", title: "Global", eyebrow: "Worldwide picks" },
  { id: "south", title: "South", eyebrow: "Regional favorites" },
  { id: "devotional", title: "Bhakti", eyebrow: "Reflective listens" },
  { id: "other", title: "Indie", eyebrow: "Outside the main lanes" },
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

type GuestPlaybackState = {
  limit: number;
  playedTrackIds: number[];
  remaining: number;
};

function GuestAuthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.modalScrim} role="presentation">
      <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="guest-auth-title">
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close login prompt">
          <X size={18} />
        </button>
        <span className={styles.modalBadge}>
          <Lock size={14} />
          Keep listening
        </span>
        <h2 id="guest-auth-title" className={styles.modalTitle}>
          Login to keep listening.
        </h2>
        <p className={styles.modalText}>
          Sign in to unlock the full catalog, save what you like, and keep your listening flow across devices.
        </p>
        <div className={styles.modalActions}>
          <Link href="/login" className={styles.modalPrimary}>
            Login
          </Link>
          <Link href="/register" className={styles.modalSecondary}>
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

function PublicMiniPlayer({
  remaining,
}: {
  remaining: number;
}) {
  const { currentTrack, playing, progress, duration, togglePlayback, seekTo } = usePlayer();

  if (!currentTrack) {
    return null;
  }

  const progressMax = Math.max(duration, progress, 1);
  const progressValue = Math.min(progress, progressMax);
  const progressPercent = `${Math.min((progressValue / progressMax) * 100, 100)}%`;

  return (
    <div className={styles.playerDock}>
      <div className={styles.playerMeta}>
        {currentTrack.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.playerArtwork} src={currentTrack.cover_url} alt={currentTrack.title} />
        ) : (
          <div className={styles.playerFallback}>{currentTrack.title.slice(0, 1)}</div>
        )}
        <div className={styles.playerCopy}>
          <p className={styles.playerEyebrow}>Now playing</p>
          <strong className={styles.playerTitle}>{currentTrack.title}</strong>
          <span className={styles.playerArtist}>{currentTrack.artist_display}</span>
        </div>
      </div>

      <div className={styles.playerControls}>
        <button type="button" className={styles.playerToggle} onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <div className={styles.playerTimelineWrap}>
          <input
            className={styles.playerTimeline}
            type="range"
            min={0}
            max={progressMax}
            value={progressValue}
            onChange={(event) => seekTo(Number(event.target.value))}
            style={{ "--slider-progress": progressPercent } as CSSProperties}
            aria-label="Preview playback progress"
          />
          <div className={styles.playerTimes}>
            <span>{formatDuration(progress)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      </div>

      <div className={styles.playerAside}>
        <span className={styles.previewPill}>{remaining} songs left</span>
        <Link href="/login" className={styles.playerLoginLink}>
          Login
        </Link>
      </div>
    </div>
  );
}

export function PublicGuestExperience({
  tracks,
  playlists,
}: {
  tracks: Track[];
  playlists: Playlist[];
}) {
  const { playTracks } = usePlayer();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<PublicCategory>("all");
  const [guestState, setGuestState] = useState<GuestPlaybackState>({
    limit: guestLimitFallback,
    playedTrackIds: [],
    remaining: guestLimitFallback,
  });
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim();
  const searching = normalizedQuery.length > 0;

  useEffect(() => {
    let active = true;

    void fetch("/api/public-playback/authorize")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active || !payload) {
          return;
        }

        setGuestState({
          limit: payload.limit ?? guestLimitFallback,
          playedTrackIds: Array.isArray(payload.playedTrackIds) ? payload.playedTrackIds : [],
          remaining: typeof payload.remaining === "number" ? payload.remaining : guestLimitFallback,
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const tracksByCategory = useMemo(() => {
    return tracks.reduce<Record<PublicTrackCategory, Track[]>>(
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

  const topTracks = useMemo(() => [...tracks].sort(sortByPlaysThenRecent).slice(0, topTrackLimit), [tracks]);
  const fullCatalog = useMemo(() => [...tracks].sort(sortByPlaysThenRecent), [tracks]);
  const featuredPlaylists = useMemo(() => playlists.slice(0, playlistLimit), [playlists]);

  const filteredTracks = useMemo(
    () => (searching ? searchTracks(tracks, normalizedQuery) : []),
    [normalizedQuery, searching, tracks],
  );

  const filteredPlaylists = useMemo(
    () => (searching ? searchPlaylists(playlists, normalizedQuery) : []),
    [normalizedQuery, playlists, searching],
  );

  const categoryTracks = useMemo(() => {
    if (activeCategory === "all") {
      return fullCatalog;
    }

    return [...tracksByCategory[activeCategory]].sort(sortByPlaysThenRecent);
  }, [activeCategory, fullCatalog, tracksByCategory]);

  const categoryCounts = useMemo(() => browseCategories.map((category) => ({ ...category })), []);
  const visibleCategories = categoryCounts.filter(
    (category): category is PublicBrowseCategory => category.id !== "all",
  );
  const hasCatalogContent = tracks.length > 0 || playlists.length > 0;

  const leadPlaylist = featuredPlaylists[0];
  const spotlightTracks = categoryTracks.slice(0, 6);
  const heroTracks = topTracks.slice(0, 3);
  const heroArtwork = leadPlaylist?.cover_url ?? heroTracks[0]?.cover_url ?? spotlightTracks[0]?.cover_url ?? null;

  const authorizeGuestTrack = async (track: Track) => {
    if (guestState.playedTrackIds.includes(track.id)) {
      playTracks([track], 0, `guest-preview:${track.id}`);
      return true;
    }

    const response = await fetch("/api/public-playback/authorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trackId: track.id }),
    });

    const payload = (await response.json().catch(() => ({}))) as Partial<GuestPlaybackState> & {
      allowed?: boolean;
      requiresAuth?: boolean;
    };

    if (!response.ok) {
      setAuthPromptOpen(true);
      return false;
    }

    setGuestState((current) => ({
      limit: typeof payload.limit === "number" ? payload.limit : current.limit,
      playedTrackIds: Array.isArray(payload.playedTrackIds) ? payload.playedTrackIds : current.playedTrackIds,
      remaining: typeof payload.remaining === "number" ? payload.remaining : current.remaining,
    }));

    if (!payload.allowed) {
      setAuthPromptOpen(true);
      return false;
    }

    playTracks([track], 0, `guest-preview:${track.id}`);
    return true;
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.nav}>
          <BrandLockup className={styles.brand} />
          <div className={styles.navActions}>
            <a className={styles.navGhost} href="#discover-preview">
              Explore
            </a>
            <Link className={styles.navGhost} href="/about">
              About
            </Link>
            <ThemeToggleButton compact />
            <Link className={styles.navLogin} href="/login">
              Log in
            </Link>
            <Link className={styles.navSolid} href="/register">
              Get started
            </Link>
          </div>
        </div>

        <div className={styles.heroStage}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}>
              <Sparkles size={14} />
              Guest preview
            </span>
            <p className={styles.eyebrow}>Open the catalog first</p>
            <h1 className={styles.title}>
              Start with the music,
              <span> not the login screen</span>
            </h1>
            <p className={styles.subtitle}>
              Search, preview tracks, and open playlists instantly. Sign in only when you want the full listening flow.
            </p>

            <div className={styles.ctaRow}>
              <Link className={styles.primaryCta} href="/register">
                Start free
              </Link>
              <a className={styles.secondaryCta} href="#discover-preview">
                Browse now
              </a>
            </div>

            <div className={styles.heroTags}>
              <span className={styles.heroTag}>Quick search</span>
              <span className={styles.heroTag}>Playlist preview</span>
              <span className={styles.heroTag}>Mobile ready</span>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div
              className={styles.heroArtwork}
              style={heroArtwork ? ({ "--hero-artwork": `url(${heroArtwork})` } as CSSProperties) : undefined}
              data-has-image={heroArtwork ? "true" : "false"}
            >
              <div className={styles.heroPanelCard}>
                <span className={styles.overlayLabel}>Featured lane</span>
                <strong>{leadPlaylist?.name ?? "Jump into the public catalog"}</strong>
                <p>
                  {leadPlaylist
                    ? "Open a playlist, then keep moving through tracks without losing the flow."
                    : "Preview tracks now, then login only when you want to save and keep listening."}
                </p>
              </div>
            </div>

            {heroTracks.length ? (
              <div className={styles.heroQueue}>
                {heroTracks.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    className={styles.heroTrackRow}
                    onClick={() => {
                      void authorizeGuestTrack(track);
                    }}
                  >
                    {track.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.heroTrackMedia} src={track.cover_url} alt={track.title} />
                    ) : (
                      <div className={styles.heroTrackFallback}>{track.title.slice(0, 1)}</div>
                    )}
                    <div className={styles.heroTrackCopy}>
                      <strong>{track.title}</strong>
                      <span>{track.artist_display}</span>
                    </div>
                    <span className={styles.heroTrackMeta}>{formatDuration(track.duration_seconds)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <label className={styles.searchField}>
          <Search size={17} strokeWidth={2.15} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search songs, artists, or playlists"
            aria-label="Search songs, artists, or playlists"
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
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Search results</h2>
              <p className={styles.sectionMeta}>
                {`${filteredTracks.length + filteredPlaylists.length} matches for "${normalizedQuery}"`}
              </p>
            </div>
            <button type="button" className={styles.inlineButton} onClick={() => setQuery("")}>
              Clear
            </button>
          </div>

          {filteredTracks.length ? (
            <div className={styles.trackGrid}>
              {filteredTracks.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  tracks={[track]}
                  queueKey={`guest-preview:${track.id}`}
                  variant="discover"
                  onPlayAttempt={authorizeGuestTrack}
                />
              ))}
            </div>
          ) : null}

          {filteredPlaylists.length ? (
            <div className={styles.playlistGrid}>
              {filteredPlaylists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} size="discover" />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <>
          {!hasCatalogContent ? (
            <section className={styles.section}>
              <EmptyState
                title="The catalog is being refreshed."
                description="Discovery is still loading music right now. You can keep exploring the app shell, switch themes, or create an account while new tracks sync in."
                actionLabel="Create account"
                actionHref="/register"
              />
            </section>
          ) : null}

          <section className={styles.section} id="discover-preview">
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Browse</h2>
                <p className={styles.sectionMeta}>Start with a lane, then move straight into tracks.</p>
              </div>
            </div>

            {hasCatalogContent ? (
              <>
                <div className={styles.categoryDeck}>
                  {visibleCategories.map((category) => {
                    const categoryPreviewTrack = [...tracksByCategory[category.id]].sort(sortByPlaysThenRecent)[0];

                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`${styles.categoryCard} ${
                          activeCategory === category.id ? styles.categoryCardActive : ""
                        }`}
                        style={
                          categoryPreviewTrack?.cover_url
                            ? ({ "--category-image": `url(${categoryPreviewTrack.cover_url})` } as CSSProperties)
                            : undefined
                        }
                        data-has-image={categoryPreviewTrack?.cover_url ? "true" : "false"}
                        onClick={() => {
                          startTransition(() => {
                            setQuery("");
                            setActiveCategory(category.id);
                          });
                        }}
                      >
                        <span className={styles.categoryOverlay}>
                          <span className={styles.categoryEyebrow}>{category.eyebrow}</span>
                          <strong className={styles.categoryTitle}>{category.title}</strong>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.trackRail}>
                  {spotlightTracks.map((track) => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      tracks={[track]}
                      queueKey={`guest-preview:${track.id}`}
                      variant="discover"
                      onPlayAttempt={authorizeGuestTrack}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.placeholderRail} aria-hidden="true">
                {visibleCategories.slice(0, 6).map((category) => (
                  <div key={category.id} className={styles.placeholderCard}>
                    <span className={styles.placeholderEyebrow}>{category.eyebrow}</span>
                    <strong className={styles.placeholderTitle}>{category.title}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.dashboardSection}>
            <div className={styles.dashboardMain}>
              {hasCatalogContent ? (
                <>
                  <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <div>
                        <h2 className={styles.sectionTitle}>Popular right now</h2>
                        <p className={styles.sectionMeta}>Fast picks from the tracks listeners are opening first.</p>
                      </div>
                    </div>
                    <div className={styles.trackGrid}>
                      {topTracks.map((track) => (
                        <TrackCard
                          key={track.id}
                          track={track}
                          tracks={[track]}
                          queueKey={`guest-preview:${track.id}`}
                          variant="discover"
                          onPlayAttempt={authorizeGuestTrack}
                        />
                      ))}
                    </div>
                  </section>

                  <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <div>
                        <h2 className={styles.sectionTitle}>Playlists</h2>
                        <p className={styles.sectionMeta}>Open a ready-made route when you want less scrolling.</p>
                      </div>
                    </div>
                    <div className={styles.playlistGrid}>
                      {featuredPlaylists.map((playlist) => (
                        <PlaylistCard key={playlist.id} playlist={playlist} size="discover" />
                      ))}
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </section>
        </>
      )}

      <AppFooter />
      <PublicMiniPlayer remaining={guestState.remaining} />
      <GuestAuthModal open={authPromptOpen} onClose={() => setAuthPromptOpen(false)} />
    </main>
  );
}
