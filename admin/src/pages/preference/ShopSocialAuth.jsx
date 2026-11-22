import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { PiArrowLeft, PiEye, PiEyeSlash } from "react-icons/pi";
import { getPreference } from "../../api/preference";
import { updateCompanyPreference } from "../../api/companyPreferances";

export default function ShopSocialAuth() {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);

  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [socialAuthEnabled, setSocialAuthEnabled] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSocialAuth = async () => {
      if (!accessToken || !companyId) return;

      try {
        const response = await getPreference(companyId, accessToken);
        const preferences = Array.isArray(response?.data) ? response.data : [];

        const readValue = (key) => {
          const item = preferences.find((entry) => entry?.key === key);
          return typeof item?.value === "string" ? item.value : item?.value || "";
        };
        const readBoolean = (key) => {
          const value = readValue(key);
          return value === true || value === 1 || value === "1" || value === "true";
        };

        setGoogleClientId(String(readValue("google_client_id") || ""));
        setGoogleClientSecret(String(readValue("google_client_secret") || ""));
        setSocialAuthEnabled(readBoolean("social_auth_enabled"));
      } catch (error) {
        console.error("Failed to load social authentication preferences", error);
        toast.error("Failed to load social authentication settings");
      }
    };

    loadSocialAuth();
  }, [accessToken, companyId]);

  const saveSocialAuth = async () => {
    try {
      setIsSaving(true);

      const formData = new FormData();
      formData.append("social_auth_enabled", socialAuthEnabled ? "1" : "0");
      formData.append("google_client_id", googleClientId);
      formData.append("google_client_secret", googleClientSecret);

      await updateCompanyPreference(accessToken, formData);

      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Social authentication settings updated successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update social authentication settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={() => navigate("/company-preference/shop-setup")}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <PiArrowLeft size={18} />
            Back
          </button>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">Social Authentication</h1>
          <p className="mt-2 text-sm text-slate-500">
            Configure Google sign-in credentials for this company.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4">
            <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <span className="block text-sm font-medium text-slate-700">Enable social authentication</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Turn this on to allow Google sign-in for the storefront.
                </span>
              </div>
              <input
                type="checkbox"
                checked={socialAuthEnabled}
                onChange={(e) => setSocialAuthEnabled(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Google Client ID</span>
              <input
                type="text"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder="Paste Google Client ID"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Google Client Secret</span>
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-primary">
                <input
                  type={isSecretVisible ? "text" : "password"}
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  placeholder="Paste Google Client Secret"
                  className="h-11 w-full border-0 bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsSecretVisible((prev) => !prev)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  {isSecretVisible ? <PiEyeSlash size={18} /> : <PiEye size={18} />}
                </button>
              </div>
            </label>

            <p className="text-sm text-slate-500">
              Use the exact Google OAuth callback URL configured in Google Cloud Console.
            </p>

            <button
              type="button"
              onClick={saveSocialAuth}
              disabled={isSaving}
              className="block h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
