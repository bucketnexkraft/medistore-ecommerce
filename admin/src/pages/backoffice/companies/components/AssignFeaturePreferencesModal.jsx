import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { closeModal } from "../../../../hooks/modalConfig";
import {
  getCompanyFeaturePreferences,
  syncCompanyFeaturePreferences,
} from "../../../../api/backoffice/company";

export default function AssignFeaturePreferencesModal({
  accessToken,
  company,
  onSaved,
}) {
  const [preferences, setPreferences] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!company?.company_id || !accessToken) return;

      setLoading(true);
      try {
        const result = await getCompanyFeaturePreferences(accessToken, company.company_id);
        setPreferences(result?.data || []);
        setSelectedCodes(result?.assigned_codes || []);
      } catch (error) {
        toast.error(
          error?.response?.data?.message ||
            error.message ||
            "Failed to fetch feature preferences"
        );
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [accessToken, company]);

  const allCodes = useMemo(
    () => preferences.map((preference) => preference.code),
    [preferences]
  );
  const coreCodes = useMemo(
    () => preferences.filter((preference) => preference.is_core).map((preference) => preference.code),
    [preferences]
  );

  const handleToggleCode = (code) => {
    if (coreCodes.includes(code)) return;
    setSelectedCodes((prev) =>
      prev.includes(code)
        ? prev.filter((item) => item !== code)
        : [...prev, code]
    );
  };

  const handleToggleAll = () => {
    if (selectedCodes.length === allCodes.length) {
      setSelectedCodes(coreCodes);
      return;
    }

    setSelectedCodes(allCodes);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company?.company_id) return;

    setSubmitting(true);
    try {
      await syncCompanyFeaturePreferences(
        accessToken,
        company.company_id,
        selectedCodes
      );
      toast.success("Company feature preferences updated successfully");
      closeModal("company-assign-feature-preferences-modal");
      if (typeof onSaved === "function") {
        onSaved();
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          "Failed to update feature preferences"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog id="company-assign-feature-preferences-modal" className="modal">
      <div className="modal-box w-full max-w-3xl">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </form>

        <h3 className="font-bold text-lg">
          Assign Feature Preference {company?.name ? `- ${company.name}` : ""}
        </h3>

        {loading ? (
          <div className="py-8 text-center">Loading feature preferences...</div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Available Options</p>
              <label className="label cursor-pointer gap-2">
                <span className="label-text">Select All</span>
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={
                    allCodes.length > 0 && selectedCodes.length === allCodes.length
                  }
                  onChange={handleToggleAll}
                />
              </label>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
              {preferences.map((preference) => (
                <label
                  key={preference.code}
                  className="flex items-start gap-3 rounded-lg border border-base-200 p-4 cursor-pointer hover:bg-base-200/50"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm mt-1"
                    checked={selectedCodes.includes(preference.code)}
                    disabled={preference.is_core}
                    onChange={() => handleToggleCode(preference.code)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{preference.name}</div>
                    {preference.is_core && <div className="text-xs font-semibold text-blue-700">Always on</div>}
                    <div className="text-sm text-gray-500">
                      {preference.description}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {preference.code}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="modal-action">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
