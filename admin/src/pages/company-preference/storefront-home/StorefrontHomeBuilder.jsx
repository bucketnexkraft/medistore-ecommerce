import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import ReactQuill from "react-quill";
import { toast } from "react-toastify";
import { PiArrowLeft, PiCheck, PiDotsSixVertical, PiFloppyDisk, PiLink, PiList, PiNotePencil, PiPaintBrush, PiPlus, PiRows, PiTrash } from "react-icons/pi";
import DividedInputLoader from "../../../components/loadings/DividedInputLoader";
import IconPickerField from "../../../components/common/IconPickerField";
import RepeaterField from "../../../components/common/RepeaterField";
import UrlField from "../../../components/common/UrlField";
import { customSectionSchema, defaultDemandTagOptions } from "../../../components/common/SectionConfigEditor";
import {
  getStorefrontHomeBuilder,
  updateStorefrontHomeBuilder,
  uploadStorefrontSectionMedia,
} from "../../../api/storefrontBuilder";
import { getUserDefinedValues } from "../../../api/userDefinedValues";
import { hasPermission } from "../../../utils/permissions";
import {
  buildStorefrontActionLinkState,
  STOREFRONT_LINK_TYPES,
  STOREFRONT_INTERNAL_ROUTE_OPTIONS,
} from "../../../utils/storefrontLinks";

const SECTION_MODES = [
  { value: "template", label: "Template" },
  { value: "rich_text", label: "Rich Text" },
  { value: "sql_query", label: "SQL Query" },
  { value: "query_json", label: "JSON Query" },
];

const ACTION_PLACEMENT_ORDER = ["header", "footer"];

const ACTION_PLACEMENT_LABELS = {
  header: "Header menu",
  footer: "Footer menu",
};

const RESERVED_PAGE_SLUGS = new Set([
  "categories",
  "products",
  "deals",
  "new-arrival",
  "limited-sale",
  "best-seller",
  "group-purchase",
  "wishlist",
  "cart",
  "checkout",
  "checkout-one",
  "checkout-two",
  "track-order",
  "user-dashboard",
  "product",
  "topseller",
  "signin",
  "signup",
]);

const PAGE_ROUTE_MODE_OPTIONS = [
  { value: "custom_url", label: "Custom URL" },
  { value: "internal_route", label: "Existing Route" },
];

const PAGE_INTERNAL_ROUTE_SET = new Set(STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => option.value));

const THEME_FONT_OPTIONS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Montserrat",
  "Open Sans",
  "Lato",
  "Nunito",
  "DM Sans",
  "Playfair Display",
];

const DEFAULT_THEME = {
  primary_color: "#7F00FF",
  secondary_color: "#F5F3FF",
  font_family: "Inter",
};

const isHexColor = (value) => /^#[0-9A-F]{6}$/i.test(String(value || "").trim());

const normalizeTheme = (theme, template = {}) => {
  const templateTheme = {
    primary_color: isHexColor(template?.primary_color) ? String(template.primary_color).toUpperCase() : DEFAULT_THEME.primary_color,
    secondary_color: isHexColor(template?.secondary_color) ? String(template.secondary_color).toUpperCase() : DEFAULT_THEME.secondary_color,
    font_family: String(template?.font_family || DEFAULT_THEME.font_family).trim() || DEFAULT_THEME.font_family,
  };

  return {
    primary_color: isHexColor(theme?.primary_color) ? String(theme.primary_color).toUpperCase() : templateTheme.primary_color,
    secondary_color: isHexColor(theme?.secondary_color) ? String(theme.secondary_color).toUpperCase() : templateTheme.secondary_color,
    font_family: String(theme?.font_family || templateTheme.font_family).trim() || templateTheme.font_family,
  };
};

const normalizeActionPlacement = (value) => {
  const placement = String(value || "").trim().toLowerCase();

  return placement === "footer" ? "footer" : "header";
};

const createBlankAction = (pageId, sectionId = "", placement = "header", sortOrder = 1) => ({
  id: createId("action"),
  page_id: pageId,
  section_id: sectionId,
  name: placement === "footer" ? "New Footer Segment" : "New Action",
  slug: placement === "footer" ? "new-footer-segment" : "new-action",
  expression: "",
  link_type: "custom_path",
  route_key: "",
  target_page_id: "",
  target_page_slug: "",
  target_page_route_mode: "custom_url",
  target_page_route_key: "",
  label: "",
  placement: placement === "footer" ? "footer" : "header",
  footer_group: "",
  sort_order: sortOrder,
});

const sortActionsForBuilder = (items = []) =>
  [...items].sort((a, b) => {
    const placementDelta =
      ACTION_PLACEMENT_ORDER.indexOf(normalizeActionPlacement(a.placement)) -
      ACTION_PLACEMENT_ORDER.indexOf(normalizeActionPlacement(b.placement));

    if (placementDelta !== 0) {
      return placementDelta;
    }

    const orderDelta = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return String(a.id || "").localeCompare(String(b.id || ""));
  });

const normalizeFooterGroupKey = (value) => slugifyValue(value || "") || "footer-group";

const getFooterGroupDisplayTitle = (groupKey) =>
  String(groupKey || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const collectActionTargetPageIds = (items = [], pages = []) => {
  const pageIdByRouteKey = new Map(
    (Array.isArray(pages) ? pages : [])
      .map((page) => [String(page?.route_key || "").trim(), String(page?.id || "").trim()])
      .filter(([routeKey, pageId]) => routeKey && pageId),
  );
  const pageIdBySlug = new Map(
    (Array.isArray(pages) ? pages : [])
      .map((page) => [String(page?.slug || "").trim().toLowerCase(), String(page?.id || "").trim()])
      .filter(([slug, pageId]) => slug && pageId),
  );

  return items
    .map((action) => {
      const directTargetPageId = String(action?.target_page_id || "").trim();
      if (directTargetPageId) {
        return directTargetPageId;
      }

      const routeKey = String(action?.route_key || action?.expression || "").trim();
      if (routeKey && pageIdByRouteKey.has(routeKey)) {
        return pageIdByRouteKey.get(routeKey);
      }

      const targetPageSlug = String(action?.target_page_slug || "").trim().toLowerCase();
      if (targetPageSlug && pageIdBySlug.has(targetPageSlug)) {
        return pageIdBySlug.get(targetPageSlug);
      }

      if ((routeKey === "/" || targetPageSlug === "home") && pageIdByRouteKey.has("/")) {
        return pageIdByRouteKey.get("/");
      }

      return "";
    })
    .filter(Boolean);
};

const routeKeyToPageSlug = (routeKey) => {
  const normalizedRoute = String(routeKey || "").trim();

  if (normalizedRoute === "/") {
    return "home";
  }

  return slugifyValue(normalizedRoute.replace(/^\/+/, ""));
};

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^-+|-+$/g, "");

const createId = (prefix) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createDefaultBuilder = () => ({
  version: 1,
  default_page_id: null,
  pages: [],
  sections: [],
  actions: [],
  settings: {
    header_placeholder: "#HEADER_LINKS#",
    token_pattern_hint: "#privacy_policy#",
    load_actions_on_boot: true,
    theme: DEFAULT_THEME,
  },
  meta: {
    template_variants: [],
    section_presets: {},
    component_options: {},
  },
});

const normalizeBuilderPages = (builder, template = {}) => ({
  ...builder,
  settings: {
    ...createDefaultBuilder().settings,
    ...(builder?.settings || {}),
    theme: normalizeTheme(builder?.settings?.theme, template),
  },
  default_page_id: builder?.default_page_id || builder?.pages?.[0]?.id || null,
  sections: Array.isArray(builder?.sections)
    ? builder.sections.map((section) => ({
        ...section,
        config: section?.config && typeof section.config === "object"
          ? section.config
          : parseSectionQueryJson(section?.query_json),
      }))
    : [],
  pages: Array.isArray(builder?.pages)
    ? builder.pages.map((page) => {
        const routeMode = page?.route_mode === "internal_route" ? "internal_route" : "custom_url";
        const normalizedName = String(page?.name || "").trim().toLowerCase();
        const normalizedSlug = String(page?.slug || "").trim().toLowerCase();
        const rawRouteKey = String(page?.route_key || "").trim();
        const inferredRouteKey = (() => {
          if (!PAGE_INTERNAL_ROUTE_SET.size) {
            return "";
          }

          if (PAGE_INTERNAL_ROUTE_SET.has(rawRouteKey)) {
            if (rawRouteKey !== "/" || normalizedName === "home" || normalizedSlug === "home") {
              return rawRouteKey;
            }
          }

          const matchedByName = STOREFRONT_INTERNAL_ROUTE_OPTIONS.find(
            (option) => option.label.trim().toLowerCase() === normalizedName,
          )?.value;

          if (matchedByName) {
            return matchedByName;
          }

          const matchedBySlug = STOREFRONT_INTERNAL_ROUTE_OPTIONS.find((option) => {
            const optionSlug = String(option.value || "").replace(/^\/+/, "").trim().toLowerCase();
            return optionSlug !== "" && optionSlug === normalizedSlug;
          })?.value;

          if (matchedBySlug) {
            return matchedBySlug;
          }

          if (normalizedSlug === "home" || normalizedName === "home") {
            return "/";
          }

          return rawRouteKey;
        })();
        const routeKey = routeMode === "internal_route"
          ? (PAGE_INTERNAL_ROUTE_SET.has(inferredRouteKey)
              ? inferredRouteKey
              : (normalizedSlug === "home"
                  ? "/"
                  : `/${normalizedSlug.replace(/^\/+/, "") || "products"}`))
          : "";

        return {
          ...page,
          route_mode: routeMode,
          route_key: routeMode === "internal_route" ? routeKey : "",
          slug: routeMode === "internal_route"
            ? routeKeyToPageSlug(routeKey)
            : slugifyValue(page?.slug || ""),
        };
      })
    : [],
  actions: Array.isArray(builder?.actions)
    ? (() => {
        const normalizedPages = Array.isArray(builder?.pages)
          ? builder.pages.map((page) => {
              const routeMode = page?.route_mode === "internal_route" ? "internal_route" : "custom_url";
              const normalizedName = String(page?.name || "").trim().toLowerCase();
              const normalizedSlug = String(page?.slug || "").trim().toLowerCase();
              const rawRouteKey = String(page?.route_key || "").trim();
              const inferredRouteKey = (() => {
                if (!PAGE_INTERNAL_ROUTE_SET.size) {
                  return "";
                }

                if (PAGE_INTERNAL_ROUTE_SET.has(rawRouteKey)) {
                  if (rawRouteKey !== "/" || normalizedName === "home" || normalizedSlug === "home") {
                    return rawRouteKey;
                  }
                }

                const matchedByName = STOREFRONT_INTERNAL_ROUTE_OPTIONS.find(
                  (option) => option.label.trim().toLowerCase() === normalizedName,
                )?.value;

                if (matchedByName) {
                  return matchedByName;
                }

                const matchedBySlug = STOREFRONT_INTERNAL_ROUTE_OPTIONS.find((option) => {
                  const optionSlug = String(option.value || "").replace(/^\/+/, "").trim().toLowerCase();
                  return optionSlug !== "" && optionSlug === normalizedSlug;
                })?.value;

                if (matchedBySlug) {
                  return matchedBySlug;
                }

                if (normalizedSlug === "home" || normalizedName === "home") {
                  return "/";
                }

                return rawRouteKey;
              })();
              const routeKey = routeMode === "internal_route"
                ? (PAGE_INTERNAL_ROUTE_SET.has(inferredRouteKey)
                    ? inferredRouteKey
                    : (normalizedSlug === "home"
                        ? "/"
                        : `/${normalizedSlug.replace(/^\/+/, "") || "products"}`))
                : "";

              return {
                ...page,
                route_mode: routeMode,
                route_key: routeMode === "internal_route" ? routeKey : "",
                slug: routeMode === "internal_route"
                  ? routeKeyToPageSlug(routeKey)
                  : slugifyValue(page?.slug || ""),
              };
            })
          : [];

        const pageById = new Map(normalizedPages.map((page) => [String(page.id || ""), page]));
        const pageByRouteKey = new Map(
          normalizedPages
            .map((page) => [String(page.route_key || "").trim(), page])
            .filter(([routeKey]) => Boolean(routeKey)),
        );
        const pageBySlug = new Map(
          normalizedPages
            .map((page) => [String(page.slug || "").trim().toLowerCase(), page])
            .filter(([slug]) => Boolean(slug)),
        );

        return builder.actions.map((action) => {
          const linkState = buildStorefrontActionLinkState(action);
          const normalizedRouteKey = String(action?.route_key || action?.expression || "").trim();
          const explicitTargetPageId = String(action?.target_page_id || "").trim();

          const inferredTargetPage =
            pageById.get(explicitTargetPageId) ||
            pageByRouteKey.get(normalizedRouteKey) ||
            pageBySlug.get(routeKeyToPageSlug(normalizedRouteKey)) ||
            null;

          return {
            ...action,
            ...linkState,
            target_page_id: explicitTargetPageId || inferredTargetPage?.id || "",
            target_page_slug:
              explicitTargetPageId || inferredTargetPage?.id
                ? (inferredTargetPage?.slug || "")
                : String(linkState.target_page_slug || "").trim(),
            target_page_route_mode:
              explicitTargetPageId || inferredTargetPage?.id
                ? (inferredTargetPage?.route_mode || "custom_url")
                : String(action?.target_page_route_mode || linkState.target_page_route_mode || "custom_url"),
            target_page_route_key:
              explicitTargetPageId || inferredTargetPage?.id
                ? (inferredTargetPage?.route_key || "")
                : String(action?.target_page_route_key || linkState.target_page_route_key || ""),
          };
        });
      })()
    : [],
});

