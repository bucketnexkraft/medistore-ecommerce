import React, { useCallback, useEffect, useState, useRef } from "react";
import { FaPlus, FaFileExcel } from "react-icons/fa";
import {
  PiCopy,
  PiMagnifyingGlass,
  PiNotePencil,
  PiSliders,
  PiTrash,
  PiEye,
} from "react-icons/pi";
import noImage from "../../../public/images/no-images/user-no-image.png";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { API_URL } from "../../config/constants";
import { fetchingUser } from "../../slice/userSlice";
import UserDetails from "./components/UserDetails";
import TableLoading from "../../components/loadings/TableLoading";
import useSelectableList from "../../hooks/useSelectableList";
import Swal from "sweetalert2";
import Pagination from "./../../components/common/Pagination";
import { showModal } from "../../hooks/modalConfig";
import { deleteUser, updateUserStatus } from "../../api/users";
import { getRoles } from "../../api/roles";
import AddUpdateUser from "./components/AddUpdateUser";
import { hasPermission } from "../../utils/permissions";

export default function AccountList() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const authUserId = useSelector((state) => state.auth.id);
  const authUserEmail = useSelector((state) => state.auth.email);
  const userList = useSelector((state) => state.users.data);
  const userState = useSelector((state) => state.users);
  const dispatch = useDispatch();

  const [filters, setFilters] = useState({
    status: "",
    role: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [data, setData] = useState({ data: [], meta: {}, others_data: {} });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loadData, setLoadData] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const filterRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(userList || []);

  const fetchRoles = async () => {
    try {
      const data = await getRoles(accessToken);
      if (data.status) {
        setRoles(data.roles);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  };

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
        role: filters.role,
      };
      const result = await dispatch(
        fetchingUser({ accessToken, payload: params })
      ).unwrap();

      if (!result?.status) {
        throw new Error(result?.message || "Failed to fetch users");
      }

      setData({
        data: result.data,
        meta: result.meta,
        others_data: result.others_data,
      });
    } catch (error) {
      toast.error(error.message || "Failed to fetch users", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [
    dispatch,
    accessToken,
    perPage,
    sortField,
    sortOrder,
    currentPage,
    filters,
    searchQuery,
  ]);

  useEffect(() => {
    if (loadData) {
      fetchData();
    }
  }, [fetchData, loadData]);

  useEffect(() => {
    if (accessToken) {
      fetchRoles();
    }
  }, [accessToken]);

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
      const response = await deleteUser(accessToken, id);
      
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete user");
      }
      
      toast.success("User deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      
      setLoadData(true);
    } catch (error) {
      console.error("Delete user error:", error);
      toast.error(error.message || "Failed to delete user", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one user to delete", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} users. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete them!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await deleteUser(accessToken, selectedOptions);
      if (!response.status) {
        throw new Error(response?.message || "Failed to delete users");
      }
      toast.success("Users deleted successfully", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
      setLoadData(true);
      clearSelection();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(error.message || "Failed to delete users", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleStatusToggle = async (user) => {
    const newStatus = user.status === 1 ? 0 : 1;
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${
        newStatus === 1 ? "Active" : "Inactive"
      } for user "${user.first_name} ${user.last_name}"?`,
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
      const response = await updateUserStatus(accessToken, user.id, {
        status: newStatus,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update status");
      }
      toast.success(
        `User status updated to ${newStatus === 1 ? "Active" : "Inactive"}`,
        {
          className: "alert alert-success",
          bodyClassName: "text-sm",
          progressClassName: "bg-success",
        }
      );
      setLoadData(true);
    } catch (error) {
      console.error("Status update error:", error);
      toast.error(error.message || "Failed to update status", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedOptions.length === 0) {
      toast.warning("Please select at least one user to update", {
        className: "alert alert-warning",
        bodyClassName: "text-sm",
        progressClassName: "bg-warning",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Change status to ${status === 1 ? "Active" : "Inactive"} for ${
        selectedOptions.length
      } selected users?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, change them!",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await updateUserStatus(accessToken, selectedOptions, {
        status,
      });
      if (!response.status) {
        throw new Error(response?.message || "Failed to update statuses");
      }
      toast.success(
        `Selected users updated to ${status === 1 ? "Active" : "Inactive"}`,
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
      toast.error(error.message || "Failed to update statuses", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleSort = (field) => {
    setSortField(field);
    setSortOrder(sortField === field && sortOrder === "asc" ? "desc" : "asc");
    setLoadData(true);
  };

  const getUserRoleName = (user) => user.role_name || user.roles?.name || "N/A";

  const exportToExcel = () => {
    const headers = ["Name", "Role", "Email", "Phone", "Status"];
    const exportData =
      selectedOptions.length > 0
        ? data.data.filter((item) => selectedOptions.includes(item.id))
        : data.data;
    const rows = exportData.map((item) => [
      `${item.first_name || ""} ${item.last_name || ""}`,
      getUserRoleName(item),
      item.email || "",
      item.phone || "",
      item.status === 1 ? "Active" : "Inactive",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Users.csv";
    link.click();
  };

  const copyToClipboard = async () => {
    try {
      const exportData =
        selectedOptions.length > 0
          ? data.data.filter((item) => selectedOptions.includes(item.id))
          : data.data;
      const text = exportData
        .map(
          (item) =>
            `${item.first_name || ""} ${item.last_name || ""},${
              getUserRoleName(item)
            },${item.email || ""},${item.phone || ""},${
              item.status === 1 ? "Active" : "Inactive"
            }`
        )
        .join("\n");
      const clipboardText = `Name,Role,Email,Phone,Status\n${text}`;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(clipboardText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = clipboardText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast.success("Data copied to clipboard", {
        className: "alert alert-success",
        bodyClassName: "text-sm",
        progressClassName: "bg-success",
      });
    } catch (error) {
      console.error("Copy to clipboard error:", error);
      toast.error("Failed to copy to clipboard", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => prev + 1);
    setLoadData(true);
  };
  const handlePrevious = () => {
    setCurrentPage((prev) => prev - 1);
    setLoadData(true);
  };
  const handlePageChange = (page) => {
    setCurrentPage(page);
    setLoadData(true);
  };

  const onFilterSubmit = () => {
    setIsAdvancedOpen(false);
    setCurrentPage(1);
    setLoadData(true);
  };

  const resetFilters = () => {
    setFilters({
      status: "",
      role: "",
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
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">User Management</h2>
        <p className="text-sm text-gray-600">
          Manage your users, roles, and permissions from this page. You can add,
          edit, or delete users as needed.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search users..."
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
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Role</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                  value={filters.role}
                  onChange={(e) => handleFilterChange("role", e.target.value)}
                >
                  <option value="">All Roles</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
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
          <h5 className="font-semibold text-custom-gray-400">User List</h5>
          <div className="flex items-center gap-2">
            {selectedOptions.length > 0 && (
              <>
                {hasPermission("user.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(1)}
                    className="btn btn-outline btn-success"
                  >
                    Set Active
                  </button>
                )}
                {hasPermission("user.edit") && (
                  <button
                    onClick={() => handleBulkStatusUpdate(0)}
                    className="btn btn-outline btn-warning"
                  >
                    Set Inactive
                  </button>
                )}
                {hasPermission("user.delete") && selectedOptions.length > 1 && (
                  <button
                    onClick={handleBulkDelete}
                    className="btn btn-outline btn-error"
                    title="Delete Selected"
                  >
                    <PiTrash className="" />
                    Delete ({selectedOptions.length})
                  </button>
                )}
              </>
            )}
            <button
              onClick={exportToExcel}
              className="btn btn-outline btn-success"
            >
              <FaFileExcel />
            </button>
            <button
              onClick={copyToClipboard}
              className="btn btn-outline btn-info"
            >
              <PiCopy size={18} />
            </button>
            {hasPermission("user.create") && (
              <button
                className="btn btn-outline btn-primary"
                onClick={() => {
                  setSelectedUser(null);
                  setIsEditMode(false);
                  setTimeout(() => {
                    showModal("add_user_modal");
                  }, 0);
                }}
              >
                <FaPlus />
                Add
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <>
              <table className="table figtree-regular">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th className="w-0.5/12">
                      <label>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          checked={isAllSelectedOnCurrentPage()}
                        />
                      </label>
                    </th>
                    <th
                      className="w-2.5/12 cursor-pointer"
                      onClick={() => handleSort("first_name")}
                    >
                      Name{" "}
                      {sortField === "first_name" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-1.5/12">Role</th>
                    <th
                      className="w-2/12 cursor-pointer"
                      onClick={() => handleSort("email")}
                    >
                      Email{" "}
                      {sortField === "email" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2/12">Phone</th>
                    <th
                      className="w-1/12 cursor-pointer"
                      onClick={() => handleSort("status")}
                    >
                      Status{" "}
                      {sortField === "status" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="w-2/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {userList?.length > 0 ? (
                    userList.map((user) => {
                      const isProtectedUser =
                        (authUserId && String(user.id) === String(authUserId)) ||
                        (authUserEmail &&
                          String(user.email || "").toLowerCase() ===
                            String(authUserEmail || "").toLowerCase());

                      return (
                      <tr
                        key={user.id}
                        className={`hover ${
                          selectedOptions.includes(user.id)
                            ? "bg-blue-100"
                            : ""
                        }`}
                      >
                        <th className="w-0.5/12">
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(user)}
                              checked={selectedOptions.includes(user.id)}
                              disabled={isProtectedUser}
                            />
                          </label>
                        </th>
                        <td className="w-2.5/12">
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="mask mask-squircle h-10 w-10">
                                <img
                                  src={user.profile_image || noImage}
                                  alt={`${user.first_name || ""} ${
                                    user.last_name || ""
                                  }'s Profile`}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="text-zinc-800">{`${
                                user.first_name || "N/A"
                              } ${user.last_name || ""}`}</div>
                            </div>
                          </div>
                        </td>
                        <td className="w-1.5/12">
                          {getUserRoleName(user)}
                        </td>
                        <td className="w-2/12">{user.email || "N/A"}</td>
                        <td className="w-2/12">{user.phone || "N/A"}</td>
                        <td className="w-1/12">
                          {hasPermission("user.edit") && !isProtectedUser ? (
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-primary"
                              checked={user.status === 1}
                              onChange={() => handleStatusToggle(user)}
                            />
                          ) : (
                            <span className="text-xs text-gray-400">
                              {user.status === 1 ? "Active" : "Inactive"}
                            </span>
                          )}
                        </td>
                        <th className="w-2/12">
                          <div className="flex items-center justify-center gap-2">
                            {hasPermission("user.view") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                onClick={() => {
                                  setSelectedUser(user);
                                  showModal("userDetailsModal");
                                }}
                              >
                                <PiEye fontSize={16} />
                              </button>
                            )}
                            {hasPermission("user.edit") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setIsEditMode(true);
                                  setTimeout(() => {
                                    showModal("edit_user_modal");
                                  }, 0);
                                }}
                              >
                                <PiNotePencil fontSize={16} />
                              </button>
                            )}
                            {hasPermission("user.delete") && !isProtectedUser && (
                              <button
                                className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                onClick={() =>
                                  handleDelete(
                                    user.id,
                                    `${user.first_name || ""} ${
                                      user.last_name || ""
                                    }`
                                  )
                                }
                              >
                                <PiTrash fontSize={16} />
                              </button>
                            )}
                          </div>
                        </th>
                      </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center pt-4 pb-4">
                        No Users Found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {userList?.length > 0 && (
                <Pagination
                  currentPage={userState.meta?.current_page || 1}
                  lastPage={userState.meta?.last_page || 1}
                  handlePrevious={handlePrevious}
                  handlePageChange={handlePageChange}
                  handleNextPage={handleNextPage}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < (userState.meta?.last_page || 1)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <AddUpdateUser user={selectedUser} isEditMode={isEditMode} setLoadData={setLoadData} />
      <UserDetails user={selectedUser} />
    </div>
  );
}
