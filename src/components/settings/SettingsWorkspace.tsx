"use client";

import { useSyncExternalStore } from "react";
import styles from "./SettingsWorkspace.module.css";

type ThemeMode = "light" | "dark";
type MotionMode = "full" | "reduced";
type PlayerSizeMode = "compact" | "comfortable";
type ToggleMode = "on" | "off";
const themeChangeEvent = "birvana-theme-change";
const motionChangeEvent = "birvana-motion-change";
const playerSizeChangeEvent = "birvana-player-size-change";
const sourceBadgesChangeEvent = "birvana-source-badges-change";
const desktopEffectsChangeEvent = "birvana-desktop-effects-change";
const preferenceCookieMaxAge = 60 * 60 * 24 * 365;

function writePreferenceCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${preferenceCookieMaxAge};samesite=lax`;
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const documentTheme = document.documentElement.dataset.theme;

  if (documentTheme === "dark" || documentTheme === "light") {
    return documentTheme;
  }

  const savedTheme = window.localStorage.getItem("birvana-theme");

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredMotion(): MotionMode {
  if (typeof window === "undefined") {
    return "full";
  }

  const documentMotion = document.documentElement.dataset.motion;

  if (documentMotion === "full" || documentMotion === "reduced") {
    return documentMotion;
  }

  const savedMotion = window.localStorage.getItem("birvana-motion");

  return savedMotion === "reduced" ? "reduced" : "full";
}

function readStoredPlayerSize(): PlayerSizeMode {
  if (typeof window === "undefined") {
    return "compact";
  }

  const documentPlayerSize = document.documentElement.dataset.playerSize;

  if (documentPlayerSize === "compact" || documentPlayerSize === "comfortable") {
    return documentPlayerSize;
  }

  const savedPlayerSize = window.localStorage.getItem("birvana-player-size");

  return savedPlayerSize === "comfortable" ? "comfortable" : "compact";
}

function readStoredToggle(datasetKey: "sourceBadges" | "desktopEffects", storageKey: string): ToggleMode {
  if (typeof window === "undefined") {
    return "on";
  }

  const documentValue = document.documentElement.dataset[datasetKey];

  if (documentValue === "on" || documentValue === "off") {
    return documentValue;
  }

  return window.localStorage.getItem(storageKey) === "off" ? "off" : "on";
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(themeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

function subscribeToMotionChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(motionChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(motionChangeEvent, onStoreChange);
  };
}

function subscribeToPlayerSizeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(playerSizeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(playerSizeChangeEvent, onStoreChange);
  };
}

function subscribeToToggleChanges(eventName: string, onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(eventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(eventName, onStoreChange);
  };
}

function getThemeSnapshot() {
  return readStoredTheme();
}

function getServerThemeSnapshot(): ThemeMode {
  return "light";
}

function getMotionSnapshot() {
  return readStoredMotion();
}

function getServerMotionSnapshot(): MotionMode {
  return "full";
}

function getPlayerSizeSnapshot() {
  return readStoredPlayerSize();
}

function getServerPlayerSizeSnapshot(): PlayerSizeMode {
  return "compact";
}

function getSourceBadgesSnapshot() {
  return readStoredToggle("sourceBadges", "birvana-source-badges");
}

function getDesktopEffectsSnapshot() {
  return readStoredToggle("desktopEffects", "birvana-desktop-effects");
}

function getServerToggleSnapshot(): ToggleMode {
  return "on";
}

function SettingSwitch({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.switchControl} ${checked ? styles.switchControlOn : ""}`}
      aria-label={label}
      aria-pressed={checked}
      onClick={onClick}
    >
      <span className={styles.switchLabelOff}>OFF</span>
      <span className={styles.switchLabelOn}>ON</span>
      <span className={styles.switchThumb} aria-hidden="true" />
    </button>
  );
}

