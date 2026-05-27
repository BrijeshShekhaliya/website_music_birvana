"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock3,
  Globe2,
  LockKeyhole,
  Radio,
  Search,
  Trash2,
  Upload,
  Waves,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteTrackAction } from "@/app/actions";
import { PlaylistModal } from "@/components/playlist/PlaylistModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { LazyImage } from "@/components/shared/LazyImage";
import { formatDuration } from "@/lib/format";
import { evictCachedMedia, notifyTrackDeleted } from "@/lib/media/clientMediaCache";
import type { Track } from "@/types/models";
import { StudioTrackEditor } from "./StudioTrackEditor";
import { StudioTrackMenu } from "./StudioTrackMenu";
import styles from "./StudioTracksWorkspace.module.css";

function getStatusMeta(status: Track["status"]) {
  switch (status) {
    case "ready":
      return {
        kind: "ready" as const,
        label: "Ready",
        className: styles.ready,
      };
    case "processing":
      return {
        kind: "processing" as const,
        label: "Processing",
        className: styles.processing,
      };
    case "failed":
      return {
        kind: "failed" as const,
        label: "Needs attention",
        className: styles.failed,
      };
    default:
      return {
        kind: "uploading" as const,
        label: "Uploading",
        className: styles.uploading,
      };
  }
}

