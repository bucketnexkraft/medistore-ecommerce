import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { getBackofficeFeaturePreferenceOptions } from "../../../api/backoffice/company";

export default function FeaturePreferences() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBackofficeFeaturePreferenceOptions(accessToken);
      setPreferences(result?.data || []);
    } catch (error) {
      toast.error(error.message || "Failed to load feature preference options");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold">Feature Preference</h2>
        <p className="text-sm text-gray-600 mt-1">
          These are the hardcoded feature preference options available for company assignment.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        {loading ? (
          <div className="py-8 text-center">Loading feature preferences...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {preferences.map((preference) => (
              <div
                key={preference.code}
                className="rounded-lg border border-base-200 p-4"
              >
                <div className="font-semibold">{preference.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {preference.description}
                </div>
                <div className="text-xs text-gray-400 mt-3">
                  Code: {preference.code}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
