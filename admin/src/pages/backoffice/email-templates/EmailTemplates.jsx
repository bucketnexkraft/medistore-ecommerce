import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiMagnifyingGlass, PiPencilSimpleLine, PiSliders } from "react-icons/pi";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  getEmailTemplates,
  updateEmailTemplate,
  updateEmailTemplateStatus,
} from "../../../api/backoffice/emailTemplates";

const PLACEHOLDER_HINTS = [
  "%name%",
  "%otp%",
  "%code%",
  "%expiry_minutes%",
  "%message%",
  "%payment_id%",
  "%payment_amount%",
  "%reject_reason%",
  "%event_name%",
  "%trx%",
];

export default function EmailTemplates() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const filterRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getEmailTemplates(accessToken, {
        keyword: searchTerm || undefined,
        status: statusFilter || undefined,
        per_page: 50,
      });

      if (!result?.status) {
        throw new Error(result?.message || "Failed to load email templates");
      }

      const payload = result?.data || {};
      setItems(Array.isArray(payload?.data) ? payload.data : []);
      setMeta(payload);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load email templates");
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchTerm, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSearch = () => {
    setSearchTerm(keyword.trim());
    setIsAdvancedOpen(false);
  };

  const resetFilters = () => {
    setKeyword("");
    setSearchTerm("");
    setStatusFilter("");
    setIsAdvancedOpen(false);
  };

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
    }),
    []
  );

  const setEditingField = (name, value) => {
    setEditing((prev) => ({ ...(prev || {}), [name]: value }));
  };

  const onToggleStatus = async (item) => {
    try {
      const result = await updateEmailTemplateStatus(accessToken, item.id, !item.status);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to update status");
      }
      toast.success("Template status updated");
      loadData();
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message || "Status update failed");
    }
  };

  const onSave = async () => {
    if (!editing) return;

    setSaving(true);
    try {
      const payload = {
        name: editing.name || "",
        subject: editing.subject || "",
        body: editing.body || "",
        status: editing.status ? 1 : 0,
      };
      const result = await updateEmailTemplate(accessToken, editing.id, payload);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to update template");
      }
      toast.success("Email template updated successfully");
      setEditing(null);
      loadData();
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message || "Template update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold">Email Templates</h2>
        <p className="text-sm text-gray-600 mt-1">Manage dynamic system email subjects and bodies.</p>

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by template name, key or subject..."
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button onClick={handleSearch} className="text-gray-500 hover:text-primary px-1 py-2" title="Search">
                  <PiMagnifyingGlass className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsAdvancedOpen((prev) => !prev)}
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  title="Advanced Search"
                >
                  <PiSliders className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="w-full sm:w-auto flex-1 min-w-[220px]">
                <label className="label"><span className="label-text">Status</span></label>
                <select className="select select-bordered h-10 min-h-10 w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={resetFilters}>Reset</button>
                <button className="btn h-10 min-h-10" onClick={handleSearch}>Search</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        {loading ? (
          <div className="rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
              <p className="font-medium">Loading email templates...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Name</th>
                  <th>Key</th>
                  <th>Subject</th>
                  <th className="w-40 text-center">Status</th>
                  <th className="w-36 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">No email templates found.</td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td className="text-gray-600">{item.key}</td>
                      <td>{item.subject}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={Boolean(item.status)}
                            onChange={() => onToggleStatus(item)}
                          />
                        </div>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                          onClick={() => setEditing(item)}
                          title="Edit"
                        >
                          <PiPencilSimpleLine className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && meta?.total != null && (
          <div className="text-xs text-gray-500 mt-3">
            Total templates: {meta.total}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Edit Email Template</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Keep placeholder tokens where needed to avoid breaking system emails.
                </p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Close</button>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Available placeholder examples: {PLACEHOLDER_HINTS.join(", ")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label py-1"><span className="label-text font-medium">Template Name</span></label>
                <input
                  className="input input-bordered w-full"
                  value={editing.name || ""}
                  onChange={(e) => setEditingField("name", e.target.value)}
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text font-medium">Template Key</span></label>
                <input className="input input-bordered w-full bg-gray-100" value={editing.key || ""} readOnly />
              </div>
              <div className="md:col-span-2">
                <label className="label py-1"><span className="label-text font-medium">Email Subject</span></label>
                <input
                  className="input input-bordered w-full"
                  value={editing.subject || ""}
                  onChange={(e) => setEditingField("subject", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label py-1"><span className="label-text font-medium">Email Body</span></label>
                <ReactQuill
                  theme="snow"
                  value={editing.body || ""}
                  onChange={(value) => setEditingField("body", value)}
                  modules={quillModules}
                  className="bg-white rounded-xl [&_.ql-container]:min-h-[280px]"
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text font-medium">Status</span></label>
                <label className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className="text-sm text-slate-600">Template active/inactive</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={Boolean(editing.status)}
                    onChange={(e) => setEditingField("status", e.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Update Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
