"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "@/components/auth/AuthForm.module.css";
import { BrandLockup } from "@/components/shared/BrandLockup";
import { ThemeToggleButton } from "@/components/shared/ThemeToggleButton";

type SignInMethod = "password" | "otp";
type OtpStage = "request" | "verify";
type OtpStatus = "idle" | "typing" | "verifying" | "error" | "success";
type SearchParamsLike = {
  get(name: string): string | null;
};

const OTP_LENGTH = 8;

function getSafeRedirectTarget(searchParams: SearchParamsLike) {
  const target = searchParams.get("next");

  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/discover";
  }

  return target;
}

function sanitizeOtpInput(value: string) {
  return value.replace(/[^\d]/gu, "").slice(0, OTP_LENGTH);
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enabled, user } = useAuth();
  const next = useMemo(() => getSafeRedirectTarget(searchParams), [searchParams]);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoSubmittedRef = useRef("");
  const [method, setMethod] = useState<SignInMethod>(() =>
    searchParams.get("mode") === "otp" ? "otp" : "password",
  );
  const [otpStage, setOtpStage] = useState<OtpStage>("request");
  const [email, setEmail] = useState(() => searchParams.get("email")?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState<"password" | "request" | "verify" | null>(null);
  const [error, setError] = useState(() => searchParams.get("error") ?? "");
  const [notice, setNotice] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");
  const [resendCooldown, setResendCooldown] = useState(0);
  const configurationError = "Authentication is not available right now.";
  const showGoogle = method === "password";
  const otpStepActive = method === "otp" && otpStage === "verify";

  useEffect(() => {
    if (!user) {
      return;
    }

    router.replace(next);
  }, [next, router, user]);

  useEffect(() => {
    if (!otpStepActive) {
      return;
    }

    otpInputRef.current?.focus();
  }, [otpStepActive]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resendCooldown]);

  const resetOtpFlow = () => {
    setOtpRequested(false);
    setOtpStage("request");
    setToken("");
    setError("");
    setNotice("");
    setOtpStatus("idle");
    setResendCooldown(0);
    lastAutoSubmittedRef.current = "";
  };

  const onPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setPending("password");
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setPending(null);
      setError(payload.error || "Unable to sign in.");
      return;
    }

    setPending(null);
    window.location.href = next;
  };

  const requestOtp = async () => {
    if (!email) {
      setError("Enter your email first.");
      return;
    }

    setPending("request");
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/request-login-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setPending(null);
      setError(payload.error || "Unable to send the OTP right now.");
      return;
    }

    setPending(null);
    setOtpRequested(true);
    setOtpStage("verify");
    setOtpStatus("typing");
    setToken("");
    setResendCooldown(40);
    lastAutoSubmittedRef.current = "";
    setNotice("OTP sent. Enter it below to continue.");
  };

  const verifyOtp = async (otpValue: string) => {
    if (!email || !otpValue) {
      setError("Enter the OTP to continue.");
      return;
    }

    setPending("verify");
    setOtpStatus("verifying");
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/verify-login-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        token: otpValue,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setPending(null);
      setOtpStatus("error");
      setToken("");
      lastAutoSubmittedRef.current = "";
      setError(payload.error || "OTP is invalid. Request a new OTP and try again.");
      otpInputRef.current?.focus();
      return;
    }

    setPending(null);
    setOtpStatus("success");
    setNotice("OTP verified. Opening BIRVANA...");
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    window.location.href = next;
  };

  const title = otpStepActive ? "Verify your email." : "Sign in to BIRVANA.";
  const subtitle = otpStepActive
    ? "Enter the OTP we emailed to you. BIRVANA verifies it automatically."
    : "Use your password, request an email OTP, or continue with Google.";

  return (
    <main className={styles.page}>
      <div className={styles.authShell}>
        <section className={styles.storyPanel}>
          <div className={styles.storyTopBar}>
            <BrandLockup className={styles.brand} size="large" />
            <div className={styles.topActions}>
              <ThemeToggleButton compact />
              <Link href="/" className={styles.topLink}>
                Home
              </Link>
            </div>
          </div>

          <div className={styles.storyCopy}>
            <p className={styles.storyEyebrow}>Auth experience</p>
            <h1 className={styles.storyTitle}>Welcome back to the signal.</h1>
            <p className={styles.storyText}>
              The new BIRVANA entry flow is cleaner, brighter, and easier to scan on mobile without losing the premium desktop feel.
            </p>
          </div>

          <div className={styles.storyOrb}>
            <span>B</span>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTopBar}>
            <span className={styles.panelBadge}>Sign in</span>
            <div className={styles.topActions}>
              <Link href="/register" className={styles.topLink}>
                Create account
              </Link>
            </div>
          </div>

          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>

          <div className={styles.methodSwitcher} role="tablist" aria-label="Sign-in method">
            <button
              className={`${styles.methodButton} ${method === "password" ? styles.methodButtonActive : ""}`}
              type="button"
              onClick={() => {
                setMethod("password");
                setError("");
                setNotice("");
                setOtpStatus("idle");
              }}
            >
              Password
            </button>
            <button
              className={`${styles.methodButton} ${method === "otp" ? styles.methodButtonActive : ""}`}
              type="button"
              onClick={() => {
                setMethod("otp");
                setOtpStage(otpRequested ? "verify" : "request");
                setError("");
                setNotice("");
                setOtpStatus(otpRequested ? "typing" : "idle");
              }}
            >
              Email OTP
            </button>
          </div>

          <div className={styles.form}>
            {method === "password" ? (
              <form className={styles.formSection} onSubmit={onPasswordSubmit}>
                <label className={styles.field}>
                  <span className={styles.label}>Email</span>
                  <input
                    name="email"
                    className={styles.input}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value.trim());
                      setError("");
                    }}
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Password</span>
                  <input
                    name="password"
                    className={styles.input}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>

                <button className={styles.button} type="submit" disabled={pending !== null || !enabled}>
                  {pending === "password" ? "Signing in..." : enabled ? "Sign in" : "Auth unavailable"}
                </button>
              </form>
            ) : null}

            {method === "otp" ? (
              <div className={styles.formSection}>
                {otpStage === "request" ? (
                  <>
                    <label className={styles.field}>
                      <span className={styles.label}>Email</span>
                      <input
                        name="otp_email"
                        className={styles.input}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value.trim());
                          setError("");
                        }}
                        required
                      />
                    </label>

                    <button
                      className={styles.button}
                      type="button"
                      onClick={requestOtp}
                      disabled={pending !== null || !enabled}
                    >
                      Send OTP
                    </button>
                  </>
                ) : (
                  <div className={styles.otpStageCard}>
                    <div className={styles.otpHeader}>
                      <div>
                        <p className={styles.label}>OTP sent to</p>
                        <strong className={styles.otpEmail}>{email}</strong>
                      </div>
                      <button type="button" className={styles.inlineAction} onClick={resetOtpFlow}>
                        Change email
                      </button>
                    </div>

                    <label className={styles.field}>
                      <span className={styles.label}>Enter OTP</span>
                      <button
                        type="button"
                        className={`${styles.otpShellButton} ${
                          otpStatus === "error" ? styles.otpShellError : ""
                        } ${otpStatus === "success" ? styles.otpShellSuccess : ""}`}
                        onClick={() => otpInputRef.current?.focus()}
                      >
                        <div className={styles.otpSlots} aria-hidden="true">
                          {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                            <span
                              key={index}
                              className={`${styles.otpSlot} ${token[index] ? styles.otpSlotFilled : ""} ${
                                otpStatus === "success" ? styles.otpSlotSuccess : ""
                              } ${otpStatus === "error" ? styles.otpSlotError : ""}`}
                              style={{ animationDelay: `${index * 60}ms` }}
                            >
                              {token[index] ?? ""}
                            </span>
                          ))}
                        </div>
                      </button>
                      <input
                        ref={otpInputRef}
                        name="token"
                        className={styles.otpInputHidden}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-label="One-time password"
                        value={token}
                        onChange={(event) => {
                          const nextToken = sanitizeOtpInput(event.target.value);
                          setToken(nextToken);
                          setError("");
                          setNotice("");
                          setOtpStatus("typing");

                          if (
                            nextToken.length === OTP_LENGTH &&
                            pending !== "verify" &&
                            lastAutoSubmittedRef.current !== nextToken
                          ) {
                            lastAutoSubmittedRef.current = nextToken;
                            void verifyOtp(nextToken);
                          }
                        }}
                      />
                    </label>

                    <div className={styles.otpMetaRow}>
                      <p className={styles.helper}>
                        {pending === "verify"
                          ? "Verifying OTP..."
                          : "BIRVANA verifies the OTP automatically as soon as all fields are filled."}
                      </p>
                      <button
                        className={styles.textButton}
                        type="button"
                        onClick={requestOtp}
                        disabled={pending !== null || !enabled || resendCooldown > 0}
                      >
                        {resendCooldown > 0 ? `Send OTP again in ${resendCooldown}s` : "Send OTP again"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {showGoogle ? (
              <>
                <div className={styles.divider} aria-hidden="true">
                  <span>or</span>
                </div>
                <GoogleAuthButton from="login" label="Continue with Google" next={next} />
              </>
            ) : null}

            {error ? <p className={`${styles.status} ${styles.statusError}`}>{error}</p> : null}
            {notice ? <p className={`${styles.status} ${styles.statusSuccess}`}>{notice}</p> : null}
            {!enabled ? <p className={`${styles.status} ${styles.statusError}`}>{configurationError}</p> : null}
          </div>

          <p className={styles.footer}>
            No account yet? <Link href="/register">Create one</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
