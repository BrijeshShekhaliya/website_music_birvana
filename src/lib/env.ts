const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authOtpSecret = process.env.AUTH_OTP_SECRET;

export function hasSupabaseEnv() {
  return Boolean(publicSupabaseUrl && publicSupabaseAnonKey);
}

export function hasR2Env() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}

export function hasSmtpEnv() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function hasAuthOtpSecret() {
  return Boolean(authOtpSecret);
}

export function getPublicSupabaseEnv() {
  return {
    url: publicSupabaseUrl,
    anonKey: publicSupabaseAnonKey,
  };
}

export function requirePublicSupabaseEnv() {
  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    throw new Error("Supabase public environment variables are missing.");
  }

  return {
    url: publicSupabaseUrl,
    anonKey: publicSupabaseAnonKey,
  };
}

export function requireServerEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}
