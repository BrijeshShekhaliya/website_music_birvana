import Image from "next/image";
import clsx from "clsx";
import styles from "./BrandLockup.module.css";

type BrandLockupProps = {
  className?: string;
  size?: "compact" | "default" | "large";
  showLabel?: boolean;
};

export function BrandLockup({
  className,
  size = "default",
  showLabel = true,
}: BrandLockupProps) {
  return (
    <span
      className={clsx(
        styles.brand,
        size === "compact" && styles.compact,
        size === "large" && styles.large,
        className,
      )}
    >
      <span className={styles.logoWrap} aria-hidden="true">
        <Image
          src="/brand/birvana-mark.png"
          alt=""
          width={96}
          height={96}
          className={styles.logo}
          priority
        />
      </span>
      {showLabel ? <span className={styles.label}>BIRVANA</span> : null}
    </span>
  );
}
