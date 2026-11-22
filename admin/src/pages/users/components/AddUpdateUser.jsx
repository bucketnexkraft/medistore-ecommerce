import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { closeModal } from "../../../hooks/modalConfig";
import { API_URL } from "../../../config/constants";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import axios from "axios";
import { getWarehouse } from "../../../api/warehouse";
import { getRoles } from "../../../api/roles";

export default function AddUpdateUser({ user, isEditMode, setLoadData }) {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const isEdit = isEditMode && !!user?.id;
    
    const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm({
        defaultValues: {
            first_name: "",
            last_name: "",
            email: "",
            phone: "",
            role: "",
            status: "1",
            warehouse_id: null,
        },
    });
    
    const [formErrors, setFormErrors] = useState("");
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [roles, setRoles] = useState([]);
    const isCompanyOwner = isEdit && (
        String(user?.company?.user_id || "") === String(user?.id || "") ||
        Number(user?.role) === 32 ||
        String(user?.role_name || "").toLowerCase() === "store owner"
    );

    const fetchRoles = useCallback(async () => {
        try {
            const data = await getRoles(accessToken);
            if (data.status) {
                setRoles(data.roles);
            }
        } catch (error) {
            console.error("Failed to fetch roles:", error);
        }
    }, [accessToken]);

    const fetchWarehouses = useCallback(async () => {
        try {
            const params = { perPage: 100 };
            const result = await getWarehouse(accessToken, params);
            if (!result?.status) {
                throw new Error(result?.message || "Failed to fetch warehouses");
            }
            setWarehouses(result.data || []);
        } catch (error) {
            console.error("Fetch warehouses error:", error);
            toast.error(error.message || "Failed to load warehouses", {
                className: "alert alert-error",
                bodyClassName: "text-sm",
                progressClassName: "bg-error",
            });
        }
    }, [accessToken]);

    // Populate form with user data when editing
    useEffect(() => {
        if (isEdit && user) {
            setValue("first_name", user.first_name || "");
            setValue("last_name", user.last_name || "");
            setValue("email", user.email || "");
            setValue("phone", user.phone || "");
            setValue("role", user.role?.toString() || "");
            setValue("status", user.status?.toString() || "1");
            setValue("warehouse_id", user.warehouse_id?.toString() || "");
        }
    }, [user, setValue, isEdit]);

    useEffect(() => {
        fetchRoles();
        fetchWarehouses();
    }, [fetchRoles, fetchWarehouses]);

    const onSubmit = async (data) => {
        setFormErrors("");
        setLoading(true);

        try {
            if (isCompanyOwner) {
                data.role = user.role;
            }

            let resultAction;
            
            if (isEdit) {
                // Update existing user
                resultAction = await axios.put(`${API_URL}/user/update/${user.id}`, data, {
                    headers: {
                        "content-type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
            } else {
                // Create new user
                resultAction = await axios.post(`${API_URL}/user/store`, data, {
                    headers: {
                        "content-type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
            }

            if (resultAction.data.status === 1) {
                reset();
                closeModal(isEdit ? "edit_user_modal" : "add_user_modal");
                toast.success(resultAction.data.msg || resultAction.data.message || "Operation successful", {
                    position: "top-right",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "light",
                });
                
                // Add small delay to ensure database commit
                setTimeout(() => {
                    setLoadData(true);
                }, 500);
            } else {
                setFormErrors(resultAction.data.msg || resultAction.data.message || "Operation failed");
            }
        } catch (error) {
            if (error.response?.data?.errors) {
                const errorMessages = Object.values(error.response.data.errors).flat();
                setFormErrors(errorMessages.join("\n"));
            } else {
                setFormErrors(error.message || "An error occurred");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <dialog id={isEdit ? "edit_user_modal" : "add_user_modal"} className="modal">
            <div className="modal-box w-11/12 max-w-4xl">
                <div className="border-b pb-4">
                    <h3 className="font-bold text-lg">
                        {isEdit ? "Edit User" : "Add New User"}
                    </h3>
                </div>

                <div className="overflow-y-auto max-h-[60vh]">
                    {formErrors && (
                        <div className="alert alert-error mb-4">
                            <ul>
                                {formErrors.split("\n").map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    <form id="userForm" onSubmit={handleSubmit(onSubmit)}>
                        {/* First Name and Last Name */}
                        <div className="flex gap-4">
                            <div className="w-6/12">
                                <label>First Name</label>
                                <input
                                    type="text"
                                    {...register("first_name", { required: "First name is required" })}
                                    className="input input-bordered w-full"
                                    aria-label="First Name"
                                />
                                {errors.first_name && <p className="text-red-500">{errors.first_name.message}</p>}
                            </div>
                            <div className="w-6/12">
                                <label>Last Name</label>
                                <input
                                    type="text"
                                    {...register("last_name", { required: "Last name is required" })}
                                    className="input input-bordered w-full"
                                    aria-label="Last Name"
                                />
                                {errors.last_name && <p className="text-red-500">{errors.last_name.message}</p>}
                            </div>
                        </div>

                        {/* Email and Phone */}
                        <div className="flex gap-4 mt-4">
                            <div className="w-6/12">
                                <label>Email</label>
                                <input
                                    type="email"
                                    {...register("email", { 
                                        required: "Email is required",
                                        pattern: {
                                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                            message: "Invalid email address"
                                        }
                                    })}
                                    className="input input-bordered w-full"
                                    aria-label="Email"
                                />
                                {errors.email && <p className="text-red-500">{errors.email.message}</p>}
                            </div>
                            <div className="w-6/12">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    {...register("phone", { required: "Phone is required" })}
                                    className="input input-bordered w-full"
                                    aria-label="Phone"
                                />
                                {errors.phone && <p className="text-red-500">{errors.phone.message}</p>}
                            </div>
                        </div>

                        {/* Role and Status */}
                        <div className="flex gap-4 mt-4">
                            <div className="w-6/12">
                                <label>Role</label>
                                <select
                                    {...register("role", { required: "Role is required" })}
                                    className="input input-bordered w-full"
                                    aria-label="Role"
                                    disabled={isCompanyOwner}
                                >
                                    <option value="">Select a role</option>
                                    {isCompanyOwner && user?.role && !roles.some((role) => String(role.id) === String(user.role)) && (
                                        <option value={user.role}>{user.role_name || "Store Owner"}</option>
                                    )}
                                    {roles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.role && <p className="text-red-500">{errors.role.message}</p>}
                            </div>
                            <div className="w-6/12">
                                <label>Status</label>
                                <select
                                    {...register("status", { required: "Status is required" })}
                                    className="input input-bordered w-full"
                                    aria-label="Status"
                                >
                                    <option value="1">Active</option>
                                    <option value="0">Inactive</option>
                                </select>
                                {errors.status && <p className="text-red-500">{errors.status.message}</p>}
                            </div>
                        </div>

                        {/* Warehouse */}
                        <div className="w-full mt-4">
                            <label>Warehouse</label>
                            <select
                                {...register("warehouse_id")}
                                className="input input-bordered w-full"
                                aria-label="Warehouse"
                            >
                                <option value="">Select a warehouse</option>
                                {warehouses.map((warehouse) => (
                                    <option key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name}
                                    </option>
                                ))}
                            </select>
                            {errors.warehouse_id && <p className="text-red-500">{errors.warehouse_id.message}</p>}
                        </div>

                        {/* Password - Only for Add */}
                        {!isEdit && (
                            <div className="flex gap-4 mt-4">
                                <div className="w-6/12">
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        {...register("password", { 
                                            required: "Password is required",
                                            minLength: {
                                                value: 6,
                                                message: "Password must be at least 6 characters"
                                            }
                                        })}
                                        className="input input-bordered w-full"
                                        aria-label="Password"
                                    />
                                    {errors.password && <p className="text-red-500">{errors.password.message}</p>}
                                </div>
                                <div className="w-6/12">
                                    <label>Confirm Password</label>
                                    <input
                                        type="password"
                                        {...register("password_confirmation", { 
                                            required: "Password confirmation is required",
                                            validate: (value) => value === watch("password") || "Passwords do not match"
                                        })}
                                        className="input input-bordered w-full"
                                        aria-label="Confirm Password"
                                    />
                                    {errors.password_confirmation && <p className="text-red-500">{errors.password_confirmation.message}</p>}
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4">
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            className="btn btn-ghost h-10 min-h-10"
                            onClick={() => closeModal(isEdit ? "edit_user_modal" : "add_user_modal")}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="userForm"
                            className={`btn btn-primary h-10 min-h-10 ${loading ? "loading" : ""}`}
                            disabled={loading}
                        >
                            {loading ? "Saving..." : (isEdit ? "Update" : "Submit")}
                        </button>
                    </div>
                </div>
            </div>
        </dialog>
    );
}
