import React, { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { closeModal } from "../../../../hooks/modalConfig";
import { toast } from "react-toastify";
import { PiX } from "react-icons/pi";

const defaultValues = {
  name: "",
  status: 1,
  attributes: [{ value: "" }],
};

const VariantAddEditModal = ({
  onSubmit,
  isEdit = false,
  editableData = null,
  errorMessage = "",
  isSuccess,
  onClearError,
  onSuccessReset,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "attributes",
  });

  const status = watch("status");
  const attributes = watch("attributes") || defaultValues.attributes;
  const [isEmpty, setIsEmpty] = useState("");

  useEffect(() => {
    if (isEdit && editableData) {
      reset({
        name: editableData.name || "",
        status: editableData.status ?? 1,
        attributes:
          Array.isArray(editableData.attributes) && editableData.attributes.length > 0
            ? editableData.attributes.map((attr) => ({
                value: attr.attribute_value || attr.value || "",
              }))
            : [{ value: "" }],
      });
      return;
    }

    reset(defaultValues);
  }, [editableData, isEdit, reset]);

  useEffect(() => {
    if (!isSuccess) return;

    reset(defaultValues);
    onSuccessReset(false);
    onClearError("");
  }, [isSuccess, onClearError, onSuccessReset, reset]);

  const handleStatusChange = (e) => {
    setValue("status", e.target.checked ? 1 : 0);
  };

  const addAttribute = () => {
    const hasEmpty = attributes.some((attr) => String(attr?.value || "").trim() === "");
    if (hasEmpty) {
      setIsEmpty("Please fill in all attribute fields before adding new ones.");
      return;
    }

    append({ value: "" });
    setIsEmpty("");
  };

  const removeAttribute = (index) => {
    if (attributes.length <= 1) {
      replace([{ value: "" }]);
      return;
    }

    remove(index);
  };

  const onFormSubmit = async (data) => {
    const attrValues = data.attributes
      .map((attr) => String(attr.value || "").trim())
      .filter(Boolean);

    if (attrValues.length === 0) {
      toast.error("At least one attribute is required.", {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
      return;
    }

    const payload = {
      name: data.name,
      status: data.status,
      attributes: attrValues,
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      let errorMsg = "An unexpected error occurred";
      if (error.response && error.response.status === 422) {
        errorMsg = error.response.data.errors.join("\n");
      } else {
        errorMsg = error.message || `Failed to ${isEdit ? "update" : "create"} variant`;
      }
      onClearError(errorMsg);
      toast.error(errorMsg, {
        className: "alert alert-error",
        bodyClassName: "text-sm",
        progressClassName: "bg-error",
      });
    }
  };

  const handleClose = () => {
    closeModal("add_edit_variant_modal");
    reset(defaultValues);
    onClearError("");
    onSuccessReset(false);
    setIsEmpty("");
  };

  return (
    <dialog id="add_edit_variant_modal" className="modal">
      <div className="modal-box w-11/12 max-w-xl max-h-[80vh] flex flex-col p-0">
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">
              {isEdit ? `Edit Variant - ${editableData?.name || "Untitled"}` : "Add New Variant"}
            </h3>
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost"
              onClick={handleClose}
            >
              <PiX size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-6">
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <div className="grid gap-4">
              <div className="form-control">
                <label className="label" htmlFor="name">
                  <span className="label-text">Variant Name*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  {...register("name", {
                    required: "Variant name is required",
                    maxLength: {
                      value: 255,
                      message: "Maximum 255 characters allowed",
                    },
                  })}
                  className={`input input-bordered ${errors.name ? "input-error" : ""}`}
                  placeholder="Enter variant name"
                />
                {errors.name && (
                  <label className="label">
                    <span className="label-text-alt text-error">{errors.name.message}</span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label className="label justify-between items-center">
                  <span className="label-text font-medium">Attributes*</span>
                  <button
                    type="button"
                    onClick={addAttribute}
                    className="btn btn-sm btn-outline"
                  >
                    + Add Attribute
                  </button>
                </label>

                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Controller
                          name={`attributes.${index}.value`}
                          control={control}
                          rules={{
                            required: "Attribute value is required",
                            validate: (value) => {
                              const trimmedValue = String(value || "").trim();
                              if (trimmedValue === "") return true;

                              const otherValues = attributes
                                .filter((_, i) => i !== index)
                                .map((attr) => String(attr?.value || "").trim().toLowerCase());

                              if (otherValues.includes(trimmedValue.toLowerCase())) {
                                return "Duplicate value not allowed";
                              }

                              return true;
                            },
                          }}
                          render={({ field: controllerField }) => (
                            <input
                              type="text"
                              {...controllerField}
                              className={`input input-bordered flex-1 ${
                                errors.attributes?.[index]?.value ? "input-error" : ""
                              }`}
                              placeholder="Enter attribute value"
                              onChange={(e) => {
                                controllerField.onChange(e.target.value);
                                if (isEmpty) {
                                  setIsEmpty("");
                                }
                              }}
                            />
                          )}
                        />

                        {attributes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAttribute(index)}
                            className="btn btn-sm btn-error text-white"
                          >
                            x
                          </button>
                        )}
                      </div>

                      {errors.attributes?.[index]?.value && (
                        <span className="text-error text-xs">
                          {errors.attributes[index].value.message}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {isEmpty && <span className="text-error text-xs">{isEmpty}</span>}
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-4">
                  <input
                    type="checkbox"
                    checked={status === 1}
                    onChange={handleStatusChange}
                    className="toggle toggle-primary"
                  />
                  <span className="label-text">Active</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-error text-sm">{errorMessage}</span>
            <div className="flex items-center gap-2 modal-action m-0">
              <button
                type="button"
                className="btn btn-ghost h-10 min-h-10"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`btn btn-primary h-10 min-h-10 ${isSubmitting ? "loading" : ""}`}
                onClick={handleSubmit(onFormSubmit)}
                disabled={isSubmitting}
              >
                {isEdit ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default VariantAddEditModal;
