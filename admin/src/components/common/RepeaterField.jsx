import { lazy, Suspense } from "react";
import { Trash2 } from "lucide-react";

const IconPickerField = lazy(() => import("./IconPickerField"));

const inputClassName = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const lazyFieldFallback = <div className="h-10 rounded-lg border border-slate-200 bg-white" />;

const childFields = (field) => {
  const source = field?.item_fields || field?.fields || {};
  if (Array.isArray(source)) return source.filter((item) => item?.key);
  return Object.entries(source).map(([key, definition]) => ({ key, ...(definition || {}) }));
};

const defaultValue = (field) => {
  if (field?.default !== undefined) return field.default;
  if (["number"].includes(field?.type || field?.input_type)) return 0;
  if (["boolean"].includes(field?.type || field?.input_type)) return false;
  if (["filters", "image", "file"].includes(field?.type || field?.input_type)) return {};
  if (["slider", "multiple_image", "repeater"].includes(field?.type || field?.input_type)) return [];
  return "";
};

const emptyItem = (field) => Object.fromEntries(childFields(field).map((child) => [child.key, defaultValue(child)]));

export default function RepeaterField({ field, value, onChange, onFileChange, uploading = false }) {
  const items = Array.isArray(value) ? value : [];
  const fields = childFields(field);
  const setItem = (index, key, nextValue) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...(item || {}), [key]: nextValue } : item));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{field?.label || field?.key || "Items"}</p>
        <button type="button" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700" onClick={() => onChange([...items, emptyItem(field)])}>Add item</button>
      </div>
      {!items.length ? <p className="text-xs text-slate-500">No items added yet.</p> : null}
      {items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Item {index + 1}</p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-100"
              title={`Remove item ${index + 1}`}
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          {fields.map((child) => {
            const type = String(child.type || child.input_type || "text");
            const childValue = item?.[child.key] ?? defaultValue(child);
            if (type === "iconpicker") return <Suspense key={child.key} fallback={lazyFieldFallback}><IconPickerField field={child} value={childValue} onChange={(nextValue) => setItem(index, child.key, nextValue)} /></Suspense>;
            if (type === "boolean") return <label key={child.key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"><span className="text-sm font-medium text-slate-800">{child.label || child.key}</span><input type="checkbox" checked={Boolean(childValue)} onChange={(event) => setItem(index, child.key, event.target.checked)} /></label>;
            if (type === "image" || type === "file") {
              const image = childValue && typeof childValue === "object" && !Array.isArray(childValue)
                ? childValue
                : (typeof childValue === "string" && childValue ? { url: childValue, alt: "" } : {});
              return (
                <div key={child.key}>
                  <p className="mb-1 block text-xs font-semibold text-slate-600">{child.label || child.key}</p>
                  <div className="space-y-2">
                    <input
                      key={`${child.key}-${image.url || "empty"}`}
                      type="file"
                      accept={child.accept || "image/*"}
                      disabled={uploading}
                      className="file-input file-input-bordered w-full"
                      onChange={(event) => onFileChange?.(event.target.files, { index, field: child })}
                    />
                    {image.url ? (
                      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <img src={image.url} alt={image.alt || child.label || child.key} className="max-h-48 w-full object-contain" loading="lazy" />
                        <button type="button" className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 hover:bg-rose-50" onClick={() => setItem(index, child.key, {})}>Remove</button>
                      </div>
                    ) : null}
                    <input className={inputClassName} value={image.alt || ""} placeholder="Image alt text" onChange={(event) => setItem(index, child.key, { ...image, alt: event.target.value })} />
                    {uploading ? <p className="text-xs text-indigo-600">Uploading...</p> : null}
                  </div>
                </div>
              );
            }
            if (type === "select") return <label key={child.key} className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{child.label || child.key}</span><select className={inputClassName} value={childValue ?? ""} onChange={(event) => setItem(index, child.key, event.target.value)}>{(child.options || []).map((option) => { const optionValue = typeof option === "object" ? option.value : option; const optionLabel = typeof option === "object" ? option.label : option; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></label>;
            if (type === "number") return <label key={child.key} className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{child.label || child.key}</span><input className={inputClassName} type="number" min={child.min} max={child.max} value={childValue ?? ""} onChange={(event) => setItem(index, child.key, event.target.value === "" ? "" : Number(event.target.value))} /></label>;
            if (type === "textarea" || type === "rich_text") return <label key={child.key} className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{child.label || child.key}</span><textarea className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={childValue ?? ""} onChange={(event) => setItem(index, child.key, event.target.value)} /></label>;
            return <label key={child.key} className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{child.label || child.key}</span><input className={inputClassName} placeholder={child.placeholder || ""} value={childValue ?? ""} onChange={(event) => setItem(index, child.key, event.target.value)} /></label>;
          })}
        </div>
      ))}
    </div>
  );
}
