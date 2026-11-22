import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { PiMagnifyingGlass, PiNotePencil, PiPlus, PiSliders, PiTrash } from "react-icons/pi";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import TableLoading from "../../../components/loadings/TableLoading";
import Pagination from "../../../components/common/Pagination";
import { hasPermission } from "../../../utils/permissions";
import {
  deleteUserDefinedValue,
  getUserDefinedValues,
  storeUserDefinedValue,
  updateUserDefinedValue,
} from "../../../api/userDefinedValues";
import { DEMAND_TAG_OPTIONS } from "../../../utils/demandTags";

const DEFAULT_TYPE = "demand_tag";

export default function DemandTags() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", value: "" });
  const filterRef = useRef(null);
  const canWrite = useMemo(
    () => hasPermission("product-setup.create") || hasPermission("product-setup.edit"),
    []
  );

  const handleSearch = () => {
    setCurrentPage(1);
    setSearch(draftSearch.trim());
    setIsAdvancedOpen(false);
  };

  const handleResetSearch = () => {
    setDraftSearch("");
    setCurrentPage(1);
    setSearch("");
    setIsAdvancedOpen(false);
  };

  const handleSearchInputChange = (value) => {
    setDraftSearch(value);
    if (value.trim() === "" && search !== "") {
      setCurrentPage(1);
      setSearch("");
    }
  };

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => prev + 1);
  }, []);

  const fetchData = useCallback(async (page = 1, q = search) => {
    setLoading(true);
    try {
      const result = await getUserDefinedValues(accessToken, {
        type: DEFAULT_TYPE,
        page,
        perPage: 20,
        search: q,
      });
      setRows(Array.isArray(result?.data) ? result.data : []);
      setMeta(result?.meta || {});
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load demand tags");
    } finally {
      setLoading(false);
    }
  }, [accessToken, search]);

  useEffect(() => {
    fetchData(currentPage, search);
  }, [fetchData, currentPage, search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetForm = () => {
    setForm({ name: "", value: "" });
    setEditing(null);
  };

  const handleCreatePresetTags = async (tags) => {
    const existingValues = new Set(rows.map((item) => String(item?.value || "").trim().toLowerCase()));
    const pendingTags = tags.filter((tag) => !existingValues.has(String(tag.value || "").trim().toLowerCase()));

    if (!pendingTags.length) {
      toast.info("These product statuses are already added.");
      return;
    }

    try {
      const results = await Promise.allSettled(
        pendingTags.map((tag) =>
          storeUserDefinedValue(accessToken, {
            type: DEFAULT_TYPE,
            name: tag.label,
            value: tag.value,
          })
        )
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const duplicateCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "1 product status added"
            : `${successCount} product statuses added`
        );
      }

      if (duplicateCount > 0) {
        toast.info(
          duplicateCount === 1
            ? "1 selected status already existed"
            : `${duplicateCount} selected statuses already existed`
        );
      }

      fetchData(currentPage, search);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to add preset product statuses");
    }
  };

  const handleOpenCreate = () => {
    resetForm();
    setOpenModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditing(item);
    setForm({
      name: item?.name || "",
      value: item?.value || "",
    });
    setOpenModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        type: DEFAULT_TYPE,
        name: form.name?.trim(),
        value: form.value?.trim(),
      };
      if (!payload.name) {
        toast.error("Name is required");
        return;
      }

      if (editing?.id) {
        await updateUserDefinedValue(accessToken, editing.id, payload);
        toast.success("Demand tag updated");
      } else {
        await storeUserDefinedValue(accessToken, payload);
        toast.success("Demand tag created");
      }
      setOpenModal(false);
      resetForm();
      fetchData(currentPage, search);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save demand tag");
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete this demand tag?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteUserDefinedValue(accessToken, id);
      toast.success("Demand tag deleted");
      fetchData(currentPage, search);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete demand tag");
    }
  };

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Demand Tag Setup</h2>
        <p className="text-sm text-gray-600">Manage dynamic demand tags and AI-style product statuses for products.</p>

        {canWrite && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Quick Add Product Status</h3>
                <p className="text-xs text-gray-600">Add ready-made statuses like Best Seller, Trending, and Top Rated.</p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleCreatePresetTags(DEMAND_TAG_OPTIONS.slice(0, 6))}
              >
                Add All AI Statuses
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMAND_TAG_OPTIONS.slice(0, 6).map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => handleCreatePresetTags([tag])}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                className="input w-full pr-16 focus:outline-none focus:border-none"
                placeholder="Search by name or value..."
                value={draftSearch}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  type="button"
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={handleSearch}
                  title="Search"
                >
                  <PiMagnifyingGlass className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={() => setIsAdvancedOpen((prev) => !prev)}
                  title="Advanced Search"
                >
                  <PiSliders className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-error btn-outline h-10 min-h-10"
                onClick={handleResetSearch}
              >
                Reset
              </button>
              <button type="button" className="btn h-10 min-h-10" onClick={handleSearch}>
                Search
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Demand Tag List</h5>
          {canWrite && (
            <button
              className="btn btn-outline btn-primary"
              onClick={handleOpenCreate}
              title="Add Demand Tag"
            >
              <PiPlus />
              Add Demand Tag
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <table className="table">
              <thead>
                <tr className="bg-gray-100 font-semibold">
                  <th className="w-4/12">Name</th>
                  <th className="w-4/12">Value</th>
                  <th className="w-2/12">Type</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((item) => (
                    <tr key={item.id} className="hover">
                      <td>{item.name}</td>
                      <td>{item.value}</td>
                      <td>{item.type}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          {canWrite && (
                            <button
                              className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                              onClick={() => handleOpenEdit(item)}
                              title="Edit"
                            >
                              <PiNotePencil />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                              onClick={() => handleDelete(item.id)}
                              title="Delete"
                            >
                              <PiTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      No demand tags found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {meta?.last_page > 1 && (
          <Pagination
            currentPage={meta?.current_page || 1}
            lastPage={meta?.last_page || 1}
            handlePrevious={handlePrevious}
            handlePageChange={handlePageChange}
            handleNextPage={handleNextPage}
          />
        )}
      </div>

      {openModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-semibold text-lg mb-4">
              {editing ? "Edit Demand Tag" : "Add Demand Tag"}
            </h3>
            <form className="space-y-3" onSubmit={handleSave}>
              <div>
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Value (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="auto-generated if empty"
                  value={form.value}
                  onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                />
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-outline" onClick={() => setOpenModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </div>
  );
}
