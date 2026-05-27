import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { requireServerEnv } from "@/lib/env";

const COOKIE_NAME = "birvana-pending-signup";
const COOKIE_MAX_AGE_SECONDS = 60 * 10;
const OTP_LENGTH = 8;

type PendingSignupPayload = {
  displayName: string;
  email: string;
  password: string;
  heardAbout: string;
  otpHash: string;
  expiresAt: number;
};

export type PendingSignupInput = {
  displayName: string;
  email: string;
  password: string;
  heardAbout: string;
};

function getSecret() {
  return requireServerEnv("AUTH_OTP_SECRET");
}

function getKey() {
  return createHash("sha256").update(getSecret()).digest();
}

function hashOtp(email: string, otp: string) {
  return createHmac("sha256", getSecret())
    .update(`${email.trim().toLowerCase()}:${otp}`)
    .digest("hex");
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string) {
  const [encodedIv, encodedTag, encodedPayload] = value.split(".");

  if (!encodedIv || !encodedTag || !encodedPayload) {
    throw new Error("Malformed signup payload.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encodedPayload, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function generateOtp() {
  return Array.from({ length: OTP_LENGTH }, () => randomInt(0, 10)).join("");
}

export function issuePendingSignup(input: PendingSignupInput) {
  const otp = generateOtp();
  const normalizedEmail = input.email.trim().toLowerCase();
  const payload: PendingSignupPayload = {
    displayName: input.displayName.trim(),
    email: normalizedEmail,
    password: input.password,
    heardAbout: input.heardAbout.trim(),
    otpHash: hashOtp(normalizedEmail, otp),
    expiresAt: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000,
  };

  return {
    otp,
    cookieValue: encrypt(JSON.stringify(payload)),
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function readPendingSignup(cookieValue?: string | null) {
  if (!cookieValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(decrypt(cookieValue)) as Partial<PendingSignupPayload>;

    if (
      typeof parsed.displayName !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.password !== "string" ||
      typeof parsed.heardAbout !== "string" ||
      typeof parsed.otpHash !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    if (parsed.expiresAt < Date.now()) {
      return null;
    }

    return parsed as PendingSignupPayload;
  } catch {
    return null;
  }
}

export function isPendingSignupOtpValid(payload: PendingSignupPayload, otp: string) {
  const expected = Buffer.from(payload.otpHash, "hex");
  const actual = Buffer.from(hashOtp(payload.email, otp), "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function getPendingSignupCookieName() {
  return COOKIE_NAME;
}

export function getPendingSignupCookieOptions(maxAge = COOKIE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}
