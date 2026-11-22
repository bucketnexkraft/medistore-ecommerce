import { useForm, Controller } from "react-hook-form";
import { useEffect, useState, useCallback } from "react";
import { closeModal } from "../../../../hooks/modalConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "react-select";
import { useSelector } from "react-redux";
import { storeDiscounts, updateDiscounts } from "../../../../api/discount";
import { toast } from "react-toastify";
import { fetchProductOptions, getAllProduct } from "../../../../api/products";
import { getproductSettings } from "../../../../api/productSettings";
import { getWarehouse } from "../../../../api/warehouse";
import { PiX } from "react-icons/pi";

export default function DiscountAddEditModal({ discount, onClose }) {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    setValue,
    watch,
  } = useForm();
  const [discountType, setDiscountType] = useState("");
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [canUseWarehouseDiscount, setCanUseWarehouseDiscount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectStyles = {
    control: (baseStyles) => ({ ...baseStyles, height: "auto", minHeight: 48 }),
    valueContainer: (baseStyles) => ({ ...baseStyles, flexWrap: "wrap" }),
  };

  const formType = watch("type", ""); // Watch for the promotion type
  const vatApplicable = watch("vat_applicable", false);

  const toSelectOption = (item, labelKey = "name") => ({
    value: item?.value ?? item?.id ?? item,
    label: item?.label ?? item?.[labelKey] ?? item?.title ?? item?.name ?? String(item ?? ""),
  });

  const toSelectedIds = (items) =>
    (Array.isArray(items) ? items : [])
      .map((item) => item?.value ?? item?.id ?? item)
      .filter((value) => value !== undefined && value !== null && value !== "");

  const formatDate = (date) => {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString().split("T")[0];
    return String(date).split("T")[0];
  };

  // Fetch categories, brands, and products
  const fetchData = useCallback(async () => {
    try {
      const productList = await getAllProduct(accessToken);
      setProducts(productList.data);
      const allDependency = await fetchProductOptions(accessToken);
      setCategories(allDependency.data.categories);
      setBrands(allDependency.data.brands);
      const prefRes = await getproductSettings(accessToken);
      const assignedPreferences = prefRes?.data?.preferences || [];
      const warehouseDiscountPref = assignedPreferences.find(
        (preference) => preference.code === "ftr_warehouse_base_discount"
      );
      const enabled = !!warehouseDiscountPref?.is_active;
      setCanUseWarehouseDiscount(enabled);

      if (enabled) {
        const warehouseList = await getWarehouse(accessToken, { perPage: 200, status: "1" });
        setWarehouses(warehouseList?.data || []);
      } else {
        setWarehouses([]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map API data to react-select options
  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: cat.title,
  }));
  const brandOptions = brands.map((brand) => ({
    value: brand.id,
    label: brand.title,
  }));
  const productOptions = products.map((prod) => ({
    value: prod.id,
    label: prod.name,
  }));
  const warehouseOptions = warehouses.map((warehouse) => ({
    value: warehouse.id,
    label: warehouse.name,
  }));

  // Populate form with existing discount data
  useEffect(() => {
    if (discount) {
      reset({
        name: discount.name || "",
        number_of_cards: discount.no_of_cards || 1,
        prefix: discount.prefix || "REWARD-",
        type: discount.type || "",
        code: discount.code || "",
        form_date: discount.form_date ? new Date(discount.form_date) : null,
        to_date: discount.to_date ? new Date(discount.to_date) : null,
        dateRange: discount.form_date && discount.to_date
        ? [new Date(discount.form_date), new Date(discount.to_date)]
        : [null, null],
        amount: discount.amount || "",
        discount_type: discount.discount_type || "",
        category_ids: discount.categories?.map((cat) => toSelectOption(cat, "title")) || [],
        brand_ids: discount.brands?.map((brand) => toSelectOption(brand, "title")) || [],
        product_ids: discount.products?.map((prod) => toSelectOption(prod, "name")) || [],
        warehouse_ids: discount.warehouses?.map((warehouse) => toSelectOption(warehouse, "name")) || [],
        vat_applicable: discount.vat_applicable || false,
        vat_calculate_for: discount.vat_calculate_for || "after_discount",
        is_active: discount.is_active,
      });
      setDiscountType(discount.discount_type || "");
    } else {
      reset({
        type: "discount", // Default to 'discount' for new setups
        code: "",
        dateRange: [null, null],
        form_date: null,
        to_date: null,
        amount: "",
        discount_type: "percent",
        category_ids: [],
        brand_ids: [],
        product_ids: [],
        warehouse_ids: [],
        vat_applicable: false,
        vat_calculate_for: "after_discount",
        is_active: true,
        number_of_cards: 1, // Default for reward cards
        prefix: "REWARD-",
      });
      setDiscountType("percent");
    }
    setErrorMessage("");
  }, [discount, reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [startDate, endDate] = data.dateRange || [];
      const formattedData = {
        ...data,
        form_date: formatDate(startDate),
        to_date: formatDate(endDate),
        amount: parseFloat(data.amount) || null,
        category_ids: toSelectedIds(data.category_ids),
        brand_ids: toSelectedIds(data.brand_ids),
        product_ids: toSelectedIds(data.product_ids),
        warehouse_ids: canUseWarehouseDiscount ? toSelectedIds(data.warehouse_ids) : [],
      };

      // Conditionally remove fields not applicable to the current type
      if (data.type !== "coupon") {
        delete formattedData.code;
      }
      if (data.type !== "reward_card") {
        delete formattedData.number_of_cards;
        delete formattedData.prefix;
      }
      if (!data.vat_applicable) {
        delete formattedData.vat_calculate_for;
      }

      if (discount) {
        await updateDiscounts(
          accessToken,
          discount.id,
          formattedData
        );
        toast.success("Promotion updated successfully");
        reset(); 
      } else {
        await storeDiscounts(accessToken, formattedData);
        toast.success("Promotion added successfully");
        reset(); 
      }

      onClose();
      window.dispatchEvent(new Event("discountUpdated"));
    } catch (error) {
      setErrorMessage(error.message || "Failed to save promotion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog id="discount_add_edit_modal" className="modal">
      <div className="modal-box w-11/12 max-w-4xl flex flex-col h-[90vh] p-0">
        {/* Fixed Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {discount ? "Edit Promotion" : "Add New Promotion"}
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost"
              onClick={() => {
                closeModal("discount_add_edit_modal");
                reset();
              }}
            >
              <PiX size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 px-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Promotion Type */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Promotion Type</span>
              </label>
              <select
                {...register("type", {
                  required: "Promotion type is required",
                })}
                className="select select-bordered w-full text-sm"
                disabled={loading || discount} // Disable change on edit mode
              >
                <option value="discount">Discount</option>
                <option value="coupon">Coupon</option>
                <option value="reward_card">Reward Card</option>
              </select>
              {errors.type && (
                <span className="text-error text-xs mt-1">
                  {errors.type.message}
                </span>
              )}
            </div>

            {/* General Fields for all promotion types */}
            {/* Name */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Title</span>
              </label>
              <input
                type="text"
                {...register("name", { required: "Title is required" })}
                className="input input-bordered w-full text-sm"
                placeholder="Enter discount title"
                disabled={loading}
              />
              {errors.name && (
                <span className="text-error text-xs mt-1">
                  {errors.name.message}
                </span>
              )}
            </div>

            {/* Date Range */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Date Range</span>
              </label>
              <Controller
                control={control}
                name="dateRange"
                rules={{
                  required: "Date range is required",
                  validate: (value) =>
                    value && value[0] && value[1]
                      ? true
                      : "Both start and end dates must be selected",
                }}
                render={({ field }) => (
                  <DatePicker
                    selectsRange={true}
                    startDate={field.value?.[0] || null}
                    endDate={field.value?.[1] || null}
                    onChange={(dates) => field.onChange(dates)}
                    className="input input-bordered w-full text-sm"
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Select start and end date"
                    isClearable={true}
                    disabled={loading}
                  />
                )}
              />
              {errors.dateRange && (
                <span className="text-error text-xs mt-1">
                  {errors.dateRange.message}
                </span>
              )}
            </div>

            {/* Conditional Fields based on Promotion Type */}
            {formType === "coupon" && (
              <>
                {/* Coupon Code */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Coupon Code</span>
                  </label>
                  <input
                    type="text"
                    {...register("code", {
                      required: "Coupon code is required",
                    })}
                    className="input input-bordered w-full text-sm"
                    placeholder="Enter coupon code (e.g., SAVE10)"
                    disabled={loading}
                  />
                  {errors.code && (
                    <span className="text-error text-xs mt-1">
                      {errors.code.message}
                    </span>
                  )}
                </div>
              </>
            )}

            {formType === "reward_card" && (
              <>
                {/* Number of Cards */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Number of Cards to Generate</span>
                  </label>
                  <input
                    type="number"
                    {...register("number_of_cards", {
                      required: "Number of cards is required",
                      min: {
                        value: 1,
                        message: "Must generate at least 1 card",
                      },
                    })}
                    className="input input-bordered w-full text-sm"
                    placeholder="e.g., 100"
                    disabled={loading}
                  />
                  {errors.number_of_cards && (
                    <span className="text-error text-xs mt-1">
                      {errors.number_of_cards.message}
                    </span>
                  )}
                </div>

                {/* Prefix */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Card Prefix</span>
                  </label>
                  <input
                    type="text"
                    {...register("prefix")}
                    className="input input-bordered w-full text-sm"
                    placeholder="e.g., REWARD-"
                    disabled={loading}
                  />
                </div>
              </>
            )}

            {/* Always rendered fields for Amount, Discount Type, and targets */}
            
                {/* Discount Type */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Discount Type</span>
                  </label>
                  <select
                    {...register("discount_type", {
                      required: "Discount type is required",
                    })}
                    className="select select-bordered w-full text-sm"
                    onChange={(e) => {
                      setDiscountType(e.target.value);
                      setValue("discount_type", e.target.value);
                    }}
                    disabled={loading}
                  >
                    <option value="">Select discount type</option>
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                  {errors.discount_type && (
                    <span className="text-error text-xs mt-1">
                      {errors.discount_type.message}
                    </span>
                  )}
                </div>

                {/* Amount */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">
                      {discountType === "percent"
                        ? "Percent"
                        : discountType === "fixed"
                        ? "Fixed Amount"
                        : "Amount"}
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("amount", {
                      required: `${
                        discountType === "percent"
                          ? "Percentage amount is required"
                          : discountType === "fixed"
                          ? "Fixed amount is required"
                          : "Amount is required"
                      }`,
                      validate: (value) => {
                        const stringValue = value.toString();
                        return value <= 0
                          ? "Amount must be greater than 0"
                          : discountType === "percent"
                          ? stringValue.length > 3
                            ? "Max 3 characters allowed for percentage"
                            : value > 100
                            ? "Percentage must be 100 or less"
                            : true
                          : stringValue.length > 16
                          ? "Max 16 characters allowed"
                          : true;
                      },
                    })}
                    className="input input-bordered w-full text-sm"
                    placeholder={
                      discountType === "percent"
                        ? "Enter percentage amount"
                        : discountType === "fixed"
                        ? "Enter fixed amount"
                        : "Enter amount"
                    }
                    disabled={loading}
                  />
                  {errors.amount && (
                    <span className="text-error text-xs mt-1">
                      {errors.amount.message}
                    </span>
                  )}
                </div>
              {formType !== "reward_card" && (
              <>
                {/* Categories */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Categories</span>
                  </label>
                  <Controller
                    control={control}
                    name="category_ids"
                    render={({ field }) => (
                      <Select
                        isMulti
                        options={categoryOptions}
                        value={field.value}
                        onChange={(selected) => field.onChange(selected)}
                        className="basic-multi-select"
                        classNamePrefix="select"
                        placeholder="Select categories..."
                        isDisabled={loading}
                        styles={selectStyles}
                      />
                    )}
                  />
                  {errors.category_ids && (
                    <span className="text-error text-xs mt-1">
                      {errors.category_ids.message}
                    </span>
                  )}
                </div>

                {/* Brands */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Brands</span>
                  </label>
                  <Controller
                    control={control}
                    name="brand_ids"
                    render={({ field }) => (
                      <Select
                        isMulti
                        options={brandOptions}
                        value={field.value}
                        onChange={(selected) => field.onChange(selected)}
                        className="basic-multi-select"
                        classNamePrefix="select"
                        placeholder="Select brands..."
                        isDisabled={loading}
                        styles={selectStyles}
                      />
                    )}
                  />
                  {errors.brand_ids && (
                    <span className="text-error text-xs mt-1">
                      {errors.brand_ids.message}
                    </span>
                  )}
                </div>

                {/* Products */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Products</span>
                  </label>
                  <Controller
                    control={control}
                    name="product_ids"
                    render={({ field }) => (
                      <Select
                        isMulti
                        options={productOptions}
                        value={field.value}
                        onChange={(selected) => field.onChange(selected)}
                        className="basic-multi-select"
                        classNamePrefix="select"
                        placeholder="Select products..."
                        isDisabled={loading}
                        styles={selectStyles}
                      />
                    )}
                  />
                  {errors.product_ids && (
                    <span className="text-error text-xs mt-1">
                      {errors.product_ids.message}
                    </span>
                  )}
                </div>

                {/* Warehouses */}
                {canUseWarehouseDiscount && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">Warehouses</span>
                    </label>
                    <Controller
                      control={control}
                      name="warehouse_ids"
                      render={({ field }) => (
                        <Select
                          isMulti
                          options={warehouseOptions}
                          value={field.value}
                          onChange={(selected) => field.onChange(selected)}
                          className="basic-multi-select"
                          classNamePrefix="select"
                          placeholder="Select warehouses..."
                          isDisabled={loading}
                          styles={selectStyles}
                        />
                      )}
                    />
                    {errors.warehouse_ids && (
                      <span className="text-error text-xs mt-1">
                        {errors.warehouse_ids.message}
                      </span>
                    )}
                  </div>
                )}

                {/* VAT Applicable */}
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text font-semibold">VAT Applicable</span>
                    <input
                      type="checkbox"
                      {...register("vat_applicable")}
                      className="toggle toggle-primary"
                      disabled={loading}
                    />
                  </label>
                </div>
              </>
            )}
            {/* VAT Calculate For (Conditional) */}
            {vatApplicable && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">VAT Calculate For</span>
                </label>
                <select
                  {...register("vat_calculate_for", {
                    required: vatApplicable
                      ? "VAT calculate for is required"
                      : false,
                  })}
                  className="select select-bordered w-full text-sm"
                  disabled={loading}
                >
                  <option value="after_discount">After Discount</option>
                  <option value="before_discount">Before Discount</option>
                </select>
                {errors.vat_calculate_for && (
                  <span className="text-error text-xs mt-1">
                    {errors.vat_calculate_for.message}
                  </span>
                )}
              </div>
            )}
            {/* Is Active Toggle */}
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text font-semibold">Is Active</span>
                <input
                  type="checkbox"
                  {...register("is_active")}
                  className="toggle toggle-primary"
                  disabled={loading}
                />
              </label>
            </div>
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4 mt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-error text-sm">{errorMessage}</span>
            <div className="flex items-center gap-2">
              
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => closeModal("discount_add_edit_modal")}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                onClick={handleSubmit(onSubmit)}
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : discount
                  ? "Update Promotion"
                  : "Add Promotion"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
