const DEFAULT_LOCAL_ROOT_DOMAIN = "arcade.local";

export function normalizeHost(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export function isLocalHost(host: string | null | undefined) {
  const normalized = normalizeHost(host);

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".test")
  );
}

export function resolvePlatformRootDomain(host: string | null | undefined) {
  const envDomain = normalizeHost(process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN);

  if (envDomain) {
    return envDomain;
  }

  const normalizedHost = normalizeHost(host);

  if (!normalizedHost || normalizedHost === "localhost" || normalizedHost === "127.0.0.1") {
    return DEFAULT_LOCAL_ROOT_DOMAIN;
  }

  if (normalizedHost.endsWith(".local") || normalizedHost.endsWith(".test")) {
    return normalizedHost.split(".").slice(-2).join(".");
  }

  const segments = normalizedHost.split(".").filter(Boolean);

  if (segments.length <= 2) {
    return normalizedHost;
  }

  return segments.slice(-2).join(".");
}

export function extractStorefrontSubdomain(host: string | null | undefined, rootDomain?: string) {
  const normalizedHost = normalizeHost(host);
  const resolvedRootDomain = normalizeHost(rootDomain || resolvePlatformRootDomain(normalizedHost));

  if (!normalizedHost || !resolvedRootDomain || normalizedHost === resolvedRootDomain) {
    return "";
  }

  const suffix = `.${resolvedRootDomain}`;

  if (!normalizedHost.endsWith(suffix)) {
    return "";
  }

  return normalizedHost.slice(0, -suffix.length);
}
