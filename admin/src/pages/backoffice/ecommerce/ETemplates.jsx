import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Select from "react-select";
import { PiMagnifyingGlass, PiNotePencil, PiRows, PiTrash } from "react-icons/pi";
import { API_URL } from "../../../config/constants";
import {
  createETemplate,
  deleteETemplate,
  getETemplateOptions,
  getETemplates,
  updateETemplate,
} from "../../../api/backoffice/ecommerceTemplates";

const initialForm = {
  template_name: "",
  primary_color: "#7F00FF",
  secondary_color: "#F5F3FF",
  font_family: "Inter",
  template_type: "PRMT",
  short_description: "",
  price: "0",
  discount_amount: "0",
  discount_type: "fixed",
  categories: [],
  tags: [],
  image: null,
};

const defaultTemplateTypeOptions = [
  { value: "FREE", label: "Free" },
  { value: "PRMT", label: "Premium" },
  { value: "PTSU", label: "Premium Single Use" },
];

const isFreeTemplate = (value) => String(value || "").toUpperCase() === "FREE" || String(value || "").toLowerCase() === "free";

const normalizeTemplateType = (value, price = 0) => {
  if (isFreeTemplate(value)) return "FREE";
  const normalized = String(value || "").toUpperCase();
  if (["PRMT", "PTSU"].includes(normalized)) return normalized;
  return Number(price || 0) === 0 && String(value || "").toLowerCase() === "free" ? "FREE" : "PRMT";
};

const templateTypeLabel = (value, options = []) => {
  const normalized = String(value || "").toUpperCase();
  const option = options.find((item) => String(item.value).toUpperCase() === normalized);
  if (option) return option.label;
  if (isFreeTemplate(value)) return "Free";
  if (String(value || "").toLowerCase() === "paid") return "Premium";
  return "Premium";
};

const toTagOptions = (items = []) =>
  (Array.isArray(items) ? items : []).filter(Boolean).map((item) => ({
    label: String(item),
    value: String(item),
  }));

const formatPresetGroupLabel = (value) =>
  String(value || "other")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getBackendBaseUrl = () => {
  const candidates = [
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_API_PROXY_TARGET,
    API_URL.replace(/\/api\/v\d+\/?$/, ""),
    window.location.origin,
  ];

  const absoluteCandidate = candidates.find(
    (value) => typeof value === "string" && value.length > 0 && /^https?:\/\//i.test(value)
  );

  return (absoluteCandidate || window.location.origin).replace(/\/+$/, "");
};

const resolveImagePreviewUrl = (value) => {
  if (!value) return "";
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  const backendBase = getBackendBaseUrl();

  if (value.startsWith("/uploads/")) {
    return `${backendBase}${value}`;
  }

  if (value.startsWith("/images/")) {
    return `${backendBase}${value}`;
  }

  if (value.startsWith("uploads/") || value.startsWith("images/")) {
    return `${backendBase}/${value.replace(/^\/+/, "")}`;
  }

  if (value.startsWith("/")) {
    return `${backendBase}${value}`;
  }

  return `${backendBase}/images/e-templates/${value.replace(/^\/+/, "")}`;
};

