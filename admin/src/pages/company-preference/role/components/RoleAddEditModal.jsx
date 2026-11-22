import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchRoleList } from "../../../../slice/roleRightSlice";
import { closeModal } from "../../../../hooks/modalConfig";

const RoleAddEditModal = ({ onSubmit, initialData }) => {
  const normalizeRightId = (id) => String(id);
  const [role, setRole] = useState("");
  const [selectedRights, setSelectedRights] = useState([]);
  const dispatch = useDispatch();
  const { rights } = useSelector((state) => state.roleright);
  const [loading, setLoading] = useState(false);
  const areAllRightsSelected =
    rights.length > 0 &&
    rights.every((right) => selectedRights.includes(normalizeRightId(right.id)));

  useEffect(() => {
    dispatch(fetchRoleList());
    if (initialData) {
      setRole(initialData.name || "");
      setSelectedRights((initialData.rights || []).map(normalizeRightId));
    } else {
      setRole("");
      setSelectedRights([]);
    }
  }, [initialData, dispatch]);

  const handleRightToggle = (rightId) => {
    const normalizedRightId = normalizeRightId(rightId);

    setSelectedRights((prev) =>
      prev.includes(normalizedRightId)
        ? prev.filter((id) => id !== normalizedRightId)
        : [...prev, normalizedRightId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await onSubmit({ name: role, rights: selectedRights });
    if (success) {
      setRole("");
      setSelectedRights([]);
      closeModal("role-add-edit-modal");
    }
    setLoading(false);
  };

  const handleSelectAll = () => {
    if (areAllRightsSelected) {
      setSelectedRights([]);
    } else {
      setSelectedRights(rights.map((right) => normalizeRightId(right.id)));
    }
  };

  const groupedRights = rights.reduce((acc, right) => {
    if (!acc[right.module]) acc[right.module] = [];
    acc[right.module].push(right);
    return acc;
  }, {});

  const toggleModuleRights = (module) => {
    const moduleRights = groupedRights[module].map((r) => normalizeRightId(r.id));
    const allSelected = moduleRights.every((id) => selectedRights.includes(id));

    if (allSelected) {
      setSelectedRights(
        selectedRights.filter((id) => !moduleRights.includes(id))
      );
    } else {
      setSelectedRights([...new Set([...selectedRights, ...moduleRights])]);
    }
  };

  return (
    <dialog id="role-add-edit-modal" className="modal">
      <div className="modal-box w-11/12 max-w-4xl p-0">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-20">
            x
          </button>
        </form>

        <div className="px-6 pt-5 pb-4 border-b bg-base-100 sticky top-0 z-10">
          <h3 className="font-bold text-xl">
            {initialData ? "Edit Role" : "Add Role"}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[78vh] overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Role Name</span>
              </label>
              <input
                type="text"
                id="role"
                className="input input-bordered w-full"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <div className="flex items-center justify-between mb-2">
                <span className="label-text font-medium">Rights</span>
                <label className="label cursor-pointer gap-2 p-0">
                  <span className="label-text">Select All</span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm"
                    checked={areAllRightsSelected}
                    onChange={handleSelectAll}
                  />
                </label>
              </div>

              <div className="space-y-3">
                {Object.entries(groupedRights).map(([moduleName, moduleRights]) => {
                  const allSelected = moduleRights.every((r) =>
                    selectedRights.includes(normalizeRightId(r.id))
                  );

                  return (
                    <div
                      key={moduleName}
                      className="border border-base-200 rounded-lg p-3 bg-base-100"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <label className="label cursor-pointer p-0">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary checkbox-sm"
                            checked={allSelected}
                            onChange={() => toggleModuleRights(moduleName)}
                          />
                        </label>
                        <h5 className="capitalize text-sm font-semibold">
                          {moduleName} Module
                        </h5>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {moduleRights.map((right) => (
                          <label
                            key={right.id}
                            className="label cursor-pointer gap-2 justify-start rounded-md px-2 py-1 hover:bg-base-200"
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary checkbox-sm"
                              checked={selectedRights.includes(normalizeRightId(right.id))}
                              onChange={() => handleRightToggle(right.id)}
                            />
                            <span className="label-text break-all">{right.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 border-t bg-base-100 px-6 py-4">
            <div className="flex justify-end">
              <button
                type="submit"
                className="btn btn-primary min-w-36"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : initialData
                  ? "Update Role"
                  : "Add Role"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
};

export default RoleAddEditModal;
