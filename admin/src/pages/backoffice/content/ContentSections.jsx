import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getSectionLibrary } from "../../../api/backoffice/contentManager";

const REGISTERED_SECTION_NAMES = [
  "hero",
  "feature",
  "ecommerce_setup",
  "working_step",
  "testimonial",
  "faq",
  "footer",
  "history",
  "mission_vission",
  "core_principles",
  "team",
  "pricing",
  "blog",
  "contact",
];

export default function ContentSections() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSectionLibrary(accessToken);
      if (!result?.status) throw new Error(result?.message || "Failed to load sections");
      const registeredNames = new Set(REGISTERED_SECTION_NAMES);
      const registeredSections = (result?.data || []).filter((section) =>
        registeredNames.has(section?.name)
      );
      setSections(registeredSections);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load sections");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSections = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sections;

    return sections.filter((section) => {
      const title = String(section?.title || "").toLowerCase();
      const name = String(section?.name || "").toLowerCase();
      return title.includes(term) || name.includes(term);
    });
  }, [search, sections]);

  const sectionStats = useMemo(() => {
    const total = sections.length;
    const repeaterEnabled = sections.filter(
      (section) => Array.isArray(section.repeated_fields) && section.repeated_fields.length > 0
    ).length;
    const totalFields = sections.reduce((count, section) => {
      return count + (Array.isArray(section.fields) ? section.fields.length : 0);
    }, 0);

    return { total, repeaterEnabled, totalFields };
  }, [sections]);

  return (
    <div className="p-4 md:p-6 space-y-5 bg-slate-50 min-h-screen">
      <div className="rounded-2xl p-5 md:p-7 bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Section Library</h2>
            <p className="text-sm md:text-base text-slate-200 mt-2 max-w-2xl">
              Predefined components from kit. Pick a section and manage its content in one click.
            </p>
          </div>
          <div className="w-full md:w-80">
            <input
              type="text"
              className="input input-bordered w-full bg-white/95 text-slate-700 border-white/70 focus:border-white"
              placeholder="Search sections by title or slug..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-200">Total Sections</p>
            <p className="text-2xl font-semibold mt-1">{sectionStats.total}</p>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-200">Total Fields</p>
            <p className="text-2xl font-semibold mt-1">{sectionStats.totalFields}</p>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-200">Repeater Enabled</p>
            <p className="text-2xl font-semibold mt-1">{sectionStats.repeaterEnabled}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
        {loading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
              <p className="font-medium">Loading sections...</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
              <div className="h-44 bg-slate-100 rounded-2xl" />
              <div className="h-44 bg-slate-100 rounded-2xl" />
              <div className="h-44 bg-slate-100 rounded-2xl" />
            </div>
          </div>
        ) : (
          <div>
            {filteredSections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center text-slate-600">
                No sections found for your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSections.map((section) => {
                  const fieldsCount = Array.isArray(section.fields) ? section.fields.length : 0;
                  const hasRepeater = Array.isArray(section.repeated_fields) && section.repeated_fields.length > 0;

                  return (
                    <div
                      key={section.name}
                      className="rounded-2xl border border-slate-200 p-5 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-800">{section.title}</h3>
                          <p className="text-sm text-slate-500 mt-1">slug: {section.name}</p>
                        </div>
                        <span className={`badge ${hasRepeater ? "badge-info text-white" : "badge-ghost text-slate-600"}`}>
                          {hasRepeater ? "Repeater" : "Static"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-slate-100 p-3">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Fields</p>
                          <p className="text-xl font-semibold text-slate-800 mt-1">{fieldsCount}</p>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-3">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Type</p>
                          <p className="text-sm font-semibold text-slate-800 mt-1">{hasRepeater ? "Multi-item" : "Single-item"}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-end">
                        <button
                          className="btn btn-sm bg-slate-900 hover:bg-slate-800 text-white border-none"
                          onClick={() => navigate(`/backoffice/content/sections/${section.name}`)}
                        >
                          Manage Content
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
