import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { PiMagnifyingGlass, PiMapPin, PiNotePencil, PiPlus, PiSliders, PiTrash } from "react-icons/pi";
import Pagination from "../../../components/common/Pagination";
import TableLoading from "../../../components/loadings/TableLoading";
import {
  createLocation,
  createLocationHierarchy,
  deleteLocation,
  deleteLocationHierarchy,
  getLocationHierarchies,
  getLocationHierarchyOptions,
  getLocationParentOptions,
  getLocations,
  updateLocation,
  updateLocationHierarchy,
} from "../../../api/backoffice/locations";

const hierarchyDefaultForm = {
  name: "",
  parent_hierarchy_id: "",
  status: true,
};

const locationDefaultForm = {
  name: "",
  location_hierarchy_id: "",
  parent_id: "",
  status: true,
};

export default function Locations() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [activeTab, setActiveTab] = useState("hierarchies");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [hierarchyFilter, setHierarchyFilter] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const filterRef = useRef(null);

  const [hierarchyOptions, setHierarchyOptions] = useState([]);
  const [parentOptions, setParentOptions] = useState([]);
  const [hierarchyModalOpen, setHierarchyModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingHierarchy, setEditingHierarchy] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [hierarchyForm, setHierarchyForm] = useState(hierarchyDefaultForm);
  const [locationForm, setLocationForm] = useState(locationDefaultForm);
  const [hierarchyFormError, setHierarchyFormError] = useState("");
  const [locationFormError, setLocationFormError] = useState("");
  const [locationParentInfo, setLocationParentInfo] = useState({
    hierarchy: null,
    parent_hierarchy: null,
  });

  const isHierarchyTab = activeTab === "hierarchies";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (hierarchyModalOpen || locationModalOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hierarchyModalOpen, locationModalOpen]);

  const loadHierarchyOptions = useCallback(async () => {
    try {
      const result = await getLocationHierarchyOptions(accessToken);
      if (result?.status) {
        setHierarchyOptions(result.data || []);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load hierarchy options");
    }
  }, [accessToken]);

  const loadData = useCallback(async (nextPage = page) => {
    setLoading(true);
    try {
      const params = {
        page: nextPage,
        perPage: 20,
        search,
        status,
      };

      if (!isHierarchyTab) {
        params.hierarchy_id = hierarchyFilter;
        params.parent_id = parentFilter;
      }

      const result = isHierarchyTab
        ? await getLocationHierarchies(accessToken, params)
        : await getLocations(accessToken, params);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch data");
      }

      setRows(result.data || []);
      setMeta(result.meta || { current_page: 1, last_page: 1, per_page: 20, total: 0 });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [accessToken, hierarchyFilter, isHierarchyTab, page, parentFilter, search, status]);

  useEffect(() => {
    loadHierarchyOptions();
  }, [loadHierarchyOptions]);

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

  const selectedHierarchyMeta = useMemo(
    () => hierarchyOptions.find((item) => String(item.id) === String(locationForm.location_hierarchy_id || "")) || null,
    [hierarchyOptions, locationForm.location_hierarchy_id]
  );

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
    setHierarchyFilter("");
    setParentFilter("");
    if (page !== 1) {
      setPage(1);
      return;
    }
    loadData(1);
    setIsAdvancedOpen(false);
  };

  const openHierarchyCreate = () => {
    setEditingHierarchy(null);
    setHierarchyForm(hierarchyDefaultForm);
    setHierarchyFormError("");
    setHierarchyModalOpen(true);
  };

  const openHierarchyEdit = (row) => {
    setEditingHierarchy(row);
    setHierarchyForm({
      name: row.name || "",
      parent_hierarchy_id: row.parent_hierarchy_id ? String(row.parent_hierarchy_id) : "",
      status: Number(row.status) === 1 || row.status === true,
    });
    setHierarchyFormError("");
    setHierarchyModalOpen(true);
  };

  const closeHierarchyModal = () => {
    if (saving) return;
    setEditingHierarchy(null);
    setHierarchyForm(hierarchyDefaultForm);
    setHierarchyFormError("");
    setHierarchyModalOpen(false);
  };

  const openLocationCreate = async () => {
    setEditingLocation(null);
    setLocationForm(locationDefaultForm);
    setParentOptions([]);
    setLocationParentInfo({ hierarchy: null, parent_hierarchy: null });
    setLocationFormError("");
    setLocationModalOpen(true);
  };

  const openLocationEdit = async (row) => {
    setEditingLocation(row);
    const nextForm = {
      name: row.name || "",
      location_hierarchy_id: row.location_hierarchy_id ? String(row.location_hierarchy_id) : "",
      parent_id: row.parent_id ? String(row.parent_id) : "",
      status: Number(row.status) === 1 || row.status === true,
    };
    setLocationForm(nextForm);
    setLocationFormError("");
    setLocationModalOpen(true);
    await loadParentOptions(nextForm.location_hierarchy_id, row.id, nextForm.parent_id);
  };

  const closeLocationModal = () => {
    if (saving) return;
    setEditingLocation(null);
    setLocationForm(locationDefaultForm);
    setParentOptions([]);
    setLocationParentInfo({ hierarchy: null, parent_hierarchy: null });
    setLocationFormError("");
    setLocationModalOpen(false);
  };

  const loadParentOptions = useCallback(async (hierarchyId, excludeId = "", preferredParentId = "") => {
    if (!hierarchyId) {
      setParentOptions([]);
      setLocationParentInfo({ hierarchy: null, parent_hierarchy: null });
      setLocationFormError("");
      return;
    }

    try {
      const result = await getLocationParentOptions(accessToken, {
        hierarchy_id: hierarchyId,
        exclude_id: excludeId || undefined,
      });

      if (!result?.status) {
        throw new Error(result?.message || "Failed to load parent options");
      }

      setLocationParentInfo({
        hierarchy: result.data?.hierarchy || null,
        parent_hierarchy: result.data?.parent_hierarchy || null,
      });
      setParentOptions(result.data?.parent_locations || []);
      setLocationForm((prev) => ({
        ...prev,
        parent_id: preferredParentId || "",
      }));
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load parent locations");
    }
  }, [accessToken]);

  const handleSaveHierarchy = async (event) => {
    event.preventDefault();
    setSaving(true);
    setHierarchyFormError("");
    try {
      const payload = {
        name: hierarchyForm.name.trim(),
        parent_hierarchy_id: hierarchyForm.parent_hierarchy_id || null,
        status: hierarchyForm.status ? 1 : 0,
      };

      const result = editingHierarchy
        ? await updateLocationHierarchy(accessToken, editingHierarchy.id, payload)
        : await createLocationHierarchy(accessToken, payload);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to save hierarchy");
      }

      toast.success(editingHierarchy ? "Hierarchy updated" : "Hierarchy created");
      closeHierarchyModal();
      loadHierarchyOptions();
      loadData(page);
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      setHierarchyFormError(Array.isArray(apiErrors) ? apiErrors.join(" | ") : error?.response?.data?.message || error?.message || "Failed to save hierarchy");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocation = async (event) => {
    event.preventDefault();
    setSaving(true);
    setLocationFormError("");
    try {
      const payload = {
        name: locationForm.name.trim(),
        location_hierarchy_id: Number(locationForm.location_hierarchy_id),
        parent_id: locationForm.parent_id || null,
        status: locationForm.status ? 1 : 0,
      };

      const result = editingLocation
        ? await updateLocation(accessToken, editingLocation.id, payload)
        : await createLocation(accessToken, payload);

      if (!result?.status) {
        throw new Error(result?.message || "Failed to save location");
      }

      toast.success(editingLocation ? "Location updated" : "Location created");
      closeLocationModal();
      loadData(page);
    } catch (error) {
      const apiErrors = error?.response?.data?.errors;
      setLocationFormError(Array.isArray(apiErrors) ? apiErrors.join(" | ") : error?.response?.data?.message || error?.message || "Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteHierarchy = async (row) => {
    const result = await Swal.fire({
      title: "Delete Hierarchy?",
      text: `You are about to delete ${row.name}. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deleteLocationHierarchy(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Delete failed");
      toast.success("Hierarchy deleted");
      loadHierarchyOptions();
      loadData(page);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Delete failed");
    }
  };

  const confirmDeleteLocation = async (row) => {
    const result = await Swal.fire({
      title: "Delete Location?",
      text: `You are about to delete ${row.name}. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deleteLocation(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Delete failed");
      toast.success("Location deleted");
      loadData(page);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Delete failed");
    }
  };

  const hierarchyChoices = useMemo(() => hierarchyOptions.filter((item) => item.status === true || Number(item.status) === 1), [hierarchyOptions]);
  const hierarchyParentChoices = useMemo(
    () => hierarchyChoices.filter((item) => String(item.id) !== String(editingHierarchy?.id || "")),
    [editingHierarchy?.id, hierarchyChoices]
  );

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Global Locations</h2>
            <p className="text-sm text-gray-600">
              Manage reusable location hierarchy levels and actual locations for any country or delivery structure.
            </p>
          </div>

          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {[
              { id: "hierarchies", label: "Hierarchy Levels" },
              { id: "locations", label: "Locations" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setPage(1);
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === item.id ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-4xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                className="input w-full pr-16 focus:outline-none focus:border-none"
                placeholder={isHierarchyTab ? "Search hierarchy name" : "Search location name"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <div className="absolute right-1 w-full max-w-16 flex items-center justify-end gap-0.5">
                <button onClick={handleSearch} className="text-gray-500 hover:text-primary px-1 py-2" title="Search">
                  <PiMagnifyingGlass className="w-5 h-5" />
                </button>
                <button onClick={() => setIsAdvancedOpen((prev) => !prev)} className="text-gray-500 hover:text-primary px-1 py-2" title="Advanced Search">
                  <PiSliders className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select className="select select-bordered h-10 min-h-10 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>

                {!isHierarchyTab && (
                  <>
                    <select className="select select-bordered h-10 min-h-10 w-full" value={hierarchyFilter} onChange={(e) => setHierarchyFilter(e.target.value)}>
                      <option value="">All Types</option>
                      {hierarchyChoices.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>

                    <select className="select select-bordered h-10 min-h-10 w-full" value={parentFilter} onChange={(e) => setParentFilter(e.target.value)}>
                      <option value="">All Parents</option>
                      <option value="root">Root Only</option>
                      {parentOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={handleReset}>Reset</button>
                <button className="btn h-10 min-h-10" onClick={handleSearch}>Search</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-end mb-3">
          {isHierarchyTab ? (
            <button className="btn btn-primary" onClick={openHierarchyCreate}>
              <PiPlus size={18} /> Add Hierarchy
            </button>
          ) : (
            <button className="btn btn-primary" onClick={openLocationCreate}>
              <PiPlus size={18} /> Add Location
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : isHierarchyTab ? (
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Name</th>
                  <th>Parent Level</th>
                  <th>Children</th>
                  <th>Locations</th>
                  <th>Status</th>
                  <th className="text-center w-36">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8">No hierarchy levels found</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">{row.name}</td>
                      <td>{row.parent_hierarchy?.name || "Root"}</td>
                      <td>{Number(row.child_hierarchies_count || 0)}</td>
                      <td>{Number(row.locations_count || 0)}</td>
                      <td>
                        <span className={`badge ${Number(row.status) === 1 || row.status === true ? "badge-success" : "badge-ghost"}`}>
                          {Number(row.status) === 1 || row.status === true ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20" onClick={() => openHierarchyEdit(row)} title="Edit">
                            <PiNotePencil fontSize={16} />
                          </button>
                          <button className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20" onClick={() => confirmDeleteHierarchy(row)} title="Delete">
                            <PiTrash fontSize={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Name</th>
                  <th>Type</th>
                  <th>Parent</th>
                  <th>Children</th>
                  <th>Status</th>
                  <th className="text-center w-36">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8">No locations found</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-gray-500">{row.slug}</div>
                      </td>
                      <td>{row.hierarchy?.name || "-"}</td>
                      <td>{row.parent?.name || "Root"}</td>
                      <td>{Number(row.children_count || 0)}</td>
                      <td>
                        <span className={`badge ${Number(row.status) === 1 || row.status === true ? "badge-success" : "badge-ghost"}`}>
                          {Number(row.status) === 1 || row.status === true ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20" onClick={() => openLocationEdit(row)} title="Edit">
                            <PiNotePencil fontSize={16} />
                          </button>
                          <button className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20" onClick={() => confirmDeleteLocation(row)} title="Delete">
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

      {hierarchyModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 py-6" onClick={closeHierarchyModal}>
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="font-bold text-2xl text-slate-900">{editingHierarchy ? "Edit Hierarchy" : "Add Hierarchy"}</h3>
              <p className="text-sm text-slate-600 mt-1">Define reusable global location levels like Country, State, Division, District, or City.</p>
            </div>

            <form onSubmit={handleSaveHierarchy} className="px-6 py-5 space-y-4">
              {hierarchyFormError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {hierarchyFormError}
                </div>
              )}

              <div>
                <label className="label py-1"><span className="label-text font-medium text-slate-700">Hierarchy Name</span></label>
                <input
                  className="input input-bordered w-full"
                  placeholder="e.g. Country, State, District"
                  value={hierarchyForm.name}
                  onChange={(e) => setHierarchyForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label py-1"><span className="label-text font-medium text-slate-700">Parent Hierarchy</span></label>
                <select
                  className="select select-bordered w-full"
                  value={hierarchyForm.parent_hierarchy_id}
                  onChange={(e) => setHierarchyForm((prev) => ({ ...prev, parent_hierarchy_id: e.target.value }))}
                >
                  <option value="">No parent hierarchy</option>
                  {hierarchyParentChoices.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Example: District can have Division as parent. Country can stay root level.</p>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                <div>
                  <p className="font-medium text-slate-800">Hierarchy Status</p>
                  <p className="text-xs text-slate-500">Inactive levels will stay hidden from future location creation.</p>
                </div>
                <input type="checkbox" className="toggle toggle-primary" checked={hierarchyForm.status} onChange={(e) => setHierarchyForm((prev) => ({ ...prev, status: e.target.checked }))} />
              </label>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={closeHierarchyModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary min-w-28" disabled={saving}>
                  {saving ? <span className="loading loading-spinner loading-sm" /> : editingHierarchy ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {locationModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 py-6" onClick={closeLocationModal}>
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="font-bold text-2xl text-slate-900">{editingLocation ? "Edit Location" : "Add Location"}</h3>
              <p className="text-sm text-slate-600 mt-1">Create actual locations under your hierarchy chain, such as Bangladesh under Country or California under State.</p>
            </div>

            <form onSubmit={handleSaveLocation} className="px-6 py-5 space-y-4">
              {locationFormError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {locationFormError}
                </div>
              )}

              <div>
                <label className="label py-1"><span className="label-text font-medium text-slate-700">Location Name</span></label>
                <input
                  className="input input-bordered w-full"
                  placeholder="e.g. Bangladesh, USA, Dhaka, Jamalpur"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label py-1"><span className="label-text font-medium text-slate-700">Location Type</span></label>
                <select
                  className="select select-bordered w-full"
                  value={locationForm.location_hierarchy_id}
                  onChange={async (e) => {
                    const nextHierarchyId = e.target.value;
                    setLocationForm((prev) => ({ ...prev, location_hierarchy_id: nextHierarchyId, parent_id: "" }));
                    await loadParentOptions(nextHierarchyId, editingLocation?.id || "");
                  }}
                  required
                >
                  <option value="">Select location type</option>
                  {hierarchyChoices.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label py-1"><span className="label-text font-medium text-slate-700">Parent Location</span></label>
                <select
                  className="select select-bordered w-full"
                  value={locationForm.parent_id}
                  onChange={(e) => setLocationForm((prev) => ({ ...prev, parent_id: e.target.value }))}
                  disabled={!selectedHierarchyMeta || !locationParentInfo.parent_hierarchy}
                >
                  <option value="">
                    {locationParentInfo.parent_hierarchy ? `Select ${locationParentInfo.parent_hierarchy.name}` : "No parent required"}
                  </option>
                  {parentOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {locationParentInfo.parent_hierarchy
                    ? `This type needs a parent from ${locationParentInfo.parent_hierarchy.name}.`
                    : "Root level locations do not need a parent."}
                </p>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                <div>
                  <p className="font-medium text-slate-800">Location Status</p>
                  <p className="text-xs text-slate-500">Disable a location if you do not want to use it in future delivery mapping.</p>
                </div>
                <input type="checkbox" className="toggle toggle-primary" checked={locationForm.status} onChange={(e) => setLocationForm((prev) => ({ ...prev, status: e.target.checked }))} />
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <PiMapPin size={20} className="mt-0.5 text-primary" />
                  <div>
                    <p className="font-medium text-slate-800">Current chain preview</p>
                    <p className="mt-1">
                      {selectedHierarchyMeta?.name || "Type not selected"}
                      {locationParentInfo.parent_hierarchy ? ` -> parent from ${locationParentInfo.parent_hierarchy.name}` : " -> root level"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={closeLocationModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary min-w-28" disabled={saving}>
                  {saving ? <span className="loading loading-spinner loading-sm" /> : editingLocation ? "Update" : "Create"}
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
