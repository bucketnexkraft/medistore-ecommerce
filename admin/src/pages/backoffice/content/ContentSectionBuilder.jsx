import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { getContentPages, getSectionLibrary, updateSectionContentByName } from "../../../api/backoffice/contentManager";
import { API_URL } from "../../../config/constants";

const parseFieldKey = (name) => {
  const match = String(name || "").match(/\[([^\]]+)\]$/);
  return match ? match[1] : String(name || "");
};

const resolvePreviewUrl = (value) => {
  if (!value || typeof value !== "string") return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    if (value.startsWith("/uploads/")) {
      const backendBase = API_URL.replace(/\/api\/v\d+\/?$/, "");
      return `${backendBase}${value}`;
    }
    return value;
  }
  const backendBase = API_URL.replace(/\/api\/v\d+\/?$/, "");
  if (value.startsWith("uploads/")) {
    return `${backendBase}/${value}`;
  }
  if (value.startsWith("images/")) {
    return `${backendBase}/${value}`;
  }
  // Stored filename only (e.g. "abc.jpg") should resolve to CMS folder.
  if (!value.includes("/")) {
    return `${backendBase}/images/sections/${value}`;
  }
  return `${backendBase}/${value.replace(/^\/+/, "")}`;
};

const normalizeFooterGroups = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((group) => ({
    title: typeof group?.title === "string" ? group.title : "",
    links: Array.isArray(group?.links)
      ? group.links.map((link) => ({
          name: typeof link?.name === "string" ? link.name : "",
          slug: typeof link?.slug === "string" ? link.slug : "",
        }))
      : [],
  }));
};

