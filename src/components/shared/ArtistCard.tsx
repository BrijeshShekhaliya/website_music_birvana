"use client";

import Link from "next/link";
import styles from "./ArtistCard.module.css";
import { ArtistFollowButton } from "@/components/shared/ArtistFollowButton";
import { LazyImage } from "@/components/shared/LazyImage";
import type { ArtistProfile } from "@/types/models";

export function ArtistCard({
  artist,
  initialFollowing = false,
  showFollowButton = false,
}: {
  artist: ArtistProfile;
  initialFollowing?: boolean;
  showFollowButton?: boolean;
}) {
  return (
    <article className={styles.card}>
      <Link href={`/artist/${artist.slug}`} className={styles.linkArea}>
        <div className={styles.avatarWrap}>
          {artist.image_url ? (
            <LazyImage className={styles.avatar} src={artist.image_url} alt={artist.name} />
          ) : (
            <div className={styles.avatarFallback}>{artist.name.slice(0, 1)}</div>
          )}
        </div>

        <div className={styles.body}>
          <p className={styles.role}>Artist</p>
          <p className={styles.name}>{artist.name}</p>
          <p className={styles.meta}>Open artist page</p>
        </div>
      </Link>

      {showFollowButton ? (
        <div className={styles.actions}>
          <ArtistFollowButton artistId={artist.id} initialFollowing={initialFollowing} compact />
        </div>
      ) : null}
    </article>
  );
}
