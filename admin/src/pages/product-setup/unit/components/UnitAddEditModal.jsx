import React from "react";
import { closeModal } from "../../../../hooks/modalConfig";
import UnitForm from "./UnitForm";

const UnitAddEditModal = ({
  isEdit = false,
  editableData = null,
  onSubmit,
  errorMessage = "",
  isSuccess,
  onClearError,
  onSuccessReset,
  baseUnits = [],
}) => {
  const handleCancel = () => {
    closeModal("add_edit_unit_modal");
  };

  const errorLines = [...new Set(
    String(errorMessage || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  )];

  return (
    <dialog id="add_edit_unit_modal" className="modal">
      <div className="modal-box w-11/12 max-w-2xl max-h-[80vh] flex flex-col p-0">
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">
              {isEdit
                ? `Edit Unit - ${editableData?.unit_name || "Untitled"}`
                : "Add New Unit"}
            </h3>
            <button onClick={handleCancel} className="btn btn-sm btn-circle">
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-6">
          <UnitForm
            isEdit={isEdit}
            editableData={editableData}
            onSubmit={onSubmit}
            onCancel={handleCancel}
            showButton={false}
            isSuccess={isSuccess}
            onClearError={onClearError}
            onSuccessReset={onSuccessReset}
            baseUnits={baseUnits}
          />
        </div>

        <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-error text-sm">
              {errorLines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </div>
            <div className="flex items-center gap-2 modal-action m-0">
              <button onClick={handleCancel} className="btn btn-ghost">
                Cancel
              </button>
              <button
                onClick={() => {
                  const form = document.querySelector("#add_edit_unit_modal form");
                  if (form) form.requestSubmit();
                }}
                className="btn btn-primary !m-0"
              >
                {isEdit ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop">
        <button onClick={handleCancel}>close</button>
      </div>
    </dialog>
  );
};

export default UnitAddEditModal;
