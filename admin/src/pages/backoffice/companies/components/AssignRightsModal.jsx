import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { closeModal } from "../../../../hooks/modalConfig";
import {
  getCompanyRights,
  updateCompanyRights,
} from "../../../../api/backoffice/company";

export default function AssignRightsModal({ accessToken, company, onSaved }) {
  const normalizeRightId = (id) => String(id);
  const [rights, setRights] = useState([]);
  const [selectedRights, setSelectedRights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadRights = async () => {
      if (!company?.company_id || !accessToken) return;

      setLoading(true);
      try {
        const result = await getCompanyRights(accessToken, company.company_id);
        const allRights = result?.data?.rights || [];
        const assigned = (result?.data?.assigned_right_ids || []).map((id) =>
          normalizeRightId(id)
        );

        setRights(allRights);
        setSelectedRights(assigned);
      } catch (error) {
        toast.error(
          error?.response?.data?.message ||
            error.message ||
            "Failed to fetch company rights"
        );
      } finally {
        setLoading(false);
      }
    };

    loadRights();
  }, [accessToken, company]);

  const groupedRights = useMemo(() => {
    return rights.reduce((acc, right) => {
      const moduleName = right.module || "other";
      if (!acc[moduleName]) acc[moduleName] = [];
      acc[moduleName].push(right);
      return acc;
    }, {});
  }, [rights]);

  const handleToggleRight = (rightId) => {
    const normalizedRightId = normalizeRightId(rightId);

    setSelectedRights((prev) =>
      prev.includes(normalizedRightId)
        ? prev.filter((id) => id !== normalizedRightId)
        : [...prev, normalizedRightId]
    );
  };

  const handleToggleAll = () => {
    const allSelected =
      rights.length > 0 &&
      rights.every((right) => selectedRights.includes(normalizeRightId(right.id)));

    if (allSelected) {
      setSelectedRights([]);
      return;
    }

    setSelectedRights(rights.map((right) => normalizeRightId(right.id)));
  };

  const handleToggleModule = (moduleName) => {
    const moduleRightIds = (groupedRights[moduleName] || []).map((r) =>
      normalizeRightId(r.id)
    );
    const allSelected = moduleRightIds.every((id) => selectedRights.includes(id));

    if (allSelected) {
      setSelectedRights((prev) => prev.filter((id) => !moduleRightIds.includes(id)));
      return;
    }

    setSelectedRights((prev) => [...new Set([...prev, ...moduleRightIds])]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company?.company_id) return;

    setSubmitting(true);
    try {
      await updateCompanyRights(accessToken, company.company_id, selectedRights);
      toast.success("Company rights updated successfully");
      closeModal("company-assign-rights-modal");
      if (typeof onSaved === "function") {
        onSaved();
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          "Failed to update company rights"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog id="company-assign-rights-modal" className="modal">
      <div className="modal-box w-full max-w-3xl">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </form>
        <h3 className="font-bold text-lg">
          Assign Rights {company?.name ? `- ${company.name}` : ""}
        </h3>

        {loading ? (
          <div className="py-8 text-center">Loading rights...</div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Rights</p>
              <label className="label cursor-pointer gap-2">
                <span className="label-text">Select All</span>
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={
                    rights.length > 0 &&
                    rights.every((right) =>
                      selectedRights.includes(normalizeRightId(right.id))
                    )
                  }
                  onChange={handleToggleAll}
                />
              </label>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(groupedRights).map(([moduleName, moduleRights]) => {
                const allSelected = moduleRights.every((r) =>
                  selectedRights.includes(normalizeRightId(r.id))
                );

                return (
                  <div
                    key={moduleName}
                    className="mb-3 border border-base-200 rounded-md p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={allSelected}
                        onChange={() => handleToggleModule(moduleName)}
                      />
                      <p className="text-sm font-semibold capitalize">
                        {moduleName} Module
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {moduleRights.map((right) => (
                        <label
                          key={right.id}
                          className="label cursor-pointer justify-start gap-2"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary checkbox-sm"
                            checked={selectedRights.includes(normalizeRightId(right.id))}
                            onChange={() => handleToggleRight(right.id)}
                          />
                          <span className="label-text">{right.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-action">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Rights"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

