import { notFound } from "next/navigation";
import { ArtistFollowButton } from "@/components/shared/ArtistFollowButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { LazyImage } from "@/components/shared/LazyImage";
import { TrackCard } from "@/components/shared/TrackCard";
import { getFollowedArtistIds } from "@/lib/auth/account-state";
import { getArtistDetail, getCurrentUser, getEngagementState } from "@/lib/data";
import styles from "./page.module.css";

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, detail] = await Promise.all([getCurrentUser(), getArtistDetail(id)]);
  const { artist, tracks } = detail;

  if (!artist) {
    notFound();
  }

  const engagement = user
    ? await getEngagementState({
        userId: user.id,
        songIds: tracks.map((track) => track.id),
      })
    : null;
  const likedSongIds = new Set(engagement?.likedSongIds ?? []);
  const followedArtistIds = user ? new Set(getFollowedArtistIds(user)) : new Set<string>();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroMedia}>
          {artist.image_url ? (
            <LazyImage className={styles.heroImage} src={artist.image_url} alt={artist.name} />
          ) : (
            <div className={styles.heroFallback}>{artist.name.slice(0, 1)}</div>
          )}
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Artist</p>
          <h1 className={styles.name}>{artist.name}</h1>
          {artist.bio ? (
            <p className={styles.bio}>{artist.bio}</p>
          ) : (
            <p className={`${styles.bio} ${styles.bioMuted}`}>
              Explore the songs currently available from {artist.name} in the BIRVANA catalog.
            </p>
          )}

          <div className={styles.actions}>
            <span className={styles.infoPill}>
              {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            </span>
            {user ? (
              <ArtistFollowButton
                artistId={artist.id}
                initialFollowing={followedArtistIds.has(artist.id)}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.trackPanel}>
        <div className={styles.trackHeader}>
          <div>
            <p className={styles.trackEyebrow}>Catalog</p>
            <h2 className={styles.trackTitle}>Songs by {artist.name}</h2>
          </div>
        </div>

        {tracks.length ? (
          <div className={styles.trackList}>
            {tracks.map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                tracks={tracks}
                index={index}
                variant="liked"
                queueKey={`artist:${artist.slug}`}
                initialLiked={likedSongIds.has(track.id)}
                showLikeButton={Boolean(user)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No songs available yet"
            description="This artist does not have a ready song in the public catalog right now."
          />
        )}
      </section>
    </div>
  );
}
