"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useSyncExternalStore } from "react";
import styles from "./ThemeToggleButton.module.css";

type ThemeMode = "light" | "dark";

const themeChangeEvent = "birvana-theme-change";
const preferenceCookieMaxAge = 60 * 60 * 24 * 365;

function readTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const documentTheme = document.documentElement.dataset.theme;

  if (documentTheme === "dark" || documentTheme === "light") {
    return documentTheme;
  }

  const storedTheme = window.localStorage.getItem("birvana-theme");

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(themeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

export function ThemeToggleButton({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");

  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  const toggleTheme = () => {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("birvana-theme", nextTheme);
    document.cookie = `birvana-theme=${nextTheme};path=/;max-age=${preferenceCookieMaxAge};samesite=lax`;
    window.dispatchEvent(new Event(themeChangeEvent));
  };

  return (
    <button
      type="button"
      className={`${styles.toggle} ${compact ? styles.compact : ""}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        {theme === "dark" ? <SunMedium size={16} strokeWidth={2} /> : <MoonStar size={16} strokeWidth={2} />}
      </span>
      <span className={styles.label}>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
