"use client";

import { useState } from "react";
import styles from "@/components/auth/AuthForm.module.css";
import { getBrowserSupabase } from "@/lib/supabase/client";

type GoogleAuthButtonProps = {
  from: "login" | "register";
  label: string;
  next?: string;
};

export function GoogleAuthButton({ from, label, next = "/discover" }: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false);

  const startGoogleAuth = async () => {
    const supabase = getBrowserSupabase();

    if (!supabase || pending) {
      return;
    }

    setPending(true);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("from", from);
    callbackUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setPending(false);
      const target = from === "register" ? "/register" : "/login";
      const params = new URLSearchParams();

      if (next !== "/discover") {
        params.set("next", next);
      }

      params.set("error", error.message);
      window.location.assign(`${target}?${params.toString()}`);
    }
  };

  return (
    <button
      type="button"
      className={styles.oauthButton}
      onClick={() => {
        void startGoogleAuth();
      }}
      disabled={pending}
    >
      <span className={styles.oauthIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation" focusable="false">
          <path
            d="M21.805 12.23c0-.76-.068-1.49-.195-2.19H12v4.145h5.49a4.7 4.7 0 0 1-2.036 3.083v2.56h3.29c1.925-1.772 3.06-4.388 3.06-7.598Z"
            fill="#4285F4"
          />
          <path
            d="M12 22c2.756 0 5.067-.913 6.756-2.472l-3.29-2.56c-.913.61-2.08.973-3.466.973-2.657 0-4.91-1.794-5.715-4.206H2.884v2.64A9.996 9.996 0 0 0 12 22Z"
            fill="#34A853"
          />
          <path
            d="M6.285 13.735A5.992 5.992 0 0 1 5.965 12c0-.603.109-1.188.32-1.735v-2.64H2.884A9.996 9.996 0 0 0 2 12c0 1.61.385 3.133 1.064 4.375l3.221-2.64Z"
            fill="#FBBC04"
          />
          <path
            d="M12 6.06c1.5 0 2.848.516 3.91 1.53l2.93-2.93C17.061 2.99 14.75 2 12 2A9.996 9.996 0 0 0 2.884 7.625l3.401 2.64C7.09 7.854 9.343 6.06 12 6.06Z"
            fill="#EA4335"
          />
        </svg>
      </span>
      <span>{pending ? "Redirecting to Google..." : label}</span>
    </button>
  );
}
