import React, { useState, useRef, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import "react-datepicker/dist/react-datepicker.css";
import {
  PiMagnifyingGlass,
  PiPlus,
  PiNotePencil,
  PiTrash,
} from "react-icons/pi";
import RoleAddEditModal from "./components/RoleAddEditModal";
import { useDispatch, useSelector } from "react-redux";
import {
  getRoles,
  addRole,
  updateRole,
  deleteRole,
} from "../../../api/roleRights";
import useSelectableList from "../../../hooks/useSelectableList";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import Pagination from "../../../components/common/Pagination";
import TableLoading from "../../../components/loadings/TableLoading";
import { fetchRoleList } from "../../../slice/roleRightSlice";
import { showModal } from "../../../hooks/modalConfig";
import { hasPermission } from "../../../utils/permissions";

export default function Role() {
  const [selectedRole, setSelectedRole] = useState(null);
  const filterRef = useRef(null);
  const dispatch = useDispatch();
  const { rights } = useSelector((state) => state.roleright);
  const { accessToken } = useSelector((state) => state.auth);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [meta, setMeta] = useState({});
  const [filters, setFilters] = useState({
    search: "",
    roleType: "",
  });

  const { control, handleSubmit, reset } = useForm({
    defaultValues: filters,
  });

  const fetchRoles = useCallback(
    async (page = 1, filterParams = {}) => {
      setLoading(true);
      try {
        const params = {
          page,
          search: filterParams.search,
          role_type: filterParams.roleType,
        };

        const result = await getRoles(accessToken, params);

        if (!result?.status) {
          throw new Error(result?.message || "Failed to fetch roles");
        }

        setRoles(result.data || []);
        setMeta(result.meta || {});
      } catch (error) {
        console.error("Fetching roles error:", error);
        toast.error(error.message || "Failed to load roles");
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    dispatch(fetchRoleList());
  }, [dispatch]);

  useEffect(() => {
    fetchRoles(currentPage, filters);
  }, [fetchRoles, currentPage, filters]);

  const {
    selectedOptions,
    handleSelect,
    clearSelection,
  } = useSelectableList(roles);

  const isProtectedRole = (role) =>
    String(role?.name || "").trim().toLowerCase() === "admin";

  const selectableRoleIds = roles
    .filter((role) => !isProtectedRole(role))
    .map((role) => role.id);

  const allSelectableSelected =
    selectableRoleIds.length > 0 &&
    selectableRoleIds.every((id) => selectedOptions.includes(id));

  const handleSelectAllRoles = (checked) => {
    clearSelection();
    if (checked) {
      selectableRoleIds.forEach((id) => handleSelect(id));
    }
  };

  const onFilterSubmit = (data) => {
    setFilters(data);
  };

  const openAddEditModal = (role = null) => {
    if (role) {
      const rolePermissions = role.rights;
      setSelectedRole({ ...role, rights: rolePermissions });
    } else {
      setSelectedRole(null);
    }
    showModal("role-add-edit-modal");
  };

  const handleAddEditSubmit = async (roleData) => {
    try {
      if (selectedRole) {
        await updateRole(accessToken, selectedRole.id, roleData);
        toast.success("Role updated successfully");
      } else {
        await addRole(accessToken, roleData);
        toast.success("Role added successfully");
      }
      fetchRoles(currentPage, filters);
      return true;
    } catch (error) {
      console.error("Failed to save role:", error);
      toast.error(error.message || "Failed to save role");
      return false;
    }
  };

  const handleDelete = async (id) => {
    const targetRole = roles.find((role) => role.id === id);
    if (targetRole && isProtectedRole(targetRole)) {
      toast.warning("Admin role cannot be deleted");
      return;
    }

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
        await deleteRole(accessToken, id);
        toast.success("Role deleted successfully");
        fetchRoles(currentPage, filters);
      } catch (error) {
        toast.error(error.message || "Failed to delete role");
      }
    }
  };

  const handleDeleteMultiple = async () => {
    const deletableIds = selectedOptions.filter((id) => {
      const role = roles.find((item) => item.id === id);
      return role && !isProtectedRole(role);
    });

    if (deletableIds.length === 0) {
      toast.warning("No deletable roles selected");
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${deletableIds.length} roles. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete them!",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        await Promise.all(deletableIds.map((id) => deleteRole(accessToken, id)));
        toast.success("Roles deleted successfully");
        clearSelection();
        fetchRoles(currentPage, filters);
      } catch (error) {
        console.error("Delete multiple roles error:", error);
        toast.error(error.message || "Failed to delete roles");
      }
    }
  };

  const handleNextPage = () => setCurrentPage((prev) => prev + 1);
  const handlePrevious = () => setCurrentPage((prev) => prev - 1);
  const handlePageChange = (page) => setCurrentPage(page);

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Role Management</h2>
        <p className="text-sm text-gray-600">
          Manage your roles from this page.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <form
            onSubmit={handleSubmit(onFilterSubmit)}
            className="rounded-lg border"
          >
            <div className="relative flex items-center">
              <Controller
                control={control}
                name="search"
                render={({ field }) => (
                  <input
                    type="text"
                    placeholder="Search by role name..."
                    className="input w-full pr-16 focus:outline-none focus:border-none"
                    {...field}
                  />
                )}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  type="submit"
                  className="px-1 py-2 text-gray-500 hover:text-primary cursor-pointer"
                >
                  <PiMagnifyingGlass fontSize={20} />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Role List</h5>
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
            {hasPermission("role.create") && (
              <button
                className="btn btn-outline btn-primary"
                onClick={() => openAddEditModal()}
                title="Add Role"
              >
                <PiPlus />
                Add Role
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <table className="table figtree-regular">
              <thead>
                <tr className="bg-gray-100 font-semibold">
                  <th className="w-0.5/12">
                    <label>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        onChange={(e) => handleSelectAllRoles(e.target.checked)}
                        checked={allSelectableSelected}
                      />
                    </label>
                  </th>
                  <th>Role Name</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <tr
                      key={role.id}
                      className={`hover ${
                        selectedOptions.includes(role.id) ? "bg-blue-100" : ""
                      }`}
                    >
                      <th>
                        <label>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            onChange={() => handleSelect(role)}
                            checked={selectedOptions.includes(role.id)}
                            disabled={isProtectedRole(role)}
                          />
                        </label>
                      </th>
                      <td>{role.name}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {hasPermission("role.edit") && (
                            <button
                              className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                              onClick={() => openAddEditModal(role)}
                            >
                              <PiNotePencil fontSize={16} />
                            </button>
                          )}
                          {hasPermission("role.delete") && (
                            <button
                              className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                              onClick={() => handleDelete(role.id)}
                              disabled={isProtectedRole(role)}
                              title={isProtectedRole(role) ? "Admin role cannot be deleted" : "Delete"}
                            >
                              <PiTrash fontSize={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="text-center py-4">
                      No Data Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {meta.last_page > 1 && (
          <Pagination
            currentPage={meta.current_page}
            lastPage={meta.last_page}
            handlePrevious={handlePrevious}
            handlePageChange={handlePageChange}
            handleNextPage={handleNextPage}
            showPrevious={meta.current_page > 1}
            showNext={meta.current_page < meta.last_page}
          />
        )}
      </div>
      <RoleAddEditModal
        onSubmit={handleAddEditSubmit}
        initialData={selectedRole}
        rights={rights}
      />
    </div>
  );
}
