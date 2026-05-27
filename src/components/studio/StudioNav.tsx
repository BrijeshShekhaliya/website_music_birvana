"use client";

import Link from "next/link";
import { Music2, Upload } from "lucide-react";
import { usePathname } from "next/navigation";
import styles from "./StudioNav.module.css";

const studioLinks = [
  { href: "/studio/upload", label: "Upload", icon: Upload },
  { href: "/studio/tracks", label: "Tracks", icon: Music2 },
];

export function StudioNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {studioLinks.map((link) => {
        const active = pathname === link.href;
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.link} ${active ? styles.active : ""}`}
          >
            <Icon size={16} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
