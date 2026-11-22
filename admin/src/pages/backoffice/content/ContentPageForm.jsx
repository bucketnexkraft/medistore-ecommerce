import { useCallback, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import CreatableSelect from "react-select/creatable";
import {
  createContentPage,
  getContentPageById,
  getSectionLibrary,
  updateContentPage,
} from "../../../api/backoffice/contentManager";

export default function ContentPageForm() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const { pageId } = useParams();
  const isEdit = Boolean(pageId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectionLibrary, setSectionLibrary] = useState([]);
  const [builderSections, setBuilderSections] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [sectionSearch, setSectionSearch] = useState("");
  const [editorMode, setEditorMode] = useState("edit");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    status: true,
    has_builder: true,
    has_breadcrumb: false,
    breadcrumb_title: "",
    breadcrumb_description: "",
    content: "",
    seo_title: "",
    seo_description: "",
    seo_tags: [],
  });

  const sectionMap = useMemo(() => {
    const map = {};
    sectionLibrary.forEach((item) => {
      map[item.name] = item;
    });
    return map;
  }, [sectionLibrary]);

  const draggableSections = useMemo(() => {
    const term = sectionSearch.trim().toLowerCase();
    return sectionLibrary
      .filter((section) => !section?.is_fixed)
      .filter((section) => {
        if (!term) return true;
        return (
          String(section?.title || "").toLowerCase().includes(term) ||
          String(section?.name || "").toLowerCase().includes(term)
        );
      });
  }, [sectionLibrary, sectionSearch]);

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        [{ font: [] }, { size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ indent: "-1" }, { indent: "+1" }],
        ["blockquote", "code-block"],
        ["link", "image", "video"],
        ["clean"],
      ],
    }),
    []
  );

  const quillFormats = useMemo(
    () => [
      "header",
      "font",
      "size",
      "bold",
      "italic",
      "underline",
      "strike",
      "color",
      "background",
      "align",
      "list",
      "bullet",
      "indent",
      "blockquote",
      "code-block",
      "link",
      "image",
      "video",
    ],
    []
  );

  const seoTagStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 54,
        borderRadius: 12,
        borderColor: state.isFocused ? "#8b5cf6" : "#d1d5db",
        boxShadow: "none",
        backgroundColor: "#fff",
        "&:hover": {
          borderColor: state.isFocused ? "#8b5cf6" : "#9ca3af",
        },
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "6px 10px",
        gap: "6px",
      }),
      placeholder: (base) => ({
        ...base,
        color: "#94a3b8",
      }),
      input: (base) => ({
        ...base,
        color: "#111827",
      }),
      multiValue: (base) => ({
        ...base,
        backgroundColor: "#eef2ff",
        borderRadius: 8,
        border: "1px solid #c7d2fe",
      }),
      multiValueLabel: (base) => ({
        ...base,
        color: "#3730a3",
        fontWeight: 500,
      }),
      multiValueRemove: (base) => ({
        ...base,
        color: "#4f46e5",
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
        ":hover": {
          backgroundColor: "#e0e7ff",
          color: "#312e81",
        },
      }),
      indicatorSeparator: () => ({
        display: "none",
      }),
      dropdownIndicator: (base) => ({
        ...base,
        color: "#9ca3af",
        ":hover": { color: "#6b7280" },
      }),
      clearIndicator: (base) => ({
        ...base,
        color: "#9ca3af",
        ":hover": { color: "#6b7280" },
      }),
      menu: (base) => ({
        ...base,
        zIndex: 20,
        borderRadius: 12,
        overflow: "hidden",
      }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? "#4f46e5" : state.isFocused ? "#eef2ff" : "#fff",
        color: state.isSelected ? "#fff" : "#111827",
      }),
    }),
    []
  );

  const descriptionText = useMemo(() => {
    return String(form.content || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, [form.content]);
  const sanitizedPreviewHtml = useMemo(
    () => DOMPurify.sanitize(form.content || "<p class='text-slate-400'>Nothing to preview yet.</p>"),
    [form.content]
  );

  const toggleRowClass = "flex h-12 items-center justify-between border rounded-lg px-3";

  const wordCount = descriptionText ? descriptionText.split(" ").length : 0;
  const charCount = descriptionText.length;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const lib = await getSectionLibrary(accessToken);
      setSectionLibrary(lib?.data || []);

      if (isEdit) {
        const page = await getContentPageById(accessToken, pageId);
        if (!page?.status) throw new Error(page?.message || "Failed to load page");
        const data = page.data;
        setForm({
          name: data?.name || "",
          slug: data?.slug || "",
          status: Boolean(data?.status),
          has_builder: Boolean(data?.has_builder),
          has_breadcrumb: Boolean(data?.has_breadcrumb),
          breadcrumb_title: data?.breadcrumb_title || "",
          breadcrumb_description: data?.breadcrumb_description || "",
          content: data?.content || "",
          seo_title: data?.seo_title || "",
          seo_description: data?.seo_description || "",
          seo_tags: Array.isArray(data?.seo_tags) ? data.seo_tags : [],
        });
        const names = Array.isArray(data?.sections) ? data.sections.map((s) => s.name) : [];
        setBuilderSections(names);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [accessToken, isEdit, pageId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addSectionToBuilder = (sectionName, targetIndex = null) => {
    if (!sectionName || !sectionMap[sectionName]) return;
    setBuilderSections((prev) => {
      if (prev.includes(sectionName)) return prev;
      if (targetIndex === null || targetIndex < 0 || targetIndex > prev.length) {
        return [...prev, sectionName];
      }
      const next = [...prev];
      next.splice(targetIndex, 0, sectionName);
      return next;
    });
  };

  const onDropCanvas = (event, targetIndex = null) => {
    event.preventDefault();
    const droppedName = event.dataTransfer.getData("sectionName");

    if (droppedName) {
      addSectionToBuilder(droppedName, targetIndex);
      setDragIndex(null);
      return;
    }

    if (dragIndex === null) return;

    setBuilderSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      const safeTarget = targetIndex === null ? next.length : targetIndex;
      next.splice(safeTarget, 0, moved);
      return next;
    });
    setDragIndex(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalizedContent = form.has_builder
        ? JSON.stringify({ builder_sections: builderSections })
        : (form.content || "");

      const payload = {
        ...form,
        content: normalizedContent,
        seo_tags: Array.isArray(form.seo_tags) ? form.seo_tags.filter(Boolean) : [],
      };

      const formData = new FormData();
      formData.append("name", payload.name || "");
      formData.append("slug", payload.slug || "");
      formData.append("status", payload.status ? "1" : "0");
      formData.append("has_builder", payload.has_builder ? "1" : "0");
      formData.append("has_breadcrumb", payload.has_breadcrumb ? "1" : "0");
      formData.append("breadcrumb_title", payload.breadcrumb_title || "");
      formData.append("breadcrumb_description", payload.breadcrumb_description || "");
      formData.append("content", payload.content || "");
      formData.append("seo_title", payload.seo_title || "");
      formData.append("seo_description", payload.seo_description || "");
      payload.seo_tags.forEach((tag) => formData.append("seo_tags[]", tag));

      let response;
      if (isEdit) {
        response = await updateContentPage(accessToken, pageId, formData);
      } else {
        response = await createContentPage(accessToken, formData);
      }

      if (!response?.status) throw new Error(response?.message || "Failed to save page");

      toast.success("Page saved successfully");
      navigate("/backoffice/content/pages");
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{isEdit ? "Edit Page" : "Create Page"}</h2>
          <p className="text-sm text-gray-600 mt-1">If has builder is enabled, drag and reorder sections.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate("/backoffice/content/pages")}>Back</button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 text-slate-600">
            <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            <p className="font-medium">Preparing page editor...</p>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-lg" />
            <div className="h-10 bg-slate-100 rounded-lg" />
            <div className="h-10 bg-slate-100 rounded-lg" />
            <div className="h-10 bg-slate-100 rounded-lg" />
            <div className="h-24 bg-slate-100 rounded-lg md:col-span-2" />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Page Name</span></label>
              <input className="input input-bordered w-full" placeholder="Enter page name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Has Breadcrumb</span></label>
              <label className={toggleRowClass}>
                <span className="text-sm text-slate-600">Show breadcrumb on this page</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={Boolean(form.has_breadcrumb)}
                  onChange={(e) => setForm((p) => ({ ...p, has_breadcrumb: e.target.checked }))}
                />
              </label>
            </div>
            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Status</span></label>
              <label className={toggleRowClass}><span className="text-sm text-slate-600">Set page active/inactive</span><input type="checkbox" className="toggle toggle-primary" checked={Boolean(form.status)} onChange={(e) => setForm((p) => ({ ...p, status: e.target.checked }))} /></label>
            </div>
            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Has Builder</span></label>
              <label className={toggleRowClass}><span className="text-sm text-slate-600">Enable section-based page builder</span><input type="checkbox" className="toggle toggle-primary" checked={Boolean(form.has_builder)} onChange={(e) => setForm((p) => ({ ...p, has_builder: e.target.checked }))} /></label>
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="label py-1"><span className="label-text font-medium">SEO Title</span></label>
              <input className="input input-bordered w-full" placeholder="Enter SEO title" value={form.seo_title} onChange={(e) => setForm((p) => ({ ...p, seo_title: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="label py-1">
                <span className="label-text font-medium">SEO Tags</span>
              </label>
              <CreatableSelect
                isMulti
                placeholder="Type and press Enter..."
                value={(form.seo_tags || []).map((tag) => ({ label: tag, value: tag }))}
                onChange={(values) =>
                  setForm((p) => ({
                    ...p,
                    seo_tags: (values || []).map((item) => item.value).filter(Boolean),
                  }))
                }
                classNamePrefix="react-select"
                styles={seoTagStyles}
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="label py-1"><span className="label-text font-medium">SEO Description</span></label>
              <textarea className="textarea textarea-bordered w-full" rows={3} placeholder="Enter SEO description" value={form.seo_description} onChange={(e) => setForm((p) => ({ ...p, seo_description: e.target.value }))} />
            </div>

            {form.has_breadcrumb && (
              <>
                <div className="md:col-span-2 space-y-1">
                  <label className="label py-1"><span className="label-text font-medium">Breadcrumb Title</span></label>
                  <input
                    className="input input-bordered w-full"
                    placeholder="Enter breadcrumb title"
                    value={form.breadcrumb_title}
                    onChange={(e) => setForm((p) => ({ ...p, breadcrumb_title: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500 mt-1">If empty, Page Name will be shown.</p>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="label py-1"><span className="label-text font-medium">Breadcrumb Description</span></label>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={2}
                    placeholder="Enter breadcrumb description"
                    value={form.breadcrumb_description}
                    onChange={(e) => setForm((p) => ({ ...p, breadcrumb_description: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          {!form.has_builder && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">Page Description</p>
                  <p className="text-xs text-slate-500">Advanced content editor for static pages.</p>
                </div>
                <div className="tabs tabs-boxed w-fit">
                  <button
                    type="button"
                    className={`tab ${editorMode === "edit" ? "tab-active" : ""}`}
                    onClick={() => setEditorMode("edit")}
                  >
                    Editor
                  </button>
                  <button
                    type="button"
                    className={`tab ${editorMode === "preview" ? "tab-active" : ""}`}
                    onClick={() => setEditorMode("preview")}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {editorMode === "edit" ? (
                <ReactQuill
                  theme="snow"
                  value={form.content || ""}
                  onChange={(value) => setForm((p) => ({ ...p, content: value }))}
                  modules={quillModules}
                  formats={quillFormats}
                  className="bg-white rounded-xl [&_.ql-container]:min-h-[260px]"
                />
              ) : (
                <div
                  className="bg-white rounded-xl border border-slate-200 p-4 min-h-[260px] prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }}
                />
              )}

              <div className="flex items-center justify-end gap-3 text-xs text-slate-500">
                <span>{wordCount} words</span>
                <span>{charCount} chars</span>
              </div>
            </div>
          )}

          {form.has_builder && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-3 md:p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-slate-800">Section Library</h4>
                    <p className="text-xs text-slate-500 mt-1">Drag sections to canvas. Fixed sections are excluded.</p>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="Search sections..."
                    value={sectionSearch}
                    onChange={(e) => setSectionSearch(e.target.value)}
                  />
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {draggableSections.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        No section found.
                      </div>
                    ) : (
                      draggableSections.map((section) => {
                        const isAdded = builderSections.includes(section.name);
                        return (
                          <div
                            key={section.name}
                            draggable={!isAdded}
                            onDragStart={(e) => e.dataTransfer.setData("sectionName", section.name)}
                            className={`rounded-xl border p-3 transition-all ${
                              isAdded
                                ? "border-slate-200 bg-slate-100 opacity-60"
                                : "border-slate-200 bg-white cursor-grab hover:border-indigo-300 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm text-slate-800">{section.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{section.name}</p>
                              </div>
                              <button
                                type="button"
                                className="btn btn-xs btn-outline"
                                disabled={isAdded}
                                onClick={() => addSectionToBuilder(section.name)}
                              >
                                {isAdded ? "Added" : "Add"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 p-3 md:p-4">
                  <h4 className="font-semibold mb-2 text-slate-800">Builder Canvas</h4>
                  <p className="text-xs text-slate-500 mb-3">Drop and reorder sections to design page flow.</p>
                  <div
                    className="space-y-2 min-h-40 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropCanvas(e, null)}
                  >
                    {builderSections.length === 0 && (
                      <div className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center">
                        Drag sections from left library and drop here.
                      </div>
                    )}

                    {builderSections.map((name, index) => {
                      const section = sectionMap[name];
                      const isFixed = Boolean(section?.is_fixed);
                      return (
                        <div
                          key={`${name}-${index}`}
                          draggable
                          onDragStart={() => setDragIndex(index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDropCanvas(e, index)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-sm" title="Drag to reorder">::</span>
                            <div>
                              <div className="font-medium text-sm text-slate-800">{section?.title || name}</div>
                              <div className="text-xs text-slate-500">{name}</div>
                            </div>
                            {isFixed && (
                              <span className="badge badge-ghost text-slate-600">Fixed</span>
                            )}
                          </div>
                          <button
                            className="btn btn-xs btn-error btn-outline"
                            disabled={isFixed}
                            onClick={() => setBuilderSections((prev) => prev.filter((_, i) => i !== index))}
                          >
                            x
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </div>
      )}
    </div>
  );
}
