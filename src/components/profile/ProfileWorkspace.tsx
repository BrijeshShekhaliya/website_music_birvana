import Link from "next/link";
import { CalendarDays, Heart, Library, ShieldCheck, Users } from "lucide-react";
import { ProfileEditModal } from "@/components/profile/ProfileEditModal";
import { LazyImage } from "@/components/shared/LazyImage";
import type { ProfileOverview } from "@/types/models";
import styles from "./ProfileWorkspace.module.css";

function formatDate(value?: string | null) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "B";
}

export function ProfileWorkspace({
  overview,
  email,
}: {
  overview: ProfileOverview;
  email: string;
}) {
  const { profile } = overview;

  if (!profile) {
    return (
      <section className={styles.empty}>
        <h1>Profile not found</h1>
        <p>Your account exists, but the profile row is missing.</p>
      </section>
    );
  }

  const identity = profile.username ? `@${profile.username}` : email;
  const displayNameNeedsReview = profile.display_name.includes(",") && !profile.username;
  const displayName = displayNameNeedsReview ? "Your Birvana profile" : profile.display_name;
  const accountType = "Listener";

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.identityBlock}>
          <div className={styles.avatarFrame}>
            {profile.avatar_url ? (
              <LazyImage src={profile.avatar_url} alt={displayName} className={styles.avatar} eager />
            ) : (
              <span>{getInitials(displayName)}</span>
            )}
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Profile</p>
            <h1>{displayName}</h1>
            <p>{identity}</p>
            {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}
            <div className={styles.badges}>
              <span>
                <ShieldCheck size={15} strokeWidth={2} />
                {accountType}
              </span>
              <span>
                <CalendarDays size={15} strokeWidth={2} />
                Joined {formatDate(profile.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.heroActions}>
          <ProfileEditModal profile={profile} triggerClassName={styles.secondaryAction} />
          <Link href="/library" className={styles.primaryAction}>
            Open library
          </Link>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Shortcuts</p>
              <h2>Open faster</h2>
            </div>
          </div>

          <div className={styles.quickLinks}>
            <Link href="/library">
              <Library size={18} />
              <span>Library</span>
              <small>Playlists and saved mixes.</small>
            </Link>
            <Link href="/liked">
              <Heart size={18} />
              <span>Liked songs</span>
              <small>Your saved songs.</small>
            </Link>
            <Link href="/artists">
              <Users size={18} />
              <span>Artists</span>
              <small>Browse artist pages.</small>
            </Link>
            <a href="https://pub-c356460231d64956950b327b6efadbbf.r2.dev/Birvana%20aaplication/Birvana.apk" download>
              <Heart size={18} />
              <span>Download App</span>
              <small>Get Birvana for Android.</small>
            </a>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.accountPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Account</p>
              <h2>Profile details</h2>
            </div>
          </div>

          <div className={styles.detailList}>
            <div className={styles.detailItem}>
              <span>Display name</span>
              <strong>{displayName}</strong>
            </div>
            <div className={styles.detailItem}>
              <span>Email</span>
              <strong>{email}</strong>
            </div>
            <div className={styles.detailItem}>
              <span>Account type</span>
              <strong>{accountType}</strong>
            </div>
            <div className={styles.detailItem}>
              <span>Joined</span>
              <strong>{formatDate(profile.created_at)}</strong>
            </div>
            <div className={styles.detailItemWide}>
              <span>Bio</span>
              <strong>{profile.bio || "No bio added yet."}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