export default function ETemplates() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [templateTypeOptions, setTemplateTypeOptions] = useState(defaultTemplateTypeOptions);
  const [supportsTemplateTypeCodes, setSupportsTemplateTypeCodes] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState(initialForm);
  const groupedPresetEntries = [];

  const selectStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 46,
        borderRadius: 12,
        borderColor: state.isFocused ? "#0f172a" : "#d1d5db",
        boxShadow: "none",
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "4px 10px",
        gap: "6px",
      }),
      multiValue: (base) => ({
        ...base,
        backgroundColor: "#eef2ff",
        border: "1px solid #c7d2fe",
        borderRadius: 8,
      }),
      multiValueLabel: (base) => ({
        ...base,
        color: "#3730a3",
      }),
      multiValueRemove: (base) => ({
        ...base,
        color: "#4f46e5",
        "&:hover": {
          backgroundColor: "#e0e7ff",
          color: "#312e81",
        },
      }),
      menu: (base) => ({
        ...base,
        zIndex: 30,
      }),
    }),
    []
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getETemplates(accessToken, {
        perPage: 200,
        search: searchTerm || undefined,
      });
      if (!result?.status) throw new Error(result?.message || "Failed to load e-templates");
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load e-templates");
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchTerm]);

  const loadOptions = useCallback(async () => {
    try {
      const templateOptionsResult = await getETemplateOptions(accessToken, { minimal: 1 });
      if (!templateOptionsResult?.status) {
        throw new Error(templateOptionsResult?.message || "Failed to load category options");
      }

      setCategoryOptions(
        Array.isArray(templateOptionsResult?.data?.categories)
          ? templateOptionsResult.data.categories.map((item) => ({
              value: item.id,
              label: item.name,
            }))
          : []
      );
      const incomingTemplateTypes = Array.isArray(templateOptionsResult?.data?.template_types)
        ? templateOptionsResult.data.template_types
        : [];
      setSupportsTemplateTypeCodes(incomingTemplateTypes.length > 0);

      setTemplateTypeOptions(
        incomingTemplateTypes.length
          ? incomingTemplateTypes.map((item) => ({
              value: item.code,
              label: item.value,
            }))
          : defaultTemplateTypeOptions
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load category options");
    }
  }, [accessToken]);

  const updateSectionPresetSelection = useCallback(() => {}, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setForm(initialForm);
    setPreview((currentPreview) => {
      if (currentPreview.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }
      return "";
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setPreview("");
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      template_name: row.template_name || "",
      primary_color: row.primary_color || "#7F00FF",
      secondary_color: row.secondary_color || "#F5F3FF",
      font_family: row.font_family || "Inter",
      template_type: normalizeTemplateType(row.template_type, row.price),
      short_description: row.short_description || "",
      price: String(row.price ?? 0),
      discount_amount: String(row.discount_amount ?? 0),
      discount_type: row.discount_type || "fixed",
      categories: Array.isArray(row.categories) && row.categories.length
        ? [
            {
              value: row.categories[0].id,
              label: row.categories[0].name,
            },
          ]
        : [],
      tags: toTagOptions(row.tags || []),
      image: null,
    });
    setPreview(row.image_url || "");
    setIsModalOpen(true);
  };

  const handleSearch = () => {
    setSearchTerm(keyword.trim());
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = new FormData();
      payload.append("template_name", form.template_name);
      payload.append("primary_color", form.primary_color);
      payload.append("secondary_color", form.secondary_color);
      payload.append("font_family", form.font_family);
      payload.append(
        "template_type",
        supportsTemplateTypeCodes
          ? normalizeTemplateType(form.template_type, form.price)
          : isFreeTemplate(form.template_type) ? "free" : "paid"
      );
      payload.append("short_description", form.short_description);
      payload.append("price", isFreeTemplate(form.template_type) ? "0" : String(form.price ?? "0"));
      payload.append("discount_amount", isFreeTemplate(form.template_type) ? "0" : String(form.discount_amount ?? "0"));
      payload.append("discount_type", isFreeTemplate(form.template_type) ? "fixed" : form.discount_type);
      payload.append(
        "categories",
        JSON.stringify(
          form.categories.slice(0, 1).map((item) => ({
            id: Number(item.value),
            name: item.label,
          }))
        )
      );
      payload.append("tags", JSON.stringify(form.tags.map((item) => item.value)));

      if (form.image) {
        payload.append("image", form.image);
      }

      const result = editing
        ? await updateETemplate(accessToken, editing.id, payload)
        : await createETemplate(accessToken, payload);

      if (!result?.status) throw new Error(result?.message || "Failed to save e-template");

      toast.success(editing ? "E-template updated" : "E-template created");
      closeModal();
      loadTemplates();
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors.join(" | ") : error?.response?.data?.message || error?.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const result = await Swal.fire({
      title: "Delete E-Template?",
      text: `You are deleting "${row.template_name}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deleteETemplate(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Delete failed");
      toast.success("E-template deleted");
      loadTemplates();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Delete failed");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">E-Templates</h2>
            <p className="text-sm text-gray-600">
            Pick one category, and the app will automatically attach the presets that belong to it.
            </p>
        </div>
        <div className="flex w-full lg:w-auto gap-2">
          <div className="relative flex-1 lg:w-80">
            <input
              className="input input-bordered w-full pr-12"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search template, tag, or category..."
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary"
              onClick={handleSearch}
              type="button"
            >
              <PiMagnifyingGlass className="h-5 w-5" />
            </button>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            + Add Template
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 overflow-x-auto">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="table">
            <thead>
              <tr className="bg-gray-100">
                <th>Image</th>
                <th>Template Name</th>
                <th>Price</th>
                <th>Type</th>
                <th>Categories</th>
                <th className="text-center">Builder</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    No e-templates found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.image_url ? (
                        <img
                          src={resolveImagePreviewUrl(row.image_url)}
                          alt={row.template_name}
                          className="h-14 w-16 rounded object-cover border"
                        />
                      ) : (
                        <div className="h-14 w-16 rounded border bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                          No image
                        </div>
                      )}
                    </td>
                    <td className="font-medium">{row.template_name}</td>
                    <td>
                      {isFreeTemplate(row.template_type) ? (
                        <span className="text-sm text-gray-400">Free</span>
                      ) : Number(row.discount_amount || 0) > 0 ? (
                        <div className="text-sm">
                          <div className="font-medium text-slate-900">
                            {Number(row.discount_type === "percent"
                              ? Number(row.price || 0) * (1 - Math.min(Number(row.discount_amount || 0), 100) / 100)
                              : Number(row.price || 0) - Number(row.discount_amount || 0)
                            ).toFixed(2)}
                          </div>
                          <div className="text-xs text-slate-400 line-through">
                            {Number(row.price || 0).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        Number(row.price || 0).toFixed(2)
                      )}
                    </td>
                    <td>
                      <span className={`badge ${isFreeTemplate(row.template_type) ? "badge-success" : "badge-primary"}`}>
                        {templateTypeLabel(row.template_type, templateTypeOptions)}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(row.categories || []).length ? (
                          row.categories.map((item) => (
                            <span key={`${row.id}-cat-${item.id}`} className="badge badge-outline">
                              {item.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">No categories</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm border-none bg-slate-900/10 text-slate-800 hover:bg-slate-900/20"
                        onClick={() => navigate(`/backoffice/e-templates/${row.id}/builder`)}
                        title="Template Builder"
                      >
                        <PiRows />
                      </button>
                      <div className="mt-2 text-xs text-gray-500">
                        {row.pages_count || 0}P / {row.sections_count || 0}S / {row.actions_count || 0}A
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <button className="btn btn-sm border-none bg-primary/10 text-primary" onClick={() => openEdit(row)}>
                          <PiNotePencil />
                        </button>
                        <button className="btn btn-sm border-none bg-error/10 text-error" onClick={() => remove(row)}>
                          <PiTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (<>
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/25"
          onClick={() => !saving && closeModal()}
        >
          <div
            className="relative z-10 flex h-full w-full max-w-[1120px] flex-col overflow-hidden border-l border-slate-200 bg-slate-50 shadow-[-20px_0_60px_rgba(15,23,42,0.16)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-white px-7 py-6">
              <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      Template catalog
                    </div>
                    <h3 className="text-2xl font-semibold text-slate-950">
                      {editing ? "Edit E-Template" : "Add E-Template"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Select a plan, category, and tags. Then save and build the template.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                    onClick={closeModal}
                    disabled={saving}
                    aria-label="Close"
                  >
                    x
                  </button>
                </div>
              </div>

              <form className="min-h-0 flex-1 overflow-y-auto px-7 py-7" onSubmit={submit}>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-5">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div>
                        <p className="text-base font-semibold text-slate-950">Template details</p>
                        <p className="mt-1 text-sm text-slate-500">Basic information for this template.</p>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Template name</label>
                          <input
                            className="input input-bordered h-12 w-full rounded-lg border-slate-200 bg-white focus:border-slate-400 focus:outline-none"
                            value={form.template_name}
                            onChange={(e) => setForm((prev) => ({ ...prev, template_name: e.target.value }))}
                            placeholder="e.g. Electronics Prime"
                            required
                          />
                        </div>

                        {!isFreeTemplate(form.template_type) && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Price</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="input input-bordered h-12 w-full rounded-lg border-slate-200 bg-white focus:border-slate-400 focus:outline-none"
                              value={form.price}
                              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                              required
                            />
                          </div>
                        )}

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Primary color</label>
                          <div className="flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2">
                            <input
                              type="color"
                              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                              value={form.primary_color}
                              onChange={(e) => setForm((prev) => ({ ...prev, primary_color: e.target.value }))}
                              aria-label="Primary color"
                            />
                            <input
                              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm uppercase outline-none"
                              value={form.primary_color}
                              onChange={(e) => setForm((prev) => ({ ...prev, primary_color: e.target.value }))}
                              pattern="^#[0-9A-Fa-f]{6}$"
                              maxLength={7}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Secondary color</label>
                          <div className="flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2">
                            <input
                              type="color"
                              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                              value={form.secondary_color}
                              onChange={(e) => setForm((prev) => ({ ...prev, secondary_color: e.target.value }))}
                              aria-label="Secondary color"
                            />
                            <input
                              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm uppercase outline-none"
                              value={form.secondary_color}
                              onChange={(e) => setForm((prev) => ({ ...prev, secondary_color: e.target.value }))}
                              pattern="^#[0-9A-Fa-f]{6}$"
                              maxLength={7}
                              required
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-slate-700">Font family</label>
                          <select
                            className="select select-bordered h-12 w-full rounded-lg border-slate-200 bg-white focus:border-slate-400 focus:outline-none"
                            value={form.font_family}
                            onChange={(e) => setForm((prev) => ({ ...prev, font_family: e.target.value }))}
                          >
                            {["Inter", "Poppins", "Roboto", "Montserrat", "Open Sans", "Lato", "Nunito", "DM Sans", "Playfair Display"].map((font) => (
                              <option key={font} value={font}>{font}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Template for setup template</label>
                          <select
                            className="select select-bordered h-12 w-full rounded-lg border-slate-200 bg-white focus:border-slate-400 focus:outline-none"
                            value={form.template_type}
                            onChange={(e) => setForm((prev) => ({
                              ...prev,
                              template_type: e.target.value,
                              ...(isFreeTemplate(e.target.value)
                                ? { price: "0", discount_amount: "0", discount_type: "fixed" }
                                : {}),
                            }))}
                          >
                            {templateTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>

                        {!isFreeTemplate(form.template_type) && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Discount</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="0"
                                max={form.discount_type === "percent" ? "100" : undefined}
                                step="0.01"
                                className="input input-bordered h-12 min-w-0 flex-1 rounded-lg border-slate-200 bg-white focus:border-slate-400 focus:outline-none disabled:bg-slate-50"
                                value={form.discount_amount}
                                onChange={(e) => setForm((prev) => ({ ...prev, discount_amount: e.target.value }))}
                              />
                              <select
                                className="select select-bordered h-12 w-28 rounded-lg border-slate-200 bg-white focus:border-slate-400 focus:outline-none disabled:bg-slate-50"
                                value={form.discount_type}
                                onChange={(e) => setForm((prev) => ({ ...prev, discount_type: e.target.value }))}
                              >
                                <option value="fixed">Amount</option>
                                <option value="percent">Percent</option>
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-slate-700">Short description</label>
                          <textarea
                            className="textarea textarea-bordered w-full rounded-lg border-slate-200 bg-white focus:border-slate-400 focus:outline-none"
                            rows={3}
                            value={form.short_description}
                            onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
                            placeholder="Short summary shown in the library"
                            required
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div>
                        <p className="text-base font-semibold text-slate-950">Category scope</p>
                        <p className="mt-1 text-sm text-slate-500">Pick one category for this template.</p>
                      </div>

                      <div className="mt-5">
                        <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                        <Select
                          options={categoryOptions}
                          value={form.categories[0] || null}
                          onChange={(value) => setForm((prev) => ({ ...prev, categories: value ? [value] : [] }))}
                          placeholder="Select a category..."
                          styles={selectStyles}
                        />
                      </div>
                    </section>

                  </div>

                  <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h4 className="text-base font-semibold text-slate-950">Preview image</h4>
                      <p className="mt-1 text-sm text-slate-500">Optional cover image for the template card.</p>

                      <label className="mt-5 block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Image</span>
                        <span className="mb-2 block text-xs text-slate-500">Required image size: 444 × 464 px</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="file-input file-input-bordered w-full rounded-lg border-slate-200 bg-white focus:border-slate-400 focus:outline-none"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setForm((prev) => ({ ...prev, image: file }));
                            setPreview((currentPreview) => {
                              if (currentPreview.startsWith("blob:")) {
                                URL.revokeObjectURL(currentPreview);
                              }
                              return file ? URL.createObjectURL(file) : editing?.image_url || "";
                            });
                          }}
                        />
                      </label>

                      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        {preview ? (
                          <img
                            src={resolveImagePreviewUrl(preview)}
                            alt="Template preview"
                            className="h-60 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-60 items-center justify-center px-6 text-center text-sm text-slate-400">
                            No preview image selected.
                          </div>
                        )}
                      </div>
                    </section>

                  </aside>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                  <button type="button" className="btn btn-ghost rounded-xl px-5" onClick={closeModal} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-xl px-6" disabled={saving}>
                    {saving ? "Saving..." : editing ? "Update Template" : "Create Template"}
                  </button>
                </div>
              </form>
            </div>
          </div>
      </>)}
    </div>
  );
}
