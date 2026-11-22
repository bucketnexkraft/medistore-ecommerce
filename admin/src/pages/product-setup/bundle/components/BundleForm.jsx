import React, { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import Select from "react-select";
import { FaPlus, FaTrash } from "react-icons/fa";
import { PiCube, PiPercent, PiStack } from "react-icons/pi";

const BundleForm = ({
  isEdit,
  editableData,
  onSubmit,
  onCancel,
  showButton = true,
  isSuccess,
  onClearError,
  onSuccessReset,
  products = [],
}) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: "",
      discount_type: "percentage",
      discount_value: 0,
      bundle_qty: 1,
      is_active: 1,
      products: [{ product_id: "", quantity: 1 }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "products",
  });

  useEffect(() => {
    if (isEdit && editableData) {
      reset({
        name: editableData.name || "",
        discount_type: editableData.discount_type || "percentage",
        discount_value: editableData.discount_value ?? 0,
        bundle_qty: editableData.bundle_qty ?? 1,
        is_active: editableData.is_active ?? 1,
        products:
          editableData.products?.length > 0
            ? editableData.products.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity ?? 1,
              }))
            : [{ product_id: "", quantity: 1 }],
      });
    } else {
      reset({
        name: "",
        discount_type: "percentage",
        discount_value: 0,
        bundle_qty: 1,
        is_active: 1,
        products: [{ product_id: "", quantity: 1 }],
      });
    }
  }, [editableData, isEdit, reset]);

  useEffect(() => {
    if (isSuccess) {
      reset({
        name: "",
        discount_type: "percentage",
        discount_value: 0,
        bundle_qty: 1,
        is_active: 1,
        products: [{ product_id: "", quantity: 1 }],
      });
      onSuccessReset(false);
      onClearError("");
    }
  }, [isSuccess, onClearError, onSuccessReset, reset]);

  const productMap = useMemo(
    () =>
      products.reduce((acc, product) => {
        acc[product.id] = product;
        return acc;
      }, {}),
    [products]
  );

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name}${product.code ? ` (${product.code})` : ""}`,
        searchText: `${product.name || ""} ${product.code || ""}`.toLowerCase(),
        price: Number(product.price || 0),
        available_quantity: Number(product.available_quantity || 0),
      })),
    [products]
  );

  const discountType = watch("discount_type");
  const status = watch("is_active");
  const selectedProducts = watch("products") || [];

  const estimatedBasePrice = selectedProducts.reduce((sum, item) => {
    const product = productMap[item?.product_id];
    const price = Number(product?.price || 0);
    const qty = Number(item?.quantity || 0);
    return sum + price * qty;
  }, 0);

  const discountValue = Number(watch("discount_value") || 0);
  const estimatedDiscount =
    discountType === "percentage"
      ? (estimatedBasePrice * discountValue) / 100
      : discountValue;
  const appliedDiscount = Math.min(estimatedDiscount, estimatedBasePrice);
  const estimatedFinalPrice = Math.max(estimatedBasePrice - appliedDiscount, 0);
  const formatPrice = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const summaryCards = [
    {
      title: "Products in bundle",
      value: selectedProducts.filter((item) => item?.product_id).length,
      icon: PiStack,
      tone: "from-sky-50 to-cyan-50",
    },
    {
      title: "Estimated discount",
      value: appliedDiscount.toFixed(2),
      icon: PiPercent,
      tone: "from-amber-50 to-orange-50",
    },
    {
      title: "Bundle sell price",
      value: estimatedFinalPrice.toFixed(2),
      icon: PiCube,
      tone: "from-violet-50 to-fuchsia-50",
    },
  ];

  const onFormSubmit = async (data) => {
    await onSubmit({
      ...data,
      discount_value: Number(data.discount_value || 0),
      bundle_qty: Number(data.bundle_qty || 1),
      is_active: data.is_active ? 1 : 0,
      products: (data.products || []).map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity || 0),
      })),
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className="space-y-6 p-6 lg:p-7"
      data-bundle-form="true"
    >
      <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-600">
              Bundle setup
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">
              {isEdit ? "Refine your bundle" : "Create a clear, sellable bundle"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Pick products, set the discount, and review the live total before saving.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Price is calculated from your latest product selling price in stock.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className={`rounded-3xl border border-white bg-gradient-to-br ${card.tone} p-5 shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
                <span className="rounded-2xl bg-white/80 p-2 text-slate-700 shadow-sm">
                  <Icon size={18} />
                </span>
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-900">
                {card.title === "Products in bundle" ? card.value : formatPrice(card.value)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h4 className="text-lg font-semibold text-slate-900">Bundle identity</h4>
              <p className="text-sm text-slate-500">
                Give the bundle a strong name and define how the discount should work.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="form-control">
                <label className="label" htmlFor="bundle_name">
                  <span className="label-text font-medium">Bundle Name*</span>
                </label>
                <input
                  id="bundle_name"
                  type="text"
                  placeholder="Weekend essentials, starter kit, combo pack..."
                  className={`input input-bordered h-12 ${errors.name ? "input-error" : ""}`}
                  {...register("name", {
                    required: "Bundle name is required",
                    maxLength: {
                      value: 191,
                      message: "Bundle name must be at most 191 characters long",
                    },
                  })}
                />
                {errors.name && (
                  <label className="label">
                    <span className="label-text-alt text-error">{errors.name.message}</span>
                  </label>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="form-control">
                  <label className="label" htmlFor="discount_type">
                    <span className="label-text font-medium">Discount Type*</span>
                  </label>
                  <select
                    id="discount_type"
                    className="select select-bordered h-12 w-full"
                    {...register("discount_type", {
                      required: "Discount type is required",
                    })}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="bundle_qty">
                    <span className="label-text font-medium">Default Sell Qty*</span>
                  </label>
                  <input
                    id="bundle_qty"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={`input input-bordered h-12 ${
                      errors.bundle_qty ? "input-error" : ""
                    }`}
                    {...register("bundle_qty", {
                      required: "Default sell qty is required",
                      min: {
                        value: 0.01,
                        message: "Default sell qty must be greater than 0",
                      },
                    })}
                  />
                  {errors.bundle_qty && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.bundle_qty.message}
                      </span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="discount_value">
                    <span className="label-text font-medium">
                      {discountType === "percentage" ? "Discount (%)" : "Discount Amount"}
                    </span>
                  </label>
                  <input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    min="0"
                    className={`input input-bordered h-12 ${
                      errors.discount_value ? "input-error" : ""
                    }`}
                    {...register("discount_value", {
                      required: "Discount value is required",
                      min: {
                        value: 0,
                        message: "Discount value cannot be negative",
                      },
                    })}
                  />
                  {errors.discount_value && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.discount_value.message}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Bundle products</h4>
                <p className="text-sm text-slate-500">
                  Add every product included in the bundle and define the included quantity.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm rounded-full px-4"
                onClick={() => append({ product_id: "", quantity: 1 })}
              >
                <FaPlus />
                Add Product
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => {
                const selectedProduct = productMap[selectedProducts?.[index]?.product_id];

                return (
                  <div
                    key={field.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        Item {index + 1}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm border-none bg-rose-100 text-rose-600 hover:bg-rose-200"
                        onClick={() =>
                          fields.length > 1
                            ? remove(index)
                            : replace([{ product_id: "", quantity: 1 }])
                        }
                      >
                        <FaTrash />
                      </button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">Select Product</span>
                        </label>
                        <Controller
                          control={control}
                          name={`products.${index}.product_id`}
                          rules={{ required: "Product is required" }}
                          render={({ field: selectField }) => (
                            <Select
                              classNamePrefix="bundle-select"
                              options={productOptions}
                              isSearchable
                              placeholder="Search and select a product"
                              value={
                                productOptions.find(
                                  (option) => String(option.value) === String(selectField.value)
                                ) || null
                              }
                              onChange={(option) => selectField.onChange(option?.value || "")}
                              filterOption={(option, inputValue) => {
                                const query = String(inputValue || "").trim().toLowerCase();
                                if (!query) {
                                  return true;
                                }

                                return (
                                  option.label.toLowerCase().includes(query) ||
                                  option.data.searchText.includes(query)
                                );
                              }}
                              isClearable
                              noOptionsMessage={() =>
                                products.length === 0
                                  ? "No products loaded yet"
                                  : "No matching product found"
                              }
                              loadingMessage={() => "Searching products..."}
                              formatOptionLabel={(option) => (
                                <div className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                                    {option.label}
                                  </span>
                                  <span className="shrink-0 text-xs font-semibold text-violet-600">
                                    {formatPrice(option.price)}
                                  </span>
                                </div>
                              )}
                              styles={{
                                control: (base, state) => ({
                                  ...base,
                                  minHeight: 48,
                                  borderRadius: 16,
                                  borderColor: errors.products?.[index]?.product_id
                                    ? "#f87171"
                                    : state.isFocused
                                      ? "#7c3aed"
                                      : base.borderColor,
                                  boxShadow: state.isFocused
                                    ? "0 0 0 1px #7c3aed"
                                    : "none",
                                }),
                                menu: (base) => ({
                                  ...base,
                                  zIndex: 60,
                                }),
                              }}
                            />
                          )}
                        />
                        {errors.products?.[index]?.product_id && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              {errors.products[index].product_id.message}
                            </span>
                          </label>
                        )}
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">Qty Per Bundle</span>
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max={Math.max(
                            1,
                            Number(
                              productMap[selectedProducts?.[index]?.product_id]
                                ?.available_quantity || 0
                            )
                          )}
                          placeholder="Quantity"
                          className={`input input-bordered h-12 ${
                            errors.products?.[index]?.quantity ? "input-error" : ""
                          }`}
                          {...register(`products.${index}.quantity`, {
                            required: "Quantity is required",
                            valueAsNumber: true,
                            min: {
                              value: 1,
                              message: "Quantity must be at least 1",
                            },
                            validate: {
                              integer: (value) =>
                                Number.isInteger(Number(value)) ||
                                "Quantity must be a whole number",
                              maxStock: (value) => {
                                const availableStock = Number(
                                  productMap[selectedProducts?.[index]?.product_id]
                                    ?.available_quantity || 0
                                );

                                return (
                                  Number(value) <= availableStock ||
                                  `Quantity cannot exceed available stock (${availableStock})`
                                );
                              },
                            },
                            onChange: (event) => {
                              const availableStock = Number(
                                productMap[selectedProducts?.[index]?.product_id]
                                  ?.available_quantity || 0
                              );
                              const rawValue = event.target.value;

                              if (rawValue === "") {
                                return;
                              }

                              const sanitizedValue = Math.trunc(Number(rawValue) || 0);

                              if (availableStock <= 0) {
                                event.target.value = "";
                                return;
                              }

                              event.target.value = String(
                                Math.min(Math.max(sanitizedValue, 1), availableStock)
                              );
                            },
                          })}
                        />
                        {errors.products?.[index]?.quantity && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              {errors.products[index].quantity.message}
                            </span>
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-col gap-3 text-sm lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Selected product
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {selectedProduct?.name || "No product selected"}
                            </span>
                            {selectedProduct?.code && (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                {selectedProduct.code}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 rounded-2xl bg-slate-50 px-4 py-3 lg:min-w-[360px]">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                              Unit price
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {formatPrice(selectedProduct?.price)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                              Stock
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {Number(selectedProduct?.available_quantity || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                              Line total
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {formatPrice(
                                Number(selectedProduct?.price || 0) *
                                  Number(selectedProducts?.[index]?.quantity || 0)
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-900">Price preview</h4>
            <p className="mt-1 text-sm text-slate-500">
              Live estimate based on your current selected items and discount.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Base total</span>
                  <span className="font-semibold text-slate-900">
                    {formatPrice(estimatedBasePrice)}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-4">
                <div className="flex items-center justify-between text-sm text-amber-700">
                  <span>Discount applied</span>
                  <span className="font-semibold">{formatPrice(appliedDiscount)}</span>
                </div>
              </div>
              <div className="rounded-2xl bg-violet-600 px-4 py-5 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-violet-100">Estimated bundle price</span>
                  <span className="text-2xl font-semibold">
                    {formatPrice(estimatedFinalPrice)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-900">Bundle status</h4>
            <p className="mt-1 text-sm text-slate-500">
              Keep the bundle ready for selling or save it inactive for later.
            </p>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
              <div>
                <p className="font-medium text-slate-900">Active in product list</p>
                <p className="text-sm text-slate-500">
                  Sales teams can use this bundle immediately after saving.
                </p>
              </div>
              <input
                type="checkbox"
                checked={status === 1 || status === true}
                onChange={(e) => setValue("is_active", e.target.checked ? 1 : 0)}
                className="toggle toggle-primary"
              />
            </div>
          </div>
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

export default BundleForm;
