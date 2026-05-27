import Link from "next/link";
import { AudioLines, Globe2, ShieldCheck, Sparkles } from "lucide-react";
import { BrandLockup } from "@/components/shared/BrandLockup";
import { AppFooter } from "@/components/shared/AppFooter";
import { ThemeToggleButton } from "@/components/shared/ThemeToggleButton";
import styles from "./page.module.css";

const principles = [
  {
    icon: Sparkles,
    title: "Discovery first",
    description: "The strongest music surfaces stay up front.",
  },
  {
    icon: AudioLines,
    title: "Built to move",
    description: "Search, playlists, and personal pages stay easy to scan.",
  },
  {
    icon: ShieldCheck,
    title: "Consistent UI",
    description: "One visual system holds landing, auth, and app pages together.",
  },
  {
    icon: Globe2,
    title: "Ready to grow",
    description: "The product stays simple now without blocking future expansion.",
  },
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.nav}>
          <BrandLockup className={styles.brand} />
          <div className={styles.actions}>
            <ThemeToggleButton compact />
            <Link href="/" className={styles.ghost}>
              Home
            </Link>
            <Link href="/login" className={styles.ghost}>
              Login
            </Link>
            <Link href="/register" className={styles.solid}>
              Start free
            </Link>
          </div>
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>About BIRVANA</p>
            <h1 className={styles.title}>A music platform shaped to feel clear, fast, and modern.</h1>
            <p className={styles.subtitle}>
              BIRVANA is built around a simple idea: make discovery easy to enter and daily listening easy to keep using.
            </p>
            <div className={styles.heroActions}>
              <Link href="/register" className={styles.solid}>
                Create account
              </Link>
              <Link href="/login" className={styles.ghost}>
                Open app
              </Link>
            </div>
          </div>

          <aside className={styles.heroVisual}>
            <div className={styles.orb}>
              <span>B</span>
            </div>
            <div className={styles.visualCard}>
              <span className={styles.visualLabel}>Product direction</span>
              <strong>Simple first. Stronger where it matters.</strong>
              <p>The product keeps the public landing, auth, and signed-in app connected through one shared system.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.grid}>
        {principles.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.title} className={styles.card}>
              <span className={styles.cardIcon}>
                <Icon size={18} strokeWidth={2} />
              </span>
              <h2 className={styles.cardTitle}>{item.title}</h2>
              <p className={styles.cardText}>{item.description}</p>
            </article>
          );
        })}
      </section>

      <AppFooter />
    </main>
  );
}
