import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { getPreference } from "../../api/preference";
import { useDispatch, useSelector } from "react-redux";
import { fetchPreferences } from "../../slice/preferencesSlice";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import DividedInputLoader from "./../../components/loadings/DividedInputLoader";
// Import React Icons (Heroicons v2)
import {
  HiArrowPath,
  HiCheckCircle,
  HiCloudArrowUp,
  HiEnvelope,
  HiInformationCircle,
  HiLink,
  HiMapPin,
  HiPhone,
  HiShare,
  HiPhoto,
  HiBuildingOffice,
} from "react-icons/hi2";
import {
  getCurrency,
  updateCompanyPreference,
} from "../../api/companyPreferances";
import { getPublicLanguages } from "../../api/backoffice/languages";
import { hasPermission } from "../../utils/permissions";
import { getCompany, updateCompanyInfo } from "../../api/backoffice/company";

const normalizePreferenceValue = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

// Define field groups for better structure and reusability
const basicFields = [
  {
    name: "application_name",
    label: "Business Display Name",
    placeholder: "NexStock Retail",
    help: "Shown on invoices, receipts, emails, and customer-facing pages.",
    type: "text",
    required: true,
  },
  {
    name: "application_phone",
    label: "Support Phone",
    placeholder: "+1 555 010 2030",
    help: "Primary number customers and staff can use for support.",
    type: "text",
    required: true,
  },
  {
    name: "application_email",
    label: "Support Email",
    placeholder: "support@example.com",
    help: "Used for customer communication and system notifications.",
    type: "email",
    required: true,
  },
  {
    name: "application_fax",
    label: "Fax Number",
    placeholder: "Optional fax number",
    help: "Keep this empty if your business does not use fax.",
    type: "text",
    required: false,
  },
  {
    name: "application_address",
    label: "Business Address",
    placeholder: "Street, city, state, postal code, country",
    help: "Printed on receipts, quotations, and official documents.",
    type: "text",
    required: false,
  },
  {
    name: "currency",
    label: "Default Currency",
    placeholder: "Select the operating currency",
    help: "Controls the currency used across pricing, invoices, and reports.",
    type: "text",
    required: true,
  }, // This will be overridden to select
  {
    name: "default_language",
    label: "Default Language",
    placeholder: "Select the default language",
    help: "Controls the default language used by your storefront and translations.",
    type: "text",
    required: true,
  }, // This will be overridden to select
  {
    name: "allow_guest_checkout",
    label: "Allow Guest Checkout",
    help: "If enabled, customers can place ecommerce orders without signing in first.",
    type: "toggle",
    required: false,
  },
  {
    name: "stock_tracking_enabled",
    label: "Enable Stock Tracking",
    help: "If disabled, you can add products and sell them without using Stock In.",
    type: "toggle",
    required: false,
  },
];

const socialFields = [
  {
    name: "facebook_link",
    label: "Facebook Page URL",
    placeholder: "https://facebook.com/your-business",
    type: "url",
    required: false,
  },
  { name: "twitter_link", label: "X / Twitter URL", placeholder: "https://x.com/your-business", type: "url", required: false },
  {
    name: "instagram_link",
    label: "Instagram Profile URL",
    placeholder: "https://instagram.com/your-business",
    type: "url",
    required: false,
  },
  {
    name: "linkedin_link",
    label: "LinkedIn Company URL",
    placeholder: "https://linkedin.com/company/your-business",
    type: "url",
    required: false,
  },
  { name: "youtube_link", label: "YouTube Channel URL", placeholder: "https://youtube.com/@your-business", type: "url", required: false },
];

const imageFields = [
  { name: "site_logo", label: "Primary Logo", help: "Use a clear PNG or JPG logo for headers, receipts, and customer pages." },
  { name: "site_favicon", label: "Browser Favicon", help: "Upload a square icon that represents your brand in browser tabs." },
];

const toggleFieldNames = new Set(["push_status", "allow_guest_checkout", "stock_tracking_enabled"]);

