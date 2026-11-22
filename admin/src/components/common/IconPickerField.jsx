import { useEffect, useMemo, useRef, useState } from "react";
import { icons, X } from "lucide-react";

const ICON_ALIASES = {
  home: "House",
  "shopping-bag": "ShoppingBag",
  "magnifying-glass": "Search",
  "map-pin": "MapPin",
  "arrow-right": "ArrowRight",
};
const MAX_VISIBLE_ICONS = 96;

const iconKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveIcon = (value) => {
  const rawValue = String(value || "");
  const alias = ICON_ALIASES[rawValue.toLowerCase()] || rawValue;
  if (icons[alias]) return icons[alias];
  const normalized = iconKey(alias);
  const name = Object.keys(icons).find((candidate) => iconKey(candidate) === normalized);
  return name ? icons[name] : null;
};

export default function IconPickerField({ field, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const options = useMemo(() => {
    const source = Array.isArray(field?.options) && field.options.length ? field.options : Object.keys(icons);
    return source
      .map((option) => ({
        value: typeof option === "object" ? option.value : option,
        label: typeof option === "object" ? option.label || option.value : option,
      }))
      .filter((option) => option.value !== undefined && option.value !== null && String(option.value) !== "");
  }, [field?.options]);
  const filteredOptions = options
    .filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query.toLowerCase()));
  const visibleOptions = filteredOptions.slice(0, MAX_VISIBLE_ICONS);
  const selectedOption = options.find((option) => String(option.value) === String(value || ""));
  const SelectedIcon = resolveIcon(value);
  const ChevronIcon = resolveIcon("ChevronDown");

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={pickerRef} className="relative min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{field?.label || field?.key || "Icon"}</p>
        {value ? (
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-100"
            title="Clear selected icon"
            aria-label="Clear selected icon"
            onClick={() => onChange("")}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className={`flex min-h-10 w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${open ? "border-indigo-500 ring-4 ring-indigo-100" : "border-slate-200 hover:border-indigo-300"}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {SelectedIcon ? <SelectedIcon className="size-4 shrink-0 text-indigo-700" /> : <span className="size-4 shrink-0 rounded border border-slate-300" />}
        <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{selectedOption?.label || value || "Choose an icon"}</span>
        {ChevronIcon ? <ChevronIcon className={`size-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} /> : null}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <input
            autoFocus
            className="mb-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search icons"
          />
          <div className="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
            {visibleOptions.map((option) => {
              const Icon = resolveIcon(option.value);
              const selected = String(value || "") === String(option.value);
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  title={String(option.label)}
                  className={`flex h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-1 text-[9px] transition ${selected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50"}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {Icon ? <Icon className="size-4 shrink-0" /> : <span className="text-xs font-bold">{String(option.label).slice(0, 1).toUpperCase()}</span>}
                  <span className="w-full truncate leading-none">{option.label}</span>
                </button>
              );
            })}
            {!filteredOptions.length ? <p className="col-span-full px-2 py-4 text-center text-xs text-slate-500">No icons found.</p> : null}
            {filteredOptions.length > MAX_VISIBLE_ICONS ? <p className="col-span-full px-2 py-2 text-center text-xs text-slate-500">Showing {MAX_VISIBLE_ICONS} of {filteredOptions.length} matches.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
