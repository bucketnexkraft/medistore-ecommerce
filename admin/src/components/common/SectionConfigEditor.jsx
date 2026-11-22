import { lazy, Suspense } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { PiCheck } from "react-icons/pi";

const IconPickerField = lazy(() => import("./IconPickerField"));
const RepeaterField = lazy(() => import("./RepeaterField"));
const UrlField = lazy(() => import("./UrlField"));

const inputClassName = "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const textareaClassName = "min-h-[132px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const lazyFieldFallback = <div className="h-10 rounded-lg border border-slate-200 bg-white" />;

export const defaultDemandTagOptions = [
  { value: "best_seller", label: "Best Seller" },
  { value: "trending", label: "Trending" },
  { value: "popular", label: "Popular" },
  { value: "top_rated", label: "Top Rated" },
  { value: "most_viewed", label: "Most Viewed" },
  { value: "most_sold", label: "Most Sold" },
  { value: "seasonal", label: "Seasonal" },
  { value: "clearance", label: "Clearance" },
  { value: "imported", label: "Imported" },
  { value: "high_risk", label: "High Risk" },
];

export const customSectionSchema = {
  key: "custom",
  version: 1,
  fields: [
    {
      key: "title",
      label: "Title",
      type: "text",
      group: "content",
      placeholder: "Custom section title",
    },
    {
      key: "subtitle",
      label: "Subtitle",
      type: "text",
      group: "content",
      placeholder: "Custom section subtitle",
    },
    {
      key: "html",
      label: "Content",
      type: "rich_text",
      group: "content",
      placeholder: "Add custom section content",
    },
  ],
};

const richTextModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
};

export const sectionSchemaDefaults = (schema) => {
  const config = { schema_version: Number(schema?.version || 1), content: {}, data: {}, style: {} };
  (Array.isArray(schema?.fields) ? schema.fields : []).forEach((field) => {
    if (!field?.key) return;
    const group = String(field.group || "content");
    const fallback = field.default !== undefined ? field.default : field.type === "number" ? 8 : field.type === "boolean" ? false : field.type === "filters" || field.type === "image" || field.type === "file" ? {} : field.type === "slider" || field.type === "multiple_image" || field.type === "repeater" ? [] : "";
    config[group] = { ...(config[group] || {}), [field.key]: fallback };
  });
  return config;
};

export const mergeSectionSchemaConfig = (schema, value) => {
  const defaults = sectionSchemaDefaults(schema);
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return { ...defaults, ...source, content: { ...defaults.content, ...(source.content || {}) }, data: { ...defaults.data, ...(source.data || {}) }, style: { ...defaults.style, ...(source.style || {}) } };
};