const realtimeFields = [
  {
    name: "push_status",
    label: "Enable Realtime Chat",
    help: "Turn on private broadcast chat for this company storefront and group purchase rooms.",
    type: "toggle",
    required: false,
  },
  {
    name: "pusher_app_key",
    label: "Pusher App Key",
    placeholder: "Public realtime key",
    help: "Used by the storefront to connect to this company's realtime channel.",
    type: "text",
    required: false,
  },
  {
    name: "pusher_app_cluster",
    label: "Pusher Cluster",
    placeholder: "mt1",
    help: "Example: mt1, ap1, eu, ap2.",
    type: "text",
    required: false,
  },
  {
    name: "pusher_app_id",
    label: "Pusher App ID",
    placeholder: "Internal app id",
    help: "Used only by the backend broadcaster for this company.",
    type: "text",
    required: false,
  },
  {
    name: "pusher_app_secret",
    label: "Pusher App Secret",
    placeholder: "Secret key",
    help: "Keep this secret. It is stored per company and never exposed publicly.",
    type: "password",
    required: false,
  },
];

// Company information fields
const companyFields = [
  {
    name: "name",
    label: "Company Name",
    placeholder: "Registered company name",
    type: "text",
    required: true,
  },
  {
    name: "contact_name",
    label: "Primary Contact",
    placeholder: "Person responsible for this account",
    type: "text",
    required: true,
  },
  {
    name: "phone_number",
    label: "Phone Number",
    placeholder: "+1 555 010 2030",
    type: "text",
    required: true,
  },
  {
    name: "department",
    label: "Department",
    placeholder: "Finance, Operations, Head Office",
    type: "text",
    required: false,
  },
  {
    name: "vat_no",
    label: "VAT Number",
    placeholder: "VAT registration number",
    type: "text",
    required: false,
  },
  {
    name: "reg_number",
    label: "Registration Number",
    placeholder: "Business registration number",
    type: "text",
    required: false,
  },
  {
    name: "tin_number",
    label: "TIN Number",
    placeholder: "Tax identification number",
    type: "text",
    required: false,
  },
  {
    name: "bin_number",
    label: "BIN Number",
    placeholder: "Business identification number",
    type: "text",
    required: false,
  },
  {
    name: "email",
    label: "Company Email",
    placeholder: "accounts@example.com",
    type: "email",
    required: true,
  },
  {
    name: "website_url",
    label: "Website URL",
    placeholder: "https://example.com",
    type: "url",
    required: false,
  },
  {
    name: "domain",
    label: "Company Domain",
    placeholder: "shop.example.com",
    type: "text",
    required: false,
  },
  {
    name: "address",
    label: "Address",
    placeholder: "Registered business address",
    type: "textarea",
    required: false,
  },
  {
    name: "post_code",
    label: "Post Code",
    placeholder: "Postal or ZIP code",
    type: "text",
    required: false,
  },
  {
    name: "city",
    label: "City",
    placeholder: "City",
    type: "text",
    required: false,
  },
  {
    name: "state",
    label: "State/Province",
    placeholder: "State or province",
    type: "text",
    required: false,
  },
  {
    name: "country",
    label: "Country",
    placeholder: "Country",
    type: "text",
    required: false,
  },
];

const tabs = [
  {
    id: "basic",
    title: "Business Profile",
    description: "Set the identity and default contact details used across your store.",
    icon: HiInformationCircle,
    fields: basicFields,
    type: "input",
    accent: "from-blue-500 to-cyan-500",
  },
  {
    id: "company",
    title: "Legal Company",
    description: "Keep registration, tax, and official company details accurate.",
    icon: HiBuildingOffice,
    fields: companyFields,
    type: "company",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    id: "social",
    title: "Social Channels",
    description: "Connect customers to the places where your brand is active.",
    icon: HiShare,
    fields: socialFields,
    type: "input",
    accent: "from-fuchsia-500 to-pink-500",
  },
  {
    id: "branding",
    title: "Branding Assets",
    description: "Upload the visual assets that make receipts, tabs, and pages feel branded.",
    icon: HiPhoto,
    fields: imageFields,
    type: "image",
    accent: "from-violet-500 to-indigo-500",
  },
  {
    id: "realtime",
    title: "Realtime Chat",
    description: "Configure the company-specific broadcast credentials used by group purchase chat.",
    icon: HiShare,
    fields: realtimeFields,
    type: "input",
    accent: "from-amber-500 to-orange-500",
  },
];

