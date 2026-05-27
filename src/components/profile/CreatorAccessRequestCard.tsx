"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, Clock3, Send, ShieldCheck } from "lucide-react";
import { submitCreatorAccessRequestAction } from "@/app/actions";
import { useToast } from "@/components/shared/ToastProvider";
import type { CreatorAccessRequest } from "@/types/models";
import styles from "./CreatorAccessRequestCard.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function CreatorAccessRequestCard({
  email,
  initialRequest,
  title = "Request Studio access",
  description = "Studio uploads are reviewed manually right now. Share your creator details once and BIRVANA will review the request.",
}: {
  email: string;
  initialRequest: CreatorAccessRequest | null;
  title?: string;
  description?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [request, setRequest] = useState(initialRequest);
  const { notify } = useToast();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const nextRequest = await submitCreatorAccessRequestAction(formData);
        setRequest(nextRequest);
        notify("Creator access request sent.", "success");
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not send request.", "error");
      }
    });
  };

  if (request) {
    return (
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Creator access</p>
            <h3>{request.status === "approved" ? "Studio access approved" : "Request sent"}</h3>
          </div>
          <span className={styles.statusPill}>
            {request.status === "approved" ? <ShieldCheck size={15} strokeWidth={2} /> : <Clock3 size={15} strokeWidth={2} />}
            {request.status === "approved" ? "Approved" : "Pending review"}
          </span>
        </div>

        <p className={styles.copy}>
          {request.status === "approved"
            ? "Your creator profile is approved. Studio tools can be unlocked by the BIRVANA team."
            : "After your request is reviewed, BIRVANA will contact you if your profile is eligible for creator access."}
        </p>

        <div className={styles.summary}>
          <div>
            <span>Email</span>
            <strong>{request.email}</strong>
          </div>
          <div>
            <span>Full name</span>
            <strong>{request.fullName}</strong>
          </div>
          <div>
            <span>YouTube handle</span>
            <strong>{request.youtubeHandle}</strong>
          </div>
          <div>
            <span>Submitted</span>
            <strong>{formatDate(request.submittedAt)}</strong>
          </div>
        </div>

        <div className={styles.confirmation}>
          <CheckCircle2 size={18} strokeWidth={2} />
          <p>This request stays on your account, so you only need to submit it once.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Creator access</p>
          <h3>{title}</h3>
        </div>
        <span className={styles.statusPill}>
          <Send size={15} strokeWidth={2} />
          One-time request
        </span>
      </div>

      <p className={styles.copy}>{description}</p>

      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span>Full name</span>
          <input name="fullName" autoComplete="name" required placeholder="Brijesh Patel" />
        </label>

        <label className={styles.field}>
          <span>Email</span>
          <input name="email" type="email" required defaultValue={email} autoComplete="email" />
        </label>

        <label className={styles.field}>
          <span>YouTube handle</span>
          <input name="youtubeHandle" required placeholder="@birvanaofficial" />
        </label>

        <label className={styles.field}>
          <span>Location</span>
          <input name="location" placeholder="Ahmedabad, India" />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Tell us about your catalog</span>
          <textarea name="notes" rows={4} placeholder="Genres, release plan, links, or anything that helps the review." />
        </label>

        <button type="submit" className={styles.submit} disabled={pending}>
          <Send size={16} strokeWidth={2} />
          {pending ? "Sending..." : "Send request"}
        </button>
      </form>
    </section>
  );
}