function DemandTagFiltersField({ filters, onChange, demandTags = [], loading = false }) {
  const selectedTags = (Array.isArray(filters.demand_tag) ? filters.demand_tag : [filters.demand_tag])
    .flatMap((tag) => String(tag || "").split(","))
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const options = [...defaultDemandTagOptions, ...(Array.isArray(demandTags) ? demandTags : [])].reduce((result, tag) => {
    const value = String(tag?.value || tag?.label || tag?.name || "").trim().toLowerCase();
    if (!value || result.some((option) => option.value === value)) return result;
    result.push({ value, label: tag?.label || tag?.name || value.replaceAll("_", " ") });
    return result;
  }, []);

  const toggleTag = (tagValue, checked) => {
    const nextTags = new Set(selectedTags);
    if (checked) nextTags.add(tagValue);
    else nextTags.delete(tagValue);

    const nextFilters = { ...filters };
    if (nextTags.size > 0) nextFilters.demand_tag = Array.from(nextTags);
    else delete nextFilters.demand_tag;
    onChange(nextFilters);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-2">
      <span className="pt-2 text-xs font-semibold text-slate-600">demand_tag</span>
      <div className="flex flex-wrap gap-2">
        {loading ? <span className="text-sm text-slate-500">Loading demand tags...</span> : null}
        {!loading && options.map((tag) => {
          const checked = selectedTags.includes(tag.value);
          return (
            <label
              key={tag.value}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                checked
                  ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(event) => toggleTag(tag.value, event.target.checked)}
              />
              {checked ? <PiCheck className="size-3.5" aria-hidden="true" /> : null}
              {tag.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function SectionConfigEditor({ schema, value, onChange, onFileChange, uploading = false, pages = [], contextKey = "section", demandTags = [], demandTagsLoading = false }) {
  if (!schema?.fields?.length) return null;
  const config = mergeSectionSchemaConfig(schema, value);
  const setField = (field, nextValue) => {
    const group = String(field.group || "content");
    onChange({ ...config, [group]: { ...(config[group] || {}), [field.key]: nextValue } });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
      {schema.fields.map((field) => {
        const fieldValue = config?.[field.group || "content"]?.[field.key];
        const type = String(field.type || "text");
        const label = field.label || field.key;
        if (type === "boolean") return <label key={field.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm font-semibold text-slate-900">{label}</span><input type="checkbox" checked={Boolean(fieldValue)} onChange={(event) => setField(field, event.target.checked)} /></label>;
        if (type === "image" || type === "file") {
          const image = fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue) ? fieldValue : {};
          return <div key={field.key}><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><div className="space-y-2"><input key={`${field.key}-${image.url || "empty"}`} type="file" accept={field.accept || "image/*"} disabled={uploading} className="file-input file-input-bordered w-full" onChange={(event) => onFileChange?.(field, event.target.files)} />{image.url ? <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={image.url} alt={image.alt || label} className="max-h-56 w-full object-contain" loading="lazy" /><button type="button" className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 hover:bg-rose-50" onClick={() => setField(field, {})}>Remove</button></div> : null}<input className={inputClassName} value={image.alt || ""} placeholder="Alt text" onChange={(event) => setField(field, { ...image, alt: event.target.value })} /></div></div>;
        }
        if (type === "slider" || type === "multiple_image") {
          const images = Array.isArray(fieldValue) ? fieldValue : [];
          return <div key={field.key}><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><input key={`${field.key}-${images.length}`} type="file" multiple accept={field.accept || "image/*"} disabled={uploading} className="file-input file-input-bordered w-full" onChange={(event) => onFileChange?.(field, event.target.files)} />{images.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{images.map((item, index) => { const url = typeof item === "object" ? item?.url : item; return url ? <div key={`${url}-${index}`} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={url} alt={typeof item === "object" ? item?.alt || `${label} ${index + 1}` : `${label} ${index + 1}`} className="h-24 w-full object-cover" loading="lazy" /><button type="button" className="absolute right-1 top-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 hover:bg-rose-50" onClick={() => setField(field, images.filter((_, imageIndex) => imageIndex !== index))}>Remove</button></div> : null; })}</div> : null}</div>;
        }
        if (type === "iconpicker") return <Suspense key={field.key} fallback={lazyFieldFallback}><IconPickerField field={field} value={fieldValue ?? ""} onChange={(nextValue) => setField(field, nextValue)} /></Suspense>;
        if (type === "repeater") return <Suspense key={field.key} fallback={lazyFieldFallback}><RepeaterField field={field} value={fieldValue ?? []} onChange={(nextValue) => setField(field, nextValue)} onFileChange={(files, context) => onFileChange?.(field, files, context)} uploading={uploading} /></Suspense>;
        if (type === "url") return <Suspense key={`${contextKey}.${schema?.key || "schema"}.${field.key}`} fallback={lazyFieldFallback}><UrlField field={field} value={fieldValue ?? ""} onChange={(nextValue) => setField(field, nextValue)} pages={pages} /></Suspense>;
        if (type === "rich_text") return <div key={field.key}><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><ReactQuill theme="snow" value={fieldValue ?? ""} modules={richTextModules} placeholder={field.placeholder || "Write something..."} onChange={(nextValue) => setField(field, nextValue)} className="rounded-xl bg-white" /></div>;
        if (type === "filters") {
          const filters = fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue) ? fieldValue : {};
          return <div key={field.key}><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">{(field.allowed || []).map((key) => key === "demand_tag" ? <DemandTagFiltersField key={key} filters={filters} onChange={(next) => setField(field, next)} demandTags={demandTags} loading={demandTagsLoading} /> : <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2"><span className="text-xs font-semibold text-slate-600">{key}</span><input className={inputClassName} value={filters[key] ?? ""} placeholder="Optional" onChange={(event) => { const next = { ...filters }; if (event.target.value === "") delete next[key]; else next[key] = event.target.value; setField(field, next); }} /></div>)}</div></div>;
        }
        if (type === "select") return <label key={field.key} className="block"><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><select className={inputClassName} value={fieldValue ?? field.default ?? ""} onChange={(event) => setField(field, event.target.value)}>{(field.options || []).map((option) => { const optionValue = typeof option === "object" ? option.value : option; const optionLabel = typeof option === "object" ? option.label : option; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></label>;
        if (type === "color") {
          const textValue = String(fieldValue ?? field.default ?? "");
          const pickerValue = /^#[0-9a-f]{6}$/i.test(textValue) ? textValue : "#7F00FF";
          return <label key={field.key} className="block"><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><div className="flex items-center gap-2"><input type="color" aria-label={`${label} picker`} className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" value={pickerValue} onChange={(event) => setField(field, event.target.value)} /><input className={inputClassName} value={textValue} placeholder={field.placeholder || "#7F00FF"} onChange={(event) => setField(field, event.target.value)} /></div></label>;
        }
        if (type === "number") return <label key={field.key} className="block"><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><input className={inputClassName} type="number" min={field.min} max={field.max} value={fieldValue ?? field.default ?? ""} onChange={(event) => setField(field, event.target.value === "" ? "" : Number(event.target.value))} /></label>;
        if (type === "textarea") return <label key={field.key} className="block"><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><textarea className={textareaClassName} value={fieldValue ?? ""} placeholder={field.placeholder || ""} onChange={(event) => setField(field, event.target.value)} /></label>;
        return <label key={field.key} className="block"><p className="mb-2 text-sm font-semibold text-slate-900">{label}</p><input className={inputClassName} value={fieldValue ?? ""} placeholder={field.placeholder || ""} onChange={(event) => setField(field, event.target.value)} /></label>;
      })}
    </section>
  );
}
