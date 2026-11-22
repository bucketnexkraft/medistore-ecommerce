import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import "react-datepicker/dist/react-datepicker.css";
import useSelectableList from "../../../hooks/useSelectableList";
import {
  PiMagnifyingGlass,
  PiPlus,
  PiNotePencil,
  PiTrash,
} from "react-icons/pi";
import RightAddEditModal from "./components/RightAddEditModal";
import {
  createRight,
  updateRight,
  deleteRight,
  getRights,
} from "../../../api/roleRights";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import TableLoading from "../../../components/loadings/TableLoading";
import { hasPermission } from "../../../utils/permissions";

export default function Right() {
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [selectedRight, setSelectedRight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rights, setRights] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
  });
  const [activeModule, setActiveModule] = useState("all");

  const filterRef = useRef(null);
  const { accessToken } = useSelector((state) => state.auth);

  useForm({
    defaultValues: {
      search: "",
    },
  });

  const fetchRights = useCallback(
    async (filterParams = {}) => {
      setLoading(true);
      try {
        const params = {
          perPage: "all",
          ...filterParams,
        };

        const result = await getRights(accessToken, params);

        if (!result?.status) {
          throw new Error(result?.message || "Failed to fetch rights");
        }

        setRights(result.data || []);
      } catch (error) {
        console.error("Fetching rights error:", error);
        toast.error(error.message || "Failed to load rights");
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  // Fetch rights on component mount and when filters/page change
  useEffect(() => {
    fetchRights(filters);
  }, [fetchRights, filters]);

  // Handle click outside filter dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilter(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const onFilterSubmit = (data) => {
    setShowFilter(false);
    setFilters({
      search: data.search,
    });
  };

  const openAddEditModal = (right = null) => {
    setSelectedRight(right);
    setShowAddEditModal(true);
  };

  const closeAddEditModal = () => {
    setShowAddEditModal(false);
    setSelectedRight(null);
  };

  const handleAddEditSubmit = async (rightData) => {
    try {
      if (selectedRight) {
        await updateRight(accessToken, selectedRight.id, rightData);
        toast.success("Right updated successfully");
      } else {
        await createRight(accessToken, rightData);
        toast.success("Right added successfully");
      }
      // Refresh the list with current filters
      fetchRights(filters);
      closeAddEditModal();
    } catch (error) {
      console.error("Failed to save right:", error);
      toast.error(error.message || "Failed to save right");
    }
  };

  const handleDeleteRight = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        const response = await deleteRight(accessToken, id);
        if (response?.status) {
          toast.success(response?.message || "Right deleted successfully");
          fetchRights(filters);
        } else {
          toast.error(response?.message || "Failed to delete right");
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || error?.message || "Failed to delete right");
      }
    }
  };

  // Filter rights based on search input
  const filteredRights = rights.filter((right) =>
    right.name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedRights = useMemo(() => {
    return filteredRights.reduce((acc, right) => {
      const rightName = String(right?.name || "");
      const moduleName = rightName.includes(".")
        ? rightName.split(".")[0]
        : rightName.includes("-")
        ? rightName.split("-")[0]
        : "general";

      if (!acc[moduleName]) {
        acc[moduleName] = [];
      }
      acc[moduleName].push(right);
      return acc;
    }, {});
  }, [filteredRights]);

  const groupedEntries = useMemo(
    () => Object.entries(groupedRights).sort(([a], [b]) => a.localeCompare(b)),
    [groupedRights]
  );

  const visibleRights = useMemo(() => {
    if (activeModule === "all") {
      return filteredRights;
    }
    return groupedRights[activeModule] || [];
  }, [activeModule, filteredRights, groupedRights]);

  useEffect(() => {
    if (activeModule === "all") return;
    if (!groupedRights[activeModule]) {
      setActiveModule("all");
    }
  }, [activeModule, groupedRights]);

  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(visibleRights);

  const handleDeleteMultiple = async () => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} rights. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete them!",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        await deleteRight(accessToken, selectedOptions);
        toast.success("Rights deleted successfully");
        clearSelection();
        fetchRights(filters);
      } catch (error) {
        console.error("Delete multiple rights error:", error);
        toast.error(error.message || "Failed to delete rights");
      }
    }
  };

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Right Management</h2>
        <p className="text-sm text-gray-600">
          Manage your rights from this page.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search by right name..."
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    onFilterSubmit({ search });
                  }
                }}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  className="px-1 py-2 text-gray-500 hover:text-primary cursor-pointer"
                  title="Search"
                  onClick={() =>
                    onFilterSubmit({
                      search,
                    })
                  }
                >
                  <PiMagnifyingGlass fontSize={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Right List</h5>
          <div className="flex items-center gap-2">
            {selectedOptions.length > 0 && (
              <button
                onClick={handleDeleteMultiple}
                className="btn btn-outline btn-error"
                title="Delete Selected"
              >
                <PiTrash />
                Delete ({selectedOptions.length})
              </button>
            )}
            
              <button
                className="btn btn-outline btn-primary"
                onClick={() => openAddEditModal()}
                title="Add Right"
              >
                <PiPlus />
                Add Right
              </button>
          </div>
        </div>

        <div className="px-4 pb-2">
          {loading ? (
            <TableLoading />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-3 border rounded-lg p-3 h-fit bg-slate-50">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Modules
                </p>
                <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
                  <button
                    type="button"
                    className={`w-full text-left rounded-md px-3 py-2 text-sm border ${
                      activeModule === "all"
                        ? "bg-primary text-white border-primary"
                        : "bg-white border-slate-200 hover:border-primary/40"
                    }`}
                    onClick={() => setActiveModule("all")}
                  >
                    All Modules
                    <span className="float-right">{filteredRights.length}</span>
                  </button>
                  {groupedEntries.map(([moduleName, moduleRights]) => (
                    <button
                      key={moduleName}
                      type="button"
                      className={`w-full text-left rounded-md px-3 py-2 text-sm border capitalize ${
                        activeModule === moduleName
                          ? "bg-primary text-white border-primary"
                          : "bg-white border-slate-200 hover:border-primary/40"
                      }`}
                      onClick={() => setActiveModule(moduleName)}
                    >
                      {moduleName}
                      <span className="float-right">{moduleRights.length}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-9">
                <div className="sticky top-0 z-10 bg-white border rounded-lg p-3 mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-700 capitalize">
                      {activeModule === "all" ? "All Modules" : `${activeModule} Module`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {visibleRights.length} right(s) shown
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        checked={isAllSelectedOnCurrentPage()}
                      />
                      Select all shown
                    </label>
                    {selectedOptions.length > 0 && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={clearSelection}
                      >
                        Clear ({selectedOptions.length})
                      </button>
                    )}
                  </div>
                </div>

                {visibleRights.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visibleRights.map((right) => (
                      <div
                        key={right.id}
                        className={`rounded-xl border p-3 transition ${
                          selectedOptions.includes(right.id)
                            ? "border-primary bg-primary/5"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex items-start gap-3 cursor-pointer w-full">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm mt-1"
                              onChange={() => handleSelect(right)}
                              checked={selectedOptions.includes(right.id)}
                            />
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-wide text-slate-500 capitalize">
                                {String(right.name || "").split(".")[0] || "general"}
                              </p>
                              <p className="font-medium text-slate-800 break-all">{right.name}</p>
                            </div>
                          </label>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                              onClick={() => openAddEditModal(right)}
                              title="Edit"
                            >
                              <PiNotePencil fontSize={16} />
                            </button>
                            <button
                              className="btn btn-sm border-none bg-red-500/10 text-red-500 hover:bg-red-500/20"
                              onClick={() => handleDeleteRight(right.id)}
                              title="Delete"
                            >
                              <PiTrash fontSize={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-lg py-10 text-center text-slate-500">
                    No rights found for this view
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <RightAddEditModal
        isOpen={showAddEditModal}
        onClose={closeAddEditModal}
        onSubmit={handleAddEditSubmit}
        initialData={selectedRight}
      />
    </div>
  );
}