const fieldIcons = {
  application_phone: HiPhone,
  phone_number: HiPhone,
  application_email: HiEnvelope,
  email: HiEnvelope,
  application_address: HiMapPin,
  address: HiMapPin,
  website_url: HiLink,
  domain: HiLink,
  facebook_link: HiLink,
  twitter_link: HiLink,
  instagram_link: HiLink,
  linkedin_link: HiLink,
  youtube_link: HiLink,
};

const inputClassName =
  "h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const selectClassName =
  "h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const textareaClassName =
  "min-h-28 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const renderFieldShell = (field, children, wide = false) => {
  const Icon = fieldIcons[field.name] || HiCheckCircle;

  return (
    <div key={field.name} className={wide ? "col-span-12" : "col-span-12 lg:col-span-6"}>
      <div className="group h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 transition-all duration-200 focus-within:border-blue-300 focus-within:shadow-md focus-within:shadow-blue-100/70">
        <label className="mb-2 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-focus-within:bg-blue-50 group-focus-within:text-blue-600">
              <Icon className="size-4" />
            </span>
            <span className="truncate">{field.label}</span>
          </span>
          {field.required && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-blue-700">
              Required
            </span>
          )}
        </label>
        {children}
        {field.help && <p className="mt-2 text-xs leading-5 text-slate-500">{field.help}</p>}
      </div>
    </div>
  );
};

