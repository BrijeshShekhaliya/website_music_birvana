"use client";

import { Pause, Play } from "lucide-react";
import styles from "./TrackCard.module.css";
import { compactNumber, formatDuration } from "@/lib/format";
import { useMemo } from "react";
import { usePlayerPlayback } from "@/components/player/PlayerProvider";
import { LazyImage } from "@/components/shared/LazyImage";
import { TrackLikeButton } from "@/components/shared/TrackLikeButton";
import type { Track } from "@/types/models";

export function TrackCard({
  track,
  tracks,
  playbackTracks,
  index = 0,
  variant = "grid",
  initialLiked = false,
  showLikeButton = false,
  queueKey,
  eagerArtwork = false,
  onPlayAttempt,
}: {
  track: Track;
  tracks: Track[];
  playbackTracks?: Track[];
  index?: number;
  variant?: "grid" | "row" | "discover" | "liked";
  initialLiked?: boolean;
  showLikeButton?: boolean;
  queueKey?: string;
  eagerArtwork?: boolean;
  onPlayAttempt?: (track: Track) => boolean | Promise<boolean>;
}) {
  const {
    currentTrack,
    playing,
    playTracks,
    queueKey: activeQueueKey,
    togglePlayback,
  } = usePlayerPlayback();
  const active = currentTrack?.id === track.id;
  const resolvedPlaybackTracks = playbackTracks ?? tracks;
  const resolvedQueueKey = useMemo(
    () => queueKey ?? `collection:${resolvedPlaybackTracks.map((item) => item.id).join(",")}`,
    [queueKey, resolvedPlaybackTracks],
  );
  const sameQueue = activeQueueKey === resolvedQueueKey;

  const handlePlay = async () => {
    if (onPlayAttempt) {
      const allowed = await onPlayAttempt(track);

      if (allowed === false) {
        return;
      }
    }

    if (active && sameQueue) {
      togglePlayback();
      return;
    }

    playTracks(resolvedPlaybackTracks, index, resolvedQueueKey);
  };

  const className =
    variant === "row"
      ? styles.row
      : variant === "liked"
        ? `${styles.row} ${styles.likedRow}`
      : variant === "discover"
        ? `${styles.card} ${styles.discoverCard}`
        : styles.card;
  const activeClassName = `${className} ${active ? styles.activeTrack : ""} ${active && playing ? styles.playingTrack : ""}`;
  const bodyClassName =
    variant === "row"
      ? `${styles.body} ${styles.rowBody}`
      : variant === "liked"
        ? `${styles.body} ${styles.rowBody} ${styles.likedRowBody}`
      : variant === "discover"
        ? `${styles.body} ${styles.discoverBody}`
        : styles.body;
  const statsClassName =
    variant === "row"
      ? `${styles.stats} ${styles.rowStats}`
      : variant === "liked"
        ? `${styles.stats} ${styles.rowStats} ${styles.likedRowStats}`
      : variant === "discover"
        ? `${styles.stats} ${styles.discoverStats}`
        : styles.stats;
  const actionsClassName =
    variant === "row"
      ? `${styles.actions} ${styles.rowActions}`
      : variant === "liked"
        ? `${styles.actions} ${styles.rowActions} ${styles.likedRowActions}`
      : variant === "discover"
        ? `${styles.actions} ${styles.discoverActions}`
        : styles.actions;
  const showArtist = variant !== "liked";
  const showPlayCount = variant === "row";

  return (
    <article className={activeClassName} aria-current={active ? "true" : undefined}>
      <div className={styles.coverWrap}>
        {track.cover_url ? (
          <LazyImage className={styles.cover} src={track.cover_url} alt={track.title} eager={eagerArtwork} />
        ) : (
          <div className={styles.coverFallback}>{track.title.slice(0, 1)}</div>
        )}
        <button className={styles.playButton} type="button" onClick={handlePlay} aria-label={active && playing ? "Pause" : "Play"}>
          {active && playing ? <Pause size={18} strokeWidth={2.1} /> : <Play size={18} strokeWidth={2.1} />}
        </button>
      </div>

      <div className={bodyClassName}>
        <div className={styles.textBlock}>
          <p className={styles.name}>{track.title}</p>
          {showArtist ? <p className={styles.meta}>{track.artist_display}</p> : null}
        </div>

        <div className={statsClassName}>
          <span>{formatDuration(track.duration_seconds)}</span>
          {showPlayCount ? <span>{compactNumber(track.play_count)} plays</span> : null}
        </div>

        {showLikeButton ? (
          <div className={actionsClassName}>
            <TrackLikeButton
              songId={track.id}
              initialLiked={initialLiked}
              compact={variant === "row" || variant === "discover" || variant === "liked"}
              iconOnly={variant === "liked"}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
