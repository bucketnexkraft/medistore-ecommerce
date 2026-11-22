import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import CreatableSelect from "react-select/creatable";
import { createBlog, getBlogById, getBlogOptions, updateBlog } from "../../../api/backoffice/blogs";
import { API_URL } from "../../../config/constants";

const toTagOptions = (items = []) =>
  (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .map((item) => ({ label: String(item), value: String(item) }));

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
  if (value.startsWith("/")) return value;
  return `${API_URL.replace(/\/api\/v\d+\/?$/, "")}/${value.replace(/^\/+/, "")}`;
};

export default function BlogForm() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const { blogId } = useParams();
  const isEdit = useMemo(() => Boolean(blogId), [blogId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({
    category_id: "",
    title: "",
    short_description: "",
    description: "",
    tags: [],
    seo_tags: [],
    seo_description: "",
    status: true,
    is_show_in_home: true,
    image: null,
  });

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

  const tagSelectStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 48,
        borderRadius: 8,
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
      indicatorSeparator: () => ({ display: "none" }),
      dropdownIndicator: (base) => ({
        ...base,
        color: "#64748b",
        padding: 6,
        "&:hover": { color: "#334155" },
      }),
      clearIndicator: (base) => ({
        ...base,
        color: "#94a3b8",
        padding: 6,
        "&:hover": { color: "#64748b" },
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
        padding: "2px 8px",
      }),
      multiValueRemove: (base) => ({
        ...base,
        color: "#4f46e5",
        borderRadius: "0 7px 7px 0",
        "&:hover": {
          backgroundColor: "#e0e7ff",
          color: "#312e81",
        },
      }),
      menu: (base) => ({
        ...base,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        zIndex: 20,
      }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? "#f5f3ff" : "#fff",
        color: "#111827",
        cursor: "pointer",
      }),
    }),
    []
  );

  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const optionResult = await getBlogOptions(accessToken);
        if (!optionResult?.status) throw new Error(optionResult?.message || "Failed to load options");
        setCategories(optionResult?.data?.categories || []);

        if (isEdit) {
          const blogResult = await getBlogById(accessToken, blogId);
          if (!blogResult?.status) throw new Error(blogResult?.message || "Failed to load blog");
          const blog = blogResult.data || {};
          setForm({
            category_id: String(blog.category_id || ""),
            title: blog.title || "",
            short_description: blog.short_description || "",
            description: blog.description || "",
            tags: toTagOptions(blog.tags || []),
            seo_tags: toTagOptions(blog.seo_tags || []),
            seo_description: blog.seo_description || "",
            status: Boolean(blog.status),
            is_show_in_home: Boolean(blog.is_show_in_home),
            image: null,
          });
          setPreview(blog.image_url || "");
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || error?.message || "Failed to load form");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [accessToken, isEdit, blogId]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("category_id", form.category_id);
      payload.append("title", form.title);
      payload.append("short_description", form.short_description);
      payload.append("description", form.description);
      form.tags.forEach((tag) => payload.append("tags[]", tag.value));
      form.seo_tags.forEach((tag) => payload.append("seo_tags[]", tag.value));
      payload.append("seo_description", form.seo_description);
      payload.append("status", form.status ? "1" : "0");
      payload.append("is_show_in_home", form.is_show_in_home ? "1" : "0");
      if (form.image) payload.append("image", form.image);

      const result = isEdit
        ? await updateBlog(accessToken, blogId, payload)
        : await createBlog(accessToken, payload);
      if (!result?.status) throw new Error(result?.message || "Save failed");

      toast.success(isEdit ? "Blog updated" : "Blog created");
      navigate("/backoffice/content/blogs");
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors.join(" | ") : error?.response?.data?.message || error?.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{isEdit ? "Edit Blog" : "Create Blog"}</h2>
          <p className="text-sm text-gray-600">Manage blog content, SEO and visibility.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate("/backoffice/content/blogs")}>Back</button>
      </div>

      <form onSubmit={submit} className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">Category</span></label>
          <select className="select select-bordered w-full" value={form.category_id} onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))} required>
            <option value="">Select category</option>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label"><span className="label-text">Title</span></label>
          <input className="input input-bordered w-full" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
        </div>

        <div className="md:col-span-2">
          <label className="label"><span className="label-text">Short Description</span></label>
          <textarea className="textarea textarea-bordered w-full" rows={3} value={form.short_description} onChange={(e) => setForm((p) => ({ ...p, short_description: e.target.value }))} required />
        </div>

        <div className="md:col-span-2">
          <label className="label"><span className="label-text">Description</span></label>
          <div className="rounded-lg border border-base-300 bg-white overflow-hidden">
            <ReactQuill
              theme="snow"
              value={form.description}
              onChange={(value) => setForm((p) => ({ ...p, description: value }))}
              modules={quillModules}
              formats={quillFormats}
            />
          </div>
        </div>

        <div>
          <label className="label"><span className="label-text">Tags</span></label>
          <CreatableSelect
            isMulti
            value={form.tags}
            onChange={(value) => setForm((p) => ({ ...p, tags: value || [] }))}
            placeholder="Add tags..."
            classNamePrefix="react-select"
            styles={tagSelectStyles}
          />
        </div>

        <div>
          <label className="label"><span className="label-text">SEO Tags</span></label>
          <CreatableSelect
            isMulti
            value={form.seo_tags}
            onChange={(value) => setForm((p) => ({ ...p, seo_tags: value || [] }))}
            placeholder="Add SEO tags..."
            classNamePrefix="react-select"
            styles={tagSelectStyles}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label"><span className="label-text">SEO Description</span></label>
          <textarea className="textarea textarea-bordered w-full" rows={3} value={form.seo_description} onChange={(e) => setForm((p) => ({ ...p, seo_description: e.target.value }))} />
        </div>

        <div className="md:col-span-2">
          <label className="label"><span className="label-text">Image</span></label>
          <input
            type="file"
            accept="image/*"
            className="file-input file-input-bordered w-full"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setForm((p) => ({ ...p, image: file }));
              setPreview((currentPreview) => {
                if (currentPreview.startsWith("blob:")) {
                  URL.revokeObjectURL(currentPreview);
                }
                return file ? URL.createObjectURL(file) : "";
              });
            }}
          />
          {preview ? (
            <img
              src={resolveImagePreviewUrl(preview)}
              alt="Blog preview"
              className="mt-2 h-32 w-48 object-cover rounded border"
            />
          ) : null}
        </div>

        <label className="flex items-center justify-between rounded-lg border p-3">
          <span>Status Active</span>
          <input type="checkbox" className="toggle toggle-primary" checked={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.checked }))} />
        </label>

        <label className="flex items-center justify-between rounded-lg border p-3">
          <span>Show In Home</span>
          <input type="checkbox" className="toggle toggle-primary" checked={form.is_show_in_home} onChange={(e) => setForm((p) => ({ ...p, is_show_in_home: e.target.checked }))} />
        </label>

        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/backoffice/content/blogs")} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : isEdit ? "Update Blog" : "Create Blog"}</button>
        </div>
      </form>
    </div>
  );
}
