import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { API_URL } from "./config/constants";
import enFallback from "./locales/en/translation.json";

const missingSent = new Set();
const LANGUAGE_STORAGE_KEY = "app_lang";
const LANGUAGE_LIST_CACHE_KEY = "app_lang_list_cache_v2";
const LANG_PACK_CACHE_PREFIX = "app_lang_pack_v2_";

const sanitizeFlatObject = (flat) => {
  const normalized = {};
  Object.entries(flat || {}).forEach(([key, value]) => {
    if (typeof key !== "string" || typeof value !== "string") return;
    normalized[key] = value;
  });
  return normalized;
};

const registerMissingKey = async (key, fallback = "") => {
  if (!key || missingSent.has(key)) return;
  missingSent.add(key);
  try {
    await fetch(`${API_URL}/translations/missing-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, fallback: fallback || key }),
    });
  } catch {
    // Keep UI silent on missing key sync failure.
  }
};

const normalizeCode = (value) => String(value || "en").toLowerCase().trim();

const isRtlCode = (code) => ["ar", "fa", "he", "ur"].includes(normalizeCode(code));

const applyDocumentDirection = (langMeta) => {
  const code = normalizeCode(langMeta?.code || i18n.language || "en");
  const direction = langMeta?.direction === "rtl" || isRtlCode(code) ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", direction);
  document.documentElement.setAttribute("lang", code);
};

const readCachedLanguageList = () => {
  try {
    const raw = localStorage.getItem(LANGUAGE_LIST_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const cacheLanguageList = (list) => {
  try {
    localStorage.setItem(LANGUAGE_LIST_CACHE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {
    // ignore cache failure
  }
};

const readCachedPack = (code) => {
  try {
    const raw = localStorage.getItem(`${LANG_PACK_CACHE_PREFIX}${normalizeCode(code)}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeFlatObject(parsed);
  } catch {
    return null;
  }
};

const cachePack = (code, payload) => {
  try {
    localStorage.setItem(`${LANG_PACK_CACHE_PREFIX}${normalizeCode(code)}`, JSON.stringify(payload || {}));
  } catch {
    // ignore cache failure
  }
};

const fetchLanguageList = async () => {
  const response = await fetch(`${API_URL}/translation-languages`);
  if (!response.ok) throw new Error("Failed to load language list");
  const payload = await response.json();
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const normalized = list
    .map((item) => ({
      id: item?.id,
      code: normalizeCode(item?.code),
      name: item?.name || String(item?.code || "EN").toUpperCase(),
      is_default: Boolean(item?.is_default),
      direction: item?.direction === "rtl" ? "rtl" : "ltr",
      has_json: item?.has_json !== false,
    }))
    .filter((item) => item.code);

  return normalized;
};

const resolveLanguage = (requestedCode, list) => {
  const normalizedRequested = normalizeCode(requestedCode);
  const byRequested = list.find((item) => item.code === normalizedRequested);
  if (byRequested) return byRequested;

  const short = normalizedRequested.split("-")[0];
  const byShort = list.find((item) => item.code === short);
  if (byShort) return byShort;

  const fallbackDefault = list.find((item) => item.is_default) || list.find((item) => item.code === "en");
  if (fallbackDefault) return fallbackDefault;

  return { code: "en", name: "English", is_default: true, direction: "ltr", has_json: true };
};

const fetchLanguagePack = async (langCode) => {
  const response = await fetch(`${API_URL}/translations/${encodeURIComponent(langCode)}`);
  if (!response.ok) throw new Error("Failed to load language");
  const payload = await response.json();
  return sanitizeFlatObject(payload?.data || {});
};

const mountBundle = (langCode, bundle) => {
  i18n.addResourceBundle(langCode, "translation", bundle || {}, true, true);
};

export const loadLanguagePack = async (langCode = "en", options = {}) => {
  const code = normalizeCode(langCode);

  try {
    let list = options.languages;
    if (!Array.isArray(list) || list.length === 0) {
      list = readCachedLanguageList();
      if (!list.length) {
        list = await fetchLanguageList();
        cacheLanguageList(list);
      }
    }

    const resolved = resolveLanguage(code, list);
    const resolvedCode = resolved.code;

    let bundle = readCachedPack(resolvedCode);
    if (!bundle || Object.keys(bundle).length === 0 || options.forceRefresh) {
      bundle = await fetchLanguagePack(resolvedCode);
      cachePack(resolvedCode, bundle);
    }

    mountBundle(resolvedCode, bundle);
    await i18n.changeLanguage(resolvedCode);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, resolvedCode);
    applyDocumentDirection(resolved);
    return true;
  } catch {
    const fallbackCode = "en";
    const cachedFallback = readCachedPack(fallbackCode);
    if (cachedFallback && Object.keys(cachedFallback).length > 0) {
      mountBundle(fallbackCode, cachedFallback);
    } else {
      mountBundle(fallbackCode, sanitizeFlatObject(enFallback));
    }
    await i18n.changeLanguage(fallbackCode);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, fallbackCode);
    applyDocumentDirection({ code: fallbackCode, direction: "ltr" });
    return false;
  }
};

export const getBackendLanguages = async (options = {}) => {
  const { forceRefresh = false } = options;
  try {
    if (!forceRefresh) {
      const cached = readCachedLanguageList();
      if (cached.length > 0) return cached;
    }

    const list = await fetchLanguageList();
    cacheLanguageList(list);
    return list;
  } catch {
    return readCachedLanguageList();
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: sanitizeFlatObject(enFallback) },
    },
    fallbackLng: "en",
    lng: localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en",
    debug: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "cookie", "navigator", "htmlTag"],
      caches: ["localStorage", "cookie"],
    },
    keySeparator: false,
    nsSeparator: false,
    saveMissing: false,
  });

// Load server language pack after initialization and sync direction.
loadLanguagePack(localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en");

export default i18n;
