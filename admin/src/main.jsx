import React, { Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Provider, useDispatch, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { RouterProvider } from "react-router-dom";
import { persistor, store } from "./store/store";
import router from "./routes/route";
import "./index.css";
import "./shims/react-quill.css";
import "react-toastify/dist/ReactToastify.css";
import { fetchPreferences } from "./slice/preferencesSlice";
import { setPriceCurrency } from "./hooks/currency";
import { getBackendLanguages, loadLanguagePack } from "./i18n";
import { installAutoTranslate } from "./i18nAutoTranslate";

const getPathSegmentTitle = (pathname = "/") => {
  const normalizedPath = String(pathname || "/").split("?")[0].split("#")[0];

  if (normalizedPath === "/" || normalizedPath === "/dashboard") return "Dashboard";
  if (normalizedPath === "/login") return "Login";
  if (normalizedPath === "/forgot-password") return "Forgot Password";
  if (normalizedPath.startsWith("/backoffice/dashboard")) return "Dashboard";

  const segments = normalizedPath.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || "Dashboard";

  return lastSegment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const patchHistoryEvents = () => {
  if (window.__NEXSTOCK_HISTORY_PATCHED__) return;

  const notify = () => window.dispatchEvent(new Event("nexstock:location-change"));
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    notify();
    return result;
  };

  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    notify();
    return result;
  };

  window.addEventListener("popstate", notify);
  window.__NEXSTOCK_HISTORY_PATCHED__ = true;
};

const enforceLightMode = () => {
  const html = document.documentElement;
  html.classList.remove("dark");
  html.classList.add("light");
  html.setAttribute("data-theme", "light");
  html.style.colorScheme = "light";
};

function AppInitializer() {
  const dispatch = useDispatch();
  const { data } = useSelector((state) => state.preferences);
  const company_id = useSelector((state) => state.auth.company_id);
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;

  useEffect(() => {
    dispatch(fetchPreferences(company_id));
  }, [dispatch, company_id]);

  useEffect(() => {
    if (data?.currency && typeof data.currency === "object") {
      setPriceCurrency({
        ...data.currency,
        precision: data?.basic?.precision,
        currency_format: data?.basic?.currency_format,
      });
    }
  }, [data]);

  useEffect(() => {
    if (data?.default_language == null) return undefined;

    let cancelled = false;

    const applyDefaultLanguage = async () => {
      const languages = await getBackendLanguages({ forceRefresh: true });
      const selectedLanguage = languages.find(
        (language) => String(language.id) === String(data.default_language)
      );

      if (!cancelled && selectedLanguage) {
        await loadLanguagePack(selectedLanguage.code, {
          forceRefresh: true,
          languages,
        });
      }
    };

    applyDefaultLanguage();

    return () => {
      cancelled = true;
    };
  }, [data?.default_language]);

  useEffect(() => {
    patchHistoryEvents();
    const syncDocumentTitle = () => {
      const appName = company_id
        ? data?.application_name || data?.basic?.sitename || data?.sitename || "Stoqio"
        : data?.basic?.sitename || data?.sitename || "Stoqio";
      const pageTitle = getPathSegmentTitle(window.location.pathname);
      document.title = `${appName} | ${pageTitle}`;
    };

    syncDocumentTitle();
    window.addEventListener("nexstock:location-change", syncDocumentTitle);

    return () => {
      window.removeEventListener("nexstock:location-change", syncDocumentTitle);
    };
  }, [data, company_id]);

  useEffect(() => {
    const isInBackoffice = window.location.pathname.startsWith("/backoffice");
    const transparentFavicon =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
    const favicon = data?.site_favicon || (isSuperAdmin || isInBackoffice ? "/favicon.png" : transparentFavicon);
    let link = document.querySelector("link[rel='icon']");

    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "icon");
      document.head.appendChild(link);
    }

    link.setAttribute("href", favicon);
  }, [data, isSuperAdmin, company_id]);

  return null;
}

enforceLightMode();
installAutoTranslate();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found!");
}

const root =
  window.__NEXSTOCK_REACT_ROOT__ ||
  (window.__NEXSTOCK_REACT_ROOT__ = createRoot(rootElement));

root.render(
  <Provider store={store}>
    <PersistGate
      loading={<div className="min-h-screen bg-slate-50" />}
      persistor={persistor}
    >
      <AppInitializer />
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <RouterProvider router={router} />
      </Suspense>
    </PersistGate>
  </Provider>
);