function StudioTrackRow({
  track,
  menuOpen,
  onMenuChange,
  onEdit,
  onDelete,
}: {
  track: Track;
  menuOpen: boolean;
  onMenuChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusMeta = getStatusMeta(track.status);

  return (
    <article className={styles.row}>
      <div className={styles.media}>
        {track.cover_url ? (
          <LazyImage className={styles.cover} src={track.cover_url} alt={track.title} />
        ) : (
          <div className={styles.coverFallback}>{track.title.slice(0, 1)}</div>
        )}
      </div>

      <div className={styles.rowBody}>
        <div className={styles.identity}>
          <div className={styles.titleBlock}>
            <h3 className={styles.title}>{track.title}</h3>
            <p className={styles.artist}>{track.artist_display}</p>
          </div>
          <p className={styles.metaLine}>
            <span>{formatDuration(track.duration_seconds)}</span>
            <span>
              {track.visibility === "public" ? <Globe2 size={14} /> : null}
              {track.visibility === "unlisted" ? <Radio size={14} /> : null}
              {track.visibility === "private" ? <LockKeyhole size={14} /> : null}
              {track.visibility === "public" ? "Public" : track.visibility === "unlisted" ? "Unlisted" : "Private"}
            </span>
            <span className={statusMeta.className}>
              {statusMeta.kind === "ready" ? <CheckCircle2 size={14} /> : null}
              {statusMeta.kind === "processing" ? <Clock3 size={14} /> : null}
              {statusMeta.kind === "failed" ? <XCircle size={14} /> : null}
              {statusMeta.kind === "uploading" ? <Waves size={14} /> : null}
              {statusMeta.label}
            </span>
          </p>
        </div>

        <div className={styles.rowActions}>
          <StudioTrackMenu
            open={menuOpen}
            onOpenChange={onMenuChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}

export function StudioTracksWorkspace({ tracks }: { tracks: Track[] }) {
  const router = useRouter();
  const [currentTracks, setCurrentTracks] = useState(tracks);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "public" | "hidden">("all");
  const [menuTrackId, setMenuTrackId] = useState<number | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [deletingTrack, setDeletingTrack] = useState<Track | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  useEffect(() => {
    setCurrentTracks(tracks);
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    return currentTracks.filter((track) => {
      const matchesQuery =
        !query ||
        track.title.toLowerCase().includes(query.toLowerCase()) ||
        track.artist_display.toLowerCase().includes(query.toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "public" ? track.visibility === "public" : track.visibility !== "public");

      return matchesQuery && matchesFilter;
    });
  }, [currentTracks, filter, query]);

  const handleDelete = () => {
    if (!deletingTrack) {
      return;
    }

    startDeleteTransition(async () => {
      try {
        await deleteTrackAction(deletingTrack.id);
        evictCachedMedia([deletingTrack.cover_url]);
        notifyTrackDeleted(deletingTrack.id);
        setCurrentTracks((current) => current.filter((track) => track.id !== deletingTrack.id));
        setDeletingTrack(null);
        setNotice({ tone: "success", text: "Song removed from Studio." });
        router.refresh();
      } catch (error) {
        console.error(error);
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Could not delete the song.",
        });
      }
    });
  };

  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Studio tracks</p>
          <h1 className={styles.heroTitle}>Manage your uploaded tracks.</h1>
          <p className={styles.heroText}>Edit details, artwork, and visibility in one place.</p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/studio/upload" className={styles.uploadLink}>
            <Upload size={16} />
            <span>Upload song</span>
          </Link>
        </div>
      </section>

      <section className={styles.manager}>
        <div className={styles.managerHeader}>
          <div>
            <p className={styles.eyebrow}>Your uploads</p>
            <h2 className={styles.managerTitle}>Uploaded songs</h2>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.filterBar}>
            <button
              type="button"
              className={`${styles.filterChip} ${filter === "all" ? styles.filterChipActive : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${filter === "public" ? styles.filterChipActive : ""}`}
              onClick={() => setFilter("public")}
            >
              Public
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${filter === "hidden" ? styles.filterChipActive : ""}`}
              onClick={() => setFilter("hidden")}
            >
              Private + unlisted
            </button>
          </div>

          <label className={styles.searchField}>
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tracks or artists"
              aria-label="Search songs"
            />
          </label>
        </div>

        {notice ? (
          <p className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.text}
          </p>
        ) : null}

        {currentTracks.length ? (
          filteredTracks.length ? (
            <div className={styles.list}>
              {filteredTracks.map((track) => (
                <StudioTrackRow
                  key={track.id}
                  track={track}
                  menuOpen={menuTrackId === track.id}
                  onMenuChange={(open) => setMenuTrackId(open ? track.id : null)}
                  onEdit={() => setEditingTrack(track)}
                  onDelete={() => setDeletingTrack(track)}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyFilter}>
              <p>No songs match this filter right now.</p>
            </div>
          )
        ) : (
          <EmptyState
            title="No uploads yet"
            description="Your uploaded tracks will appear here once you publish your first release."
            actionLabel="Upload a song"
            actionHref="/studio/upload"
          />
        )}
      </section>

      <PlaylistModal
        title={editingTrack ? `Edit ${editingTrack.title}` : "Edit track"}
        open={Boolean(editingTrack)}
        onClose={() => setEditingTrack(null)}
      >
        {editingTrack ? (
          <StudioTrackEditor
            key={editingTrack.id}
            track={editingTrack}
            onSaved={() => {
              setEditingTrack(null);
              setNotice({ tone: "success", text: "Track details updated." });
              router.refresh();
            }}
          />
        ) : null}
      </PlaylistModal>

      <PlaylistModal
        title={deletingTrack ? `Delete ${deletingTrack.title}` : "Delete track"}
        open={Boolean(deletingTrack)}
        onClose={() => {
          if (!isDeleting) {
            setDeletingTrack(null);
          }
        }}
      >
        {deletingTrack ? (
          <div className={styles.deleteShell}>
            <div className={styles.deleteIcon}>
              <Trash2 size={20} />
            </div>
            <div className={styles.deleteCopy}>
              <p className={styles.deleteTitle}>Remove this song from Studio?</p>
              <p className={styles.deleteText}>
                The audio file, cover image, and library entry are removed. The uploaded audio
                cannot be restored after deletion.
              </p>
            </div>
            <div className={styles.deleteActions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={isDeleting}
                onClick={() => setDeletingTrack(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? "Deleting..." : "Delete song"}
              </button>
            </div>
          </div>
        ) : null}
      </PlaylistModal>
    </div>
  );
}
