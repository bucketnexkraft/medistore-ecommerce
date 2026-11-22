import React, { useCallback, useEffect, useState, useRef } from "react";
import { FaPlus } from "react-icons/fa";
import {
  PiMagnifyingGlass,
  PiNotePencil,
  PiSliders,
  PiTrash,
  PiEye,
  PiKey,
  PiToggleRight,
  PiToggleLeft,
} from "react-icons/pi";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import useSelectableList from "../../../hooks/useSelectableList";
import Pagination from "../../../components/common/Pagination";
import { showModal } from "../../../hooks/modalConfig";
import { 
  getCompanies, 
  getCompany,
  deleteCompany, 
  updateCompanyStatus, 
  bulkDeleteCompanies,
  bulkUpdateCompanyStatus,
  createCompany,
  updateCompany
} from "../../../api/backoffice/company";
import Swal from "sweetalert2";
import CompanyAddUpdateModal from "./components/CompanyAddUpdateModal";
import AssignRightsModal from "./components/AssignRightsModal";
import AssignFeaturePreferencesModal from "./components/AssignFeaturePreferencesModal";
import { useNavigate } from "react-router-dom";

export default function Companies() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);

  const [data, setData] = useState({ 
    data: [], 
    meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    others_data: {} 
  });
  const companyList = data.data;
  const [filters, setFilters] = useState({
    status: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loadData, setLoadData] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedRightsCompany, setSelectedRightsCompany] = useState(null);
  const [selectedFeaturePreferenceCompany, setSelectedFeaturePreferenceCompany] = useState(null);
  const filterRef = useRef(null);

  const {
    selectedOptions,
    handleSelectOption,
    handleSelectAll,
    clearSelection,
  } = useSelectableList(companyList || [], "company_id");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        perPage: perPage,
        status: filters.status,
        search: searchQuery,
        sortField,
        sortOrder,
        page: currentPage,
      };
      const result = await getCompanies(accessToken, params);
      
      if (result.status) {
        // The API might return data in different formats
        let companiesData = [];
        
        if (Array.isArray(result.data)) {
          // Direct array format
          companiesData = result.data;
        } else if (result.data && Array.isArray(result.data.data)) {
          // Nested format: { data: { data: [...] } }
          companiesData = result.data.data;
        } else if (result.data && typeof result.data === 'object') {
          // Object format - check if it has a data property that's an array
          if (result.data.data && Array.isArray(result.data.data)) {
            companiesData = result.data.data;
          }
        }
        
        const paginationData = result.pagination || { current_page: 1, last_page: 1, per_page: 20, total: 0 };

        setData({
          data: companiesData,
          meta: paginationData,
          others_data: {}
        });
      } else {
        console.error('API returned error:', result);
        toast.error(result.message || "Failed to fetch companies");
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
      console.error("Error details:", error.response);
      toast.error("Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    perPage,
    filters.status,
    searchQuery,
    sortField,
    sortOrder,
    currentPage,
  ]);

  useEffect(() => {
    if (loadData) {
      fetchData();
      setLoadData(false);
    }
  }, [loadData, fetchData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim() !== "") {
      setCurrentPage(1);
      setLoadData(true);
    }
  };

  const handleAddCompany = () => {
    setSelectedCompany(null);
    showModal("add_company_modal");
  };

  const handleEditCompany = (company) => {
    const openEditModal = async () => {
      try {
        const response = await getCompany(accessToken, company.company_id);
        setSelectedCompany(response.data || company);
      } catch (error) {
        console.error("Error fetching company details:", error);
        setSelectedCompany(company);
        toast.error(error.message || "Failed to load company details");
      } finally {
        setTimeout(() => {
          showModal("edit_company_modal");
        }, 0);
      }
    };

    openEditModal();
  };

  const handleStatusToggle = async (company) => {
    const newStatus = company.status === 1 ? 0 : 1;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${
        newStatus === 1 ? "Active" : "Inactive"
      } for company "${company.name}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, change it!",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await updateCompanyStatus(
        accessToken,
        company.company_id,
        newStatus
      );
      if (!response.status) {
        throw new Error(response?.message || "Failed to update status");
      }
      toast.success(
        `Company status updated to ${newStatus === 1 ? "Active" : "Inactive"}`,
        {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        }
      );
      setLoadData(true);
    } catch (error) {
      console.error("Status toggle error:", error);
      toast.error(error.message || "Failed to update status", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleAssignRights = (company) => {
    setSelectedRightsCompany(company);
    setTimeout(() => {
      showModal("company-assign-rights-modal");
    }, 0);
  };

  const handleAssignFeaturePreferences = (company) => {
    setSelectedFeaturePreferenceCompany(company);
    setTimeout(() => {
      showModal("company-assign-feature-preferences-modal");
    }, 0);
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${name}. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await deleteCompany(accessToken, id);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete company");
      }
      toast.success("Company deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
      clearSelection();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete company", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${
        status === 1 ? "Active" : "Inactive"
      } for selected companies?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, change it!",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await bulkUpdateCompanyStatus(
        accessToken,
        selectedOptions,
        status
      );
      if (!response.status) {
        throw new Error(response?.message || "Failed to update status");
      }
      toast.success(
        `Companies status updated to ${status === 1 ? "Active" : "Inactive"}`,
        {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        }
      );
      setLoadData(true);
      clearSelection();
    } catch (error) {
      console.error("Bulk status update error:", error);
      toast.error(error.message || "Failed to update status", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleBulkDelete = async () => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} companies. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await bulkDeleteCompanies(accessToken, selectedOptions);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete companies");
      }
      toast.success("Companies deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
      clearSelection();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(error.message || "Failed to delete companies", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
    setLoadData(true);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setLoadData(true);
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, data.meta?.last_page || 1));
    setLoadData(true);
  };

  const handleViewCompany = (company) => {
    navigate(`/backoffice/company-details?company_id=${company.company_id}`);
  };

  const onFilterSubmit = () => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  };

  const resetFilters = () => {
    setFilters({
      status: "",
    });
    setSearchQuery("");
    setSortField("created_at");
    setSortOrder("desc");
    setCurrentPage(1);
    setLoadData(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4">
      <div className="bg-white figtree-regular rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-xl font-semibold">Company Management</h2>
        <p className="text-sm text-gray-600">
          Manage your companies and their associated users from this page. You can add,
          edit, or delete companies as needed.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search companies..."
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setLoadData(true);
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && searchQuery.trim() !== "") {
                    handleSearch();
                  }
                }}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={handleSearch}
                >
                  <PiMagnifyingGlass fontSize={20} />
                </button>
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                >
                  <PiSliders fontSize={20} />
                </button>
              </div>
            </div>
          </div>
          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button
                  className="btn btn-error btn-outline h-10 min-h-10"
                  onClick={resetFilters}
                >
                  Reset
                </button>
                <button className="btn h-10 min-h-10" onClick={onFilterSubmit}>
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Company List</h5>
          <div className="flex items-center gap-2">
            {selectedOptions.length > 0 && (
              <>
                <button
                  onClick={() => handleBulkStatusUpdate(1)}
                  className="btn btn-outline btn-success"
                >
                  <PiToggleRight className="mr-1" />
                  Activate
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate(0)}
                  className="btn btn-outline btn-warning"
                >
                  <PiToggleLeft className="mr-1" />
                  Deactivate
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="btn btn-outline btn-error"
                >
                  <PiTrash className="mr-1" />
                  Delete
                </button>
              </>
            )}
            <button
              onClick={handleAddCompany}
              className="btn btn-primary"
            >
              <FaPlus className="mr-1" />
              Add Company
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : (data.data || []).length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-500 mb-4">
                <PiTrash fontSize={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-lg font-medium">No companies found</p>
                <p className="text-sm">Get started by adding your first company.</p>
              </div>
              <button
                onClick={handleAddCompany}
                className="btn btn-primary"
              >
                <FaPlus className="mr-1" />
                Add Company
              </button>
            </div>
          ) : (
            <table className="table figtree-regular">
              <thead>
                <tr className="bg-gray-100 font-semibold">
                  <th className="w-0.5/12">
                    <label>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        checked={selectedOptions.length === (data.data?.length || 0) && (data.data?.length || 0) > 0}
                      />
                    </label>
                  </th>
                  <th className="w-2.5/12">Company Name</th>
                  <th className="w-1.5/12">Contact Name</th>
                  <th className="w-2/12">Email</th>
                  <th className="w-2/12">Phone</th>
                  <th className="w-1/12">Status</th>
                  <th className="w-2/12 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data.data || []).length > 0 ? (
                  (data.data || []).map((company) => (
                    <tr
                      key={company.company_id}
                      className={`hover ${
                        selectedOptions.includes(company.company_id)
                          ? "bg-blue-100"
                          : ""
                      }`}
                    >
                      <th className="w-0.5/12">
                        <label>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            onChange={(e) => handleSelectOption(company.company_id, e.target.checked)}
                            checked={selectedOptions.includes(company.company_id)}
                          />
                        </label>
                      </th>
                      <td className="w-2.5/12">
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="mask mask-squircle h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-indigo-600">
                                  {company.name?.charAt(0)?.toUpperCase() || 'C'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <button
                              type="button"
                              className="text-zinc-800 hover:text-primary hover:underline text-left"
                              onClick={() => handleViewCompany(company)}
                            >
                              {company.name || "N/A"}
                            </button>
                            <div className="text-sm text-gray-500">{company.email || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="w-1.5/12">
                        {company.contact_name || 'N/A'}
                      </td>
                      <td className="w-2/12">{company.email || 'N/A'}</td>
                      <td className="w-2/12">{company.phone_number || 'N/A'}</td>
                      <td className="w-1/12">
                        <input
                          type="checkbox"
                          className="toggle toggle-sm toggle-primary"
                          checked={company.status === 1}
                          onChange={() => handleStatusToggle(company)}
                        />
                      </td>
                      <th className="w-2/12">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewCompany(company)}
                            className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                            title="View"
                          >
                            <PiEye fontSize={16} />
                          </button>
                          <button
                            onClick={() => handleEditCompany(company)}
                            className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                            title="Edit"
                          >
                            <PiNotePencil fontSize={16} />
                          </button>
                          <button
                            onClick={() => handleAssignRights(company)}
                            className="btn btn-sm border-none bg-secondary/10 text-secondary hover:bg-secondary/20"
                            title="Assign Rights"
                          >
                            <PiKey fontSize={16} />
                          </button>
                          <button
                            onClick={() => handleAssignFeaturePreferences(company)}
                            className="btn btn-sm border-none bg-accent/10 text-accent hover:bg-accent/20"
                            title="Assign Feature Preference"
                          >
                            <PiSliders fontSize={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(company.company_id, company.name)}
                            className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                            title="Delete"
                          >
                            <PiTrash fontSize={16} />
                          </button>
                        </div>
                      </th>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center pt-4 pb-4">
                      No Companies Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {(data.data?.length || 0) > 0 && (
          <Pagination
            currentPage={currentPage}
            lastPage={data.meta?.last_page || 1}
            handlePrevious={handlePrevious}
            handlePageChange={handlePageChange}
            handleNextPage={handleNextPage}
            showPrevious={currentPage > 1}
            showNext={currentPage < (data.meta?.last_page || 1)}
          />
        )}
      </div>

      <CompanyAddUpdateModal company={selectedCompany} setLoadData={setLoadData} />
      <AssignRightsModal
        accessToken={accessToken}
        company={selectedRightsCompany}
        onSaved={() => setLoadData(true)}
      />
      <AssignFeaturePreferencesModal
        accessToken={accessToken}
        company={selectedFeaturePreferenceCompany}
        onSaved={() => setLoadData(true)}
      />
    </div>
  );
}
