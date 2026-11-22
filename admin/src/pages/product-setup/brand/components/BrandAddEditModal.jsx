import React from "react";
import { closeModal } from "../../../../hooks/modalConfig";
import BrandForm from "./BrandForm";

const BrandAddEditModal = ({
  isEdit = false,
  editableData = null,
  onSubmit,
  isDrawer = false,
  errorMessage = "",
  isSuccess,
  onClearError,
  onSuccessReset,
}) => {
  const handleCancel = () => {
    closeModal("add_edit_brand_modal");
  };

  return (
    <>
      {isDrawer ? (
        <div className="p-4">
          <BrandForm
            isEdit={isEdit}
            editableData={editableData}
            onSubmit={onSubmit}
            onCancel={() => {
              document.getElementById("brand_drawer").checked = false;
            }}
            errorMessage={errorMessage}
            isSuccess={isSuccess}
            onClearError={onClearError}
            onSuccessReset={onSuccessReset}
          />
        </div>
      ) : (
        <dialog id="add_edit_brand_modal" className="modal">
          <div className="modal-box w-11/12 max-w-xl max-h-[80vh] flex flex-col p-0">
            {/* fixed header */}
            <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">
                  {isEdit
                    ? `Edit Brand - ${editableData?.title || "Untitled"}`
                    : "Add New Brand"}
                </h3>
                <button
                  onClick={handleCancel}
                  className="btn btn-sm btn-circle"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* scrollable content */}
            <div className="flex-1 overflow-y-auto py-4 px-6">
              <BrandForm
                isEdit={isEdit}
                editableData={editableData}
                onSubmit={onSubmit}
                onCancel={handleCancel}
                showButton={false}
                errorMessage={errorMessage}
                isSuccess={isSuccess}
                onClearError={onClearError}
                onSuccessReset={onSuccessReset}
              />
            </div>

            {/* Fixed Footer */}
            <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-error text-sm">{errorMessage}</span>
                <div className="flex items-center gap-2 modal-action m-0">
                  <button onClick={handleCancel} className="btn btn-ghost">
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const form = document.querySelector(
                        "#add_edit_brand_modal form"
                      );
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
      )}
    </>
  );
};

export default BrandAddEditModal;
