"use client";

import { createPlaylistAction } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styles from "./CreatePlaylistForm.module.css";

export function CreatePlaylistForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const openingPlaylist = message?.tone === "success";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData();
    formData.set("name", name);

    startTransition(async () => {
      try {
        const playlist = await createPlaylistAction(formData);
        setName("");
        setMessage({ tone: "success", text: "Playlist created. Opening it now..." });
        window.setTimeout(() => {
          router.push(`/playlist/${playlist.id}`);
        }, 700);
      } catch (error) {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Playlist could not be created.",
        });
      }
    });
  };

  return (
    <form className={`${styles.form} ${compact ? styles.compact : ""}`} onSubmit={onSubmit}>
      <div className={styles.intro}>
        <p className={styles.kicker}>Quick create</p>
        <h2 className={styles.title}>New playlist</h2>
      </div>

      <div className={styles.editor}>
        <label className={styles.field}>
          <span>Playlist name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Give this playlist a name"
            required
          />
        </label>
      </div>

      {message ? (
        <p className={`${styles.message} ${message.tone === "success" ? styles.success : styles.error}`}>
          {message.text}
        </p>
      ) : null}

      <div className={styles.footer}>
        <button className={styles.button} type="submit" disabled={isPending || openingPlaylist || !name.trim()}>
          {openingPlaylist ? "Opening..." : isPending ? "Creating..." : "Create playlist"}
        </button>
      </div>
    </form>
  );
}