const createBlankSection = (pageId, index) => ({
  id: createId("section"),
  page_id: pageId,
  name: `section_${index + 1}`,
  title: "New Section",
  subtitle: "",
  layout: "template",
  variant: "hero",
  preset_key: "",
  component_key: "storefront-hero",
  order: index + 1,
  query_sql: "",
  query_json: "",
  rich_text_html: "",
  query_config: {},
  config: { schema_version: 1, content: {}, data: {}, style: {} },
  editor_schema: null,
});

const createBlankCustomSection = (pageId, index) => ({
  id: createId("section"),
  page_id: pageId,
  name: `custom-section-${index + 1}`,
  title: "Custom Section",
  subtitle: "",
  layout: "rich_text",
  variant: "custom",
  preset_key: "",
  component_key: "",
  order: index + 1,
  query_sql: "",
  query_json: "",
  rich_text_html: "",
  query_config: {},
  config: schemaDefaults(customSectionSchema),
  editor_schema: customSectionSchema,
});

const parseSectionQueryJson = (value) => {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const stringifySectionQueryJson = (value) => JSON.stringify(value, null, 2);

const schemaDefaults = (schema) => {
  const config = { schema_version: Number(schema?.version || 1), content: {}, data: {}, style: {} };
  (Array.isArray(schema?.fields) ? schema.fields : []).forEach((field) => {
    if (!field?.key) return;
    const group = String(field.group || "content");
    const fallback = field.default !== undefined
      ? field.default
      : field.type === "number"
        ? 8
        : field.type === "boolean"
          ? false
          : field.type === "filters" || field.type === "image" || field.type === "file"
            ? {}
            : field.type === "slider" || field.type === "multiple_image" || field.type === "repeater"
              ? []
            : "";
    config[group] = { ...(config[group] || {}), [field.key]: fallback };
  });
  return config;
};

const mergeSectionConfig = (schema, value) => {
  const defaults = schemaDefaults(schema);
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...defaults,
    ...source,
    content: { ...defaults.content, ...(source.content || {}) },
    data: { ...defaults.data, ...(source.data || {}) },
    style: { ...defaults.style, ...(source.style || {}) },
  };
};

const getSectionSchema = (section, presetLibrary = {}) => {
  if (section?.editor_schema?.fields) return section.editor_schema;
  if (section?.variant === "custom") return customSectionSchema;
  const presets = presetLibrary?.[section?.variant] || [];
  return presets.find((preset) => preset.preset_key === section?.preset_key)?.config_schema || null;
};

const getConfigField = (config, field) => config?.[field?.group || "content"]?.[field?.key];

const inputClassName =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10";

const textareaClassName =
  "min-h-[132px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10";

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <div className="mb-2 flex min-h-[24px] items-center gap-2">
        <p className="text-sm font-semibold text-zinc-900">{label}</p>
        {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
      </div>
      {children}
    </label>
  );
}

