import React, { useState } from "react";
import { closeModal } from "../../../../hooks/modalConfig";
import CategoryForm from "./CategoryForm";

const CategoryAddEditModal = ({
  isEdit = false,
  editableData = null,
  onSubmit,
  parentCategories = [],
  isDrawer = false,
  errorMessage = "",
  isSuccess,
  setIsSuccess,
}) => {
  const handleCancel = () => {
    closeModal("add_edit_category_modal");
  };

  return (
    <>
      {isDrawer ? (
        <div className="p-4">
          <CategoryForm
            isEdit={isEdit}
            editableData={editableData}
            onSubmit={onSubmit}
            parentCategories={parentCategories}
            onCancel={() => {
              document.getElementById("category_drawer").checked = false;
            }}
          />
        </div>
      ) : (
        <dialog id="add_edit_category_modal" className="modal">
          <div className="modal-box w-11/12 max-w-xl max-h-[80vh] flex flex-col p-0">
            {/* fixed header */}
            <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">
                  {isEdit
                    ? `Edit Category - ${editableData?.title || "Untitled"}`
                    : "Add New Category"}
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
              <CategoryForm
                isEdit={isEdit}
                editableData={editableData}
                onSubmit={onSubmit}
                parentCategories={parentCategories}
                onCancel={handleCancel}
                showButton={false}
                errorMessage={errorMessage}
                isSuccess={isSuccess}
                setIsSuccess={setIsSuccess}
              />
            </div>

            {/* Fixed Footer - This will override the CategoryForm footer */}
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
                        "#add_edit_category_modal form"
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

export default CategoryAddEditModal;
