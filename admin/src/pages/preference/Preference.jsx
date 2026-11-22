import React, { useEffect, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useForm } from "react-hook-form";
import { getPreference, updatePreference } from "../../api/preference";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import DividedInputLoader from './../../components/loadings/DividedInputLoader';
import { hasPermission } from './../../utils/permissions';

const Preference = () => {
  const [loading, setLoading] = useState(true);

  // Preview images
  const [previews, setPreviews] = useState({
    site_logo: "",
    site_favicon: "",
  });

  // File inputs
  const [siteLogoFile, setSiteLogoFile] = useState("");
  const [siteFaviconFile, setSiteFaviconFile] = useState("");

  const accessToken = useSelector((state) => state.auth.accessToken);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm();

  // Fetch preferences
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getPreference(null, accessToken);
        const data = response.data;

        const imagePreviews = {};

        data.forEach(({ key, value }) => {
          setValue(key, value);
          if (["site_logo", "site_favicon"].includes(key)) {
            imagePreviews[key] = value;
          }
        });

        setPreviews((prev) => ({
          ...prev,
          ...imagePreviews,
        }));
      } catch (err) {
        console.error("Failed to load preference data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [setValue]);

  // Separate file input handlers
  const handleSiteLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSiteLogoFile(file);
      setPreviews((prev) => ({
        ...prev,
        site_logo: URL.createObjectURL(file),
      }));
    }
  };

  const handleSiteFaviconChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSiteFaviconFile(file);
      setPreviews((prev) => ({
        ...prev,
        site_favicon: URL.createObjectURL(file),
      }));
    }
  };

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();

      // Remove keys that shouldn't go in as string values
      delete data.site_logo;
      delete data.site_favicon;

      // Add all other fields
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value ?? "");
      });

      // Append file inputs manually
      if (siteLogoFile instanceof File) {
        formData.append("site_logo", siteLogoFile, siteLogoFile.name);
      }
      if (siteFaviconFile instanceof File) {
        formData.append("site_favicon", siteFaviconFile, siteFaviconFile.name);
      }

      const response = await updatePreference(accessToken, formData);

      if (response?.status) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Preferences updated successfully",
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: response?.message || "Preferences updated successfully",
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
        });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "An error occurred", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
      });
    }
  };

  return (
    <>
      {loading ? (
        <DividedInputLoader />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="w-full rounded-xl">
          <h2 className="text-2xl font-bold mb-6">Application Settings</h2>
          <div className="grid grid-cols-12 gap-4">
            {[
              { name: "application_name", label: "Application Name" },
              { name: "application_phone", label: "Application Phone" },
              {
                name: "application_email",
                label: "Application Email",
                type: "email",
              },
              { name: "application_fax", label: "Application Fax" },
              { name: "application_address", label: "Application Address" },
              { name: "facebook_link", label: "Facebook Link" },
              { name: "twitter_link", label: "Twitter Link" },
              { name: "instagram_link", label: "Instagram Link" },
              { name: "linkedin_link", label: "LinkedIn Link" },
              { name: "youtube_link", label: "YouTube Link" },
            ].map(({ name, label, type = "text" }) => (
              <div key={name} className="col-span-12 md:col-span-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">{label}</span>
                  </label>
                  <input
                    type={type}
                    className="input input-bordered w-full"
                    {...register(name, { required: `${label} is required` })}
                  />
                  {errors[name] && (
                    <p className="text-red-500 text-sm">
                      {errors[name].message}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Rich Text Editors */}
            {[
              { name: "about_us", label: "About Us" },
              { name: "terms_and_conditions", label: "Terms and Conditions" },
              { name: "privacy_policy", label: "Privacy Policy" },
              { name: "return_policy", label: "Return Policy" },
            ].map(({ name, label }) => (
              <div key={name} className="col-span-12">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">{label}</span>
                  </label>
                  <ReactQuill
                    theme="snow"
                    value={getValues(name) || ""}
                    onChange={(value) => setValue(name, value)}
                    className="bg-white rounded-md"
                  />
                </div>
              </div>
            ))}

            {/* Site Logo */}
            <div className="col-span-12 md:col-span-6">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Site Logo</span>
                </label>
                <input
                  type="file"
                  name="site_logo"
                  onChange={handleSiteLogoChange}
                  accept="image/*"
                  className="file-input file-input-bordered w-full"
                />
                {previews.site_logo && (
                  <img
                    src={previews.site_logo}
                    alt="Site Logo Preview"
                    className="mt-2 h-24 w-auto rounded-md object-contain border"
                  />
                )}
              </div>
            </div>

            {/* Site Favicon */}
            <div className="col-span-12 md:col-span-6">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Site Favicon</span>
                </label>
                <input
                  type="file"
                  name="site_favicon"
                  onChange={handleSiteFaviconChange}
                  accept="image/*"
                  className="file-input file-input-bordered w-full"
                />
                {previews.site_favicon && (
                  <img
                    src={previews.site_favicon}
                    alt="Site Favicon Preview"
                    className="mt-2 h-24 w-auto rounded-md object-contain border"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button type="submit" className="btn btn-primary w-full md:w-auto">
              Save Settings
            </button>
          </div>
        </form>
      )}
    </>
  );
};

export default Preference;
