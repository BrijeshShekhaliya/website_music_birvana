import styles from "./page.module.css";
import { EmptyState } from "@/components/shared/EmptyState";
import { TrackCard } from "@/components/shared/TrackCard";
import { getCurrentUser, getLikedTracks } from "@/lib/data";

export default async function LikedPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const tracks = await getLikedTracks(user.id);

  return (
    <div className={styles.page}>
      {tracks.length ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>Liked songs</p>
              <h1 className={styles.heroTitle}>Your favorites.</h1>
              <p className={styles.heroText}>The songs you want close.</p>
            </div>
          </section>

          <section className={styles.tracksSection}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Saved</p>
                <h2 className={styles.sectionTitle}>All liked songs</h2>
              </div>
            </div>

            <div className={styles.list}>
              {tracks.map((track, index) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  tracks={tracks}
                  index={index}
                  variant="liked"
                  queueKey="liked"
                  initialLiked
                  showLikeButton
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          title="Nothing liked yet"
          description="Like a song and it will show here."
          actionLabel="Browse discover"
          actionHref="/discover"
        />
      )}
    </div>
  );
}
