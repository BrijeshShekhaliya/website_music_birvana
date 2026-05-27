import Link from "next/link";
import styles from "./AppFooter.module.css";

const footerLinks = [
  { href: "/", label: "Discover" },
  { href: "/about", label: "About" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
];

export function AppFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brandBlock}>
        <p className={styles.brand}>BIRVANA</p>
        <p className={styles.caption}>A cleaner music platform for discovery, playlists, and daily listening.</p>
      </div>

      <div className={styles.links}>
        {footerLinks.map((link) => (
          <Link key={link.href} href={link.href} className={styles.link}>
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
