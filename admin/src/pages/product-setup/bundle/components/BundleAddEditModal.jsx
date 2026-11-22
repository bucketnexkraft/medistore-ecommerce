import React from "react";
import { PiX } from "react-icons/pi";
import BundleForm from "./BundleForm";

const BundleAddEditModal = ({
  isOpen = false,
  onClose,
  isEdit = false,
  editableData = null,
  onSubmit,
  errorMessage = "",
  isSuccess,
  onClearError,
  onSuccessReset,
  products = [],
}) => {
  const handleCancel = () => {
    onClose?.();
  };

  const errorLines = [
    ...new Set(
      String(errorMessage || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    ),
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={handleCancel}
        aria-label="Close bundle drawer"
      />

      <div className="absolute inset-y-0 right-0 flex w-full justify-end">
        <div className="flex h-full w-full max-w-[1180px] flex-col overflow-hidden bg-slate-50 shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">
                  Bundle Workspace
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">
                  {isEdit
                    ? `Edit Bundle - ${editableData?.name || "Untitled"}`
                    : "Create New Bundle"}
                </h3>
              </div>
              <button
                onClick={handleCancel}
                className="btn btn-sm btn-circle border-none bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <PiX size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <BundleForm
              isEdit={isEdit}
              editableData={editableData}
              onSubmit={onSubmit}
              onCancel={handleCancel}
              showButton={false}
              isSuccess={isSuccess}
              onClearError={onClearError}
              onSuccessReset={onSuccessReset}
              products={products}
            />
          </div>

          <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-error">
                {errorLines.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button onClick={handleCancel} className="btn btn-ghost">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const form = document.querySelector('[data-bundle-form="true"]');
                    if (form) {
                      form.requestSubmit();
                    }
                  }}
                  className="btn btn-primary"
                >
                  {isEdit ? "Update Bundle" : "Save Bundle"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundleAddEditModal;
