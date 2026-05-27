"use client";

import { useEffect, useState } from "react";
import { ListPlus, X } from "lucide-react";
import { CreatePlaylistForm } from "@/components/studio/CreatePlaylistForm";
import styles from "./CreatePlaylistModal.module.css";

export function CreatePlaylistModal({
  triggerClassName,
  triggerLabel = "Create playlist",
}: {
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverlayState = document.body.dataset.overlayOpen;
    document.body.style.overflow = "hidden";
    document.body.dataset.overlayOpen = "true";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousOverlayState) {
        document.body.dataset.overlayOpen = previousOverlayState;
      } else {
        delete document.body.dataset.overlayOpen;
      }
    };
  }, [open]);

  return (
    <>
      <button type="button" className={triggerClassName ?? styles.trigger} onClick={() => setOpen(true)}>
        <ListPlus size={17} strokeWidth={2} />
        {triggerLabel}
      </button>

      {open ? (
        <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-playlist-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.header}>
              <div>
                <p className={styles.kicker}>Library</p>
                <h2 id="create-playlist-title">Create playlist</h2>
              </div>
              <button type="button" className={styles.close} aria-label="Close playlist creator" onClick={() => setOpen(false)}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className={styles.body}>
              <CreatePlaylistForm compact />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
