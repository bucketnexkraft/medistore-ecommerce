import React, { useState, useEffect } from "react";
import { PiX } from "react-icons/pi";

const RightAddEditModal = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [name, setName] = useState("");
  const [module, setModule] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || "");
        setModule(initialData.module || "");
      }
      document.getElementById("right_add_edit_modal").showModal();
    } else {
      document.getElementById("right_add_edit_modal").close();
      setName("");
      setModule("");
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    const success = onSubmit({ name, module });
    if (success) {
      setName("");
      setModule("");
      onClose();
      setLoading(false);
    } else {
      setLoading(false);
    }
  };

  return (
    <dialog id="right_add_edit_modal" className="modal">
      <div className="modal-box w-11/12 max-w-md flex flex-col p-0">
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {initialData ? "Edit Right" : "Add Right"}
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-circle"
              onClick={onClose}
            >
              <PiX size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Right Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter right name (e.g., product.view)"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Module</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full text-sm"
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="Enter module name (e.g., product)"
              />
            </div>
          </form>
        </div>

        <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4 mt-3">
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary !m-0"
              onClick={handleSubmit}
            >
              {loading ? "Saving..." : initialData ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default RightAddEditModal;
