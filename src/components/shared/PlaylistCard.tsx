"use client";

import clsx from "clsx";
import Link from "next/link";
import { Disc3, Headphones } from "lucide-react";
import styles from "./PlaylistCard.module.css";
import { compactNumber } from "@/lib/format";
import { PlaylistSaveButton } from "@/components/shared/PlaylistSaveButton";
import { PlaylistArtwork } from "@/components/shared/PlaylistArtwork";
import type { Playlist } from "@/types/models";

export function PlaylistCard({
  playlist,
  initialSaved = false,
  showSaveButton = false,
  size = "default",
}: {
  playlist: Playlist;
  initialSaved?: boolean;
  showSaveButton?: boolean;
  size?: "default" | "compact" | "discover" | "library";
}) {
  const playlistLabel = size === "library" ? "Playlist" : "Collection";
  const description =
    playlist.description
    || (size === "compact"
      ? "Built for the next session."
      : size === "library"
        ? "Open and keep listening."
      : size === "discover"
        ? "Start here."
        : "Curated for repeat listening.");

  return (
    <article
      className={clsx(
        styles.card,
        size === "compact" && styles.compact,
        size === "discover" && styles.discover,
        size === "library" && styles.library,
        showSaveButton && styles.withAction,
      )}
    >
      {showSaveButton ? (
        <div className={styles.saveDock}>
          <PlaylistSaveButton
            playlistId={playlist.id}
            initialSaved={initialSaved}
            compact
            iconOnly
          />
        </div>
      ) : null}

      <Link
        href={`/playlist/${playlist.id}`}
        className={clsx(
          styles.linkArea,
          size === "compact" && styles.linkAreaCompact,
          size === "discover" && styles.linkAreaDiscover,
          size === "library" && styles.linkAreaLibrary,
        )}
      >
        <div className={styles.coverWrap}>
          <PlaylistArtwork name={playlist.name} coverUrl={playlist.cover_url} />
          <div className={styles.coverOverlay} />
          <div className={styles.coverMeta}>
            <span className={styles.coverTag}>Playlist</span>
          </div>
        </div>

          <div className={styles.body}>
            <div className={styles.copy}>
            <div className={styles.kickerRow}>
              <span className={styles.kicker}>{playlistLabel}</span>
            </div>
            <p className={styles.name}>{playlist.name}</p>
            <p className={styles.description}>{description}</p>
          </div>

          <div className={styles.metaRow}>
            <span className={styles.metaPill}>
              <Disc3 size={14} strokeWidth={1.9} />
              <span>{playlist.song_count} tracks</span>
            </span>
            <span className={styles.metaPill}>
              <Headphones size={14} strokeWidth={1.9} />
              <span>{compactNumber(playlist.follower_count)} saves</span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
