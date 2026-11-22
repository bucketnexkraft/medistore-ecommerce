import React, { useEffect, useState } from "react";
import { getAdminData, updateProfile } from "../../api/updateprofile";
import { useSelector, useDispatch } from "react-redux";
import { updateUserInfo } from "../../slice/authSlice";
import { toast } from "react-toastify";
import Spiner from "../../components/loadings/Spiner";
import axiosInstance from "../../config/axiosInstance";
import { useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

const Profile = () => {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  const dispatch = useDispatch();
  const location = useLocation();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    image: null,
    printer_type: "normal",
    private_code: "",
    private_code_confirmation: "",
  });

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [initialLoading, setInitialLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState("profile");
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState({
    current_password: false,
    new_password: false,
    confirm_password: false,
    private_code: false,
    private_code_confirmation: false,
  });

  const withCacheBust = (url) => {
    if (!url) return "";
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}t=${Date.now()}`;
  };

  const supportedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const isBackofficeProfile = isSuperAdmin;

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const tab = query.get("tab");
    if (tab === "password") {
      setActiveTab("password");
    } else {
      setActiveTab("profile");
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      setInitialLoading(true);
      try {
        const response = await getAdminData(accessToken);
        const user = response?.data?.user || {};
        const profileImage = user.profile_image_path || user.profile_image || null;

        setForm({
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          email: user.email || "",
          phone: user.phone || "",
          image: null,
          printer_type: user.printer_type || "normal",
          private_code: "",
          private_code_confirmation: "",
        });

        dispatch(
          updateUserInfo({
            name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
            email: user.email || "",
            profile_image_path: profileImage ? withCacheBust(profileImage) : "",
            printer_type: user.printer_type || "normal",
            role_name: user.role_name || user.roles?.name || undefined,
          })
        );

        if (profileImage) {
          setPreviewError("");
          setPreview(withCacheBust(profileImage));
        }
      } catch (err) {
        console.error("Failed to load profile data", err);
        toast.error("Failed to load profile data");
      } finally {
        setInitialLoading(false);
      }
    };

    if (accessToken) {
      fetchData();
    }
  }, [accessToken]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") {
      const file = files?.[0];
      if (file) {
        if (!supportedImageTypes.includes(file.type)) {
          const message = "Only JPG, PNG, GIF, and WEBP images are supported.";
          setPreviewError(message);
          setErrors([message]);
          toast.error(message);
          e.target.value = "";
          return;
        }

        setForm((prev) => ({ ...prev, image: file }));
        setPreviewError("");
        setPreview(URL.createObjectURL(file));
      }
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value || "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);

    if (form.private_code && form.private_code !== form.private_code_confirmation) {
      const message = "Private code and confirm private code do not match.";
      setErrors([message]);
      toast.error(message);
      return;
    }

    setSubmitting(true);

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== null && value !== "") {
        data.append(key, value);
      }
    });

    try {
      const response = await updateProfile(accessToken, data);
      if (response?.status) {
        const refreshed = await getAdminData(accessToken);
        const latestUser = refreshed?.data?.user || {};

        const profileImage = latestUser.profile_image_path || latestUser.profile_image || null;

        dispatch(
          updateUserInfo({
            name: `${latestUser.first_name || form.first_name} ${latestUser.last_name || form.last_name}`.trim(),
            email: latestUser.email || form.email,
            profile_image_path: profileImage ? withCacheBust(profileImage) : "",
            printer_type: latestUser.printer_type || form.printer_type,
            role_name: latestUser.role_name || latestUser.roles?.name || undefined,
          })
        );

        if (profileImage) {
          setPreviewError("");
          setPreview(withCacheBust(profileImage));
        }

        setForm((prev) => ({
          ...prev,
          private_code: "",
          private_code_confirmation: "",
        }));

        toast.success(response?.message || "Profile updated successfully");
      } else {
        const message = response?.message || "Update failed";
        setErrors([message]);
        toast.error(message);
      }
    } catch (err) {
      const apiErrors = err?.response?.data?.errors;
      const message =
        (Array.isArray(apiErrors) && apiErrors[0]) ||
        err?.response?.data?.message ||
        "Update failed due to an error";
      setErrors(Array.isArray(apiErrors) ? apiErrors : [message]);
      toast.error(message);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value || "" }));
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    try {
      setPasswordSubmitting(true);
      const api = axiosInstance(accessToken);
      const response = await api.post("/change/password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        new_password_confirmation: passwordForm.confirm_password,
      });

      if (response?.data?.status) {
        toast.success(response?.data?.message || "Password updated successfully");
        setPasswordForm({
          current_password: "",
          new_password: "",
          confirm_password: "",
        });
      } else {
        toast.error(response?.data?.message || "Failed to update password");
      }
    } catch (err) {
      const apiErrors = err?.response?.data?.errors;
      const message =
        (Array.isArray(apiErrors) && apiErrors[0]) ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update password";
      toast.error(message);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  if (initialLoading) {
    return <Spiner />;
  }

  const renderVisibilityInput = ({ label, name, value, onChange, placeholder, required = false }) => (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={passwordVisibility[name] ? "text" : "password"}
          name={name}
          className={`input input-bordered w-full ${value ? "pr-12" : ""}`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
        {value ? (
          <button
            type="button"
            className="absolute inset-y-0 right-3 my-auto text-slate-500 hover:text-slate-700"
            onClick={() => togglePasswordVisibility(name)}
            aria-label={passwordVisibility[name] ? `Hide ${label}` : `Show ${label}`}
          >
            {passwordVisibility[name] ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 lg:px-8 py-5 border-b border-slate-100">
          <h2 className="text-2xl font-bold text-slate-900">Profile Settings</h2>
          <p className="text-sm text-slate-600 mt-1">
            {isBackofficeProfile
              ? "Update your backoffice account information and password."
              : "Update your personal information, printer preference, and private code."}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={`btn btn-sm ${activeTab === "profile" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setActiveTab("profile")}
            >
              Profile Info
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === "password" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setActiveTab("password")}
            >
              Password Update
            </button>
          </div>
        </div>

        <div className="p-5 lg:p-8">
          {errors.length > 0 && (
            <div className="alert alert-error mb-4">
              <ul className="list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "profile" ? (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-800 mb-3">Profile Image</p>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full h-40 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                    {preview && !previewError ? (
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onLoad={() => setPreviewError("")}
                        onError={() => {
                          setPreviewError("Image preview could not be loaded. Please use a JPG, PNG, GIF, or WEBP image.");
                        }}
                      />
                    ) : (
                      <span className="text-slate-400 text-sm">
                        {previewError || "No Image"}
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    name="image"
                    accept=".jpg,.jpeg,.png,.gif,.webp"
                    className="file-input file-input-bordered w-full"
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    className="input input-bordered w-full"
                    value={form.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label className="label">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    className="input input-bordered w-full"
                    value={form.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    name="email"
                    className="input input-bordered w-full"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label className="label">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    className="input input-bordered w-full"
                    value={form.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {!isBackofficeProfile && (
                <>
                  <div>
                    <label className="label">Default Printer Type</label>
                    <select
                      name="printer_type"
                      className="select select-bordered w-full"
                      value={form.printer_type}
                      onChange={handleChange}
                    >
                      <option value="normal">Normal Printer</option>
                      <option value="pos">POS Printer (TSP100III)</option>
                    </select>
                    <label className="label">
                      <span className="label-text-alt">Select your preferred printer type for sales receipts</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      {renderVisibilityInput({
                        label: "Private Code",
                        name: "private_code",
                        value: form.private_code,
                        onChange: handleChange,
                        placeholder: "Enter new private code (optional)",
                      })}
                      <label className="label">
                        <span className="label-text-alt">
                          Minimum 4 characters. Leave empty if unchanged.
                        </span>
                      </label>
                    </div>

                    {renderVisibilityInput({
                      label: "Confirm Private Code",
                      name: "private_code_confirmation",
                      value: form.private_code_confirmation,
                      onChange: handleChange,
                      placeholder: "Re-enter private code",
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-3 pt-2">
              <button
                type="submit"
                className="btn btn-primary w-full md:w-auto min-w-44"
                disabled={submitting}
              >
                {submitting ? "Updating..." : "Update Profile"}
              </button>
            </div>
          </form>
          ) : (
            <div className="w-full">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderVisibilityInput({
                    label: "Current Password",
                    name: "current_password",
                    value: passwordForm.current_password,
                    onChange: handlePasswordChange,
                    required: true,
                  })}

                  {renderVisibilityInput({
                    label: "New Password",
                    name: "new_password",
                    value: passwordForm.new_password,
                    onChange: handlePasswordChange,
                    required: true,
                  })}
                </div>

                {renderVisibilityInput({
                  label: "Confirm New Password",
                  name: "confirm_password",
                  value: passwordForm.confirm_password,
                  onChange: handlePasswordChange,
                  required: true,
                })}

                <button
                  type="submit"
                  className="btn btn-primary min-w-44"
                  disabled={passwordSubmitting}
                >
                  {passwordSubmitting ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
