import Link from "next/link";
import { Clock3 } from "lucide-react";
import styles from "./page.module.css";
import { LibraryCollectionsPanel } from "@/components/library/LibraryCollectionsPanel";
import { getCurrentUser, getLibraryData } from "@/lib/data";

export default async function LibraryPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { ownedPlaylists, savedPlaylists } = await getLibraryData(user.id);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>Library</p>
          <h1 className={styles.heroTitle}>Your playlists, in one place.</h1>
          <p className={styles.heroText}>Open what you made, saved, or want to hear again.</p>
        </div>
      </section>

      <section className={styles.historyEntry} aria-label="Playback history">
        <div>
          <p className={styles.historyEyebrow}>History</p>
          <h2>Resume listening</h2>
          <p>Jump back into your recent songs.</p>
        </div>
        <Link href="/history" className={styles.historyLink}>
          <Clock3 size={18} strokeWidth={2} />
          Open
        </Link>
      </section>

      <LibraryCollectionsPanel
        ownedPlaylists={ownedPlaylists}
        savedPlaylists={savedPlaylists}
        currentUserId={user.id}
      />
    </div>
  );
}
