import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";

const resolveLandingPreviewBaseUrl = () => {
  const configuredUrl = String(import.meta.env.VITE_LANDING_URL || "").trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return "http://127.0.0.1:3001";
};

export default function TemplateLandingPreview() {
  const { templateId } = useParams();

  const iframeUrl = useMemo(() => {
    const baseUrl = resolveLandingPreviewBaseUrl();
    return `${baseUrl}/preview/template/${templateId}`;
  }, [templateId]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `Template Preview`;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Landing Preview
          </p>
          <h1 className="text-base font-semibold text-white">Template #{templateId}</h1>
        </div>

        <a
          href={iframeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-white transition hover:bg-slate-900"
        >
          Open Full Preview
        </a>
      </div>

      <iframe
        title={`Template ${templateId} preview`}
        src={iframeUrl}
        className="h-[calc(100vh-73px)] w-full border-0 bg-white"
      />
    </main>
  );
}
