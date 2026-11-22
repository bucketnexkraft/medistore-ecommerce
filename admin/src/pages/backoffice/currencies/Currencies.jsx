import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Pagination from "../../../components/common/Pagination";
import TableLoading from "../../../components/loadings/TableLoading";
import { PiMagnifyingGlass, PiSliders, PiNotePencil, PiTrash } from "react-icons/pi";
import { useRef } from "react";
import {
  createCurrency,
  deleteCurrency,
  getCurrencies,
  updateCurrency,
} from "../../../api/backoffice/currencies";

const defaultForm = {
  name: "",
  code: "",
  symbol: "",
  exchange_rate: 1,
  is_active: true,
};

export default function Currencies() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const filterRef = useRef(null);

  useEffect(() => {
    if (!isModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  const loadData = useCallback(async (nextPage = page) => {
    setLoading(true);
    try {
      const result = await getCurrencies(accessToken, {
        page: nextPage,
        perPage: 20,
        search,
        status,
      });
      if (!result?.status) throw new Error(result?.message || "Failed to fetch currencies");
      setRows(result.data || []);
      setMeta(result.meta || { current_page: 1, last_page: 1, per_page: 20, total: 0 });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to fetch currencies");
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, status]);

  useEffect(() => {
    loadData(page);
  }, [loadData, page]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    loadData(1);
    setIsAdvancedOpen(false);
  };

  const handleReset = () => {
    setSearch("");
    setStatus("");
    if (page !== 1) {
      setPage(1);
      return;
    }
    loadData(1);
    setIsAdvancedOpen(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      code: row.code || "",
      symbol: row.symbol || "",
      exchange_rate: row.exchange_rate || 1,
      is_active: Number(row.is_active) === 1,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditing(null);
    setForm(defaultForm);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: String(form.code || "").toUpperCase(),
        exchange_rate: Number(form.exchange_rate || 1),
        is_active: form.is_active ? 1 : 0,
      };

      const result = editing
        ? await updateCurrency(accessToken, editing.id, payload)
        : await createCurrency(accessToken, payload);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to save currency");
      }

      toast.success(editing ? "Currency updated" : "Currency created");
      closeModal();
      loadData(page);
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      toast.error(Array.isArray(apiErrors) ? apiErrors.join(" | ") : error?.response?.data?.message || error?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: "Delete Currency?",
      text: `You are about to delete ${row.code}. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deleteCurrency(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Delete failed");
      toast.success("Currency deleted");
      loadData(page);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Delete failed");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">Currencies</h2>
            <p className="text-sm text-gray-600">Manage system currencies and exchange rates.</p>
          </div>
        </div>

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                className="input w-full pr-16 focus:outline-none focus:border-none"
                placeholder="Search name/code/symbol"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <div className="absolute right-1 w-full max-w-16 flex items-center justify-end gap-0.5">
                <button
                  onClick={handleSearch}
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  title="Search"
                >
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
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={handleReset}>
                  Reset
                </button>
                <button className="btn h-10 min-h-10" onClick={handleSearch}>
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-end mb-3">
          <button className="btn btn-primary" onClick={openCreate}>
            + Add Currency
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Name</th>
                  <th>Code</th>
                  <th>Symbol</th>
                  <th>Exchange Rate</th>
                  <th>Status</th>
                  <th className="text-center w-36">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8">No currencies found</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.code}</td>
                      <td>{row.symbol || "-"}</td>
                      <td>{Number(row.exchange_rate || 0).toFixed(6)}</td>
                      <td>
                        <span className={`badge ${Number(row.is_active) === 1 ? "badge-success" : "badge-ghost"}`}>
                          {Number(row.is_active) === 1 ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                            onClick={() => openEdit(row)}
                            title="Edit"
                          >
                            <PiNotePencil fontSize={16} />
                          </button>
                          <button
                            className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                            onClick={() => handleDelete(row)}
                            title="Delete"
                          >
                            <PiTrash fontSize={16} />
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

        <Pagination
          currentPage={meta.current_page || 1}
          lastPage={meta.last_page || 1}
          handlePrevious={() => setPage((prev) => Math.max(prev - 1, 1))}
          handlePageChange={setPage}
          handleNextPage={() => setPage((prev) => Math.min(prev + 1, meta.last_page || 1))}
        />
      </div>

      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center px-4 py-6"
            onClick={closeModal}
          >
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />
            <div
              className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h3 className="font-bold text-2xl text-slate-900">
                  {editing ? "Edit Currency" : "Add Currency"}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Configure currency details and exchange rate for your system.
                </p>
              </div>

              <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
                <div>
                  <label className="label py-1">
                    <span className="label-text font-medium text-slate-700">Currency Name</span>
                  </label>
                  <input
                    className="input input-bordered w-full"
                    placeholder="e.g. US Dollar"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label py-1">
                      <span className="label-text font-medium text-slate-700">Currency Code</span>
                    </label>
                    <input
                      className="input input-bordered w-full uppercase"
                      placeholder="USD"
                      maxLength={10}
                      value={form.code}
                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="label py-1">
                      <span className="label-text font-medium text-slate-700">Currency Symbol</span>
                    </label>
                    <input
                      className="input input-bordered w-full"
                      placeholder="$"
                      value={form.symbol}
                      onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label py-1">
                    <span className="label-text font-medium text-slate-700">Exchange Rate</span>
                  </label>
                  <input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    className="input input-bordered w-full"
                    placeholder="1.000000"
                    value={form.exchange_rate}
                    onChange={(e) => setForm((p) => ({ ...p, exchange_rate: e.target.value }))}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Use base currency rate as 1.000000
                  </p>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                  <div>
                    <p className="font-medium text-slate-800">Currency Status</p>
                    <p className="text-xs text-slate-500">Enable this currency for use across the system</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={form.is_active}
                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  />
                </label>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary min-w-28" disabled={saving}>
                    {saving ? <span className="loading loading-spinner loading-sm" /> : editing ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
