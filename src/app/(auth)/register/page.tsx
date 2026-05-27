"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "@/components/auth/AuthForm.module.css";
import { BrandLockup } from "@/components/shared/BrandLockup";
import { ThemeToggleButton } from "@/components/shared/ThemeToggleButton";

type OtpStatus = "idle" | "typing" | "verifying" | "error" | "success";
type SearchParamsLike = {
  get(name: string): string | null;
};
type RegisterStep = 1 | 2 | 3 | 4;

const OTP_LENGTH = 8;
const HEARD_ABOUT_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "ads", label: "Ads" },
  { value: "friend", label: "Friend" },
  { value: "search", label: "Search" },
] as const;

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

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enabled, user } = useAuth();
  const next = useMemo(() => getSafeRedirectTarget(searchParams), [searchParams]);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoSubmittedRef = useRef("");
  const [step, setStep] = useState<RegisterStep>(1);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [heardAbout, setHeardAbout] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState<"request" | "verify" | null>(null);
  const [error, setError] = useState(() => searchParams.get("error") ?? "");
  const [notice, setNotice] = useState("");
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");
  const [resendCooldown, setResendCooldown] = useState(0);
  const configurationError = "Authentication is not available right now.";

  useEffect(() => {
    if (!user) {
      return;
    }

    router.replace(next);
  }, [next, router, user]);

  useEffect(() => {
    if (step !== 4) {
      return;
    }

    otpInputRef.current?.focus();
  }, [step]);

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

  const resetOtpStage = () => {
    setToken("");
    setOtpStatus("idle");
    setNotice("");
    setError("");
    setResendCooldown(0);
    lastAutoSubmittedRef.current = "";
  };

  const goToStepTwo = () => {
    if (!displayName.trim() || !email.trim()) {
      setError("Enter your name and email first.");
      return;
    }

    setError("");
    setStep(2);
  };

  const goToStepThree = () => {
    if (!password || !confirmPassword) {
      setError("Enter and confirm your password.");
      return;
    }

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setStep(3);
  };

  const requestRegisterOtp = async () => {
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword || !heardAbout) {
      setError("Complete the registration steps before requesting the OTP.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending("request");
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        heardAbout,
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
    setStep(4);
    setToken("");
    setOtpStatus("typing");
    setResendCooldown(40);
    lastAutoSubmittedRef.current = "";
    setNotice("OTP sent. Enter it below to finish creating your account.");
  };

  const verifyRegisterOtp = async (otpValue: string) => {
    if (!otpValue) {
      setError("Enter the OTP to continue.");
      return;
    }

    setPending("verify");
    setOtpStatus("verifying");
    setError("");
    setNotice("");

    const response = await fetch("/api/auth/register/verify-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
    setNotice("Email verified. Opening your BIRVANA account...");
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    window.location.href = next;
  };

  const stepTitle =
    step === 1
      ? "Create your account."
      : step === 2
        ? "Set your password."
        : step === 3
          ? "Tell us where you found us."
          : "Verify your email.";

  const stepSubtitle =
    step === 1
      ? "Start with the two details we need first."
      : step === 2
        ? "Choose a password you will use to sign in."
        : step === 3
          ? "One quick detail before we send the OTP."
          : "Enter the OTP we emailed to finish signup and enter BIRVANA.";

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
            <p className={styles.storyEyebrow}>New account</p>
            <h1 className={styles.storyTitle}>Build your BIRVANA space in four clean steps.</h1>
            <p className={styles.storyText}>
              The signup flow now feels like part of the product: stronger hierarchy, brighter fields, and clearer progress on mobile and desktop.
            </p>
          </div>

          <div className={styles.storyOrb}>
            <span>B</span>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTopBar}>
            <span className={styles.panelBadge}>Create account</span>
            <div className={styles.topActions}>
              <Link href="/login" className={styles.topLink}>
                Sign in
              </Link>
            </div>
          </div>

          <div className={styles.stepMeta}>
            <p className={styles.eyebrow}>Registration flow</p>
            <span className={styles.stepCount}>Step {step} of 4</span>
          </div>

          <div className={styles.stepDots} aria-hidden="true">
            {[1, 2, 3, 4].map((value) => (
              <span
                key={value}
                className={`${styles.stepDot} ${
                  value < step ? styles.stepDotDone : value === step ? styles.stepDotActive : ""
                }`}
              />
            ))}
          </div>

          <h1 className={styles.title}>{stepTitle}</h1>
          <p className={styles.subtitle}>{stepSubtitle}</p>

          <div className={styles.form}>
            {step === 1 ? (
              <div className={styles.formSection}>
                <label className={styles.field}>
                  <span className={styles.label}>Full name</span>
                  <input
                    name="display_name"
                    className={styles.input}
                    type="text"
                    autoComplete="name"
                    placeholder="How your profile should appear"
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      setError("");
                    }}
                    required
                  />
                </label>

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

                <button className={styles.button} type="button" onClick={goToStepTwo} disabled={!enabled}>
                  Next
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className={styles.formSection}>
                <label className={styles.field}>
                  <span className={styles.label}>Password</span>
                  <input
                    name="password"
                    className={styles.input}
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Confirm password</span>
                  <input
                    name="confirm_password"
                    className={styles.input}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError("");
                    }}
                    required
                  />
                </label>

                <div className={styles.buttonRow}>
                  <button className={styles.ghostButton} type="button" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button className={styles.button} type="button" onClick={goToStepThree} disabled={!enabled}>
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className={styles.formSection}>
                <div className={styles.choiceGrid}>
                  {HEARD_ABOUT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.choiceCard} ${
                        heardAbout === option.value ? styles.choiceCardActive : ""
                      }`}
                      onClick={() => {
                        setHeardAbout(option.value);
                        setError("");
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className={styles.buttonRow}>
                  <button className={styles.ghostButton} type="button" onClick={() => setStep(2)}>
                    Back
                  </button>
                  <button
                    className={styles.button}
                    type="button"
                    onClick={requestRegisterOtp}
                    disabled={pending !== null || !enabled}
                  >
                    Send OTP
                  </button>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className={styles.otpStageCard}>
                <div className={styles.otpHeader}>
                  <div>
                    <p className={styles.label}>OTP sent to</p>
                    <strong className={styles.otpEmail}>{email}</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => {
                      resetOtpStage();
                      setStep(1);
                    }}
                  >
                    Edit details
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
                        void verifyRegisterOtp(nextToken);
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
                    onClick={requestRegisterOtp}
                    disabled={pending !== null || !enabled || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Send OTP again in ${resendCooldown}s` : "Send OTP again"}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <>
                <div className={styles.divider} aria-hidden="true">
                  <span>or</span>
                </div>
                <GoogleAuthButton from="register" label="Continue with Google" next={next} />
              </>
            ) : null}

            {error ? <p className={`${styles.status} ${styles.statusError}`}>{error}</p> : null}
            {notice ? <p className={`${styles.status} ${styles.statusSuccess}`}>{notice}</p> : null}
            {!enabled ? <p className={`${styles.status} ${styles.statusError}`}>{configurationError}</p> : null}
          </div>

          <p className={styles.footer}>
            Already registered? <Link href="/login">Sign in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