export function SettingsWorkspace() {
  const theme = useSyncExternalStore(
    subscribeToThemeChanges,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const motion = useSyncExternalStore(
    subscribeToMotionChanges,
    getMotionSnapshot,
    getServerMotionSnapshot,
  );
  const playerSize = useSyncExternalStore(
    subscribeToPlayerSizeChanges,
    getPlayerSizeSnapshot,
    getServerPlayerSizeSnapshot,
  );
  const sourceBadges = useSyncExternalStore(
    (onStoreChange) => subscribeToToggleChanges(sourceBadgesChangeEvent, onStoreChange),
    getSourceBadgesSnapshot,
    getServerToggleSnapshot,
  );
  const desktopEffects = useSyncExternalStore(
    (onStoreChange) => subscribeToToggleChanges(desktopEffectsChangeEvent, onStoreChange),
    getDesktopEffectsSnapshot,
    getServerToggleSnapshot,
  );

  const updateTheme = (nextTheme: ThemeMode) => {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("birvana-theme", nextTheme);
    writePreferenceCookie("birvana-theme", nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  };

  const updateMotion = (nextMotion: MotionMode) => {
    document.documentElement.dataset.motion = nextMotion;
    window.localStorage.setItem("birvana-motion", nextMotion);
    writePreferenceCookie("birvana-motion", nextMotion);
    window.dispatchEvent(new Event(motionChangeEvent));
  };

  const updatePlayerSize = (nextPlayerSize: PlayerSizeMode) => {
    document.documentElement.dataset.playerSize = nextPlayerSize;
    window.localStorage.setItem("birvana-player-size", nextPlayerSize);
    writePreferenceCookie("birvana-player-size", nextPlayerSize);
    window.dispatchEvent(new Event(playerSizeChangeEvent));
  };

  const updateSourceBadges = (nextValue: ToggleMode) => {
    document.documentElement.dataset.sourceBadges = nextValue;
    window.localStorage.setItem("birvana-source-badges", nextValue);
    writePreferenceCookie("birvana-source-badges", nextValue);
    window.dispatchEvent(new Event(sourceBadgesChangeEvent));
  };

  const updateDesktopEffects = (nextValue: ToggleMode) => {
    document.documentElement.dataset.desktopEffects = nextValue;
    window.localStorage.setItem("birvana-desktop-effects", nextValue);
    writePreferenceCookie("birvana-desktop-effects", nextValue);
    window.dispatchEvent(new Event(desktopEffectsChangeEvent));
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.text}>Tune this device the way you like.</p>
        </div>
      </section>

      <section className={styles.settingsPanel} aria-labelledby="app-settings-heading">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="app-settings-heading" className={styles.panelTitle}>
              App preferences
            </h2>
          </div>
        </div>

        <div className={styles.settingRows}>
          <div className={styles.settingRow}>
            <div className={styles.settingCopy}>
              <h3>Dark mode</h3>
              <p>Use the darker app theme.</p>
            </div>
            <SettingSwitch
              checked={theme === "dark"}
              label="Dark mode"
              onClick={() => updateTheme(theme === "dark" ? "light" : "dark")}
            />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingCopy}>
              <h3>Reduced motion</h3>
              <p>Use calmer motion across the app.</p>
            </div>
            <SettingSwitch
              checked={motion === "reduced"}
              label="Reduced motion"
              onClick={() => updateMotion(motion === "reduced" ? "full" : "reduced")}
            />
          </div>

          <div className={`${styles.settingRow} ${styles.mobileOnlySetting}`}>
            <div className={styles.settingCopy}>
              <h3>Comfortable mini player</h3>
              <p>Show a larger mobile mini player layout.</p>
            </div>
            <SettingSwitch
              checked={playerSize === "comfortable"}
              label="Comfortable mini player"
              onClick={() => updatePlayerSize(playerSize === "comfortable" ? "compact" : "comfortable")}
            />
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingCopy}>
              <h3>Playback source labels</h3>
              <p>Show source labels in the player.</p>
            </div>
            <SettingSwitch
              checked={sourceBadges === "on"}
              label="Playback source labels"
              onClick={() => updateSourceBadges(sourceBadges === "on" ? "off" : "on")}
            />
          </div>

          <div className={`${styles.settingRow} ${styles.desktopOnlySetting}`}>
            <div className={styles.settingCopy}>
              <h3>Desktop player effects</h3>
              <p>Show extra desktop visual effects.</p>
            </div>
            <SettingSwitch
              checked={desktopEffects === "on"}
              label="Desktop player effects"
              onClick={() => updateDesktopEffects(desktopEffects === "on" ? "off" : "on")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
