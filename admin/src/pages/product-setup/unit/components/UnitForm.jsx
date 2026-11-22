import React, { useEffect } from "react";
import { useForm } from "react-hook-form";

const UnitForm = ({
  isEdit,
  editableData,
  onSubmit,
  onCancel,
  showButton = true,
  isSuccess,
  onClearError,
  onSuccessReset,
  baseUnits = [],
}) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      unit_name: "",
      unit_code: "",
      base_unit: 0,
      operator: "*",
      operation_value: 1,
      is_active: 1,
    },
  });

  const selectedBaseUnit = Number(watch("base_unit") || 0);
  const status = watch("is_active");

  useEffect(() => {
    if (isEdit && editableData) {
      reset({
        unit_name: editableData.unit_name || "",
        unit_code: editableData.unit_code || "",
        base_unit: editableData.base_unit ?? 0,
        operator: editableData.operator || "*",
        operation_value: editableData.operation_value ?? 1,
        is_active: editableData.is_active ?? 1,
      });
    } else {
      reset({
        unit_name: "",
        unit_code: "",
        base_unit: 0,
        operator: "*",
        operation_value: 1,
        is_active: 1,
      });
    }
  }, [editableData, isEdit, reset]);

  useEffect(() => {
    if (!selectedBaseUnit) {
      setValue("operator", "*");
      setValue("operation_value", 1);
    }
  }, [selectedBaseUnit, setValue]);

  useEffect(() => {
    if (isSuccess) {
      reset({
        unit_name: "",
        unit_code: "",
        base_unit: 0,
        operator: "*",
        operation_value: 1,
        is_active: 1,
      });
      onSuccessReset(false);
      onClearError("");
    }
  }, [isSuccess, onClearError, onSuccessReset, reset]);

  const onFormSubmit = async (data) => {
    await onSubmit({
      ...data,
      base_unit: Number(data.base_unit || 0),
      operation_value: Number(data.operation_value || 1),
      is_active: status === 1 ? 1 : 0,
    });
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="form-control md:col-span-1">
          <label className="label" htmlFor="unit_name">
            <span className="label-text">Unit Name*</span>
          </label>
          <input
            id="unit_name"
            type="text"
            placeholder="Enter unit name"
            className={`input input-bordered ${errors.unit_name ? "input-error" : ""}`}
            {...register("unit_name", {
              required: "Unit name is required",
              maxLength: {
                value: 191,
                message: "Unit name must be at most 191 characters long",
              },
            })}
          />
          {errors.unit_name && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.unit_name.message}</span>
            </label>
          )}
        </div>

        <div className="form-control md:col-span-1">
          <label className="label" htmlFor="unit_code">
            <span className="label-text">Unit Code*</span>
          </label>
          <input
            id="unit_code"
            type="text"
            placeholder="Enter unit code"
            className={`input input-bordered ${errors.unit_code ? "input-error" : ""}`}
            {...register("unit_code", {
              required: "Unit code is required",
              maxLength: {
                value: 191,
                message: "Unit code must be at most 191 characters long",
              },
            })}
          />
          {errors.unit_code && (
            <label className="label">
              <span className="label-text-alt text-error">{errors.unit_code.message}</span>
            </label>
          )}
        </div>

        <div className="form-control md:col-span-2">
          <label className="label" htmlFor="base_unit">
            <span className="label-text">Base Unit</span>
          </label>
          <select
            id="base_unit"
            className="select select-bordered w-full"
            {...register("base_unit")}
          >
            <option value={0}>No base unit</option>
            {baseUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_name} ({unit.unit_code})
              </option>
            ))}
          </select>
          <label className="label">
            <span className="label-text-alt text-gray-500">
              Select a base unit if this unit is a conversion of another one.
            </span>
          </label>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="operator">
            <span className="label-text">Operator</span>
          </label>
          <select
            id="operator"
            className="select select-bordered w-full"
            disabled={!selectedBaseUnit}
            {...register("operator")}
          >
            <option value="*">Multiply (*)</option>
            <option value="/">Divide (/)</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="operation_value">
            <span className="label-text">Operation Value</span>
          </label>
          <input
            id="operation_value"
            type="number"
            step="any"
            min="0.0001"
            disabled={!selectedBaseUnit}
            placeholder="Enter operation value"
            className={`input input-bordered ${errors.operation_value ? "input-error" : ""}`}
            {...register("operation_value", {
              validate: (value) => {
                if (!selectedBaseUnit) return true;
                return Number(value) > 0 || "Operation value must be greater than 0";
              },
            })}
          />
          {errors.operation_value && (
            <label className="label">
              <span className="label-text-alt text-error">
                {errors.operation_value.message}
              </span>
            </label>
          )}
        </div>

        <div className="form-control md:col-span-2">
          <label className="label cursor-pointer justify-start gap-4">
            <input
              type="checkbox"
              checked={status === 1}
              onChange={(e) => setValue("is_active", e.target.checked ? 1 : 0)}
              className="toggle toggle-primary"
            />
            <span className="label-text">Active</span>
          </label>
        </div>
      </div>

      {showButton && (
        <div className="modal-action mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`btn btn-primary ${isSubmitting ? "loading" : ""}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing..." : isEdit ? "Update" : "Save"}
          </button>
        </div>
      )}
    </form>
  );
};

export default UnitForm;
