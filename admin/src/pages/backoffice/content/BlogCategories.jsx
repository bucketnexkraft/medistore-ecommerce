import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { PiNotePencil, PiTrash } from "react-icons/pi";
import {
  createBlogCategory,
  deleteBlogCategory,
  getBlogCategories,
  updateBlogCategory,
} from "../../../api/backoffice/blogs";

const initialForm = { name: "", status: true };

export default function BlogCategories() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBlogCategories(accessToken, { perPage: 200 });
      if (!result?.status) throw new Error(result?.message || "Failed to load categories");
      setRows(result.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name || "", status: Boolean(row.status) });
    setIsModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name, status: form.status ? 1 : 0 };
      const result = editing
        ? await updateBlogCategory(accessToken, editing.id, payload)
        : await createBlogCategory(accessToken, payload);
      if (!result?.status) throw new Error(result?.message || "Failed to save category");
      toast.success(editing ? "Category updated" : "Category created");
      setIsModalOpen(false);
      setEditing(null);
      setForm(initialForm);
      loadData();
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors.join(" | ") : error?.response?.data?.message || error?.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const result = await Swal.fire({
      title: "Delete Blog Category?",
      text: `You are deleting "${row.name}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });
    if (!result.isConfirmed) return;

    try {
      const response = await deleteBlogCategory(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Delete failed");
      toast.success("Category deleted");
      loadData();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Delete failed");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Blog Categories</h2>
          <p className="text-sm text-gray-600">Manage blog categories for content organization.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Category</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 overflow-x-auto">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="table">
            <thead>
              <tr className="bg-gray-100">
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Blogs</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={5} className="text-center py-8">No categories found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.slug}</td>
                  <td>
                    <span className={`badge ${row.status ? "badge-success" : "badge-ghost"}`}>
                      {row.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{row.blogs_count || 0}</td>
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{editing ? "Edit Category" : "Add Category"}</h3>
            <form className="mt-4 space-y-4" onSubmit={save}>
              <div>
                <label className="label"><span className="label-text">Name</span></label>
                <input
                  className="input input-bordered w-full"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <label className="flex items-center justify-between rounded-lg border p-3">
                <span>Status Active</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.checked }))}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => !saving && setIsModalOpen(false)} />
        </div>
      )}
    </div>
  );
}
