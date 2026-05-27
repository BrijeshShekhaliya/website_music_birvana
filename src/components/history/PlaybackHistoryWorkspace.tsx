"use client";

import Link from "next/link";
import { Clock3, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { usePlayerHistory, usePlayerPlayback } from "@/components/player/PlayerProvider";
import { LazyImage } from "@/components/shared/LazyImage";
import styles from "./PlaybackHistoryWorkspace.module.css";

function formatHistoryTime(value: number) {
  if (!value) {
    return "Recently played";
  }

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffSeconds = Math.round((value - Date.now()) / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(diffDays, "day");
}

export function PlaybackHistoryWorkspace() {
  const { history, playHistoryItem, clearPlaybackHistory } = usePlayerHistory();
  const { currentTrack, playing, togglePlayback } = usePlayerPlayback();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>History</p>
          <h1>Recently played</h1>
          <p>Your recent songs stay ready to resume on this device.</p>
        </div>
        {history.length ? (
          <button type="button" className={styles.clearButton} onClick={clearPlaybackHistory}>
            <Trash2 size={16} strokeWidth={2} />
            Clear history
          </button>
        ) : null}
      </section>

      {history.length ? (
        <section className={styles.historyList} aria-label="Playback history">
          {history.map((item) => {
            const active = currentTrack?.id === item.track.id;
            const canToggle = active;

            return (
              <article key={`${item.track.id}-${item.updatedAt}`} className={`${styles.historyRow} ${active ? styles.activeRow : ""}`}>
                <button
                  type="button"
                  className={styles.coverButton}
                  onClick={() => {
                    if (canToggle) {
                      togglePlayback();
                      return;
                    }

                    playHistoryItem(item);
                  }}
                  aria-label={active && playing ? `Pause ${item.track.title}` : `Resume ${item.track.title}`}
                >
                  {item.track.cover_url ? (
                    <LazyImage src={item.track.cover_url} alt={item.track.title} />
                  ) : (
                    <span>{item.track.title.slice(0, 1)}</span>
                  )}
                  <span className={styles.playBadge}>
                    {active && playing ? <Pause size={15} strokeWidth={2.2} /> : <Play size={15} strokeWidth={2.2} />}
                  </span>
                </button>

                <div className={styles.rowCopy}>
                  <div>
                    <p className={styles.trackTitle}>{item.track.title}</p>
                    <p className={styles.trackMeta}>{item.track.artist_display}</p>
                  </div>
                  <div className={styles.rowMeta}>
                    <span>{formatDuration(item.progress)} saved</span>
                    <span>{formatHistoryTime(item.updatedAt)}</span>
                  </div>
                </div>

                <button type="button" className={styles.resumeButton} onClick={() => playHistoryItem(item)}>
                  <RotateCcw size={16} strokeWidth={2} />
                  Resume
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className={styles.empty}>
          <Clock3 size={24} strokeWidth={2} />
          <h2>No play history yet</h2>
          <p>Play a song and it will appear here.</p>
          <Link href="/discover">Browse music</Link>
        </section>
      )}
    </div>
  );
}
