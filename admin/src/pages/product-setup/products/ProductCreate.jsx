import { useCallback, useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { getproductSettings } from "../../../api/productSettings";
import { useSelector } from "react-redux";
import Select from "react-select";
import {
  fetchProductOptions,
  generateProductDescription,
  getVariantAttributes,
} from "../../../api/products";
import { toast } from "react-toastify";
import "react-quill/dist/quill.snow.css";
import AiDescriptionEditor from "../../../components/common/AiDescriptionEditor";

export default function ProductCreate() {
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    control,
    trigger,
    formState: { errors },
  } = useForm();

  const { fields, prepend, remove } = useFieldArray({
    control,
    name: "segments",
  });

  const accessToken = useSelector((state) => state.auth.accessToken);
  const [productSettings, setProductSettings] = useState({
    has_category: 0,
    has_brand: 0,
    has_variant: 0,
    has_segmentation: 0,
  });

  const [categoryList, setCategoryList] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [variantList, setVariantList] = useState([]);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const variantId = watch("variant_id");

  const [selectedVariants, setSelectedVariants] = useState([]);
  const [variantAttributesMap, setVariantAttributesMap] = useState({});
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const handleVariantsChange = async (selectedOptions) => {
    setSelectedVariants(selectedOptions);

    const newMap = {};
    for (const option of selectedOptions) {
      const res = await getVariantAttributes(accessToken, {
        variant_id: option.value,
      });

      if (res.status) {
        newMap[option.value] = res.data;
      }
    }
    setVariantAttributesMap(newMap);
  };

  const generateSku = () => {
    const randomSku =
      "SKU-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setValue("sku", randomSku);
  };

  const fetchProductSetup = useCallback(async () => {
    const settingsResult = await getproductSettings(accessToken);

    if (settingsResult.status) {
      setProductSettings(settingsResult.data);
    }
    const productOptions = await fetchProductOptions(accessToken);

    setCategoryList(productOptions.data.categories || []);
    setBrandList(productOptions.data.brands || []);
    setVariantList(productOptions.data.variants || []);
  }, [accessToken]);

  const fetchAttributes = async () => {
    if (!variantId) {
      setSelectedAttributes([]);
      return;
    }
    try {
      const response = await getVariantAttributes(accessToken, {
        variant_id: variantId,
      });

      if (response.status) {
        setSelectedAttributes(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch variant attributes", error);
    }
  };
  useEffect(() => {
    fetchProductSetup();
  }, [fetchProductSetup]);

  useEffect(() => {
    fetchAttributes();
  }, [variantId]);

  useEffect(() => {
    if (fields.length === 0) {
      prepend({ name: "", value: "" });
    }
  }, [fields, prepend]);

  const handleGenerateDescription = async (prompt = "") => {
    const productName = String(getValues("name") || "").trim();
    if (!productName) {
      toast.error("Please enter a product title first.");
      return;
    }

    const payload = {
      name: productName,
      sku: String(getValues("sku") || "").trim(),
      category_id: getValues("category_id") || "",
      brand_id: getValues("brand_id") || "",
      unit_id: getValues("unit_id") || "",
      demand_tags: getValues("demand_tags") || [],
      return_enabled: !!getValues("return_enabled"),
      group_purchase_available: !!getValues("is_group_purchase_available"),
      prompt: String(prompt || "").trim(),
    };

    try {
      setIsGeneratingDescription(true);
      const response = await generateProductDescription(accessToken, payload);
      setValue("description", response?.data?.description || "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success("Product description generated.");
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to generate product description right now."
      );
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const submitProduct = (data) => {
    return data;
  };
  return (
    <div className="card bg-base-100 w-full shadow-xl">
      <div className="card-body">
        <form onSubmit={handleSubmit(submitProduct)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-control col-span-2">
              <label className="label">
                <span className="label-text font-medium">Product Title *</span>
              </label>
              <input
                type="text"
                {...register("name", { required: "Name is required" })}
                className="input input-bordered w-full"
              />
              {errors.name && (
                <span className="text-error text-sm">
                  {errors.name.message}
                </span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Product SKU *</span>
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  {...register("sku", { required: "Sku is required" })}
                  className="input input-bordered w-full"
                />
                <button
                  type="button"
                  onClick={generateSku}
                  className="btn btn-outline btn-primary"
                >
                  Generate
                </button>
              </div>

              {errors.sku && (
                <span className="text-error text-sm">{errors.sku.message}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">
                  Product Category *
                </span>
              </label>

              <div className="flex gap-2">
                <select
                  {...register("category_id", {
                    required: "Category is required",
                  })}
                  className="select select-bordered w-full"
                >
                  <option value="">Select a category</option>
                  {categoryList.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title}
                    </option>
                  ))}
                </select>
                {errors.category_id && (
                  <span className="text-error text-sm">
                    {errors.category_id.message}
                  </span>
                )}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Product Brand *</span>
              </label>

              <div className="flex gap-2">
                <select
                  {...register("brand_id", {
                    required: "Brand is required",
                  })}
                  className="select select-bordered w-full"
                >
                  <option value="">Select a Brand</option>
                  {brandList.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.title}
                    </option>
                  ))}
                </select>
                {errors.brand_id && (
                  <span className="text-error text-sm">
                    {errors.brand_id.message}
                  </span>
                )}
              </div>
            </div>

            {/* {productSettings.has_variant === 1 && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Variant</span>
                </label>
                <select
                  {...register("variant_id")}
                  className="select select-bordered w-full"
                >
                  <option value="">Select a variant</option>
                  {variantList.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </div>
            )} */}

            {productSettings.has_variant === 1 && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Variant</span>
                </label>
                <Controller
                  name="variant_ids"
                  control={control}
                  defaultValue={[]}
                  render={({ field }) => (
                    <Select
                      {...field}
                      isMulti
                      className="w-full"
                      options={variantList.map((v) => ({
                        label: v.name,
                        value: v.id,
                      }))}
                      onChange={(selected) => {
                        field.onChange(selected);
                        handleVariantsChange(selected);
                      }}
                    />
                  )}
                />
              </div>
            )}

            {/* {selectedAttributes.length > 0 && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    Attribute Values
                  </span>
                </label>
                <Controller
                  name="attribute_values"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      isMulti
                      className="w-full"
                      options={selectedAttributes.flatMap((attr) => ({
                        label: `${attr.attribute_value}`,
                        value: attr.id,
                      }))}
                    />
                  )}
                />
              </div>
            )} */}

            {selectedVariants.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {selectedVariants.map((variant) => (
                  <div key={variant.value} className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">
                        {variant.label} Values
                      </span>
                    </label>
                    <Controller
                      name={`attributes.${variant.value}`}
                      control={control}
                      render={({ field }) => (
                        <Select
                          {...field}
                          isMulti
                          className="w-full"
                          options={(
                            variantAttributesMap[variant.value] || []
                          ).map((attr) => ({
                            label: attr.attribute_value,
                            value: attr.id,
                          }))}
                        />
                      )}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Product Image</span>
              </label>
              <input
                type="file"
                accept="image/*"
                {...register("thumbnail")}
                className="file-input file-input-bordered w-full"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Product Status *</span>
              </label>

              <div className="flex gap-2">
                <select
                  {...register("status", {
                    required: "Status is required",
                  })}
                  className="select select-bordered w-full"
                >
                  <option value="">Select Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-control">
            <Controller
              name="description"
              control={control}
              defaultValue=""
              render={({ field }) => (
                <AiDescriptionEditor
                  field={field}
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGeneratingDescription}
                  canGenerate={Boolean(String(watch("name") || "").trim())}
                />
              )}
            />
          </div>

          {productSettings.has_segmentation === 1 && (
            <div className="form-control col-span-2 mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="label">
                  <span className="label-text font-medium text-lg">
                    Segmentation
                  </span>
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    const lastName = watch(`segments.0.name`);
                    const lastValue = watch(`segments.0.value`);

                    if (
                      !fields.length ||
                      (lastName?.trim() && lastValue?.trim())
                    ) {
                      prepend({ name: "", value: "" }); // insert at the top
                    } else {
                      toast.error(
                        "Please fill out the first segment before adding a new one."
                      );
                    }
                  }}
                >
                  + Add Segment
                </button>
              </div>

              <div className="space-y-4 border rounded-md p-4 bg-gray-50">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end"
                  >
                    <div>
                      <label className="label">
                        <span className="label-text font-medium">
                          Segment Name
                        </span>
                      </label>
                      <input
                        type="text"
                        {...register(`segments.${index}.name`, {
                          required: true,
                        })}
                        placeholder="e.g. Location, Type"
                        className="input input-bordered w-full"
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="w-full">
                        <label className="label">
                          <span className="label-text font-medium">
                            Segment Value
                          </span>
                        </label>
                        <input
                          type="text"
                          {...register(`segments.${index}.value`, {
                            required: true,
                          })}
                          placeholder="e.g. Dhaka, Retail"
                          className="input input-bordered w-full"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="btn btn-error text-white"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary mt-4">
            Create Product
          </button>
        </form>
      </div>
    </div>
  );
}
