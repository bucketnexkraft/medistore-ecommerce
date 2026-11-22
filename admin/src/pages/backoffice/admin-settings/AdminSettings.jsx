import React, { useEffect, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import DividedInputLoader from "../../../components/loadings/DividedInputLoader";
import {
  getBackofficeAdminSettings,
  updateBackofficeAdminSettings,
} from "../../../api/backoffice/adminSettings";
import { fetchPreferences } from "../../../slice/preferencesSlice";

const textFields = [
  { name: "application_name", label: "Application Name", required: true },
  { name: "application_phone", label: "Application Phone", required: false },
  { name: "application_email", label: "Application Email", required: false },
  { name: "application_fax", label: "Application Fax", required: false },
  { name: "application_address", label: "Application Address", required: false },
  { name: "facebook_link", label: "Facebook Link", required: false },
  { name: "twitter_link", label: "Twitter Link", required: false },
  { name: "instagram_link", label: "Instagram Link", required: false },
  { name: "linkedin_link", label: "LinkedIn Link", required: false },
  { name: "youtube_link", label: "YouTube Link", required: false },
];

const richFields = [
  { name: "about_us", label: "About Us" },
  { name: "terms_and_conditions", label: "Terms and Conditions" },
  { name: "privacy_policy", label: "Privacy Policy" },
  { name: "return_policy", label: "Return Policy" },
];

export default function AdminSettings() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [siteLogoFile, setSiteLogoFile] = useState(null);
  const [siteFaviconFile, setSiteFaviconFile] = useState(null);
  const [previews, setPreviews] = useState({
    site_logo: "",
    site_favicon: "",
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const result = await getBackofficeAdminSettings(accessToken);
        if (!result?.status) {
          throw new Error(result?.message || "Failed to load admin settings");
        }

        const imagePreviews = {};
        (result?.data || []).forEach(({ key, value }) => {
          setValue(key, value);
          if (key === "site_logo" || key === "site_favicon") {
            imagePreviews[key] = value;
          }
        });

        setPreviews((prev) => ({ ...prev, ...imagePreviews }));
      } catch (error) {
        toast.error(error?.message || "Failed to load admin settings");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [accessToken, setValue]);

  const onSubmit = async (formValues) => {
    try {
      const formData = new FormData();

      delete formValues.site_logo;
      delete formValues.site_favicon;

      Object.entries(formValues).forEach(([key, value]) => {
        formData.append(key, value ?? "");
      });

      if (siteLogoFile instanceof File) {
        formData.append("site_logo", siteLogoFile, siteLogoFile.name);
      }
      if (siteFaviconFile instanceof File) {
        formData.append("site_favicon", siteFaviconFile, siteFaviconFile.name);
      }

      const result = await updateBackofficeAdminSettings(accessToken, formData);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to update admin settings");
      }

      await dispatch(fetchPreferences());

      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Admin settings updated successfully",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Update failed");
    }
  };

  return loading ? (
    <DividedInputLoader />
  ) : (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold">Admin Settings</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage global backoffice settings and branding from this page.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-12 gap-4">
            {textFields.map((field) => (
              <div key={field.name} className="col-span-12 md:col-span-6">
                <label className="label py-1">
                  <span className="label-text">{field.label}</span>
                </label>
                <input
                  type={field.name === "application_email" ? "email" : "text"}
                  className="input input-bordered w-full"
                  {...register(field.name, {
                    required: field.required ? `${field.label} is required` : false,
                  })}
                />
                {errors[field.name] && (
                  <p className="text-red-500 text-sm mt-1">{errors[field.name].message}</p>
                )}
              </div>
            ))}

            {richFields.map((field) => (
              <div key={field.name} className="col-span-12">
                <label className="label py-1">
                  <span className="label-text">{field.label}</span>
                </label>
                <ReactQuill
                  theme="snow"
                  value={getValues(field.name) || ""}
                  onChange={(value) => setValue(field.name, value)}
                  className="bg-white rounded-md"
                />
              </div>
            ))}

            <div className="col-span-12 md:col-span-6">
              <label className="label py-1">
                <span className="label-text">Site Logo</span>
              </label>
              <input
                type="file"
                className="file-input file-input-bordered w-full"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSiteLogoFile(file);
                    setPreviews((prev) => ({ ...prev, site_logo: URL.createObjectURL(file) }));
                  }
                }}
              />
              {previews.site_logo && (
                <img
                  src={previews.site_logo}
                  alt="Site logo preview"
                  className="mt-2 h-20 w-auto rounded border object-contain"
                />
              )}
            </div>

            <div className="col-span-12 md:col-span-6">
              <label className="label py-1">
                <span className="label-text">Site Favicon</span>
              </label>
              <input
                type="file"
                className="file-input file-input-bordered w-full"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSiteFaviconFile(file);
                    setPreviews((prev) => ({
                      ...prev,
                      site_favicon: URL.createObjectURL(file),
                    }));
                  }
                }}
              />
              {previews.site_favicon && (
                <img
                  src={previews.site_favicon}
                  alt="Site favicon preview"
                  className="mt-2 h-20 w-auto rounded border object-contain"
                />
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}

