import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { API_URL } from "../../../config/constants";
import { getESectionPresets } from "../../../api/backoffice/ecommerceTemplates";

const resolveImagePreviewUrl = (value) => {
  if (!value) return "";
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  ) {
    return value;
  }
  if (value.startsWith("/")) return value;
  return `${API_URL.replace(/\/api\/v\d+\/?$/, "")}/${value.replace(/^\/+/, "")}`;
};

export default function ESectionPresets() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getESectionPresets(accessToken, { perPage: 200 });
      if (!result?.status) throw new Error(result?.message || "Failed to load e-section presets");
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load e-section presets");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">E-Section Presets</h2>
          <p className="text-sm text-gray-600">
            Presets are loaded directly from the ecommerce template config. This screen is read only.
          </p>
        </div>
        <span className="badge badge-ghost badge-lg">Read only</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 overflow-x-auto">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="table">
            <thead>
              <tr className="bg-gray-100">
                <th>Preview</th>
                <th>Name</th>
                <th>Section Type</th>
                <th>Preset Style</th>
                <th>Component</th>
                <th>Categories</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    No e-section presets found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.preview_image_url ? (
                        <img
                          src={resolveImagePreviewUrl(row.preview_image_url)}
                          alt={row.name}
                          className="h-14 w-20 rounded object-cover border"
                        />
                      ) : (
                        <div className="h-14 w-20 rounded border bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                          No image
                        </div>
                      )}
                    </td>
                    <td className="font-medium">{row.name}</td>
                    <td>{row.section_type_label || row.section_type}</td>
                    <td>{row.preset_label || row.preset_key || "-"}</td>
                    <td>{row.component_key || "-"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(row.categories || []).length ? (
                          row.categories.map((item) => (
                            <span key={`${row.id}-${item.id}`} className="badge badge-outline">
                              {item.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">All / Generic</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${row.status ? "badge-success" : "badge-ghost"}`}>
                        {row.status ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
