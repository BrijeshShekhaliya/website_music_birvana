"use client";

import { useState } from "react";
import styles from "./LibraryCollectionsPanel.module.css";
import { CreatePlaylistModal } from "@/components/library/CreatePlaylistModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { PlaylistCard } from "@/components/shared/PlaylistCard";
import type { Playlist } from "@/types/models";

type LibraryCollectionsPanelProps = {
  ownedPlaylists: Playlist[];
  savedPlaylists: Playlist[];
  currentUserId: string;
};

type TabKey = "created" | "saved";

export function LibraryCollectionsPanel({
  ownedPlaylists,
  savedPlaylists,
  currentUserId,
}: LibraryCollectionsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("created");
  const isCreatedTab = activeTab === "created";
  const activePlaylists = isCreatedTab ? ownedPlaylists : savedPlaylists;

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Library collections</p>
          <h2 className={styles.title}>{isCreatedTab ? "Your playlists" : "Saved playlists"}</h2>
        </div>

        <div className={styles.headerSide}>
          <div className={styles.toggle} role="tablist" aria-label="Library playlist sections">
            <button
              type="button"
              role="tab"
              aria-selected={isCreatedTab}
              className={`${styles.toggleButton} ${isCreatedTab ? styles.toggleButtonActive : ""}`}
              onClick={() => setActiveTab("created")}
            >
              <span>Created</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isCreatedTab}
              className={`${styles.toggleButton} ${!isCreatedTab ? styles.toggleButtonActive : ""}`}
              onClick={() => setActiveTab("saved")}
            >
              <span>Saved</span>
            </button>
          </div>

          <CreatePlaylistModal triggerClassName={styles.action} />
        </div>
      </div>

      {activePlaylists.length ? (
        <div className={styles.grid}>
          {activePlaylists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              size="library"
              initialSaved={!isCreatedTab}
              showSaveButton={!isCreatedTab && playlist.owner_id !== currentUserId}
            />
          ))}
        </div>
      ) : isCreatedTab ? (
        <EmptyState
          title="No playlists created"
          description="Create a playlist and it will show here."
        />
      ) : (
        <EmptyState
          title="Nothing saved yet"
          description="Save a playlist from Discover or an artist page."
          actionLabel="Browse discover"
          actionHref="/discover"
        />
      )}
    </section>
  );
}