function DemandTagFiltersField({ field, value, onChange, demandTags = [], loading = false }) {
  const filters = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const selectedTags = (Array.isArray(filters.demand_tag) ? filters.demand_tag : [filters.demand_tag])
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean);

  const toggleTag = (tagValue, checked) => {
    const normalizedTag = String(tagValue || "").trim().toLowerCase();
    const nextTags = new Set(selectedTags);
    if (checked) nextTags.add(normalizedTag);
    else nextTags.delete(normalizedTag);

    const nextFilters = { ...filters };
    if (nextTags.size > 0) nextFilters.demand_tag = Array.from(nextTags);
    else delete nextFilters.demand_tag;
    onChange(nextFilters);
  };

  return (
    <Field label="Demand Tags" hint="Select the product demand tags used by this section">
      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        {loading ? <p className="text-sm text-zinc-500">Loading demand tags...</p> : null}
        {!loading && demandTags.length === 0 ? (
          <p className="text-sm text-zinc-500">No demand tags found. Add them from Demand Tag Setup first.</p>
        ) : null}
        {!loading && demandTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {demandTags.map((tag) => {
              const tagValue = String(tag?.value || "").trim().toLowerCase();
              const checked = selectedTags.includes(tagValue);

              return (
                <label
                  key={tag?.id || tagValue}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    checked
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-slate-300 bg-white text-slate-800 hover:border-slate-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(event) => toggleTag(tagValue, event.target.checked)}
                  />
                  {checked ? <PiCheck className="size-4" aria-hidden="true" /> : null}
                  <span>{tag?.name || tag?.label || tagValue.replaceAll("_", " ")}</span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
    </Field>
  );
}

function SectionConfigField({ field, value, onChange, onFileChange, uploading = false, pages = [], demandTags = [], demandTagsLoading = false }) {
  const type = String(field?.type || "text");
  const label = field?.label || field?.key || "Field";

  if (type === "boolean") {
    return (
      <label className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <span className="text-sm font-semibold text-zinc-900">{label}</span>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  if (type === "image" || type === "file") {
    const image = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return (
      <Field label={label} hint="Choose an image file">
        <div className="space-y-2">
          <input key={`${field.key}-${image.url || "empty"}`} type="file" accept={field.accept || "image/*"} className="file-input file-input-bordered w-full" disabled={uploading} onChange={(event) => onFileChange?.(event.target.files)} />
          {image.url ? (
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              <img src={image.url} alt={image.alt || label} className="max-h-56 w-full object-contain" loading="lazy" />
              <button type="button" className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 hover:bg-rose-50" onClick={() => onChange({})}>Remove</button>
            </div>
          ) : null}
          <input className={inputClassName} value={image.alt || ""} placeholder="Image alt text" onChange={(event) => onChange({ ...image, alt: event.target.value })} />
          {uploading ? <p className="text-xs text-indigo-600">Uploading...</p> : null}
        </div>
      </Field>
    );
  }

  if (type === "slider" || type === "multiple_image") {
    const images = Array.isArray(value) ? value : [];
    return (
      <Field label={label} hint="Select multiple image files">
        <input key={`${field.key}-${images.length}`} type="file" multiple accept={field.accept || "image/*"} className="file-input file-input-bordered w-full" disabled={uploading} onChange={(event) => onFileChange?.(event.target.files)} />
        {images.length ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((item, index) => {
              const url = typeof item === "object" ? item?.url : item;
              if (!url) return null;
              return (
                <div key={`${url}-${index}`} className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  <img src={url} alt={typeof item === "object" ? item?.alt || `${label} ${index + 1}` : `${label} ${index + 1}`} className="h-24 w-full object-cover" loading="lazy" />
                  <button type="button" className="absolute right-1 top-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 hover:bg-rose-50" onClick={() => onChange(images.filter((_, imageIndex) => imageIndex !== index))}>Remove</button>
                </div>
              );
            })}
          </div>
        ) : null}
        {uploading ? <p className="mt-1 text-xs text-indigo-600">Uploading...</p> : null}
      </Field>
    );
  }

  if (type === "iconpicker") {
    return <IconPickerField field={field} value={value ?? ""} onChange={onChange} />;
  }

  if (type === "url") {
    return <UrlField field={field} value={value ?? ""} onChange={onChange} pages={pages} />;
  }

  if (type === "repeater") {
    return <RepeaterField field={field} value={value ?? []} onChange={onChange} onFileChange={onFileChange} uploading={uploading} />;
  }

  if (type === "filters") {
    if (Array.isArray(field.allowed) && field.allowed.includes("demand_tag")) {
      return (
        <DemandTagFiltersField
          field={field}
          value={value}
          onChange={onChange}
          demandTags={demandTags}
          loading={demandTagsLoading}
        />
      );
    }

    const filters = value && typeof value === "object" ? value : {};
    return (
      <Field label={label} hint="Only supported filters are accepted">
        <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          {(field.allowed || []).map((filterKey) => (
            <div key={filterKey} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600">{filterKey}</span>
              <input
                className={inputClassName}
                value={filters[filterKey] ?? ""}
                placeholder="Optional"
                onChange={(event) => {
                  const next = { ...filters };
                  if (event.target.value === "") delete next[filterKey];
                  else next[filterKey] = event.target.value;
                  onChange(next);
                }}
              />
            </div>
          ))}
        </div>
      </Field>
    );
  }

  if (type === "select") {
    return (
      <Field label={label}>
        <select className={inputClassName} value={value ?? field.default ?? ""} onChange={(event) => onChange(event.target.value)}>
          {(field.options || []).map((option) => {
            const optionValue = typeof option === "object" ? option.value : option;
            const optionLabel = typeof option === "object" ? option.label : option;
            return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
          })}
        </select>
      </Field>
    );
  }

  if (type === "number") {
    return (
      <Field label={label} hint={`Range: ${field.min ?? 0}–${field.max ?? 1000}`}>
        <input className={inputClassName} type="number" min={field.min} max={field.max} value={value ?? field.default ?? ""} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} />
      </Field>
    );
  }

  if (type === "color") {
    const textValue = String(value ?? field.default ?? "");
    const pickerValue = /^#[0-9a-f]{6}$/i.test(textValue) ? textValue : "#7F00FF";
    return (
      <Field label={label} hint={field.placeholder || "Choose a color or enter a CSS color value"}>
        <div className="flex items-center gap-2">
          <input type="color" aria-label={`${label} picker`} className="h-11 w-14 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1" value={pickerValue} onChange={(event) => onChange(event.target.value)} />
          <input className={inputClassName} value={textValue} placeholder={field.placeholder || "#7F00FF"} onChange={(event) => onChange(event.target.value)} />
        </div>
      </Field>
    );
  }

  if (type === "rich_text") {
    return (
      <Field label={label}>
        <ReactQuill theme="snow" value={value ?? ""} placeholder={field.placeholder || "Write something..."} onChange={onChange} className="rounded-xl bg-white" />
      </Field>
    );
  }

  if (type === "textarea") {
    return (
      <Field label={label}>
        <textarea className={textareaClassName} value={value ?? ""} placeholder={field.placeholder || ""} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <input className={inputClassName} value={value ?? ""} placeholder={field.placeholder || ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function TabButton({ active, disabled = false, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-zinc-900 text-white shadow-sm"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
      } ${disabled ? "cursor-not-allowed opacity-50 hover:bg-white" : ""}`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 text-sm text-zinc-500">{text}</p>
    </div>
  );
}

const resolveComponentOptions = (componentOptions, variant) =>
  Array.isArray(componentOptions?.[variant]) ? componentOptions[variant] : [];

const resolveDefaultComponentKey = (componentOptions, variant, fallback = "") =>
  resolveComponentOptions(componentOptions, variant)[0]?.value || fallback || "";

export default function StorefrontHomeBuilder() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [builder, setBuilder] = useState(createDefaultBuilder());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectionMediaUploading, setSectionMediaUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("pages");
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [sectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [actionEditorOpen, setActionEditorOpen] = useState(false);
  const [activeActionPlacement, setActiveActionPlacement] = useState("header");
  const [footerGroupDraft, setFooterGroupDraft] = useState({
    group_key: "",
    title: "",
    note: "",
    target_page_ids: [],
  });
  const [footerEditorMode, setFooterEditorMode] = useState("edit");
  const [activeSectionGroup, setActiveSectionGroup] = useState("");
  const [demandTagOptions, setDemandTagOptions] = useState([]);
  const [demandTagsLoading, setDemandTagsLoading] = useState(false);
  const [selectedTemplateInfo, setSelectedTemplateInfo] = useState(null);
  const [builderSource, setBuilderSource] = useState("");
  const [draggedSectionId, setDraggedSectionId] = useState(null);
  const [draggedActionId, setDraggedActionId] = useState(null);
  const [draggedFooterGroupKey, setDraggedFooterGroupKey] = useState(null);
  const actionCardRefs = useRef(new Map());
  const previousActionRectsRef = useRef(new Map());
  const footerGroupCardRefs = useRef(new Map());
  const previousFooterGroupRectsRef = useRef(new Map());

  const pages = useMemo(() => builder.pages || [], [builder.pages]);
  const sections = useMemo(() => builder.sections || [], [builder.sections]);
  const actions = useMemo(() => builder.actions || [], [builder.actions]);
  const templateVariants = useMemo(() => builder.meta?.template_variants || [], [builder.meta?.template_variants]);
  const sectionPresets = useMemo(() => builder.meta?.section_presets || {}, [builder.meta?.section_presets]);
  const componentOptions = useMemo(() => builder.meta?.component_options || {}, [builder.meta?.component_options]);
  const canEdit = hasPermission("general-preferences.edit");

  useEffect(() => {
    let mounted = true;

    const loadBuilder = async () => {
      try {
        const response = await getStorefrontHomeBuilder(accessToken);
        if (!mounted) return;

        const nextBuilder = normalizeBuilderPages(response.data || createDefaultBuilder(), response.template || {});
        setBuilder(nextBuilder);
        setSelectedTemplateInfo(response.template || null);
        setBuilderSource(response.builder_source || "");
        setSelectedPageId(nextBuilder.default_page_id || nextBuilder.pages?.[0]?.id || null);
        setSelectedSectionId(nextBuilder.sections?.[0]?.id || null);
        setSelectedActionId(nextBuilder.actions?.[0]?.id || null);
        setActiveActionPlacement(normalizeActionPlacement(nextBuilder.actions?.[0]?.placement || "header"));
      } catch (error) {
        if (mounted) {
          toast.error(error?.response?.data?.message || error?.message || "Failed to load storefront builder");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (accessToken) {
      loadBuilder();
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  useEffect(() => {
    let mounted = true;

    const loadDemandTags = async () => {
      if (!accessToken) {
        setDemandTagOptions([]);
        return;
      }

      setDemandTagsLoading(true);
      try {
        const response = await getUserDefinedValues(accessToken, {
          type: "demand_tag",
          page: 1,
          perPage: 200,
        });
        if (!mounted) return;

        const seen = new Set();
        const options = [...defaultDemandTagOptions, ...(Array.isArray(response?.data) ? response.data : [])].filter((tag) => {
          const value = String(tag?.value || tag?.label || tag?.name || "").trim().toLowerCase();
          if (!value || seen.has(value)) return false;
          seen.add(value);
          return true;
        });
        setDemandTagOptions(options);
      } catch {
        if (mounted) setDemandTagOptions([]);
      } finally {
        if (mounted) setDemandTagsLoading(false);
      }
    };

    void loadDemandTags();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const pageOptions = useMemo(
    () => pages.map((page) => ({ value: page.id, label: page.name || "Untitled Page" })),
    [pages],
  );
  const defaultPageId = builder.default_page_id || pages[0]?.id || null;
  const hasPages = pages.length > 0;
  const homePageId = useMemo(() => {
    const matchedPage = pages.find((page) => {
      const pageSlug = String(page.slug || "").trim().toLowerCase();
      const pageName = String(page.name || "").trim().toLowerCase();
      return pageSlug === "home" || pageName === "home";
    });

    return matchedPage?.id || pages[0]?.id || "";
  }, [pages]);

  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0] || null;
  const isDefaultPageSelected = Boolean(selectedPage && defaultPageId && selectedPage.id === defaultPageId);
  const sectionsForSelectedPage = useMemo(
    () =>
      sections
        .filter((section) => section.page_id === selectedPageId)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [sections, selectedPageId],
  );
  const actionsForSelectedPage = useMemo(
    () =>
      actions
        .filter((action) => !selectedPageId || action.page_id === selectedPageId)
        .slice(),
    [actions, selectedPageId],
  );
  const activeActionGroupActions = useMemo(
    () =>
      sortActionsForBuilder(
        actionsForSelectedPage.filter(
          (action) => normalizeActionPlacement(action.placement) === activeActionPlacement,
        ),
      ),
    [actionsForSelectedPage, activeActionPlacement],
  );
  const groupedTemplatePresetLibrary = useMemo(
    () =>
      Object.entries(sectionPresets || {}).reduce((acc, [variant, presets]) => {
        if (Array.isArray(presets) && presets.length > 0) {
          acc[variant] = presets;
        }
        return acc;
      }, {}),
    [sectionPresets],
  );
  const groupedTemplatePresetEntries = useMemo(
    () => Object.entries(groupedTemplatePresetLibrary),
    [groupedTemplatePresetLibrary],
  );
  const sectionsByVariantForSelectedPage = useMemo(
    () =>
      sectionsForSelectedPage.reduce((acc, section) => {
        const key = String(section.variant || "other");
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(section);
        return acc;
      }, {}),
    [sectionsForSelectedPage],
  );
  const activePresetGroupEntry = useMemo(() => {
    if (!groupedTemplatePresetEntries.length) {
      return null;
    }

    return groupedTemplatePresetEntries.find(([groupKey]) => groupKey === activeSectionGroup) || groupedTemplatePresetEntries[0];
  }, [activeSectionGroup, groupedTemplatePresetEntries]);
  const activePresetGroupKey = activePresetGroupEntry?.[0] || "";
  const activePresetGroupPresets = activePresetGroupEntry?.[1] || [];
  const activePresetGroupLabel =
    templateVariants.find((item) => item.value === activePresetGroupKey)?.label || activePresetGroupKey;
  const placementSectionIds = useMemo(() => {
    const resolveSectionId = (variant) =>
      sections.find(
        (section) =>
          section.page_id === homePageId &&
          String(section.variant || "").trim().toLowerCase() === variant,
      )?.id || "";

    return {
      header: resolveSectionId("header"),
      footer: resolveSectionId("footer"),
    };
  }, [sections, homePageId]);
  const selectedSection =
    sectionsForSelectedPage.find((section) => section.id === selectedSectionId) ||
    sections.find((section) => section.id === selectedSectionId) ||
    null;
  const selectedAction =
    actionsForSelectedPage.find((action) => action.id === selectedActionId) ||
    actions.find((action) => action.id === selectedActionId) ||
    null;
  const actionEditorAction =
    selectedAction ||
    (footerEditorMode === "new" && selectedPage
      ? {
          id: footerGroupDraft.group_key || "footer-group-draft",
          page_id: selectedPage.id,
          section_id: "",
          name: "New Footer Segment",
          slug: "new-footer-segment",
          expression: "",
          link_type: "storefront_page",
          route_key: "",
          target_page_id: "",
          target_page_slug: "",
          target_page_route_mode: "custom_url",
          target_page_route_key: "",
          label: "",
          placement: "footer",
          footer_group: footerGroupDraft.group_key || "",
          sort_order: 1,
        }
      : null);
  const footerGroupsForSelectedPage = useMemo(() => {
    if (!selectedPage) {
      return [];
    }

    const footerActions = sortActionsForBuilder(
      actionsForSelectedPage.filter((action) => normalizeActionPlacement(action.placement) === "footer"),
    );
    const groups = [];
    const groupMap = new Map();

    footerActions.forEach((action) => {
      const groupKey = normalizeFooterGroupKey(action.footer_group);
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
        groups.push({ group_key: groupKey, actions: groupMap.get(groupKey) });
      }
      groupMap.get(groupKey).push(action);
    });

    return groups.map((group) => {
      const firstAction = group.actions[0] || null;
      return {
        group_key: group.group_key,
        title: firstAction?.footer_group || getFooterGroupDisplayTitle(group.group_key),
        note: String(firstAction?.label || "").trim(),
        target_page_ids: collectActionTargetPageIds(group.actions, pages),
        actions: sortActionsForBuilder(group.actions),
      };
    });
  }, [actionsForSelectedPage, selectedPage]);
  const selectedSectionSchema = useMemo(
    () => getSectionSchema(selectedSection, groupedTemplatePresetLibrary),
    [selectedSection, groupedTemplatePresetLibrary],
  );
  const selectedSectionConfig = useMemo(() => {
    const config = mergeSectionConfig(selectedSectionSchema, selectedSection?.config);
    const legacyTitle = String(selectedSection?.title || "");
    const legacySubtitle = String(selectedSection?.subtitle || "");
    const legacyHtml = String(selectedSection?.rich_text_html || "");

    if (selectedSection?.variant === "custom") {
      return {
        ...config,
        content: {
          ...config.content,
          title: config.content.title || legacyTitle,
          subtitle: config.content.subtitle || legacySubtitle,
          html: config.content.html || legacyHtml,
        },
      };
    }

    return config;
  }, [selectedSectionSchema, selectedSection?.config, selectedSection?.rich_text_html, selectedSection?.variant]);

  useEffect(() => {
    if (!groupedTemplatePresetEntries.some(([groupKey]) => groupKey === activeSectionGroup)) {
      setActiveSectionGroup(groupedTemplatePresetEntries[0]?.[0] || "");
    }
  }, [activeSectionGroup, groupedTemplatePresetEntries]);

  useEffect(() => {
    if (!ACTION_PLACEMENT_ORDER.includes(activeActionPlacement)) {
      setActiveActionPlacement("header");
    }
  }, [activeActionPlacement]);

  useEffect(() => {
    if (footerEditorMode === "new" && actionEditorOpen) {
      return;
    }

    if (actionsForSelectedPage.length === 0) {
      setSelectedActionId(null);
      setActionEditorOpen(false);
      setFooterGroupDraft({
        group_key: "",
        title: "",
        note: "",
        target_page_ids: [],
      });
      return;
    }

    if (selectedActionId && actionsForSelectedPage.some((action) => action.id === selectedActionId)) {
      const current = actionsForSelectedPage.find((action) => action.id === selectedActionId);
      if (current) {
        setActiveActionPlacement(normalizeActionPlacement(current.placement));
      }
      return;
    }

    const firstActionInGroup = activeActionGroupActions[0] || null;
    if (firstActionInGroup) {
      setSelectedActionId(firstActionInGroup.id);
      setActiveActionPlacement(normalizeActionPlacement(firstActionInGroup.placement));
    }
  }, [actionsForSelectedPage, activeActionGroupActions, selectedActionId, footerEditorMode, actionEditorOpen]);

  useEffect(() => {
    if (footerEditorMode === "new") {
      return;
    }

    if (!selectedAction || normalizeActionPlacement(selectedAction.placement) !== "footer") {
      return;
    }

    const groupKey = String(selectedAction.footer_group || "").trim() || normalizeFooterGroupKey(selectedAction.name);
    const footerGroup = footerGroupsForSelectedPage.find((group) => group.group_key === groupKey);

    setFooterGroupDraft({
      group_key: groupKey,
      title: footerGroup?.title || groupKey,
      note: footerGroup?.note || "",
      target_page_ids: footerGroup?.target_page_ids || [],
    });
  }, [footerGroupsForSelectedPage, selectedAction, footerEditorMode]);

  useLayoutEffect(() => {
    if (!selectedPage) {
      previousActionRectsRef.current = new Map();
      return;
    }

    const currentRects = new Map();

    activeActionGroupActions.forEach((action) => {
      const node = actionCardRefs.current.get(action.id);
      if (node) {
        currentRects.set(action.id, node.getBoundingClientRect());
      }
    });

    const previousRects = previousActionRectsRef.current;

    activeActionGroupActions.forEach((action) => {
      const node = actionCardRefs.current.get(action.id);
      const previous = previousRects.get(action.id);
      const current = currentRects.get(action.id);

      if (!node || !previous || !current) {
        return;
      }

      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;

      if (!deltaX && !deltaY) {
        return;
      }

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    });

    previousActionRectsRef.current = currentRects;
  }, [activeActionGroupActions, selectedPage]);

  useLayoutEffect(() => {
    if (!selectedPage) {
      previousFooterGroupRectsRef.current = new Map();
      return;
    }

    const currentRects = new Map();

    footerGroupsForSelectedPage.forEach((group) => {
      const node = footerGroupCardRefs.current.get(group.group_key);
      if (node) {
        currentRects.set(group.group_key, node.getBoundingClientRect());
      }
    });

    const previousRects = previousFooterGroupRectsRef.current;

    footerGroupsForSelectedPage.forEach((group) => {
      const node = footerGroupCardRefs.current.get(group.group_key);
      const previous = previousRects.get(group.group_key);
      const current = currentRects.get(group.group_key);

      if (!node || !previous || !current) {
        return;
      }

      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;

      if (!deltaX && !deltaY) {
        return;
      }

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    });

    previousFooterGroupRectsRef.current = currentRects;
  }, [footerGroupsForSelectedPage, selectedPage]);

  useEffect(() => {
    if (!hasPages && activeTab !== "pages") {
      setActiveTab("pages");
    }
  }, [activeTab, hasPages]);

  const updateBuilderList = (key, updater) => {
    setBuilder((prev) => ({
      ...prev,
      [key]: updater(Array.isArray(prev[key]) ? prev[key] : []),
    }));
  };

  const updatePageField = (pageId, field, value) => {
    updateBuilderList("pages", (items) =>
      items.map((page) => {
        if (page.id !== pageId) {
          return page;
        }

        if (field === "name") {
          const nextName = value;
          return {
            ...page,
            name: nextName,
            slug:
              page.route_mode === "internal_route"
                ? page.slug
                : (String(page.slug || "").trim() ? page.slug : slugifyValue(nextName)),
          };
        }

        if (field === "route_mode") {
          if (value === "internal_route") {
            const fallbackRoute = PAGE_INTERNAL_ROUTE_SET.has(String(page.route_key || "").trim())
              ? String(page.route_key || "").trim()
              : STOREFRONT_INTERNAL_ROUTE_OPTIONS[0].value;

            return {
              ...page,
              route_mode: "internal_route",
              route_key: fallbackRoute,
              slug: routeKeyToPageSlug(fallbackRoute),
            };
          }

          return {
            ...page,
            route_mode: "custom_url",
            route_key: "",
            slug: String(page.slug || "").trim() || slugifyValue(page.name || ""),
          };
        }

        if (field === "route_key") {
          const normalizedRoute = PAGE_INTERNAL_ROUTE_SET.has(String(value || "").trim())
            ? String(value || "").trim()
            : STOREFRONT_INTERNAL_ROUTE_OPTIONS[0].value;

          return {
            ...page,
            route_mode: "internal_route",
            route_key: normalizedRoute,
            slug: routeKeyToPageSlug(normalizedRoute),
          };
        }

        if (field === "slug") {
          const normalizedSlug = slugifyValue(value);

          if ((page.route_mode || "custom_url") !== "internal_route" && normalizedSlug && RESERVED_PAGE_SLUGS.has(normalizedSlug)) {
            toast.info("This slug is reserved by an existing route. Pick a different page slug.");
            return page;
          }

          return {
            ...page,
            slug: normalizedSlug,
          };
        }

        return { ...page, [field]: value };
      }),
    );
  };

  const updateSectionField = (sectionId, field, value) => {
    updateBuilderList("sections", (items) =>
      items.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        if (field === "variant") {
          setActiveSectionGroup(String(value));

          const nextPresets = groupedTemplatePresetLibrary?.[value] || [];
          const nextPresetKey = nextPresets.some((preset) => preset.preset_key === section.preset_key)
            ? section.preset_key
            : nextPresets[0]?.preset_key || "";
          const nextPreset = nextPresets.find((preset) => preset.preset_key === nextPresetKey) || null;
          const nextSchema = nextPreset?.config_schema || null;

          return {
            ...section,
            variant: value,
            preset_key: nextPresetKey,
            component_key: nextPreset?.component_key || resolveDefaultComponentKey(componentOptions, value, section.component_key),
            editor_schema: nextSchema,
            config: mergeSectionConfig(nextSchema, section.config),
          };
        }

        if (field === "layout") {
          if (value === "rich_text") {
            const nextSchema = getSectionSchema({ ...section, variant: "custom", preset_key: "" }, groupedTemplatePresetLibrary);
            return {
              ...section,
              layout: value,
              variant: "custom",
              preset_key: "",
              component_key: "",
              editor_schema: nextSchema,
              config: mergeSectionConfig(nextSchema, section.config),
            };
          }

          if (value === "template") {
            const fallbackVariant = activeSectionGroup && activeSectionGroup !== "custom"
              ? activeSectionGroup
              : groupedTemplatePresetEntries[0]?.[0] || templateVariants[0]?.value || "hero";
            const nextPresets = groupedTemplatePresetLibrary?.[fallbackVariant] || [];
            const nextPreset = nextPresets.find((preset) => preset.preset_key === section.preset_key) || nextPresets[0] || null;
            const nextSchema = nextPreset?.config_schema || null;

            return {
              ...section,
              layout: value,
              variant: fallbackVariant,
              preset_key: nextPreset?.preset_key || "",
              component_key: nextPreset?.component_key || resolveDefaultComponentKey(componentOptions, fallbackVariant, "storefront-hero"),
              editor_schema: nextSchema,
              config: mergeSectionConfig(nextSchema, section.config),
            };
          }
        }

        if (field === "preset_key") {
          const nextPreset = (groupedTemplatePresetLibrary?.[section.variant] || []).find((preset) => preset.preset_key === value) || null;
          const nextSchema = nextPreset?.config_schema || section.editor_schema || null;

          return {
            ...section,
            preset_key: value,
            component_key: nextPreset?.component_key || section.component_key,
            editor_schema: nextSchema,
            config: mergeSectionConfig(nextSchema, section.config),
          };
        }

        return { ...section, [field]: value };
      }),
    );
  };

  const updateSectionConfigField = (sectionId, field, value) => {
    updateBuilderList("sections", (items) =>
      items.map((section) => {
        if (section.id !== sectionId) return section;
        const schema = getSectionSchema(section, groupedTemplatePresetLibrary);
        const config = mergeSectionConfig(schema, section.config);
        const group = String(field.group || "content");
        return {
          ...section,
          editor_schema: schema || section.editor_schema,
          ...(section.variant === "custom" && field.group === "content"
            ? {
                ...(field.key === "title" ? { title: String(value || "") } : {}),
                ...(field.key === "subtitle" ? { subtitle: String(value || "") } : {}),
                ...(field.key === "html" ? { rich_text_html: String(value || "") } : {}),
              }
            : {}),
          config: {
            ...config,
            [group]: { ...(config[group] || {}), [field.key]: value },
          },
        };
      }),
    );
  };

  const uploadSectionConfigMedia = async (section, field, fileList, repeaterContext = null) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    setSectionMediaUploading(true);
    try {
      const response = await uploadStorefrontSectionMedia(accessToken, files);
      const urls = (response.data || []).map((item) => item.url).filter(Boolean);
      if (repeaterContext?.field?.key && Number.isInteger(repeaterContext.index)) {
        const schema = getSectionSchema(section, groupedTemplatePresetLibrary);
        const config = mergeSectionConfig(schema, section.config);
        const group = String(field.group || "content");
        const items = Array.isArray(config?.[group]?.[field.key]) ? [...config[group][field.key]] : [];
        const childField = repeaterContext.field;
        const item = { ...(items[repeaterContext.index] || {}) };
        const current = item[childField.key];
        item[childField.key] = ["slider", "multiple_image"].includes(String(childField.type || childField.input_type))
          ? [...(Array.isArray(current) ? current : []), ...urls]
          : (urls[0] ? { url: urls[0], alt: "" } : current);
        items[repeaterContext.index] = item;
        updateSectionConfigField(section.id, field, items);
        return;
      }
      if (String(field.type) === "slider" || String(field.type) === "multiple_image") {
        const current = Array.isArray(section?.config?.[field.group || "content"]?.[field.key])
          ? section.config[field.group || "content"][field.key]
          : [];
        updateSectionConfigField(section.id, field, [...current, ...urls]);
      } else if (urls[0]) {
        updateSectionConfigField(section.id, field, { url: urls[0], alt: "" });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to upload image");
    } finally {
      setSectionMediaUploading(false);
    }
  };

  const updateActionField = (actionId, field, value) => {
    updateBuilderList("actions", (items) =>
      items.map((action) => {
        if (action.id !== actionId) {
          return action;
        }

        const nextAction = { ...action, [field]: value };

        if (field === "name") {
          const nextName = value;
          return {
            ...action,
            name: nextName,
            slug: String(action.slug || "").trim() ? action.slug : slugifyValue(nextName),
          };
        }

        if (field === "link_type") {
          return {
            ...nextAction,
            ...buildStorefrontActionLinkState({
              ...nextAction,
              link_type: value,
            }),
          };
        }

        if (field === "route_key") {
          return {
            ...nextAction,
            route_key: value,
            expression: value,
          };
        }

        if (field === "slug") {
          return {
            ...nextAction,
            slug: slugifyValue(value),
          };
        }

        if (field === "target_page_id") {
          const targetPage = pages.find((page) => page.id === value) || null;

          return {
            ...nextAction,
            target_page_id: value,
            target_page_slug: targetPage?.slug || "",
            target_page_route_mode: targetPage?.route_mode || "custom_url",
            target_page_route_key: targetPage?.route_key || "",
            expression: "",
            route_key: "",
          };
        }

        if (field === "placement") {
          const nextPlacement = normalizeActionPlacement(value);
          const siblingCount = items.filter(
            (item) =>
              item.id !== actionId &&
              item.page_id === action.page_id &&
              normalizeActionPlacement(item.placement) === nextPlacement,
          ).length;

          return {
            ...nextAction,
            placement: nextPlacement,
            footer_group: nextPlacement === "footer" ? (nextAction.footer_group || "") : "",
            section_id: "",
            sort_order: siblingCount + 1,
          };
        }

        if (field === "page_id") {
          const nextPageSectionIds = sections
            .filter((section) => section.page_id === value)
            .map((section) => section.id);

          if (nextAction.section_id && !nextPageSectionIds.includes(nextAction.section_id)) {
            nextAction.section_id = "";
          }

          const nextPlacementCount = items.filter(
            (item) =>
              item.id !== actionId &&
              item.page_id === value &&
              normalizeActionPlacement(item.placement) === normalizeActionPlacement(action.placement),
          ).length;

          return {
            ...nextAction,
            sort_order: nextPlacementCount + 1,
          };
        }

        return nextAction;
      }),
    );
  };

  const addAction = (placement = "header") => {
    const nextPlacement = normalizeActionPlacement(placement);

    if (!selectedPage) {
      toast.info("Create a page first");
      return;
    }

    if (!isDefaultPageSelected) {
      toast.info("Select the default page to manage links");
      return;
    }

    const nextSortOrder =
      actionsForSelectedPage.filter((action) => normalizeActionPlacement(action.placement) === nextPlacement).length + 1;

    if (nextPlacement === "footer") {
      const draftKey = createId("footer-group");
      setFooterGroupDraft({
        group_key: draftKey,
        title: "",
        note: "",
        target_page_ids: [],
      });
      setFooterEditorMode("new");
      setSelectedActionId(null);
      setActiveActionPlacement(nextPlacement);
      setActionEditorOpen(true);
      return;
    }

    const nextAction = createBlankAction(selectedPage.id, "", nextPlacement, nextSortOrder);

    updateBuilderList("actions", (items) => [...items, nextAction]);
    setSelectedActionId(nextAction.id);
    setActiveActionPlacement(nextPlacement);
    setFooterEditorMode("edit");
    setActionEditorOpen(true);
  };

  const removeAction = (actionId) => {
    const removedAction = actions.find((action) => action.id === actionId) || null;

    updateBuilderList("actions", (items) => {
      const remaining = items.filter((action) => action.id !== actionId);

      if (!removedAction) {
        return remaining;
      }

      const remainingPageItems = remaining.filter((action) => action.page_id === removedAction.page_id);
      const placement = normalizeActionPlacement(removedAction.placement);
      const reorderedPlacementItems = sortActionsForBuilder(
        remainingPageItems.filter((action) => normalizeActionPlacement(action.placement) === placement),
      ).map((action, index) => ({
        ...action,
        sort_order: index + 1,
      }));
      const reorderedPlacementMap = new Map(reorderedPlacementItems.map((action) => [action.id, action]));

      return remaining.map((action) => {
        if (action.page_id !== removedAction.page_id) {
          return action;
        }

        const updated = reorderedPlacementMap.get(action.id);
        return updated || action;
      });
    });

    const remainingInPage = sortActionsForBuilder(
      actions.filter((action) => action.id !== actionId && action.page_id === selectedPage?.id),
    );
    setSelectedActionId(remainingInPage[0]?.id || null);
    if (selectedActionId === actionId) {
      setActionEditorOpen(false);
    }
  };

  const closeActionEditor = () => {
    setActionEditorOpen(false);
    setFooterEditorMode("edit");
  };

  const syncFooterGroupActions = ({ previousGroupKey, nextGroupTitle, nextGroupNote, nextPageIds }) => {
    if (!selectedPage) {
      return;
    }

    const normalizedPreviousKey = normalizeFooterGroupKey(previousGroupKey || nextGroupTitle);
    const nextTitle = String(nextGroupTitle || "").trim() || getFooterGroupDisplayTitle(normalizedPreviousKey);
    const nextNote = String(nextGroupNote || "").trim();
    const normalizedPageIds = Array.from(
      new Set((Array.isArray(nextPageIds) ? nextPageIds : []).map((pageId) => String(pageId).trim()).filter(Boolean)),
    );

    if (normalizedPageIds.length === 0) {
      toast.info("Select at least one page for this footer segment.");
      return;
    }

    const pageLookup = new Map(pages.map((page) => [String(page.id), page]));

    updateBuilderList("actions", (items) => {
      const pageFooterActions = sortActionsForBuilder(
        items.filter(
          (action) =>
            action.page_id === selectedPage.id &&
            normalizeActionPlacement(action.placement) === "footer",
        ),
      );
      const nextItems = items.filter(
        (action) =>
          action.page_id !== selectedPage.id ||
          normalizeActionPlacement(action.placement) !== "footer",
      );

      const groupedFooterActions = [];
      const groupedFooterActionsByKey = new Map();

      pageFooterActions.forEach((action) => {
        const actionGroupKey = normalizeFooterGroupKey(action.footer_group);
        const isDraftPlaceholder =
          action.id === selectedAction?.id &&
          !String(action.target_page_id || "").trim() &&
          !String(action.footer_group || "").trim() &&
          String(action.name || "").trim() === "New Footer Segment";

        if (isDraftPlaceholder) {
          return;
        }

        if (!groupedFooterActionsByKey.has(actionGroupKey)) {
          groupedFooterActionsByKey.set(actionGroupKey, []);
          groupedFooterActions.push([actionGroupKey, groupedFooterActionsByKey.get(actionGroupKey)]);
        }

        groupedFooterActionsByKey.get(actionGroupKey).push(action);
      });

      const updatedGroupActions = [];
      const previousGroupActions = groupedFooterActionsByKey.get(normalizedPreviousKey) || [];
      const previousByTargetPageId = new Map(
        previousGroupActions.map((action) => [String(action.target_page_id || "").trim(), action]),
      );

      normalizedPageIds.forEach((pageId, index) => {
        const existing = previousByTargetPageId.get(pageId) || null;
        const targetPage = pageLookup.get(pageId);

        if (!targetPage) {
          return;
        }

        updatedGroupActions.push({
          ...(existing || createBlankAction(selectedPage.id, "", "footer", index + 1)),
          page_id: selectedPage.id,
          section_id: "",
          placement: "footer",
          footer_group: nextTitle,
          label: nextNote,
          link_type: "storefront_page",
          name: targetPage.name || existing?.name || "Footer Link",
          slug: slugifyValue(targetPage.slug || existing?.slug || targetPage.name || "footer-link"),
          target_page_id: targetPage.id,
          target_page_slug: targetPage.slug || "",
          target_page_route_mode: targetPage.route_mode || "custom_url",
          target_page_route_key: targetPage.route_key || "",
          expression: "",
          route_key: "",
          sort_order: index + 1,
        });
      });

      let matchedPreviousGroup = false;
      const orderedFooterGroups = groupedFooterActions.map(([groupKey, groupActions]) => {
        if (groupKey !== normalizedPreviousKey) {
          return {
            group_key: groupKey,
            actions: sortActionsForBuilder(groupActions),
          };
        }

        matchedPreviousGroup = true;
        return {
          group_key: normalizeFooterGroupKey(nextTitle),
          actions: updatedGroupActions,
        };
      });

      if (!matchedPreviousGroup) {
        orderedFooterGroups.push({
          group_key: normalizeFooterGroupKey(nextTitle),
          actions: updatedGroupActions,
        });
      }

      const flattenedFooterActions = orderedFooterGroups
        .flatMap((group) => group.actions)
        .map((action, index) => ({
          ...action,
          sort_order: index + 1,
        }));

      return [...nextItems, ...flattenedFooterActions];
    });

    const nextFooterKey = normalizeFooterGroupKey(nextTitle);
    setFooterGroupDraft({
      group_key: nextFooterKey,
      title: nextTitle,
      note: nextNote,
      target_page_ids: normalizedPageIds,
    });
  };

  const removeFooterGroup = (groupKey) => {
    if (!selectedPage) {
      return;
    }

    const normalizedGroupKey = normalizeFooterGroupKey(groupKey);
    updateBuilderList("actions", (items) => {
      const nextItems = items.filter(
        (action) =>
          action.page_id !== selectedPage.id ||
          normalizeActionPlacement(action.placement) !== "footer",
      );
      const pageFooterActions = sortActionsForBuilder(
        items.filter(
          (action) =>
            action.page_id === selectedPage.id &&
            normalizeActionPlacement(action.placement) === "footer" &&
            normalizeFooterGroupKey(action.footer_group) !== normalizedGroupKey &&
            !(
              !String(action.target_page_id || "").trim() &&
              !String(action.footer_group || "").trim() &&
              String(action.name || "").trim() === "New Footer Segment"
            ),
        ),
      ).map((action, index) => ({
        ...action,
        sort_order: index + 1,
      }));

      return [...nextItems, ...pageFooterActions];
    });

    const remainingFooterActions = sortActionsForBuilder(
      actionsForSelectedPage.filter(
        (action) =>
          normalizeActionPlacement(action.placement) === "footer" &&
          normalizeFooterGroupKey(action.footer_group) !== normalizedGroupKey,
      ),
    );
    const nextSelected = remainingFooterActions[0] || null;

    setFooterGroupDraft({
      group_key: "",
      title: "",
      note: "",
      target_page_ids: [],
    });

    if (!nextSelected) {
      setSelectedActionId(null);
      setActiveActionPlacement("footer");
      setActionEditorOpen(false);
      return;
    }

    setSelectedActionId(nextSelected.id);
    setActiveActionPlacement("footer");
  };

  const reorderFooterGroup = (dragGroupKey, dropGroupKey) => {
    if (!selectedPage) {
      return;
    }

    const normalizedDragKey = normalizeFooterGroupKey(dragGroupKey);
    const normalizedDropKey = normalizeFooterGroupKey(dropGroupKey);

    if (!normalizedDragKey || !normalizedDropKey || normalizedDragKey === normalizedDropKey) {
      return;
    }

    const footerGroups = footerGroupsForSelectedPage.map((group) => group.group_key);
    const dragIndex = footerGroups.indexOf(normalizedDragKey);
    const dropIndex = footerGroups.indexOf(normalizedDropKey);

    if (dragIndex < 0 || dropIndex < 0) {
      return;
    }

    const reorderedGroups = [...footerGroups];
    const [movedGroup] = reorderedGroups.splice(dragIndex, 1);
    reorderedGroups.splice(dropIndex, 0, movedGroup);

    updateBuilderList("actions", (items) => {
      const pageFooterActions = items.filter(
        (action) =>
          action.page_id === selectedPage.id &&
          normalizeActionPlacement(action.placement) === "footer",
      );
      const otherActions = items.filter(
        (action) =>
          action.page_id !== selectedPage.id ||
          normalizeActionPlacement(action.placement) !== "footer",
      );

      const groupedActions = reorderedGroups.flatMap((groupKey) =>
        sortActionsForBuilder(
          pageFooterActions.filter((action) => normalizeFooterGroupKey(action.footer_group) === groupKey),
        ),
      );

      const nextOrderedFooterActions = groupedActions.map((action, index) => ({
        ...action,
        sort_order: index + 1,
      }));

      return [...otherActions, ...nextOrderedFooterActions];
    });
  };

  const addPage = () => {
    const nextPage = {
      id: createId("page"),
      name: `Page ${pages.length + 1}`,
      slug: `page-${pages.length + 1}`,
      route_mode: "custom_url",
      route_key: "",
      description: "",
    };

    updateBuilderList("pages", (items) => [...items, nextPage]);
    setBuilder((prev) => ({
      ...prev,
      default_page_id: prev.default_page_id || nextPage.id,
    }));
    setSelectedPageId(nextPage.id);
    setActiveTab("pages");
  };

  const setDefaultPage = (pageId) => {
    setBuilder((prev) => ({
      ...prev,
      default_page_id: pageId,
    }));
    setSelectedPageId(pageId);
  };

  const removePage = (pageId) => {
    if (pages.length <= 1) {
      toast.info("Keep at least one page.");
      return;
    }

    const nextPages = pages.filter((page) => page.id !== pageId);
    const fallbackPageId = nextPages[0]?.id || null;

    setBuilder((prev) => ({
      ...prev,
      default_page_id: prev.default_page_id === pageId ? fallbackPageId : prev.default_page_id,
      pages: nextPages,
      sections: prev.sections
        .filter((section) => section.page_id !== pageId)
        .map((section, index) => ({ ...section, order: index + 1 })),
      actions: prev.actions.filter((action) => action.page_id !== pageId),
    }));
    setSelectedPageId(fallbackPageId);
    setSelectedSectionId(null);
    setSelectedActionId(null);
  };

  const addCustomSection = () => {
    const pageId = selectedPageId || pages[0]?.id || null;

    if (!pageId) {
      toast.info("Create a page first, then add sections.");
      setActiveTab("pages");
      return;
    }

    const nextSection = createBlankCustomSection(pageId, sectionsForSelectedPage.length);

    updateBuilderList("sections", (items) => [...items, nextSection]);
    setSelectedSectionId(nextSection.id);
    setActiveTab("sections");
    setActiveSectionGroup("custom");
  };

  const addSectionFromPreset = (variantKey, preset) => {
    const pageId = selectedPageId || pages[0]?.id || null;

    if (!pageId) {
      toast.info("Create a page first, then add sections.");
      setActiveTab("pages");
      return;
    }

    const nextSection = {
      ...createBlankSection(pageId, sectionsForSelectedPage.length),
      variant: variantKey,
      preset_key: preset?.preset_key || "",
      component_key: preset?.component_key || resolveDefaultComponentKey(componentOptions, variantKey, "storefront-hero"),
      title: preset?.name || preset?.label || "New Section",
      name: slugifyValue(preset?.name || preset?.label || `${variantKey}-section`),
      category_refs: Array.isArray(preset?.categories) ? preset.categories : [],
      editor_schema: preset?.config_schema || null,
      config: schemaDefaults(preset?.config_schema),
    };

    updateBuilderList("sections", (items) => [...items, nextSection]);
    setSelectedSectionId(nextSection.id);
    setActiveTab("sections");
    setActiveSectionGroup(variantKey);
  };

  const reorderSections = (dragSectionId, dropSectionId) => {
    if (!selectedPage || !dragSectionId || !dropSectionId || dragSectionId === dropSectionId) {
      return;
    }

    const pageSections = [...sectionsForSelectedPage];
    const dragIndex = pageSections.findIndex((section) => section.id === dragSectionId);
    const dropIndex = pageSections.findIndex((section) => section.id === dropSectionId);

    if (dragIndex < 0 || dropIndex < 0) {
      return;
    }

    const reordered = [...pageSections];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    updateBuilderList("sections", (items) => {
      const otherSections = items.filter((section) => section.page_id !== selectedPage.id);
      const normalized = reordered.map((section, index) => ({
        ...section,
        order: index + 1,
      }));

      return [...otherSections, ...normalized];
    });
  };

  const removeSection = (sectionId) => {
    const remainingSections = sections.filter((section) => section.id !== sectionId);
    const pageSections = remainingSections
      .filter((section) => section.page_id === selectedPageId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((section, index) => ({ ...section, order: index + 1 }));
    const pageSectionMap = new Map(pageSections.map((section) => [section.id, section]));

    setBuilder((prev) => ({
      ...prev,
      sections: remainingSections.map((section) => pageSectionMap.get(section.id) || section),
      actions: prev.actions.map((action) =>
        action.section_id === sectionId ? { ...action, section_id: "" } : action,
      ),
    }));
    setSelectedSectionId(pageSections[0]?.id || null);
  };

  const handleSave = async () => {
    const theme = builder.settings?.theme || DEFAULT_THEME;
    if (!isHexColor(theme.primary_color) || !isHexColor(theme.secondary_color)) {
      setActiveTab("theme");
      toast.error("Primary and secondary colors must use a valid 6-digit hex value.");
      return;
    }

    if (!String(theme.font_family || "").trim()) {
      setActiveTab("theme");
      toast.error("Select a storefront font before saving.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        version: builder.version || 1,
        default_page_id: builder.default_page_id,
        pages: builder.pages || [],
        sections: sections.map((section) => ({
          ...section,
          order: section.order || 1,
        })),
        actions: builder.actions || [],
        settings: builder.settings || createDefaultBuilder().settings,
      };

      const response = await updateStorefrontHomeBuilder(accessToken, payload);
      setBuilder(normalizeBuilderPages(response.data || payload, selectedTemplateInfo || {}));
      toast.success("Saved successfully.");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DividedInputLoader />;
  }

  return (
    <div className="space-y-5 rounded-3xl bg-slate-50 p-4 text-slate-900 sm:p-5 lg:p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Storefront builder</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Edit the theme, pages, sections, and menus copied from the purchased template.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {builderSource === "selected_template_materialized" || builderSource === "selected_template"
                  ? "Template defaults loaded"
                  : builderSource === "company_records"
                    ? "Company records loaded"
                    : "Empty builder"}
              </span>
              {selectedTemplateInfo?.template_name ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Template: {selectedTemplateInfo.template_name}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{pages.length}</span> pages,{" "}
              <span className="font-semibold text-slate-900">{sections.length}</span> sections,{" "}
              <span className="font-semibold text-slate-900">{actions.length}</span> links
            </div>
            {canEdit && (
              <button type="button" className="btn border-0 bg-slate-900 text-white hover:bg-slate-800" onClick={handleSave} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-sm" /> : <PiFloppyDisk className="size-4" />}
                {saving ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
        <div className="flex flex-wrap gap-3">
          <TabButton active={activeTab === "pages"} icon={PiList} label="Pages" onClick={() => setActiveTab("pages")} />
          <TabButton
            active={activeTab === "sections"}
            disabled={!hasPages}
            icon={PiRows}
            label="Sections"
            onClick={() => hasPages && setActiveTab("sections")}
          />
          <TabButton
            active={activeTab === "actions"}
            disabled={!hasPages || !isDefaultPageSelected}
            icon={PiLink}
            label="Links"
            onClick={() => hasPages && isDefaultPageSelected && setActiveTab("actions")}
          />
          <TabButton active={activeTab === "theme"} icon={PiPaintBrush} label="Theme" onClick={() => setActiveTab("theme")} />
        </div>
      </section>

      {activeTab === "theme" && (() => {
        const theme = builder.settings?.theme || DEFAULT_THEME;
        const templateTheme = normalizeTheme({}, selectedTemplateInfo || {});
        const fontOptions = THEME_FONT_OPTIONS.includes(theme.font_family)
          ? THEME_FONT_OPTIONS
          : [theme.font_family, ...THEME_FONT_OPTIONS].filter(Boolean);
        const updateTheme = (field, value) => {
          setBuilder((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              theme: {
                ...DEFAULT_THEME,
                ...prev.settings?.theme,
                [field]: value,
              },
            },
          }));
        };

        return (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Store theme</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    These settings apply only to this store. The purchased template defaults stay unchanged.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-sm border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={() => setBuilder((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, theme: templateTheme },
                    }))}
                  >
                    Reset to template
                  </button>
                )}
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {[
                  ["primary_color", "Primary color", "Buttons, links, and accent elements"],
                  ["secondary_color", "Secondary color", "Supporting surfaces and secondary elements"],
                ].map(([field, label, hint]) => (
                  <Field key={field} label={label} hint={hint}>
                    <div className={`flex h-12 items-center gap-2 rounded-xl border bg-white px-2 ${isHexColor(theme[field]) ? "border-slate-200" : "border-rose-400"}`}>
                      <input
                        type="color"
                        className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                        value={isHexColor(theme[field]) ? theme[field] : DEFAULT_THEME[field]}
                        onChange={(event) => updateTheme(field, event.target.value.toUpperCase())}
                        aria-label={label}
                        disabled={!canEdit}
                      />
                      <input
                        className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-semibold uppercase outline-none disabled:cursor-not-allowed disabled:text-slate-500"
                        value={theme[field] || ""}
                        onChange={(event) => updateTheme(field, event.target.value.toUpperCase())}
                        maxLength={7}
                        placeholder="#000000"
                        disabled={!canEdit}
                      />
                    </div>
                  </Field>
                ))}

                <div className="md:col-span-2">
                  <Field label="Font family" hint="Used across storefront headings, text, navigation, and controls">
                    <select
                      className={inputClassName}
                      value={theme.font_family}
                      onChange={(event) => updateTheme("font_family", event.target.value)}
                      disabled={!canEdit}
                      style={{ fontFamily: `'${String(theme.font_family || "Inter").replace(/'/g, "")}', sans-serif` }}
                    >
                      {fontOptions.map((font) => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60"
              style={{ fontFamily: `'${String(theme.font_family || "Inter").replace(/'/g, "")}', sans-serif` }}
            >
              <div className="border-b border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Live style preview</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">Your storefront</h3>
                <p className="mt-2 text-sm text-slate-500">A quick preview of the selected brand colors and typography.</p>
              </div>
              <div className="space-y-5 p-5" style={{ backgroundColor: theme.secondary_color }}>
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: theme.primary_color }}>New collection</p>
                  <h4 className="mt-2 text-xl font-bold text-slate-950">Designed for your customers</h4>
                  <p className="mt-2 text-sm text-slate-500">Typography and brand accents update together.</p>
                  <button
                    type="button"
                    className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                    style={{ backgroundColor: theme.primary_color }}
                  >
                    Shop now
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <div className="h-2.5 w-16 rounded-full" style={{ backgroundColor: theme.primary_color }} />
                    <p className="mt-3 text-sm font-semibold text-slate-900">Primary</p>
                    <p className="mt-1 text-xs uppercase text-slate-500">{theme.primary_color}</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <div className="h-2.5 w-16 rounded-full border border-slate-200" style={{ backgroundColor: theme.secondary_color }} />
                    <p className="mt-3 text-sm font-semibold text-slate-900">Secondary</p>
                    <p className="mt-1 text-xs uppercase text-slate-500">{theme.secondary_color}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {activeTab === "pages" && (
        <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Pages</h2>
                <p className="text-sm text-slate-500">Template pages are loaded here. Add custom pages if needed.</p>
              </div>
              {canEdit && (
                <button type="button" className="btn btn-sm border-0 bg-slate-900 text-white hover:bg-slate-800" onClick={addPage}>
                  <PiPlus className="size-4" />
                </button>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {pages.length === 0 ? (
                <EmptyState title="No page yet" text="Add your first page." />
              ) : (
                pages.map((page) => (
                  <div
                    key={page.id}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      selectedPageId === page.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setSelectedPageId(page.id);
                          setActiveTab("sections");
                        }}
                      >
                        <p className="text-sm font-semibold">{page.name || "Untitled Page"}</p>
                        <p className={`mt-1 text-xs ${selectedPageId === page.id ? "text-slate-300" : "text-slate-500"}`}>
                          {page.route_mode === "internal_route" ? page.route_key || "/" : `/${page.slug || ""}`}
                        </p>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        {defaultPageId === page.id ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              selectedPageId === page.id
                                ? "border-white/15 bg-white/10 text-white"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <PiCheck className="mr-1.5 size-3.5" />
                            Default
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-xl transition ${
                            selectedPageId === page.id
                              ? "bg-white/10 text-white hover:bg-white/15"
                              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedPageId(page.id);
                            setActiveTab("pages");
                          }}
                          title="Edit page"
                        >
                          <PiNotePencil className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
            {!selectedPage ? (
              <EmptyState title="No page selected" text="Add a page and select it to edit." />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">{selectedPage.name || "Page"}</h3>
                    <p className="mt-1 text-sm text-slate-500">Update the selected storefront page.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {defaultPageId === selectedPage.id ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <PiCheck className="size-3.5" />
                        Default page
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => setDefaultPage(selectedPage.id)}
                      >
                        <PiCheck className="size-3.5" />
                        Set default
                      </button>
                    )}
                  {canEdit ? (
                    <button
                      type="button"
                        className="btn btn-ghost text-rose-600 hover:bg-rose-50"
                      onClick={() => removePage(selectedPage.id)}
                    >
                      <PiTrash className="size-4" />
                      Delete
                    </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Page Name">
                    <input
                      className={inputClassName}
                      value={selectedPage.name || ""}
                      onChange={(e) => updatePageField(selectedPage.id, "name", e.target.value)}
                      placeholder="Ecommerce Home"
                    />
                  </Field>

                  <Field label="Route Mode">
                    <select
                      className={inputClassName}
                      value={selectedPage.route_mode || "custom_url"}
                      onChange={(e) => updatePageField(selectedPage.id, "route_mode", e.target.value)}
                    >
                      {PAGE_ROUTE_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {selectedPage.route_mode === "internal_route" ? (
                    <Field label="Internal Route">
                      <select
                        className={inputClassName}
                        value={selectedPage.route_key || STOREFRONT_INTERNAL_ROUTE_OPTIONS[0].value}
                        onChange={(e) => updatePageField(selectedPage.id, "route_key", e.target.value)}
                      >
                        {STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label} - {option.value}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Slug">
                      <input
                        className={inputClassName}
                        value={selectedPage.slug || ""}
                        onChange={(e) => updatePageField(selectedPage.id, "slug", e.target.value)}
                        placeholder="ecommerce-home"
                      />
                    </Field>
                  )}
                </div>

              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "sections" && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="border-b border-slate-100 px-5 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">Preset library</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Only presets from the purchased template category are shown here. Pick a group, then add the section to the selected page.
                  </p>
                </div>

                {canEdit ? (
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                    onClick={addCustomSection}
                    disabled={!pages.length}
                  >
                    <PiPlus className="size-4" />
                    Custom section
                  </button>
                ) : null}
              </div>
            </div>

            <div className="px-5 py-5">
              {!selectedPage ? (
                <div className="mt-5">
                  <EmptyState title="Select a page" text="Pick a page first to browse preset groups." />
                </div>
              ) : groupedTemplatePresetEntries.length === 0 ? (
                <div className="mt-5">
                  <EmptyState title="No template presets" text="This template has no preset library available." />
                </div>
              ) : (
                <>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                    {groupedTemplatePresetEntries.map(([groupKey, presets]) => {
                      const groupLabel = templateVariants.find((item) => item.value === groupKey)?.label || groupKey;
                      const isActive = activePresetGroupKey === groupKey;

                      return (
                        <button
                          key={groupKey}
                          type="button"
                          onClick={() => setActiveSectionGroup(groupKey)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                            isActive
                              ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span>{groupLabel}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"}`}>
                            {Array.isArray(presets) ? presets.length : 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{activePresetGroupLabel || "Select a group"}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {activePresetGroupPresets.length} preset{activePresetGroupPresets.length === 1 ? "" : "s"} available for this section type.
                      </p>
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      {(sectionsByVariantForSelectedPage[activePresetGroupKey] || []).length} already added
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {activePresetGroupPresets.map((preset) => (
                      <button
                        key={preset.preset_key}
                        type="button"
                        onClick={() => addSectionFromPreset(activePresetGroupKey, preset)}
                        disabled={!selectedPage}
                        className="group flex min-h-[92px] items-center gap-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                          {String(preset.name || preset.label || "P").slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-950">{preset.name || preset.label}</p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                              {preset.preset_key}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Add this preset to the current page.</p>
                        </div>
                        <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition group-hover:bg-slate-50">
                          <PiPlus className="size-4" />
                          Add
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
            <div className="mb-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Builder Area</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">Canvas</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add presets from the library, then reorder the live page structure.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{selectedPage?.name || "No page"}</span>
                </div>
              </div>

              {!selectedPage ? (
                <EmptyState title="No page selected" text="Create or select a page first." />
              ) : sectionsForSelectedPage.length === 0 ? (
                <EmptyState title="No section added yet" text="Pick a template section from the left to add it here." />
              ) : (
                <div className="space-y-3">
                  {sectionsForSelectedPage.map((section) => (
                    <div
                      key={section.id}
                      draggable={canEdit}
                      onDragStart={() => setDraggedSectionId(section.id)}
                      onDragEnd={() => setDraggedSectionId(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={() => {
                        reorderSections(draggedSectionId, section.id);
                        setDraggedSectionId(null);
                      }}
                      onClick={() => {
                        setSelectedSectionId(section.id);
                        setSectionEditorOpen(true);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedSectionId(section.id);
                          setSectionEditorOpen(true);
                        }
                      }}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        selectedSection?.id === section.id
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)]"
                          : draggedSectionId === section.id
                            ? "border-slate-300 bg-slate-100 text-slate-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                      title="Drag to reorder"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
                            selectedSection?.id === section.id
                              ? "bg-white/10 text-white"
                              : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
                          }`}
                        >
                          <PiDotsSixVertical className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-6">
                            {section.title || section.name || "Untitled Section"}
                          </p>
                          <p className={`mt-1 truncate text-xs ${selectedSection?.id === section.id ? "text-slate-300" : "text-slate-500"}`}>
                            {section.preset_key || section.variant || "section"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedSectionId(section.id);
                              setSectionEditorOpen(true);
                            }}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                              selectedSection?.id === section.id
                                ? "bg-white/10 text-white hover:bg-white/15"
                                : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-white"
                            }`}
                            title="Edit section"
                          >
                            <PiNotePencil className="size-3.5" />
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeSection(section.id);
                              }}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                                selectedSection?.id === section.id
                                  ? "bg-white/10 text-white hover:bg-white/20"
                                  : "bg-white text-rose-500 ring-1 ring-slate-200 hover:bg-rose-50"
                              }`}
                              title="Remove section"
                            >
                              <PiTrash className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!selectedSection ? (
              <EmptyState
                title="No section selected"
                text={pages.length ? "Select a section from the canvas to edit it." : "Create a page first."}
              />
            ) : null}
          </div>
        </section>
      )}

      {sectionEditorOpen && selectedSection ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close section editor"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={() => setSectionEditorOpen(false)}
          />

          <div className="absolute right-0 top-0 flex h-full w-full max-w-[900px] flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)] xl:max-w-[980px]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Edit Section</p>
                  <h3 className="mt-2 truncate text-xl font-bold text-slate-950">
                    {selectedSection.title || selectedSection.name || "Section"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Update the selected section here. This drawer works for template and custom sections alike.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSectionEditorOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                  title="Close"
                >
                  <PiArrowLeft className="size-4" />
                </button>
              </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                {selectedSectionSchema?.fields?.length ? (
                  <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                    <div className="space-y-4">
                      {selectedSectionSchema.fields.map((field) => (
                        <SectionConfigField
                          key={`${selectedSection.id}.${selectedSection.preset_key || "preset"}.${field.group || "content"}.${field.key}`}
                          field={field}
                          value={getConfigField(selectedSectionConfig, field)}
                          onChange={(value) => updateSectionConfigField(selectedSection.id, field, value)}
                          onFileChange={(files, context) => uploadSectionConfigMedia(selectedSection, field, files, context)}
                          uploading={sectionMediaUploading}
                          pages={pages}
                          demandTags={demandTagOptions}
                          demandTagsLoading={demandTagsLoading}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => removeSection(selectedSection.id)}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <PiTrash className="size-4" />
                Delete section
              </button>

              <button
                type="button"
                onClick={() => setSectionEditorOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "actions" && (
        <section className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-950">Menu Builder</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Choose the menu area and then add items to the canvas.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {ACTION_PLACEMENT_ORDER.map((placement) => {
                const placementActions = actionsForSelectedPage.filter(
                  (action) => normalizeActionPlacement(action.placement) === placement,
                );
                const isActive = activeActionPlacement === placement;

                return (
                  <button
                    key={placement}
                    type="button"
                    onClick={() => {
                      setActiveActionPlacement(placement);
                      setSelectedActionId(placementActions[0]?.id || null);
                      closeActionEditor();
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                          isActive ? "border-white bg-white" : "border-slate-300 bg-white"
                        }`}
                        aria-hidden="true"
                      >
                        {isActive ? <span className="h-2.5 w-2.5 rounded-full bg-slate-950" /> : null}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{ACTION_PLACEMENT_LABELS[placement]}</p>
                        <p className={`mt-1 text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                          {placement === "header" ? "Top navigation links" : "Footer navigation links"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isActive ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {placementActions.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Canvas
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">
                  {ACTION_PLACEMENT_LABELS[activeActionPlacement]}
                </h3>
                <p className="mt-2 text-xs text-slate-500">
                  {selectedPage
                    ? `Flow: Pages / ${selectedPage.name || "Default Page"} / Links`
                    : "Flow: Pages / Default Page / Links"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {activeActionPlacement === "footer"
                    ? "Build footer columns as grouped segments. Each segment can include multiple pages."
                    : "Add menu items here, then click any item to edit it in a large drawer."}
                </p>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={() => addAction(activeActionPlacement)}
                  disabled={!selectedPage || !isDefaultPageSelected}
                >
                  <PiPlus className="size-4" />
                  {activeActionPlacement === "footer" ? "Add segment" : "Add menu"}
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {activeActionPlacement === "footer" ? (
                footerGroupsForSelectedPage.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-950">No footer segments yet</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Add a segment, give it a title, then attach pages to build a footer column.
                    </p>
                  </div>
                ) : (
                  footerGroupsForSelectedPage.map((group) => {
                    const isSelected = normalizeFooterGroupKey(footerGroupDraft.group_key) === group.group_key;

                    return (
                      <button
                        key={group.group_key}
                        type="button"
                        ref={(node) => {
                          if (node) {
                            footerGroupCardRefs.current.set(group.group_key, node);
                          } else {
                            footerGroupCardRefs.current.delete(group.group_key);
                          }
                        }}
                        draggable
                        onDragStart={() => setDraggedFooterGroupKey(group.group_key)}
                        onDragEnd={() => setDraggedFooterGroupKey(null)}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          reorderFooterGroup(draggedFooterGroupKey, group.group_key);
                          setDraggedFooterGroupKey(null);
                        }}
                        onClick={() => {
                          const firstAction = group.actions[0] || null;
                          if (firstAction) {
                            setFooterEditorMode("edit");
                            setSelectedActionId(firstAction.id);
                            setActiveActionPlacement("footer");
                            setActionEditorOpen(true);
                          }
                        }}
                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                          isSelected
                            ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)]"
                            : draggedFooterGroupKey === group.group_key
                              ? "border-slate-300 bg-slate-100 text-slate-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition ${
                                  isSelected ? "bg-white/10 text-white" : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
                                }`}
                                title="Drag segment"
                              >
                                <PiDotsSixVertical className="size-4" />
                              </span>
                              <p className="truncate text-sm font-semibold leading-6">
                                {group.title || "Untitled Group"}
                              </p>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {group.actions.length} links
                              </span>
                            </div>
                            {group.note ? (
                              <p className={`mt-1 text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                                {group.note}
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {group.actions.map((action) => (
                                <span
                                  key={action.id}
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                                    isSelected
                                      ? "border-white/10 bg-white/10 text-white"
                                      : "border-slate-200 bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  {action.name || action.target_page_slug || "Page"}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                const firstAction = group.actions[0] || null;
                                if (firstAction) {
                                  setFooterEditorMode("edit");
                                  setSelectedActionId(firstAction.id);
                                  setActiveActionPlacement("footer");
                                  setActionEditorOpen(true);
                                }
                              }}
                              className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
                                isSelected
                                  ? "bg-white/10 text-white hover:bg-white/20"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                              title="Edit segment"
                            >
                              <PiNotePencil className="size-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeFooterGroup(group.group_key);
                              }}
                              className="inline-flex h-9 items-center gap-2 rounded-xl bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                              title="Delete segment"
                            >
                              <PiTrash className="size-4" />
                            </button>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )
              ) : activeActionGroupActions.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-950">No items yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Add the first menu item for this area.
                  </p>
                </div>
              ) : (
                activeActionGroupActions.map((action) => {
                  const isSelected = selectedAction?.id === action.id;

                  return (
                    <button
                      key={action.id}
                      type="button"
                      ref={(node) => {
                        if (node) {
                          actionCardRefs.current.set(action.id, node);
                        } else {
                          actionCardRefs.current.delete(action.id);
                        }
                      }}
                      draggable
                      onDragStart={() => setDraggedActionId(action.id)}
                      onDragEnd={() => setDraggedActionId(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        reorderActionGroup(draggedActionId, action.id);
                        setDraggedActionId(null);
                      }}
                      onClick={() => {
                        setSelectedActionId(action.id);
                        setActiveActionPlacement(normalizeActionPlacement(action.placement));
                        setActionEditorOpen(true);
                      }}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
                            isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                          title="Drag to reorder"
                        >
                          <PiDotsSixVertical className="size-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-6">
                            {action.name || "Untitled Link"}
                          </p>
                          <p className={`mt-1 truncate text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                            {action.slug || "slug"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedActionId(action.id);
                              setActionEditorOpen(true);
                            }}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                              isSelected
                                ? "bg-white/10 text-white hover:bg-white/20"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                            title="Edit"
                          >
                            <PiNotePencil className="size-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAction(action.id);
                            }}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                              isSelected
                                ? "bg-white/10 text-white hover:bg-white/20"
                                : "bg-white text-rose-500 ring-1 ring-slate-200 hover:bg-rose-50"
                            }`}
                            title="Delete"
                          >
                            <PiTrash className="size-4" />
                          </button>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>
      )}

      {actionEditorOpen && actionEditorAction ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu item editor"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            onClick={closeActionEditor}
          />

          <div className="absolute right-0 top-0 flex h-full w-full max-w-[760px] flex-col border-l border-slate-200 bg-white shadow-[0_24px_90px_-18px_rgba(15,23,42,0.5)] xl:max-w-[820px]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {normalizeActionPlacement(actionEditorAction.placement) === "footer" ? "Footer Segment" : "Menu Item"}
                </p>
                <h3 className="mt-2 truncate text-xl font-bold text-slate-950">
                  {normalizeActionPlacement(actionEditorAction.placement) === "footer"
                    ? footerGroupDraft.title || "Untitled Group"
                    : actionEditorAction.name || "Untitled Link"}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {normalizeActionPlacement(actionEditorAction.placement) === "footer"
                    ? "Group pages into a footer column and manage the links from one panel."
                    : "Edit the selected menu item in a large drawer without leaving the canvas."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeActionEditor}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                title="Close"
              >
                <PiArrowLeft className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                {normalizeActionPlacement(actionEditorAction.placement) === "footer" ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Group Title" hint="This becomes the footer column heading">
                        <input
                          className={inputClassName}
                          list="footer-group-suggestions"
                          placeholder="Information"
                          value={footerGroupDraft.title || ""}
                          onChange={(e) =>
                            setFooterGroupDraft((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                        />
                      </Field>

                      <Field label="Group Note" hint="Optional helper text for this group">
                        <input
                          className={inputClassName}
                          placeholder="Top navigation and utility links"
                          value={footerGroupDraft.note || ""}
                          onChange={(e) =>
                            setFooterGroupDraft((prev) => ({
                              ...prev,
                              note: e.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <datalist id="footer-group-suggestions">
                      {["Information", "Categories", "Support"].map((group) => (
                        <option key={group} value={group} />
                      ))}
                    </datalist>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">Pages in this segment</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Pick the storefront pages that should appear under this footer column.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                          {footerGroupDraft.target_page_ids.length} selected
                        </span>
                      </div>

                      <div className="mt-4 grid max-h-[340px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                        {pages.map((page) => {
                          const pageId = String(page.id);
                          const isChecked = footerGroupDraft.target_page_ids.includes(pageId);

                          return (
                            <label
                              key={page.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                                isChecked
                                  ? "border-slate-950 bg-slate-950 text-white shadow-[0_16px_32px_-24px_rgba(15,23,42,0.55)]"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                                checked={isChecked}
                                onChange={(event) => {
                                  const nextIds = event.target.checked
                                    ? [...footerGroupDraft.target_page_ids, pageId]
                                    : footerGroupDraft.target_page_ids.filter((id) => id !== pageId);

                                  setFooterGroupDraft((prev) => ({
                                    ...prev,
                                    target_page_ids: Array.from(new Set(nextIds)),
                                  }));
                                }}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">{page.name}</span>
                                <span className={`block text-xs ${isChecked ? "text-slate-300" : "text-slate-500"}`}>
                                  {page.slug ? `/${page.slug}` : "/"}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Link Type">
                        <select
                          className={inputClassName}
                          value={actionEditorAction.link_type || "custom_path"}
                          onChange={(e) => updateActionField(actionEditorAction.id, "link_type", e.target.value)}
                        >
                          {STOREFRONT_LINK_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Name">
                        <input
                          className={inputClassName}
                          value={actionEditorAction.name || ""}
                          onChange={(e) => updateActionField(actionEditorAction.id, "name", e.target.value)}
                        />
                      </Field>

                      <Field label="Slug" hint="Valid slug only">
                        <input
                          className={inputClassName}
                          value={actionEditorAction.slug || ""}
                          onChange={(e) => updateActionField(actionEditorAction.id, "slug", e.target.value)}
                        />
                      </Field>
                    </div>

                    {actionEditorAction.link_type === "internal_route" && (
                      <Field label="Internal Route">
                        <select
                          className={inputClassName}
                          value={actionEditorAction.route_key || "/"}
                          onChange={(e) => updateActionField(actionEditorAction.id, "route_key", e.target.value)}
                        >
                          {STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    {actionEditorAction.link_type === "storefront_page" && (
                      <Field label="Target Page">
                        <select
                          className={inputClassName}
                          value={actionEditorAction.target_page_id || ""}
                          onChange={(e) => updateActionField(actionEditorAction.id, "target_page_id", e.target.value)}
                        >
                          <option value="">Select a page</option>
                          {pages.map((page) => (
                            <option key={page.id} value={page.id}>
                              {page.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    {(actionEditorAction.link_type === "custom_path" || actionEditorAction.link_type === "external_url") && (
                      <Field label={actionEditorAction.link_type === "external_url" ? "External URL" : "Custom Path"}>
                        <input
                          className={inputClassName}
                          value={actionEditorAction.expression || ""}
                          onChange={(e) => updateActionField(actionEditorAction.id, "expression", e.target.value)}
                          placeholder={actionEditorAction.link_type === "external_url" ? "https://example.com" : "/about-us"}
                        />
                      </Field>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Token Preview</p>
                      <p className="mt-2 font-mono text-sm text-slate-900">#{actionEditorAction.slug || "slug"}#</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                {normalizeActionPlacement(actionEditorAction.placement) === "footer" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    onClick={() => {
                      if (footerEditorMode === "new") {
                        setFooterEditorMode("edit");
                        setFooterGroupDraft({
                          group_key: "",
                          title: "",
                          note: "",
                          target_page_ids: [],
                        });
                        setActionEditorOpen(false);
                        return;
                      }

                      const footerGroupKey = normalizeFooterGroupKey(footerGroupDraft.group_key || footerGroupDraft.title);
                      updateBuilderList("actions", (items) =>
                        items.filter((action) => {
                          const samePage = action.page_id === selectedPage?.id;
                          const isFooterPlacement = normalizeActionPlacement(action.placement) === "footer";
                          const actionGroupKey = normalizeFooterGroupKey(action.footer_group);
                          if (!samePage || !isFooterPlacement || actionGroupKey !== footerGroupKey) {
                            return true;
                          }
                          return false;
                        })
                      );
                      setActionEditorOpen(false);
                    }}
                  >
                    <PiTrash className="size-4" />
                    Delete segment
                  </button>
                ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      onClick={() => {
                      removeAction(actionEditorAction.id);
                      setActionEditorOpen(false);
                    }}
                  >
                    <PiTrash className="size-4" />
                    Delete item
                  </button>
                )}

                {normalizeActionPlacement(actionEditorAction.placement) === "footer" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                    onClick={() => {
                      syncFooterGroupActions({
                        previousGroupKey: footerGroupDraft.group_key || actionEditorAction.footer_group || footerGroupDraft.title,
                        nextGroupTitle: footerGroupDraft.title || actionEditorAction.footer_group || "Footer Group",
                        nextGroupNote: footerGroupDraft.note || "",
                        nextPageIds: footerGroupDraft.target_page_ids,
                      });
                      setFooterEditorMode("edit");
                      setActionEditorOpen(false);
                    }}
                  >
                    Apply changes
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                    onClick={() => setActionEditorOpen(false)}
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