const GeneralPreference = ({ companyId }) => {
  // Added companyId prop for SaaS multi-tenancy
  const [loading, setLoading] = useState(true);
  const [previews, setPreviews] = useState({});
  const [files, setFiles] = useState({});
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [currencies, setCurrencies] = useState([]); // New state for currencies
  const [languages, setLanguages] = useState([]);
  const [companyLoading, setCompanyLoading] = useState(false); // Company loading state

  const accessToken = useSelector((state) => state.auth.accessToken);
  const company_id = useSelector((state) => state.auth.company_id);
  const dispatch = useDispatch();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm();

  // Fetch preferences (pass companyId to API for per-company data)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getPreference(company_id, accessToken); // Modified API call to support companyId
        const data = response.data;

        const imagePreviews = {};

        data.forEach(({ key, value }) => {
          const normalizedValue = normalizePreferenceValue(value);

          if (key === "currency" && typeof normalizedValue === "object" && normalizedValue !== null) {
            setValue(key, normalizedValue.id);
          } else if (key === "push_status") {
            setValue(key, Boolean(normalizedValue));
          } else if (key === "allow_guest_checkout") {
            setValue(key, Boolean(normalizedValue));
          } else if (key === "stock_tracking_enabled") {
            setValue(key, normalizedValue !== false && normalizedValue !== 0 && normalizedValue !== "0" && normalizedValue !== "false");
          } else {
            setValue(key, normalizedValue);
          }

          if (imageFields.some((field) => field.name === key)) {
            imagePreviews[key] = normalizedValue;
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
  }, [setValue, company_id]);

  // Fetch currencies
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const response = await getCurrency(accessToken);
        // Assuming response.data is { status: true, data: [{ id: 1, code: 'USD', name: 'US Dollar' }, ...] }
        // Adjust if your API returns a different structure (e.g., flat array: setCurrencies(response.data))
        setCurrencies(response.data.data || response.data || []);
      } catch (err) {
        console.error("Failed to load currencies", err);
        toast.error("Failed to load currency list. Please try again.");
      }
    };
    if (accessToken) {
      fetchCurrencies();
    }
  }, [accessToken]);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await getPublicLanguages();
        setLanguages(response?.data || []);
      } catch (err) {
        console.error("Failed to load languages", err);
        toast.error("Failed to load language list. Please try again.");
      }
    };

    fetchLanguages();
  }, []);

  // Fetch company data for company information tab
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!accessToken || !company_id || activeTab !== 'company') return;
      
      setCompanyLoading(true);
      try {
        const response = await getCompany(accessToken, company_id);
        
        if (response?.status && response?.data) {
          const companyData = response.data;
          
          // Set form values for company fields
          companyFields.forEach((field) => {
            const value = companyData[field.name];
            if (value !== undefined && value !== null) {
              setValue(field.name, value);
            }
          });
        }
      } catch (error) {
        console.error("Failed to fetch company data:", error);
        toast.error("Failed to load company information");
      } finally {
        setCompanyLoading(false);
      }
    };

    fetchCompanyData();
  }, [accessToken, company_id, activeTab, setValue]);

  // Generic file change handler
  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [fieldName]: file }));
      setPreviews((prev) => ({
        ...prev,
        [fieldName]: URL.createObjectURL(file),
      }));
    }
  };

  // Handle company information update
  const handleCompanyUpdate = async (data) => {
    if (!company_id) {
      toast.error("Company ID not found");
      return;
    }

    setCompanyLoading(true);
    try {
      const response = await updateCompanyInfo(accessToken, company_id, data);
      
      if (response?.status) {
        toast.success("Company information updated successfully");
      } else {
        toast.error(response?.message || "Failed to update company information");
      }
    } catch (error) {
      console.error("Company update error:", error);
      toast.error("Failed to update company information");
    } finally {
      setCompanyLoading(false);
    }
  };

  const onSubmit = async (data) => {
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    
    // Handle company information tab separately
    if (activeTab === 'company') {
      handleCompanyUpdate(data);
      return;
    }

    // Handle other tabs (preferences)
    try {
      const formData = new FormData();

      // Only submit fields from the active tab to avoid cross-tab validation issues.
        const activeFieldNames = (activeTabData?.fields || []).map((field) => field.name);

        activeFieldNames.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];

            if (toggleFieldNames.has(key)) {
              formData.append(key, value ? "1" : "0");
              return;
            }

            formData.append(key, value ?? "");
          }
        });

      // Append files
      Object.entries(files).forEach(([key, file]) => {
        if (file instanceof File) {
          formData.append(key, file, file.name);
        }
      });

      const response = await updateCompanyPreference(
        accessToken,
        formData,
        companyId
      ); // Modified API call with companyId

      if (response?.status) {
        dispatch(fetchPreferences(company_id));
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
          text: response?.message || "Failed to update preferences",
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

  const renderInput = (field) => {
    if (["currency", "default_language"].includes(field.name)) {
      return renderFieldShell(
        field,
        <>
            <Controller
              name={field.name}
              control={control}
              rules={{
                required: field.required ? `${field.label} is required` : false,
              }}
              render={({ field: controllerField }) => (
                <select
                  className={selectClassName}
                  {...controllerField}
                >
                  <option value="">{field.placeholder}</option>
                  {field.name === "currency" && currencies.length > 0 ? (
                    currencies.map((currency) => (
                      <option key={currency.id} value={currency.id}>
                        {currency.name} ({currency.code})
                      </option>
                    ))
                  ) : field.name === "default_language" && languages.length > 0 ? (
                    languages.map((language) => (
                      <option key={language.id} value={language.id}>
                        {language.name} ({String(language.code).toUpperCase()})
                      </option>
                    ))
                  ) : (
                    <option disabled>
                      No {field.name === "currency" ? "currencies" : "languages"} available
                    </option>
                  )}
                </select>
              )}
            />
            {errors[field.name] && (
              <p className="mt-2 text-sm font-medium text-red-500">
                {errors[field.name].message}
              </p>
            )}
        </>
      );
    } else if (field.type === "toggle") {
      return renderFieldShell(
        field,
        <>
          <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4">
            <span className="text-sm font-medium text-slate-700">
              {field.help || "Toggle this setting"}
            </span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              {...register(field.name)}
            />
          </label>
          {errors[field.name] && (
            <p className="mt-2 text-sm font-medium text-red-500">
              {errors[field.name].message}
            </p>
          )}
        </>
      );
    } else {
      return renderFieldShell(
        field,
        <>
            <input
              type={field.type || "text"}
              className={inputClassName}
              placeholder={field.placeholder}
              {...register(field.name, {
                required: field.required ? `${field.label} is required` : false,
              })}
            />
            {errors[field.name] && (
              <p className="mt-2 text-sm font-medium text-red-500">
                {errors[field.name].message}
              </p>
            )}
        </>
      );
    }
  };

  const renderImageInput = (field) => (
    <div key={field.name} className="col-span-12 lg:col-span-6">
      <div className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-600">
            <HiCloudArrowUp className="size-4" />
          </span>
          {field.label}
        </label>
        <input
          type="file"
          name={field.name}
          onChange={(e) => handleFileChange(e, field.name)}
          className="file-input file-input-bordered h-12 w-full rounded-lg border-slate-200 bg-white text-sm shadow-sm file-input-primary"
        />
        {field.help && <p className="mt-2 text-xs leading-5 text-slate-500">{field.help}</p>}
        {previews[field.name] && (
          <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
            <img
              src={previews[field.name]}
              alt={`${field.label} preview`}
              className="max-h-24 w-auto max-w-full rounded-md object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderCompanyField = (field) => {
    if (field.type === "textarea") {
      return renderFieldShell(
        field,
        <>
            <textarea
              className={textareaClassName}
              rows="3"
              placeholder={field.placeholder}
              {...register(field.name, {
                required: field.required ? `${field.label} is required` : false,
              })}
            />
            {errors[field.name] && (
              <p className="mt-2 text-sm font-medium text-red-500">
                {errors[field.name].message}
              </p>
            )}
        </>,
        true
      );
    } else {
      return renderFieldShell(
        field,
        <>
            <input
              type={field.type || "text"}
              className={inputClassName}
              placeholder={field.placeholder}
              {...register(field.name, {
                required: field.required ? `${field.label} is required` : false,
              })}
            />
            {errors[field.name] && (
              <p className="mt-2 text-sm font-medium text-red-500">
                {errors[field.name].message}
              </p>
            )}
        </>
      );
    }
  };

  const renderTabContent = (tab) => {
    const renderField = {
      input: renderInput,
      company: renderCompanyField,
      image: renderImageInput,
    }[tab.type];

    return (
      <div className="grid grid-cols-12 gap-4">
        {tab.fields.map(renderField)}
      </div>
    );
  };

  const activeTabData = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const ActiveIcon = activeTabData.icon;

  return (
    <>
      {loading ? (
        <DividedInputLoader />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="w-full rounded-xl bg-slate-50 p-4 text-slate-900 sm:p-5 lg:p-6">
          <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
            <div className="flex items-center gap-4 border-b border-slate-100 p-5">
              <div className="flex items-start gap-4">
                <div className={`grid size-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${activeTabData.accent} text-white shadow-lg shadow-slate-200`}>
                  <ActiveIcon className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-blue-600">General Settings</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">Company Control Center</h2>
                </div>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto p-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-left transition-all duration-200 ${
                      isActive
                        ? "border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-200"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap text-sm font-bold">{tab.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {tabs.map(
            (tab) =>
              activeTab === tab.id && (
                <section
                  key={tab.id}
                  className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/80 transition-opacity duration-300"
                >
                  <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{tab.title}</h3>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    {renderTabContent(tab)}
                  </div>
                </section>
              )
          )}

          <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-200/80 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                <HiArrowPath className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Save {activeTabData.title}
                </p>
              </div>
            </div>
            {hasPermission("general-preferences.edit") && (
              <button
                type="submit"
                className="btn min-h-12 rounded-lg border-0 bg-blue-600 px-6 text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-blue-300 sm:w-auto"
                disabled={companyLoading}
              >
                {companyLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Updating...
                  </>
                ) : activeTab === 'company' ? (
                  'Update Company Details'
                ) : (
                  'Save Changes'
                )}
              </button>
            )}
          </div>
        </form>
      )}
    </>
  );
};

export default GeneralPreference;
