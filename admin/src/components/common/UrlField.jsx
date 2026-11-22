import { useMemo, useState } from "react";
import {
  STOREFRONT_INTERNAL_ROUTE_OPTIONS,
  resolveStorefrontPageHref,
} from "../../utils/storefrontLinks";

const inputClassName = "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const LINK_SOURCE_OPTIONS = [
  { value: "existing_url", label: "Existing URL" },
  { value: "pages", label: "Pages" },
  { value: "custom_url", label: "Custom URL" },
];

const resolvePageUrl = (page) => {
  const routeKey = String(page?.route_key || "").trim();
  if (page?.route_mode === "internal_route" && routeKey) return routeKey;
  return resolveStorefrontPageHref(page?.slug);
};

const inferLinkSource = (value, pageOptions) => {
  const normalized = String(value || "").trim();
  if (STOREFRONT_INTERNAL_ROUTE_OPTIONS.some((option) => option.value === normalized)) return "existing_url";
  if (pageOptions.some((option) => option.value === normalized)) return "pages";
  return "custom_url";
};

export default function UrlField({ field, value, onChange, pages = [] }) {
  const pageOptions = useMemo(() => (
    (Array.isArray(pages) ? pages : []).map((page) => ({
      id: String(page?.id || page?.slug || ""),
      label: String(page?.name || page?.title || page?.slug || "Untitled page"),
      value: resolvePageUrl(page),
    })).filter((option) => option.id && option.value !== "#")
  ), [pages]);
  const [source, setSource] = useState(() => inferLinkSource(value, pageOptions));
  const normalizedValue = String(value || "").trim();

  const changeSource = (nextSource) => {
    setSource(nextSource);
    if (nextSource === "existing_url") {
      onChange(STOREFRONT_INTERNAL_ROUTE_OPTIONS[0]?.value || "/");
      return;
    }
    if (nextSource === "pages") {
      onChange(pageOptions[0]?.value || "");
      return;
    }
    onChange("");
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-900">{field?.label || field?.key || "Link"}</p>
      <select className={inputClassName} value={source} onChange={(event) => changeSource(event.target.value)}>
        {LINK_SOURCE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} disabled={option.value === "pages" && !pageOptions.length}>
            {option.label}
          </option>
        ))}
      </select>

      {source === "existing_url" ? (
        <select className={inputClassName} value={STOREFRONT_INTERNAL_ROUTE_OPTIONS.some((option) => option.value === normalizedValue) ? normalizedValue : "/"} onChange={(event) => onChange(event.target.value)}>
          {STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label} — {option.value}</option>
          ))}
        </select>
      ) : null}

      {source === "pages" ? (
        <select className={inputClassName} value={pageOptions.some((option) => option.value === normalizedValue) ? normalizedValue : pageOptions[0]?.value || ""} onChange={(event) => onChange(event.target.value)}>
          {pageOptions.map((option) => (
            <option key={option.id} value={option.value}>{option.label} — {option.value}</option>
          ))}
        </select>
      ) : null}

      {source === "custom_url" ? (
        <input
          className={inputClassName}
          value={normalizedValue}
          placeholder={field?.placeholder || "https://example.com or /custom-path"}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}
