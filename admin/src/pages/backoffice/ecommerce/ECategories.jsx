import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiNotePencil } from "react-icons/pi";
import { getECategories, updateECategory } from "../../../api/backoffice/ecommerceTemplates";

const initialForm = {
  status: true,
};

export default function ECategories() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [keyword, setKeyword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getECategories(accessToken, {
        perPage: 200,
        search: searchTerm || undefined,
        status: statusFilter === "" ? undefined : statusFilter,
      });
      if (!result?.status) throw new Error(result?.message || "Failed to load e-categories");
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load e-categories");
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchTerm, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setForm(initialForm);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      status: Boolean(row.status),
    });
    setIsModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        status: form.status ? 1 : 0,
      };

      const result = await updateECategory(accessToken, editing.id, payload);
      if (!result?.status) throw new Error(result?.message || "Failed to update e-category");

      toast.success("E-category status updated");
      closeModal();
      loadData();
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors.join(" | ") : error?.response?.data?.message || error?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRowEdit = (row) => {
    openEdit(row);
  };

  const handleSearch = () => {
    setSearchTerm(keyword.trim());
  };

  const clearFilters = () => {
    setKeyword("");
    setSearchTerm("");
    setStatusFilter("");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">E-Categories</h2>
          <p className="text-sm text-gray-600">
            Category names are managed from the ecommerce template config and synced into the database.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            className="input input-bordered w-full sm:w-64"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search category..."
          />
          <select
            className="select select-bordered w-full sm:w-40"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
          <button className="btn btn-primary" type="button" onClick={handleSearch}>
            Filter
          </button>
          <button className="btn btn-ghost" type="button" onClick={clearFilters}>
            Clear
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
                <th>Name</th>
                <th>Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={3} className="text-center py-8">
                    No e-categories found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.name}</td>
                    <td>
                      <span className={`badge ${row.status ? "badge-success" : "badge-ghost"}`}>
                        {row.status ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <button className="btn btn-sm border-none bg-primary/10 text-primary" onClick={() => handleRowEdit(row)}>
                          <PiNotePencil />
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

      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg p-0">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
              <h3 className="text-xl font-bold text-slate-950">Edit E-Category Status</h3>
              <p className="mt-1 text-sm text-slate-500">
                You can only toggle the active state for this category.
              </p>
            </div>

            <form className="space-y-6 px-6 py-6" onSubmit={save}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">Name</label>
                <input className="input input-bordered w-full bg-slate-50" value={editing?.name || ""} disabled />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Status</p>
                    <p className="mt-1 text-sm text-slate-500">Turn this category on or off.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.checked }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => !saving && closeModal()} />
        </div>
      )}
    </div>
  );
}
