import { API_URL } from "../../config/constants";

function getBackendBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || API_URL.replace(/\/api\/v\d+\/?$/, "")).replace(/\/+$/, "");
}

export function resolveCmsImageUrl(value) {
  if (!value || typeof value !== "string") return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const backendBase = getBackendBaseUrl();
  if (value.startsWith("/")) {
    return `${backendBase}${value}`;
  }
  if (value.startsWith("uploads/") || value.startsWith("images/")) {
    return `${backendBase}/${value}`;
  }

  return `${backendBase}/images/sections/${value}`;
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}
