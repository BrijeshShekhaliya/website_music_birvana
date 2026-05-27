import { LockKeyhole, ShieldCheck } from "lucide-react";
import { CreatorAccessRequestCard } from "@/components/profile/CreatorAccessRequestCard";
import type { CreatorAccessState } from "@/types/models";
import styles from "./StudioAccessGate.module.css";

export function StudioAccessGate({
  email,
  creatorAccess,
}: {
  email: string;
  creatorAccess: CreatorAccessState;
}) {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Studio access</p>
          <h1>BIRVANA approval is required before Studio opens.</h1>
          <p className={styles.copy}>
            Upload and release tools are reviewed manually right now, so listener accounts stay
            clean and the creator queue stays curated.
          </p>
        </div>

        <div className={styles.points}>
          <article>
            <ShieldCheck size={18} strokeWidth={2} />
            <span>Curated access</span>
            <small>Studio is enabled only after a manual creator review.</small>
          </article>
          <article>
            <LockKeyhole size={18} strokeWidth={2} />
            <span>One request</span>
            <small>Once the form is sent, the same status stays visible on your account.</small>
          </article>
        </div>
      </section>

      <CreatorAccessRequestCard
        email={email}
        initialRequest={creatorAccess.request}
        title="Apply for creator access"
        description="Share the core details BIRVANA needs to review your music identity. If your request is eligible, the team will contact you and unlock Studio later."
      />
    </div>
  );
}