export default function ContentSectionBuilder() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const { sectionName } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState(null);
  const [content, setContent] = useState({});
  const [elements, setElements] = useState([]);
  const [contentFiles, setContentFiles] = useState({});
  const [elementFiles, setElementFiles] = useState({});
  const [contentFilePreviews, setContentFilePreviews] = useState({});
  const [elementFilePreviews, setElementFilePreviews] = useState({});
  const [pages, setPages] = useState([]);
  const [activeTab, setActiveTab] = useState("content");
  const [footerInlineErrors, setFooterInlineErrors] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sectionResult, pageResult] = await Promise.all([
        getSectionLibrary(accessToken),
        getContentPages(accessToken),
      ]);
      if (!sectionResult?.status) throw new Error(sectionResult?.message || "Failed to load section library");
      const lib = sectionResult?.data || [];
      const current = lib.find((item) => item.name === sectionName);
      if (!current) throw new Error("Section not found");
      setPages(Array.isArray(pageResult?.data) ? pageResult.data.filter((page) => Boolean(page?.status)) : []);
      setSection(current);
      setContent(current?.content && typeof current.content === "object" ? current.content : {});
      setElements(Array.isArray(current?.element) ? current.element : []);
      setContentFiles({});
      setElementFiles({});
      setContentFilePreviews({});
      setElementFilePreviews({});
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load section");
    } finally {
      setLoading(false);
    }
  }, [accessToken, sectionName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const repeatedFields = Array.isArray(section?.repeated_fields) ? section.repeated_fields : [];
  const hasRepeater = repeatedFields.length > 0;

  useEffect(() => {
    if (activeTab === "elements" && !hasRepeater) {
      setActiveTab("content");
    }
  }, [activeTab, hasRepeater]);

  const addElementItem = () => {
    if (!hasRepeater) return;
    const blankItem = repeatedFields.reduce((acc, field) => {
      const key = parseFieldKey(field?.name);
      acc[key] = "";
      return acc;
    }, {});
    setElements((prev) => [...prev, blankItem]);
  };

  const updateElementField = (index, key, value) => {
    setElements((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...(item || {}), [key]: value };
      })
    );
  };

  const onElementFileChange = (index, key, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please upload an image smaller than 5MB.");
      return;
    }
    const compoundKey = `${index}:${key}`;
    setElementFiles((prev) => ({ ...prev, [compoundKey]: file }));
    setElementFilePreviews((prev) => ({ ...prev, [compoundKey]: URL.createObjectURL(file) }));
  };

  const onContentFileChange = (key, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please upload an image smaller than 5MB.");
      return;
    }
    setContentFiles((prev) => ({ ...prev, [key]: file }));
    setContentFilePreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  };

  const removeElementItem = (index) => {
    setElements((prev) => prev.filter((_, i) => i !== index));
  };

  const addUnique = (existing, next) => {
    const items = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
    if (!next) return items;
    return items.includes(next) ? items : [...items, next];
  };

  const removeFromList = (existing, value) => {
    const items = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
    return items.filter((x) => x !== value);
  };

  const setFooterGroups = (key, updater) => {
    setContent((prev) => {
      const current = normalizeFooterGroups(prev[key]);
      const next = updater(current);
      return { ...prev, [key]: next };
    });
  };

  const addFooterGroup = (key) => {
    setFooterGroups(key, (groups) => [...groups, { title: "", links: [{ name: "", slug: "" }] }]);
  };

  const removeFooterGroup = (key, groupIndex) => {
    setFooterGroups(key, (groups) => groups.filter((_, idx) => idx !== groupIndex));
  };

  const updateFooterGroupTitle = (key, groupIndex, title) => {
    setFooterGroups(key, (groups) =>
      groups.map((group, idx) => (idx === groupIndex ? { ...group, title } : group))
    );
  };

  const addFooterLink = (key, groupIndex) => {
    const groups = normalizeFooterGroups(content[key]);
    const targetGroup = groups[groupIndex];
    if (!targetGroup) return;

    const hasIncomplete = (targetGroup.links || []).some(
      (link) => !String(link?.name || "").trim() || !String(link?.slug || "").trim()
    );

    const errorKey = `${key}-${groupIndex}`;
    if (hasIncomplete) {
      setFooterInlineErrors((prev) => ({
        ...prev,
        [errorKey]: "Please complete current link name and page first.",
      }));
      return;
    }

    setFooterInlineErrors((prev) => {
      const next = { ...prev };
      delete next[errorKey];
      return next;
    });

    setFooterGroups(key, (prevGroups) =>
      prevGroups.map((group, idx) =>
        idx === groupIndex
          ? { ...group, links: [...(Array.isArray(group.links) ? group.links : []), { name: "", slug: "" }] }
          : group
      )
    );
  };

  const removeFooterLink = (key, groupIndex, linkIndex) => {
    setFooterGroups(key, (groups) =>
      groups.map((group, idx) =>
        idx === groupIndex
          ? { ...group, links: (group.links || []).filter((_, li) => li !== linkIndex) }
          : group
      )
    );
  };

  const updateFooterLink = (key, groupIndex, linkIndex, fieldName, fieldValue) => {
    const errorKey = `${key}-${groupIndex}`;
    setFooterInlineErrors((prev) => {
      const next = { ...prev };
      delete next[errorKey];
      return next;
    });

    setFooterGroups(key, (groups) =>
      groups.map((group, idx) => {
        if (idx !== groupIndex) return group;
        const links = (group.links || []).map((link, li) => {
          if (li !== linkIndex) return link;
          return { ...link, [fieldName]: fieldValue };
        });
        return { ...group, links };
      })
    );
  };

  const save = async () => {
    if (!section) return;

    setSaving(true);
    try {
      let payload;
      if (Object.keys(contentFiles).length > 0 || Object.keys(elementFiles).length > 0) {
        payload = new FormData();
        payload.append("content", JSON.stringify(content));
        payload.append("element", JSON.stringify(elements));
        payload.append("is_active", section.is_active ? "1" : "0");
        payload.append("order", String(section.order ?? 0));

        Object.entries(contentFiles).forEach(([key, file]) => {
          payload.append(`content_files[${key}]`, file);
        });

        Object.entries(elementFiles).forEach(([compoundKey, file]) => {
          const [index, key] = compoundKey.split(":");
          payload.append(`element_files[${index}][${key}]`, file);
        });
      } else {
        payload = {
          content,
          element: elements,
          is_active: section.is_active,
          order: section.order,
        };
      }

      const result = await updateSectionContentByName(accessToken, section.name, payload);
      if (!result?.status) throw new Error(result?.message || "Failed to save section");
      toast.success("Section updated successfully");
      loadData();
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Section Builder</h2>
          <p className="text-sm text-gray-600 mt-1">{section?.title || sectionName}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate("/backoffice/content/sections")}>Back</button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 text-slate-600">
            <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            <p className="font-medium">Loading section builder...</p>
          </div>
          <div className="mt-5 space-y-3 animate-pulse">
            <div className="h-8 bg-slate-100 rounded-lg w-48" />
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-28 bg-slate-100 rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <div className="tabs tabs-boxed w-fit">
            <button
              type="button"
              className={`tab ${activeTab === "content" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("content")}
            >
              Content
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "elements" ? "tab-active" : ""}`}
              onClick={() => hasRepeater && setActiveTab("elements")}
              disabled={!hasRepeater}
            >
              Elements
            </button>
          </div>

          {activeTab === "content" && (
            <div className="space-y-3">
              <h3 className="font-semibold">Content Fields</h3>
              {Array.isArray(section?.fields) && section.fields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {section.fields.map((field) => {
                    const key = parseFieldKey(field.name);
                    const value = content[key] ?? "";
                    const isTextArea = field.type === "textarea";
                    const isFile = field.type === "file";
                    const isPageLinks = field.type === "page_links";
                    const isFooterLinks = field.type === "footer_links";
                    const isMultiple = Boolean(field.multiple);
                    return (
                      <div key={`${field.name}-${field.label}`} className={isTextArea || isFooterLinks ? "md:col-span-2" : ""}>
                        <label className="label py-1"><span className="label-text">{field.label}</span></label>
                        {isTextArea ? (
                          <textarea
                            className="textarea textarea-bordered w-full"
                            rows={4}
                            value={value}
                            onChange={(e) => setContent((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                        ) : isFile ? (
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              className="file-input file-input-bordered w-full"
                              onChange={(e) => onContentFileChange(key, e.target.files?.[0])}
                            />
                            {(contentFilePreviews[key] || (typeof value === "string" && value.trim() !== "")) && (
                              <div className="border rounded-lg p-2 bg-slate-50">
                                <img
                                  src={contentFilePreviews[key] || resolvePreviewUrl(value)}
                                  alt={field.label || "preview"}
                                  className="h-24 w-full object-cover rounded"
                                />
                              </div>
                            )}
                            <p className="text-xs text-slate-500">
                              Leave empty to keep existing image.
                            </p>
                          </div>
                        ) : isPageLinks ? (
                          isMultiple ? (
                            <div className="space-y-2">
                              <select
                                className="select select-bordered w-full"
                                value=""
                                onChange={(e) => {
                                  const selected = e.target.value;
                                  setContent((prev) => ({ ...prev, [key]: addUnique(prev[key], selected) }));
                                  e.target.value = "";
                                }}
                              >
                                <option value="">Select page</option>
                                {pages.map((page) => (
                                  <option key={page.id} value={page.slug}>
                                    {page.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex flex-wrap gap-2">
                                {(Array.isArray(value) ? value : []).map((slug) => (
                                  <span key={slug} className="badge badge-outline gap-2 py-3">
                                    {slug}
                                    <button
                                      type="button"
                                      onClick={() => setContent((prev) => ({ ...prev, [key]: removeFromList(prev[key], slug) }))}
                                    >
                                      x
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <select
                              className="select select-bordered w-full"
                              value={value || ""}
                              onChange={(e) => setContent((prev) => ({ ...prev, [key]: e.target.value }))}
                            >
                              <option value="">Select page</option>
                              {pages.map((page) => (
                                <option key={page.id} value={page.slug}>
                                  {page.name}
                                </option>
                              ))}
                            </select>
                          )
                        ) : isFooterLinks ? (
                          <div className="md:col-span-2 rounded-2xl bg-white ring-1 ring-slate-200 p-5 md:p-6 space-y-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div>
                                <p className="text-base font-semibold text-slate-800">Footer Link Groups</p>
                                <p className="text-xs text-slate-500 mt-1">Create grouped footer navigation for your public site.</p>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm bg-slate-900 hover:bg-slate-800 text-white border-none rounded-xl"
                                onClick={() => addFooterGroup(key)}
                              >
                                + Add Group
                              </button>
                            </div>

                            {normalizeFooterGroups(value).length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 text-center">
                                No groups yet. Click &quot;Add Group&quot; to create footer menu groups.
                              </div>
                            ) : (
                              <div className="space-y-5">
                                {normalizeFooterGroups(value).map((group, groupIndex) => (
                                  <section
                                    key={`fg-${groupIndex}`}
                                    className="rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/80 p-4 md:p-5 space-y-4"
                                  >
                                    <div className="flex items-center">
                                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Group {groupIndex + 1}
                                      </span>
                                    </div>

                                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                                      <input
                                        className="input input-bordered w-full"
                                        placeholder="Group title (e.g. Quick Links)"
                                        value={group.title}
                                        onChange={(e) => updateFooterGroupTitle(key, groupIndex, e.target.value)}
                                      />
                                      <button
                                        type="button"
                                        className="btn btn-sm rounded-xl min-h-10 h-10 w-10 p-0 border border-red-200/80 bg-red-500/10 text-red-500 hover:text-red-600 hover:bg-red-500/15 hover:border-red-300"
                                        onClick={() => removeFooterGroup(key, groupIndex)}
                                        aria-label="Remove group"
                                        title="Remove group"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M3 6h18" />
                                          <path d="M8 6V4h8v2" />
                                          <path d="M19 6l-1 14H6L5 6" />
                                          <path d="M10 11v6" />
                                          <path d="M14 11v6" />
                                        </svg>
                                      </button>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                      {group.links.map((link, linkIndex) => (
                                        <div
                                          key={`fl-${groupIndex}-${linkIndex}`}
                                          className="flex flex-col lg:flex-row lg:items-center gap-2 py-3"
                                        >
                                          <input
                                            className="input input-bordered lg:flex-1"
                                            placeholder="Link name"
                                            value={link.name}
                                            onChange={(e) => updateFooterLink(key, groupIndex, linkIndex, "name", e.target.value)}
                                          />
                                          <select
                                            className="select select-bordered lg:flex-1"
                                            value={link.slug || ""}
                                            onChange={(e) => {
                                              const selectedSlug = e.target.value;
                                              const selectedPage = pages.find((p) => p.slug === selectedSlug);
                                              updateFooterLink(key, groupIndex, linkIndex, "slug", selectedSlug);
                                              if (selectedPage && !link.name) {
                                                updateFooterLink(key, groupIndex, linkIndex, "name", selectedPage.name || "");
                                              }
                                            }}
                                          >
                                            <option value="">Select page</option>
                                            {pages.map((page) => (
                                              <option key={page.id} value={page.slug}>
                                                {page.name}
                                              </option>
                                            ))}
                                          </select>
                                          <button
                                            type="button"
                                            className="btn btn-sm rounded-xl min-h-10 h-10 w-10 p-0 border border-red-200/80 bg-red-500/10 text-red-500 hover:text-red-600 hover:bg-red-500/15 hover:border-red-300 self-end lg:self-auto"
                                            onClick={() => removeFooterLink(key, groupIndex, linkIndex)}
                                            aria-label="Remove link"
                                            title="Remove link"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M3 6h18" />
                                              <path d="M8 6V4h8v2" />
                                              <path d="M19 6l-1 14H6L5 6" />
                                              <path d="M10 11v6" />
                                              <path d="M14 11v6" />
                                            </svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>

                                    {footerInlineErrors[`${key}-${groupIndex}`] && (
                                      <p className="text-sm text-red-500">
                                        {footerInlineErrors[`${key}-${groupIndex}`]}
                                      </p>
                                    )}

                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline rounded-xl"
                                      onClick={() => addFooterLink(key, groupIndex)}
                                    >
                                      + Add Link
                                    </button>
                                  </section>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <input
                            type={field.type === "number" ? "number" : "text"}
                            className="input input-bordered w-full"
                            value={typeof value === "string" || typeof value === "number" ? value : JSON.stringify(value)}
                            onChange={(e) => setContent((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No direct fields for this section.</p>
              )}
            </div>
          )}

          {activeTab === "elements" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Element Fields</h3>
                <button type="button" className="btn btn-sm btn-outline" onClick={addElementItem}>
                  Add Element
                </button>
              </div>

              {elements.length === 0 ? (
                <div className="text-sm text-gray-500 border border-dashed rounded-lg p-4">
                  No element added yet. Click &quot;Add Element&quot; to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {elements.map((item, index) => (
                    <div key={`element-${index}`} className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Element #{index + 1}</h4>
                        <button
                          type="button"
                          className="btn btn-xs btn-error btn-outline"
                          onClick={() => removeElementItem(index)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {repeatedFields.map((field) => {
                          const key = parseFieldKey(field?.name);
                          const isTextArea = field.type === "textarea";
                          const isFile = field.type === "file";
                          const isPageLinks = field.type === "page_links";
                          const isMultiple = Boolean(field.multiple);
                          const value = item?.[key] ?? "";
                          return (
                            <div key={`${field.name}-${index}`} className={isTextArea ? "md:col-span-2" : ""}>
                              <label className="label py-1"><span className="label-text">{field.label}</span></label>
                              {isTextArea ? (
                                <textarea
                                  className="textarea textarea-bordered w-full"
                                  rows={3}
                                  value={value}
                                  onChange={(e) => updateElementField(index, key, e.target.value)}
                                />
                              ) : isFile ? (
                                <div className="space-y-2">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="file-input file-input-bordered w-full"
                                    onChange={(e) => onElementFileChange(index, key, e.target.files?.[0])}
                                  />
                                  {(elementFilePreviews[`${index}:${key}`] || (typeof value === "string" && value.trim() !== "")) && (
                                    <div className="border rounded-lg p-2 bg-slate-50">
                                      <img
                                        src={elementFilePreviews[`${index}:${key}`] || resolvePreviewUrl(value)}
                                        alt={field.label || "preview"}
                                        className="h-24 w-full object-cover rounded"
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : isPageLinks ? (
                                isMultiple ? (
                                  <div className="space-y-2">
                                    <select
                                      className="select select-bordered w-full"
                                      value=""
                                      onChange={(e) => {
                                        const selected = e.target.value;
                                        updateElementField(index, key, addUnique(value, selected));
                                        e.target.value = "";
                                      }}
                                    >
                                      <option value="">Select page</option>
                                      {pages.map((page) => (
                                        <option key={page.id} value={page.slug}>
                                          {page.name}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="flex flex-wrap gap-2">
                                      {(Array.isArray(value) ? value : []).map((slug) => (
                                        <span key={`${slug}-${index}`} className="badge badge-outline gap-2 py-3">
                                          {slug}
                                          <button
                                            type="button"
                                            onClick={() => updateElementField(index, key, removeFromList(value, slug))}
                                          >
                                            x
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <select
                                    className="select select-bordered w-full"
                                    value={value || ""}
                                    onChange={(e) => updateElementField(index, key, e.target.value)}
                                  >
                                    <option value="">Select page</option>
                                    {pages.map((page) => (
                                      <option key={page.id} value={page.slug}>
                                        {page.name}
                                      </option>
                                    ))}
                                  </select>
                                )
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : "text"}
                                  className="input input-bordered w-full"
                                  value={value}
                                  onChange={(e) => updateElementField(index, key, e.target.value)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Section Content"}
          </button>
        </div>
      )}
    </div>
  );
}
