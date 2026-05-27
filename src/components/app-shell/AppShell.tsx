"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Clock3, Compass, Heart, Library, Settings, User, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AppShell.module.css";
import { PlayerBar } from "@/components/player/PlayerBar";
import { BrandLockup } from "@/components/shared/BrandLockup";
import { ThemeToggleButton } from "@/components/shared/ThemeToggleButton";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";

const navItems = [
  { href: "/discover", label: "Discover", icon: Compass, match: "/discover" },
  { href: "/library", label: "Library", icon: Library, match: "/library" },
  { href: "/liked", label: "Liked", icon: Heart, match: "/liked" },
  { href: "/history", label: "History", icon: Clock3, match: "/history", showInMobile: false },
  { href: "/artists", label: "Artists", icon: Users, match: "/artists" },
  { href: "/profile", label: "Profile", icon: User, match: "/profile", showInMobile: false },
  { href: "/settings", label: "Settings", icon: Settings, match: "/settings", showInMobile: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const bottomNavItems = navItems.filter((item) => item.showInMobile !== false);
  const bottomNavStyle = { "--bottom-nav-count": String(bottomNavItems.length) } as CSSProperties;
  const userLabel =
    typeof user?.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
      ? user.user_metadata.display_name.trim()
      : user?.email?.split("@")[0] ?? "Listener";
  const userAvatar =
    typeof user?.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url.trim()
      ? user.user_metadata.avatar_url.trim()
      : typeof user?.user_metadata?.picture === "string" && user.user_metadata.picture.trim()
        ? user.user_metadata.picture.trim()
        : typeof user?.user_metadata?.avatar === "string" && user.user_metadata.avatar.trim()
          ? user.user_metadata.avatar.trim()
          : null;
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("birvana-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = savedTheme === "dark" || (!savedTheme && prefersDark) ? "dark" : "light";
    const savedMotion = window.localStorage.getItem("birvana-motion");
    const savedPlayerSize = window.localStorage.getItem("birvana-player-size");
    const savedSourceBadges = window.localStorage.getItem("birvana-source-badges");
    const savedDesktopEffects = window.localStorage.getItem("birvana-desktop-effects");

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.motion = savedMotion === "reduced" ? "reduced" : "full";
    document.documentElement.dataset.playerSize = savedPlayerSize === "comfortable" ? "comfortable" : "compact";
    document.documentElement.dataset.sourceBadges = savedSourceBadges === "off" ? "off" : "on";
    document.documentElement.dataset.desktopEffects = savedDesktopEffects === "off" ? "off" : "on";
  }, []);

  useEffect(() => {
    for (const item of navItems) {
      if (pathname.startsWith(item.match)) {
        continue;
      }

      router.prefetch(item.href);
    }
  }, [pathname, router]);

  return (
    <ToastProvider>
      <div className={styles.viewport}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTop}>
            <Link href="/discover" className={styles.brand}>
              <BrandLockup size="compact" />
            </Link>
          </div>

          <nav className={styles.nav}>
            {navItems.map((item) => {
              const active = pathname.startsWith(item.match);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={`${styles.navLink} ${active ? styles.active : ""}`}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  {item.label}
                </Link>
                );
              })}
          </nav>

          <div className={styles.sidebarFooter}>
            <ThemeToggleButton compact />
            <Link href="/profile" className={styles.sidebarProfile} aria-label="Profile">
              <span className={styles.userAvatar} aria-hidden="true">
                {userAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatar} alt="" />
                ) : (
                  userLabel.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className={styles.sidebarProfileCopy}>
                <strong>{userLabel}</strong>
                <span>Profile</span>
              </span>
            </Link>
          </div>
        </aside>

        <div className={styles.mainArea}>
          <header className={styles.mobileHeader}>
            <div className={styles.mobileHeaderRow}>
              <div className={styles.mobileBrand}>
                <Link href="/discover" className={styles.brand}>
                  <BrandLockup size="compact" />
                </Link>
              </div>
              <div className={styles.mobileActions}>
                <ThemeToggleButton compact />
                <Link href="/profile" className={styles.profileChip} aria-label="Profile">
                  <span className={styles.userAvatar} aria-hidden="true">
                    {userAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userAvatar} alt="" />
                    ) : (
                      userLabel.slice(0, 1).toUpperCase()
                    )}
                  </span>
                </Link>
              </div>
            </div>
          </header>

          <main className={styles.content}>{children}</main>

          <nav className={styles.bottomNav} style={bottomNavStyle}>
            {bottomNavItems.map((item) => {
              const active = pathname.startsWith(item.match);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={`${styles.bottomLink} ${active ? styles.bottomActive : ""}`}
                >
                  <Icon size={16} strokeWidth={1.9} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <PlayerBar />
      </div>
    </ToastProvider>
  );
}
