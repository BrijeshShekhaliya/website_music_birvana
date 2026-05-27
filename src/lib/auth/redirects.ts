export function normalizeRedirectTarget(target?: string | null) {
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/discover";
  }

  return target;
}

export function normalizeAuthEntry(target?: string | null) {
  return target === "register" ? "/register" : "/login";
}
