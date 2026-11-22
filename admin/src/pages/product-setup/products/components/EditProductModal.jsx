import { useState, useCallback, useEffect, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Webcam from "react-webcam";
import Quagga from "quagga";
import "react-quill/dist/quill.snow.css";
import { getproductSettings } from "../../../../api/productSettings";
import {
    fetchProductOptions,
    fetchProductDetail,
    getVariantAttributes,
    generateProductDescription,
    updateProduct,
} from "../../../../api/products";
import { getSalesChannels } from "../../../../api/purchase";
import CategoryForm from "../../category/components/CategoryForm";
import { storeCategories } from "../../../../api/category";
import BrandForm from "../../brand/components/BrandForm";
import { storeBrands } from "../../../../api/brand";
import { FaPlus, FaTrash } from "react-icons/fa";
import { PiArrowLeft, PiX } from "react-icons/pi";
import { normalizeDemandTags } from "../../../../utils/demandTags";
import { isFeatureIncludedInPlan } from "../../../../utils/planFeatures";
import VariantCombinationEditor from "./VariantCombinationEditor";
import AiDescriptionEditor from "../../../../components/common/AiDescriptionEditor";

export default function EditProductModal({
    editableData,
    setEditableData,
    fetchData,
    viewInStep = false,
    isDrawer = true,
    mode = false,
}) {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
    const companyPreferences = useSelector((state) => state.preferences?.data || {});
    const [step, setStep] = useState(1);
    const [productSettings, setProductSettings] = useState({});
    const [categoryList, setCategoryList] = useState([]);
    const [brandList, setBrandList] = useState([]);
    const [unitList, setUnitList] = useState([]);
    const [variantList, setVariantList] = useState([]);
    const [previewImage, setPreviewImage] = useState(null);
    const [featuredPreviewImage, setFeaturedPreviewImage] = useState(null);
    const [hasVariant, setHasVariant] = useState(false);
    const [hasSegment, setHasSegment] = useState(false);
    const [status, setStatus] = useState(false);
    const [variantPairs, setVariantPairs] = useState([
        { variant: null, value: null, options: [] },
    ]);
    const [variantInventory, setVariantInventory] = useState([]);
    const [variantSetup, setVariantSetup] = useState({
        dimensions: [{ variant: null, options: [] }],
        combinations: [{ values: {}, quantity: "", selling_price: "" }],
    });
    const [isBarcodeCameraActive, setIsBarcodeCameraActive] = useState(false);
    const [isImageCameraActive, setIsImageCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [showBrandForm, setShowBrandForm] = useState(false);
    const [salesChannelEnabled, setSalesChannelEnabled] = useState(false);
    const [stockVisibilityControlEnabled, setStockVisibilityControlEnabled] = useState(false);
    const [salesChannels, setSalesChannels] = useState([]);
    const [demandTagOptions, setDemandTagOptions] = useState([]);
    const [existingGalleryImages, setExistingGalleryImages] = useState([]);
    const [galleryFiles, setGalleryFiles] = useState([]);
    const [galleryPreviews, setGalleryPreviews] = useState([]);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const webcamRef = useRef(null);
    const quaggaTimeoutRef = useRef(null);
    const quaggaInitializedRef = useRef(false);
    const loadedEditDataIdRef = useRef(null);
    const editLoadRequestRef = useRef(0);

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        control,
        watch,
        trigger,
        reset,
        formState: { errors },
    } = useForm({
        defaultValues: {
            segments: [{ name: "", value: "" }],
            thumbnail: null,
            featured_image: null,
            is_featured: false,
            unit_id: "",
            vat: 0,
            return_enabled: false,
            return_day: "",
            return_condition: [{ value: "" }],
            sales_channel: {},
            demand_tags: [],
            stock_visibility: true,
            stock_visibility_label: "",
            is_group_purchase_available: false,
            group_purchase_discount_type: "fixed",
            group_purchase_minimum_user: 2,
            group_purchase_discount_amount: 0,
            initial_quantity: "",
            initial_selling_price: "",
        },
    });

    const productTitle = watch("name");
    const isFeatured = watch("is_featured");
    const returnEnabled = watch("return_enabled");
    const stockVisibility = watch("stock_visibility");
    const stockTrackingEnabled = ![false, 0, "0", "false"].includes(companyPreferences?.stock_tracking_enabled);
    const isGroupPurchaseAvailable = watch("is_group_purchase_available");
    const isAiFeatureEnabled = isFeatureIncludedInPlan(selectedPlanFeatures, "ftr_ai");
    const selectedDemandTags = normalizeDemandTags(watch("demand_tags"))
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean);

    const toggleDemandTag = (tagValue, checked) => {
        const normalizedTag = String(tagValue || "").trim().toLowerCase();
        const current = new Set(selectedDemandTags);

        if (checked) {
            current.add(normalizedTag);
        } else {
            current.delete(normalizedTag);
        }

        setValue("demand_tags", Array.from(current), { shouldDirty: true, shouldValidate: true });
    };

    const renderDemandTagsField = () => (
        <div className="form-control col-span-2">
            <label className="label">
                <span className="label-text">Demand Tags</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {demandTagOptions.map((tag) => (
                    <label
                        key={tag.value}
                        className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                        <input
                            type="checkbox"
                            disabled={mode}
                            checked={selectedDemandTags.includes(String(tag.value || "").trim().toLowerCase())}
                            onChange={(e) => toggleDemandTag(tag.value, e.target.checked)}
                            className="checkbox checkbox-sm checkbox-primary"
                        />
                        <span>{tag.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
    const renderStockVisibilityField = () => {
        if (!stockVisibilityControlEnabled) {
            return null;
        }

        return (
            <div className="form-control col-span-2 rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="label p-0">
                        <span className="label-text font-medium">Show Stock Quantity to Buyers</span>
                    </label>
                    <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        disabled={mode}
                        checked={!!stockVisibility}
                        onChange={(e) =>
                            setValue("stock_visibility", e.target.checked, {
                                shouldDirty: true,
                                shouldValidate: true,
                            })
                        }
                    />
                </div>
                {!stockVisibility && (
                    <div className="form-control mt-4">
                        <label className="label">
                            <span className="label-text">Buyer Stock Label</span>
                        </label>
                        <input
                            type="text"
                            maxLength={100}
                            placeholder="Available, Limited Stock, Ready to Ship"
                            disabled={mode}
                            {...register("stock_visibility_label")}
                            className="input input-bordered w-full"
                        />
                    </div>
                )}
            </div>
        );
    };
    const renderGroupPurchaseField = () => (
        <div className="col-span-2 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className="font-semibold text-gray-900">Group Purchase</h3>
                    <p className="text-sm text-gray-500">Enable shared buying with a minimum member target and discount rule.</p>
                </div>
                <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    disabled={mode}
                    checked={!!isGroupPurchaseAvailable}
                    onChange={(e) =>
                        setValue("is_group_purchase_available", e.target.checked, {
                            shouldDirty: true,
                            shouldValidate: true,
                        })
                    }
                />
            </div>

            {isGroupPurchaseAvailable && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Discount Type</span>
                        </label>
                        <select {...register("group_purchase_discount_type")} disabled={mode} className="select select-bordered w-full">
                            <option value="fixed">Fixed</option>
                            <option value="percent">Percent</option>
                        </select>
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Minimum Users</span>
                        </label>
                        <input
                            type="number"
                            min="2"
                            disabled={mode}
                            {...register("group_purchase_minimum_user", {
                                valueAsNumber: true,
                                min: { value: 2, message: "Minimum users must be at least 2" },
                            })}
                            className="input input-bordered w-full"
                        />
                        {errors.group_purchase_minimum_user && <span className="text-error text-sm">{errors.group_purchase_minimum_user.message}</span>}
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Discount Amount</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={mode}
                            {...register("group_purchase_discount_amount", {
                                valueAsNumber: true,
                                min: { value: 0, message: "Discount amount cannot be negative" },
                            })}
                            className="input input-bordered w-full"
                        />
                        {errors.group_purchase_discount_amount && <span className="text-error text-sm">{errors.group_purchase_discount_amount.message}</span>}
                    </div>
                </div>
            )}
        </div>
    );
    const isUnitFeatureEnabled = Array.isArray(productSettings?.preferences)
        ? productSettings.preferences.some(
            (preference) => preference.code === "ftr_unit_setup" && preference.is_active
        )
        : true;
    const isFeatureEnabled = (value) => value === 1 || value === true || value === "1" || value === "true";
    const isVariantFeatureEnabled = isFeatureEnabled(productSettings.has_variant);
    const isSegmentationFeatureEnabled = isFeatureEnabled(productSettings.has_segmentation);

    const { fields, prepend, remove, replace } = useFieldArray({
        control,
        name: "segments",
    });
    const {
        fields: returnConditionFields,
        append: appendReturnCondition,
        remove: removeReturnCondition,
        replace: replaceReturnCondition,
    } = useFieldArray({
        control,
        name: "return_condition",
    });

    const formatVariantsForRequest = () => {
        if (stockTrackingEnabled) {
            return variantPairs.filter((pair) => pair.variant && pair.value).map((pair) => ({
                [pair.variant.name.toLowerCase()]: pair.value.attribute_value,
            }));
        }
        return variantSetup.dimensions.flatMap((dimension) => {
            const key = dimension.variant?.name?.toLowerCase();
            if (!key) return [];
            return [...new Set(variantSetup.combinations.map((combination) => combination.values?.[key]).filter(Boolean))]
                .map((value) => ({ [key]: value }));
        });
    };

    const getVariantCombinations = () => variantSetup.combinations
        .map((combination) => combination.values)
        .filter((combination) => Object.keys(combination || {}).length > 0);

    const combinationKey = (combination) =>
        JSON.stringify(Object.fromEntries(Object.entries(combination || {}).sort(([a], [b]) => a.localeCompare(b))));

    const inventoryForCombination = (combination) =>
        variantSetup.combinations.find((item) => combinationKey(item.values) === combinationKey(combination)) || {};

    const updateCombinationInventory = (combination, field, value) => {
        const key = combinationKey(combination);
        setVariantSetup((previous) => {
            const index = previous.combinations.findIndex((item) => combinationKey(item.values) === key);
            const nextItem = {
                ...(index >= 0 ? previous.combinations[index] : {}),
                values: combination,
                [field]: value,
            };

            if (index >= 0) {
                const next = [...previous.combinations];
                next[index] = nextItem;
                return { ...previous, combinations: next };
            }

            return { ...previous, combinations: [...previous.combinations, nextItem] };
        });
    };

    const buildSalesChannelPercentages = (salesChannelValues = {}) =>
        salesChannels.reduce((acc, channel) => {
            const percentage = parseFloat(salesChannelValues?.[channel.code]) || 0;
            acc[channel.code] = percentage;
            return acc;
        }, {});

    const normalizeBoolean = (value, fallback = false) => {
        if (value === undefined || value === null || value === "") {
            return fallback;
        }

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number") {
            return value === 1;
        }

        const normalized = String(value).trim().toLowerCase();
        return ["1", "true", "yes", "on"].includes(normalized);
    };

    const normalizeVariantObject = (value) => {
        if (typeof value === "string") {
            try {
                value = JSON.parse(value);
            } catch {
                return {};
            }
        }

        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    };

    const variantInventoryItemMatches = (inventoryVariant, variantValue) => {
        const actual = normalizeVariantObject(inventoryVariant);
        const expected = normalizeVariantObject(variantValue);
        const actualEntries = Object.entries(actual);
        const expectedEntries = Object.entries(expected);

        return actualEntries.length === expectedEntries.length &&
            expectedEntries.every(([key, value]) =>
                String(actual[key] ?? "").trim().toLowerCase() === String(value ?? "").trim().toLowerCase()
            );
    };

    const normalizeSegments = (value) => {
        if (typeof value === "string") {
            try {
                value = JSON.parse(value);
            } catch {
                return [{ name: "", value: "" }];
            }
        }

        if (!Array.isArray(value)) {
            return [{ name: "", value: "" }];
        }

        const segments = value
            .map((segment) => ({
                name: segment?.name ?? segment?.segment_name ?? "",
                value: segment?.value ?? segment?.segment_value ?? "",
            }))
            .filter((segment) => segment.name || segment.value);

        return segments.length ? segments : [{ name: "", value: "" }];
    };

    const normalizeSegmentsForRequest = (segments = []) =>
        (Array.isArray(segments) ? segments : [])
            .map((segment) => ({
                name: String(segment?.name || "").trim(),
                value: String(segment?.value || "").trim(),
            }))
            .filter((segment) => segment.name && segment.value);

    const normalizeSalesChannelValues = (value) => {
        if (typeof value === "string") {
            try {
                value = JSON.parse(value);
            } catch {
                return {};
            }
        }

        if (!value || typeof value !== "object") {
            return {};
        }

        if (Array.isArray(value)) {
            return value.reduce((acc, item) => {
                const code = normalizeSalesChannelCode(item?.channel_code ?? item?.code);
                if (code) {
                    acc[code] = item?.percentage ?? item?.value ?? 0;
                }
                return acc;
            }, {});
        }

        return Object.entries(value).reduce((acc, [code, percentage]) => {
            const normalizedCode = normalizeSalesChannelCode(code);
            if (normalizedCode) {
                acc[normalizedCode] = percentage;
            }
            return acc;
        }, {});
    };

    const normalizeSalesChannelCode = (code) => {
        const normalized = String(code || "").trim().toLowerCase();
        const aliases = {
            online_store: "OS",
            "online store": "OS",
            onlinestore: "OS",
            pos_store: "POS",
            "pos store": "POS",
            posstore: "POS",
            wholesale: "WS",
        };

        return aliases[normalized] || String(code || "").trim().toUpperCase();
    };

    const validateSalesChannelPercentages = (salesChannelValues = {}) => {
        const total = Object.values(salesChannelValues).reduce(
            (sum, value) => sum + (parseFloat(value) || 0),
            0
        );

        if (total > 100) {
            toast.error("Sales channel percentages cannot exceed 100%.");
            return false;
        }

        return true;
    };

    const renderInitialInventoryFields = () => {
        if (stockTrackingEnabled) {
            return null;
        }

        if (!hasVariant) {
            return (
                <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 md:grid-cols-2">
                    <div className="form-control">
                        <label className="label"><span className="label-text font-medium">Quantity *</span></label>
                        <input type="number" min="0" step="1" disabled={mode}
                            {...register("initial_quantity", {
                                validate: (value) => (
                                    value === "" || Number.isInteger(Number(value))
                                        ? true
                                        : "Quantity must be a whole number"
                                ),
                            })} className="input input-bordered w-full" />
                        {errors.initial_quantity && <span className="text-error text-sm">{errors.initial_quantity.message}</span>}
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text font-medium">Selling Price *</span></label>
                        <input type="number" min="0" step="0.01" disabled={mode}
                            {...register("initial_selling_price")} className="input input-bordered w-full" />
                    </div>
                </div>
            );
        }

        return (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 font-medium text-amber-900">Quantity and selling price per combination</p>
                <div className="space-y-2">
                    {getVariantCombinations().map((combination) => {
                        const row = inventoryForCombination(combination);
                        return (
                        <div key={combinationKey(combination)} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                            <div className="flex items-center text-sm">
                                {Object.entries(combination).map(([key, value]) => `${key}: ${value}`).join(" / ")}
                            </div>
                            <input type="number" min="0" step="1" placeholder="Quantity" disabled={mode}
                                value={row.quantity ?? ""}
                                onChange={(e) => updateCombinationInventory(combination, "quantity", e.target.value)} className="input input-bordered w-full" />
                            <input type="number" min="0" step="0.01" placeholder="Selling price" disabled={mode}
                                value={row.selling_price ?? ""}
                                onChange={(e) => updateCombinationInventory(combination, "selling_price", e.target.value)} className="input input-bordered w-full" />
                        </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const handleVariantChange = async (index, variantId) => {
        if (!variantId) return; // Add this check

        const variant = variantList.find((v) => v.id == variantId); // Use loose equality like in ProductModal
        const res = await getVariantAttributes(accessToken, {
            variant_id: variantId
        });

        const newPairs = [...variantPairs];
        newPairs[index].variant = variant;
        newPairs[index].value = null;
        newPairs[index].options = res.status ? res.data : [];

        setVariantPairs(newPairs);
    };

    const nextStep = async () => {
        let isValid = false;

        if (step === 1) {
            const stepOneFields = ["name", "sku", "category_id", "brand_id", "vat"];
            if (isUnitFeatureEnabled) {
                stepOneFields.push("unit_id");
            }
            isValid = await trigger(stepOneFields);
            if (!isValid) return;
            if (isVariantFeatureEnabled && hasVariant) {
                setStep(2);
                return;
            }
            if (isSegmentationFeatureEnabled && hasSegment) {
                setStep(3);
                return;
            }
            setStep(4);
            return;
        }

        if (step === 2) {
            if (stockTrackingEnabled) {
                if (variantPairs.some((pair) => !pair.variant || !pair.value)) {
                    toast.error("Please select both variant and value first");
                    return;
                }
            } else {
                if (variantSetup.dimensions.some((dimension) => !dimension.variant)) {
                    toast.error("Select every variant type first.");
                    return;
                }
                if (variantSetup.combinations.some((combination) =>
                    variantSetup.dimensions.some((dimension) => !combination.values?.[dimension.variant.name.toLowerCase()])
                )) {
                    toast.error("Complete every value in each combination.");
                    return;
                }
                const combinationKeys = variantSetup.combinations.map((combination) => combinationKey(combination.values));
                if (new Set(combinationKeys).size !== combinationKeys.length) {
                    toast.error("Duplicate combinations are not allowed.");
                    return;
                }
            }
            if (isSegmentationFeatureEnabled && hasSegment) {
                setStep(3);
                return;
            }
            setStep(4);
            return;
        }

        if (step === 3) {
            isValid = await trigger(["segments"]);
            if (!isValid) return;
            if (normalizeSegmentsForRequest(watch("segments")).length === 0) {
                toast.error("Please add at least one complete segment.");
                return;
            }
            setStep(4);
            return;
        }
    };

    const prevStep = () => {
        if (step <= 1) return;

        if (step === 4) {
            if (isSegmentationFeatureEnabled && hasSegment) {
                setStep(3);
                return;
            }
            if (isVariantFeatureEnabled && hasVariant) {
                setStep(2);
                return;
            }
            setStep(1);
            return;
        }

        if (step === 3) {
            if (isVariantFeatureEnabled && hasVariant) {
                setStep(2);
                return;
            }
            setStep(1);
            return;
        }

        if (step === 2) {
            setStep(1);
            return;
        }

        setStep((prev) => prev - 1);
    };

    const createBrand = async (formData) => {
        try {
            const formDataToSend = new FormData();
            formDataToSend.append("title", formData.title);
            formDataToSend.append("status", formData.status ? "1" : "0");
            formDataToSend.append("return_enabled", formData.return_enabled ? "1" : "0");
            formDataToSend.append("return_day", formData.return_day ?? "");
            formDataToSend.append(
                "return_condition",
                JSON.stringify(
                    Array.isArray(formData.return_condition)
                        ? formData.return_condition
                            .map((item) => String(item?.value || "").trim())
                            .filter(Boolean)
                        : []
                )
            );
            if (formData.image instanceof File) {
                formDataToSend.append("image", formData.image);
            }

            const response = await storeBrands(accessToken, formDataToSend);
            if (!response.status) {
                throw new Error(response.message || "Failed to create brand");
            }

            const allDependency = await fetchProductOptions(accessToken);
            setBrandList(allDependency.data.brands || []);
            setShowBrandForm(false);
            toast.success("Brand created successfully!");
        } catch (error) {
            if (error.response && error.response.status === 422) {
                toast.error(error.response.data.errors.join("\n"));
            } else {
                toast.error(error.message || "Failed to create brand");
            }
        }
    };

    const createCategory = async (formData) => {
        try {
            const formDataToSend = new FormData();
            formDataToSend.append("title", formData.title);
            formDataToSend.append("status", formData.status ? "1" : "0");
            formDataToSend.append("parentId", formData.ancestor_id || "");
            formDataToSend.append(
                "is_show_in_category_header",
                formData.is_show_in_category_header ? "1" : "0"
            );
            formDataToSend.append("return_enabled", formData.return_enabled ? "1" : "0");
            formDataToSend.append("return_day", formData.return_day ?? "");
            formDataToSend.append(
                "return_condition",
                JSON.stringify(
                    Array.isArray(formData.return_condition)
                        ? formData.return_condition
                            .map((item) => String(item?.value || "").trim())
                            .filter(Boolean)
                        : []
                )
            );
            if (formData.image instanceof File) {
                formDataToSend.append("image", formData.image);
            }

            const response = await storeCategories(accessToken, formDataToSend);
            if (!response.status) {
                throw new Error(response.message || "Failed to create category");
            }

            const allDependency = await fetchProductOptions(accessToken);
            setCategoryList(allDependency.data.categories || []);
            setShowCategoryForm(false);
            toast.success("Category created successfully!");
        } catch (error) {
            if (error.response && error.response.status === 422) {
                toast.error(error.response.data.errors.join("\n"));
            } else {
                toast.error(error.message || "Failed to create category");
            }
        }
    };

    const fetchProductSetup = useCallback(async () => {
        const settings = await getproductSettings(accessToken);
        if (settings.status) {
            setProductSettings(settings.data);
            const assignedPreferences = settings.data?.preferences || [];
            const salesChannelPreference = assignedPreferences.find(
                (preference) => preference.code === "ftr_sales_channel"
            );
            const stockVisibilityPreference = assignedPreferences.find(
                (preference) => preference.code === "ftr_stock_visibility_control"
            );
            setSalesChannelEnabled(!!salesChannelPreference?.is_active);
            setStockVisibilityControlEnabled(!!stockVisibilityPreference?.is_active);
        }

        const [options, channelResult] = await Promise.all([
            fetchProductOptions(accessToken),
            getSalesChannels(accessToken),
        ]);
        setCategoryList(options.data.categories || []);
        setBrandList(options.data.brands || []);
        const unitEnabled = Array.isArray(settings?.data?.preferences)
            ? settings.data.preferences.some(
                (preference) => preference.code === "ftr_unit_setup" && preference.is_active
            )
            : true;
        setUnitList(unitEnabled ? (options.data.units || []) : []);
        setVariantList(options.data.variants || []);
        setDemandTagOptions(Array.isArray(options?.data?.demand_tags) ? options.data.demand_tags : []);
        setSalesChannels(Array.isArray(channelResult?.data) ? channelResult.data : []);
    }, [accessToken]);

    useEffect(() => {
        fetchProductSetup();
        if (fields.length === 0) prepend({ name: "", value: "" });
    }, [fetchProductSetup, prepend, fields.length]);

    useEffect(() => {
        const requestId = ++editLoadRequestRef.current;
        const loadEditData = async () => {
            if (!editableData) {
                loadedEditDataIdRef.current = null;
                return;
            }

            let sourceData = editableData;
            if (editableData.id) {
                try {
                    const detailResult = await fetchProductDetail(accessToken, editableData.id);
                    if (requestId !== editLoadRequestRef.current) return;
                    if (detailResult?.status && detailResult.data) {
                        sourceData = {
                            ...editableData,
                            ...detailResult.data,
                            segments: detailResult.data.segments ?? detailResult.data.segmentation ?? editableData.segments,
                        };
                    }
                } catch (error) {
                    console.error("Failed to fetch latest product details:", error);
                }
            }

            const editDataId = sourceData.id || sourceData.code || sourceData.sku;
            const editDataKey = JSON.stringify({
                id: editDataId,
                updated_at: sourceData.updated_at || "",
                segments: sourceData.segments ?? sourceData.segmentation ?? [],
                has_segment: sourceData.has_segment,
            });
            if (requestId !== editLoadRequestRef.current) return;
            const shouldResetForm = loadedEditDataIdRef.current !== editDataKey;

            if (shouldResetForm) {
                const normalizedSegments = normalizeSegments(
                    sourceData.segments ?? sourceData.segmentation
                );
                const inventoryItems = Array.isArray(sourceData.inventory_items)
                    ? sourceData.inventory_items
                    : [];
                const baseInventory = inventoryItems.find((item) => !item.variant_id);
                reset({
                    name: sourceData.name || "",
                    sku: sourceData.code || "",
                    category_id: sourceData.category_id?.toString() || "",
                    brand_id: sourceData.brand_id?.toString() || "",
                    unit_id: sourceData.unit_id?.toString() || "",
                    segments: normalizedSegments,
                    description: sourceData.description || "",
                    return_enabled: normalizeBoolean(sourceData.return_enabled, false),
                    return_day: sourceData.return_day ?? "",
                    return_condition:
                        Array.isArray(sourceData.return_condition) && sourceData.return_condition.length > 0
                            ? sourceData.return_condition.map((item) => ({ value: item || "" }))
                            : [{ value: "" }],
                    status: normalizeBoolean(sourceData.status),
                    thumbnail: null,
                    featured_image: null,
                    is_featured: normalizeBoolean(
                        sourceData.is_featured ?? sourceData.isFeatured ?? sourceData.featured,
                        false
                    ),
                    vat: sourceData.vat || 0,
                    sales_channel: normalizeSalesChannelValues(sourceData.sales_channel),
                    demand_tags: normalizeDemandTags(sourceData.demand_tags),
                    stock_visibility: normalizeBoolean(sourceData.stock_visibility, true),
                    stock_visibility_label: sourceData.stock_visibility_label || "",
                    is_group_purchase_available: normalizeBoolean(sourceData.is_group_purchase_available, false),
                    group_purchase_discount_type: sourceData.group_purchase_discount_type || "fixed",
                    group_purchase_minimum_user: Number(sourceData.group_purchase_minimum_user || 2),
                    group_purchase_discount_amount: Number(sourceData.group_purchase_discount_amount || 0),
                    initial_quantity: baseInventory?.quantity ?? "",
                    initial_selling_price: baseInventory?.price ?? "",
                });
                setHasVariant(normalizeBoolean(sourceData.has_variant));
                setHasSegment(normalizeBoolean(sourceData.has_segment));
                setStatus(normalizeBoolean(sourceData.status));
                replace(normalizedSegments);
                setPreviewImage(sourceData.thumbnail || null);
                setFeaturedPreviewImage(
                    sourceData.featured_image ||
                    sourceData.featuredImage ||
                    sourceData.featured_image_url ||
                    null
                );
                const normalizedGallery = Array.isArray(sourceData.images) ? sourceData.images.filter(Boolean) : [];
                setExistingGalleryImages(normalizedGallery);
                setGalleryFiles([]);
                setGalleryPreviews(
                    normalizedGallery.map((image, index) => ({
                        id: `existing-${index}-${image}`,
                        src: image,
                        isExisting: true,
                    }))
                );
                loadedEditDataIdRef.current = editDataKey;
            }

            // Rebuild the edit rows from persisted full combinations.
            let sourceAttributes = sourceData.attributes ?? sourceData.variants;
            if (typeof sourceAttributes === "string") {
                try {
                    sourceAttributes = JSON.parse(sourceAttributes);
                } catch {
                    sourceAttributes = [];
                }
            }
            if (variantList.length > 0) {
                const inventoryItems = Array.isArray(sourceData.inventory_items ?? sourceData.inventoryItems)
                    ? (sourceData.inventory_items ?? sourceData.inventoryItems)
                    : [];
                const existingCombinationRows = sourceData.existing_combinations ?? sourceData.existingCombinations;
                const persistedCombinations = [
                    ...(Array.isArray(sourceData.variant_combinations) ? sourceData.variant_combinations : []),
                    ...(Array.isArray(existingCombinationRows) ? existingCombinationRows.map((item) => item?.combination) : []),
                    ...inventoryItems.map((item) => item?.variant_id),
                ].map(normalizeVariantObject).filter((item) => Object.keys(item).length > 0);
                const sourceEntries = Array.isArray(sourceAttributes)
                    ? sourceAttributes.flatMap((item) => Object.entries(normalizeVariantObject(item)))
                    : [];
                const fallbackCombination = sourceEntries.reduce((values, [name, value]) => {
                    const key = name.toLowerCase();
                    if (!values[key]) values[key] = value;
                    return values;
                }, {});
                const combinations = (persistedCombinations.length ? persistedCombinations : [fallbackCombination])
                    .filter((combination) => Object.keys(combination).length > 0)
                    .filter((combination, index, items) =>
                        items.findIndex((item) => combinationKey(item) === combinationKey(combination)) === index
                    );
                const dimensionNames = [...new Set(combinations.flatMap((combination) => Object.keys(combination)))];
                const dimensions = [];

                for (const dimensionName of dimensionNames) {
                    if (requestId !== editLoadRequestRef.current) return;
                    const variant = variantList.find((item) =>
                        item.name.toLowerCase() === dimensionName.toLowerCase()
                    );
                    if (!variant) continue;
                    const response = await getVariantAttributes(accessToken, { variant_id: variant.id });
                    dimensions.push({ variant, options: response.status ? response.data || [] : [] });
                }

                if (requestId !== editLoadRequestRef.current) return;
                setVariantSetup({
                    dimensions: dimensions.length ? dimensions : [{ variant: null, options: [] }],
                    combinations: combinations.map((combination) => {
                        const item = inventoryItems.find((inventoryItem) =>
                            variantInventoryItemMatches(inventoryItem.variant_id, combination)
                        );
                        return {
                            values: combination,
                            quantity: item?.quantity ?? "",
                            selling_price: item?.price ?? "",
                        };
                    }),
                });
                const pairs = dimensions.flatMap((dimension) => {
                    const key = dimension.variant.name.toLowerCase();
                    const values = [...new Set([
                        ...sourceEntries.filter(([name]) => name.toLowerCase() === key).map(([, value]) => value),
                        ...combinations.map((combination) => combination[key]).filter(Boolean),
                    ])];
                    return values.flatMap((value) => {
                        const option = dimension.options.find((item) =>
                            String(item.attribute_value).trim().toLowerCase() === String(value).trim().toLowerCase()
                        );
                        return option ? [{ variant: dimension.variant, value: option, options: dimension.options }] : [];
                    });
                });
                setVariantPairs(pairs.length ? pairs : [{ variant: null, value: null, options: [] }]);
                setVariantInventory([]);
            } else if (shouldResetForm) {
                setVariantPairs([{ variant: null, value: null, options: [] }]);
                setVariantInventory([]);
            }
        };

        if (editableData) {
            loadEditData();
        }
    }, [editableData, reset, variantList, replace, accessToken]);

    useEffect(() => {
        if (returnConditionFields.length === 0) {
            appendReturnCondition({ value: "" });
        }
    }, [appendReturnCondition, returnConditionFields.length]);

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file instanceof File) {
            setValue("thumbnail", file, { shouldValidate: true });
            setPreviewImage(URL.createObjectURL(file));
        } else {
            console.warn("No valid file selected:", file);
            toast.error("Please select a valid image file.");
        }
    };

    const handleFeaturedImageChange = (e) => {
        const file = e.target.files?.[0];

        if (file instanceof File) {
            setValue("featured_image", file, { shouldValidate: true });
            setFeaturedPreviewImage(URL.createObjectURL(file));
        } else {
            setValue("featured_image", null, { shouldValidate: true });
            setFeaturedPreviewImage(null);
        }
    };

    const handleFeaturedToggle = (checked) => {
        setValue("is_featured", checked, {
            shouldDirty: true,
            shouldValidate: true,
        });

        if (!checked) {
            setValue("featured_image", null, {
                shouldDirty: true,
                shouldValidate: true,
            });
            setFeaturedPreviewImage(null);
        }
    };

    const handleGenerateDescription = async (prompt = "") => {
        if (!isAiFeatureEnabled) {
            toast.error("AI feature is not included in the active plan.");
            return;
        }

        const productName = String(getValues("name") || "").trim();
        if (!productName) {
            toast.error("Please enter a product title first.");
            return;
        }

        const selectedCategory = categoryList.find((item) => String(item.id) === String(getValues("category_id"))?.trim())?.title || "";
        const selectedBrand = brandList.find((item) => String(item.id) === String(getValues("brand_id"))?.trim())?.title || "";
        const selectedUnit = unitList.find((item) => String(item.id) === String(getValues("unit_id"))?.trim())?.unit_name || "";

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
            notes: [
                selectedCategory ? `Category: ${selectedCategory}` : "",
                selectedBrand ? `Brand: ${selectedBrand}` : "",
                selectedUnit ? `Unit: ${selectedUnit}` : "",
            ]
                .filter(Boolean)
                .join("\n"),
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

    const handleGalleryChange = (e) => {
        const selectedFiles = Array.from(e.target.files || []).filter((file) => file instanceof File);

        if (selectedFiles.length === 0) {
            return;
        }

        setGalleryFiles((prev) => [...prev, ...selectedFiles]);
        setGalleryPreviews((prev) => [
            ...prev,
            ...selectedFiles.map((file, index) => ({
                id: `new-${file.name}-${file.size}-${file.lastModified}-${index}`,
                src: URL.createObjectURL(file),
                isExisting: false,
            })),
        ]);

        e.target.value = "";
    };

    const removeGalleryImage = (previewToRemove) => {
        if (previewToRemove.isExisting) {
            setExistingGalleryImages((prev) => prev.filter((image) => image !== previewToRemove.src));
        } else {
            const previewKey = previewToRemove.id.replace(/-\d+$/, "");
            setGalleryFiles((prev) =>
                prev.filter(
                    (file) => `new-${file.name}-${file.size}-${file.lastModified}` !== previewKey
                )
            );
        }

        setGalleryPreviews((prev) => prev.filter((image) => image.id !== previewToRemove.id));
    };

    const captureImage = () => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            fetch(imageSrc)
                .then((res) => res.blob())
                .then((blob) => {
                    const file = new File([blob], "product-image.jpg", { type: "image/jpeg" });
                    setValue("thumbnail", file, { shouldValidate: true });
                    setPreviewImage(imageSrc);
                    setIsImageCameraActive(false);
                    setCameraError(null);
                });
        } else {
            toast.error("Failed to capture image. Please try again.");
            setCameraError("Failed to capture image.");
        }
    };

    const scanBarcode = () => {
        if (!webcamRef.current || !webcamRef.current.video) {
            toast.error("Camera not ready. Please try again.");
            setCameraError("Camera not ready.");
            return;
        }

        Quagga.init(
            {
                inputStream: {
                    type: "LiveStream",
                    target: webcamRef.current.video,
                    constraints: {
                        facingMode: "environment",
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                },
                decoder: {
                    readers: [
                        "ean_reader",
                        "ean_8_reader",
                        "code_128_reader",
                        "code_39_reader",
                        "upc_reader",
                        "upc_e_reader",
                    ],
                },
                locate: true,
            },
            (err) => {
                if (err) {
                    console.error("Quagga initialization error:", err);
                    toast.error("Failed to initialize barcode scanner. Please try again.");
                    setCameraError("Failed to initialize barcode scanner.");
                    return;
                }

                quaggaInitializedRef.current = true;
                Quagga.start();

                Quagga.onDetected((result) => {
                    const code = result?.codeResult?.code;
                    if (code) {
                        setValue("sku", code);
                        toast.success(`Barcode scanned: ${code}`);
                        stopBarcodeScanner();
                        setIsBarcodeCameraActive(false);
                        setCameraError(null);
                    }
                });

                quaggaTimeoutRef.current = setTimeout(() => {
                    if (isBarcodeCameraActive && quaggaInitializedRef.current) {
                        toast.warn("No barcode detected. Stopping scanner.");
                        stopBarcodeScanner();
                        setIsBarcodeCameraActive(false);
                        setCameraError("No barcode detected.");
                    }
                }, 30000);
            }
        );
    };

    const stopBarcodeScanner = () => {
        if (quaggaInitializedRef.current) {
            try {
                Quagga.stop();
                Quagga.offDetected();
                Quagga.offProcessed();
                quaggaInitializedRef.current = false;
            } catch (error) {
                console.error("Error stopping Quagga:", error);
            }
        }
        if (quaggaTimeoutRef.current) {
            clearTimeout(quaggaTimeoutRef.current);
            quaggaTimeoutRef.current = null;
        }
    };

    const generateSku = () => {
        const sku = "SKU-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        setValue("sku", sku);
    };

    const handleCameraError = (error) => {
        setCameraError(error.message || "Failed to access camera. Please ensure permissions are granted.");
        toast.error(error.message || "Camera access failed. Check permissions.");
    };

    const videoConstraints = {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
    };

    useEffect(() => {
        return () => {
            stopBarcodeScanner();
        };
    }, []);

    const onSubmit = async (data) => {
        try {
            const formData = new FormData();
            const formattedVariants = formatVariantsForRequest();
            const normalizedSegments = hasSegment ? normalizeSegmentsForRequest(data.segments) : [];

            if (!stockTrackingEnabled && !mode) {
                if (hasVariant) {
                    const combinations = getVariantCombinations();
                    const incompleteVariant = combinations.some((combination) => {
                        const row = inventoryForCombination(combination);
                        return row.quantity === "" || row.selling_price === "" ||
                            Number(row.quantity) < 0 || !Number.isInteger(Number(row.quantity)) ||
                            Number(row.selling_price) < 0;
                    });
                    if (combinations.length === 0 || incompleteVariant) {
                        toast.error("Add quantity and selling price for every combination.");
                        setStep(2);
                        return;
                    }
                } else if (data.initial_quantity === "" || data.initial_selling_price === "") {
                    toast.error("Add quantity and selling price.");
                    return;
                }
            }

            if (hasSegment && normalizedSegments.length === 0) {
                toast.error("Please add at least one complete segment.");
                setStep(3);
                return;
            }

            formData.append("variant", JSON.stringify(formattedVariants));
            formData.append("name", data.name);
            formData.append("sku", data.sku);
            formData.append("category_id", data.category_id);
            formData.append("brand_id", data.brand_id);
            if (isUnitFeatureEnabled && data.unit_id) {
                formData.append("unit_id", data.unit_id);
            }
            formData.append("description", data.description);
            formData.append("return_enabled", data.return_enabled ? "1" : "0");
            formData.append("return_day", data.return_day ?? "");
            formData.append(
                "return_condition",
                JSON.stringify(
                    Array.isArray(data.return_condition)
                        ? data.return_condition
                            .map((item) => String(item?.value || "").trim())
                            .filter(Boolean)
                        : []
                )
            );
            formData.append("has_variant", hasVariant ? 1 : 0);
            if (!stockTrackingEnabled && !mode) {
                if (hasVariant) {
                    formData.append("initial_inventory", JSON.stringify(
                        getVariantCombinations().map((combination) => {
                            const row = inventoryForCombination(combination);
                            return {
                                variant_id: combination,
                                quantity: Number(row.quantity || 0),
                                selling_price: Number(row.selling_price || 0),
                            };
                        })
                    ));
                } else {
                    formData.append("initial_quantity", data.initial_quantity);
                    formData.append("initial_selling_price", data.initial_selling_price);
                }
            }
            if (hasVariant && !stockTrackingEnabled) {
                formData.append("variant_combinations", JSON.stringify(getVariantCombinations()));
            }
            formData.append("has_segment", hasSegment ? 1 : 0);
            formData.append("segments", JSON.stringify(normalizedSegments));
            if (hasSegment) {
                normalizedSegments.forEach((segment, index) => {
                    formData.append(`segments_array[${index}][name]`, segment.name || "");
                    formData.append(`segments_array[${index}][value]`, segment.value || "");
                });
            }
            formData.append("status", status ? 1 : 0);
            formData.append("vat", data.vat);
            formData.append("demand_tags", JSON.stringify(normalizeDemandTags(data.demand_tags)));
            if (stockVisibilityControlEnabled) {
                formData.append("stock_visibility", data.stock_visibility ? 1 : 0);
                formData.append("stock_visibility_label", data.stock_visibility_label || "");
            }
            formData.append("is_group_purchase_available", data.is_group_purchase_available ? 1 : 0);
            formData.append("group_purchase_discount_type", data.is_group_purchase_available ? data.group_purchase_discount_type : "");
            formData.append("group_purchase_minimum_user", data.is_group_purchase_available ? data.group_purchase_minimum_user : "");
            formData.append("group_purchase_discount_amount", data.is_group_purchase_available ? data.group_purchase_discount_amount : "");
            const salesChannelPercentages = buildSalesChannelPercentages(data.sales_channel);
            if (salesChannelEnabled && !validateSalesChannelPercentages(salesChannelPercentages)) {
                return;
            }
            formData.append("sales_channel", JSON.stringify(salesChannelEnabled ? salesChannelPercentages : {}));

            // Handle thumbnail
            if (data.thumbnail instanceof File) {
                formData.append("thumbnail", data.thumbnail);
            } else if (data.thumbnail instanceof FileList && data.thumbnail[0] instanceof File) {
                formData.append("thumbnail", data.thumbnail[0]);
            } else {
                console.warn("No valid thumbnail file:", data.thumbnail);
            }

            formData.append("is_featured", data.is_featured ? 1 : 0);

            if (data.is_featured && data.featured_image instanceof File) {
                formData.append("featured_image", data.featured_image);
            } else if (
                data.is_featured &&
                data.featured_image instanceof FileList &&
                data.featured_image[0] instanceof File
            ) {
                formData.append("featured_image", data.featured_image[0]);
            }

            existingGalleryImages.forEach((image) => {
                formData.append("existing_images[]", image);
            });

            galleryFiles.forEach((file) => {
                formData.append("images[]", file);
            });

            const response = await updateProduct(accessToken, editableData.id, formData);
            if (response.status) {
                toast.success("Product updated successfully!");
                fetchData();
                closeDrawer();
                setStep(1);
                reset();
                setPreviewImage(null);
                setFeaturedPreviewImage(null);
                setExistingGalleryImages([]);
                setGalleryFiles([]);
                setGalleryPreviews([]);
                setVariantPairs([{ variant: null, value: null, options: [] }]);
                setVariantSetup({
                    dimensions: [{ variant: null, options: [] }],
                    combinations: [{ values: {}, quantity: "", selling_price: "" }],
                });
                setStatus(false);
                setEditableData(null);
            }
        } catch (error) {
            console.error("Error submitting product:", error.response?.data || error.message);
            toast.error(error.response?.data?.message || error.message || "Failed to update product");
        }
    };

    const closeDrawer = () => {
        if (isDrawer) {
            document.getElementById("edit_product_drawer").checked = false;
        }

        reset({
            name: "",
            sku: "",
            category_id: "",
            brand_id: "",
            unit_id: "",
            description: "",
            return_day: "",
            return_condition: [{ value: "" }],
            thumbnail: null,
            featured_image: null,
            is_featured: false,
            segments: [{ name: "", value: "" }],
            status: false,
            vat: 0,
            sales_channel: {},
            demand_tags: [],
            stock_visibility: true,
            stock_visibility_label: "",
            is_group_purchase_available: false,
            group_purchase_discount_type: "fixed",
            group_purchase_minimum_user: 2,
            group_purchase_discount_amount: 0,
        });
        replace([{ name: "", value: "" }]);
        setHasVariant(false);
        setHasSegment(false);
        setVariantPairs([{ variant: null, value: null, options: [] }]);
        setVariantSetup({
            dimensions: [{ variant: null, options: [] }],
            combinations: [{ values: {}, quantity: "", selling_price: "" }],
        });
        setPreviewImage(null);
        setFeaturedPreviewImage(null);
        setExistingGalleryImages([]);
        setGalleryFiles([]);
        setGalleryPreviews([]);
        setStatus(false);
        setEditableData(null);
        loadedEditDataIdRef.current = null;
        setStep(1);
        setCameraError(null);
        stopBarcodeScanner();
        setShowCategoryForm(false);
        setShowBrandForm(false);
    };

    const handleLeftArrowClick = () => {
        if (showCategoryForm) {
            setShowCategoryForm(false);
        } else if (showBrandForm) {
            setShowBrandForm(false);
        } else {
            closeDrawer();
        }
    };

    const modalContent = (
        <>
            {!showCategoryForm && !showBrandForm ? (
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="flex items-center gap-6 mb-6">
                        <button
                            type="button"
                            onClick={handleLeftArrowClick}
                            className="btn btn-circle"
                            title="Close"
                        >
                            <PiX className="w-5 h-5" />
                        </button>
                        <h3 className="font-bold text-lg">{mode ? "View Product" : "Edit Product"}</h3>
                    </div>
                    <div className="mt-10">
                        {!viewInStep ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="form-control col-span-2">
                                    <label className="label">Product Title *</label>
                                    <input
                                        {...register("name", { required: "Title is required" })}
                                        className="input input-bordered w-full"
                                        disabled={mode}
                                    />
                                    {errors.name && <span className="text-error">{errors.name.message}</span>}
                                </div>
                                <div className="form-control col-span-2">
                                    <label className="label">Product SKU *</label>
                                    <div className="flex gap-2">
                                        <input
                                            {...register("sku", { required: "SKU is required" })}
                                            className="input input-bordered w-full"
                                            disabled={mode}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            disabled={mode}
                                            onClick={generateSku}
                                        >
                                            Generate
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsBarcodeCameraActive(!isBarcodeCameraActive);
                                                if (isBarcodeCameraActive) {
                                                    stopBarcodeScanner();
                                                    setCameraError(null);
                                                }
                                            }}
                                            className="btn btn-square btn-outline"
                                            disabled={mode}
                                            title={isBarcodeCameraActive ? "Stop Camera" : "Use Camera"}
                                        >
                                            {isBarcodeCameraActive ? "🛑" : "📷"}
                                        </button>
                                    </div>
                                    {errors.sku && <span className="text-error">{errors.sku.message}</span>}
                                    {isBarcodeCameraActive && (
                                        <div className="mt-4">
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                videoConstraints={videoConstraints}
                                                className="w-3/4 h-32 object-cover rounded-lg border mx-auto"
                                                onUserMediaError={handleCameraError}
                                            />
                                            {cameraError && (
                                                <p className="text-error text-center mt-2">{cameraError}</p>
                                            )}
                                            <div className="flex gap-2 mt-2 justify-center">
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={scanBarcode}
                                                    disabled={mode}
                                                >
                                                    Scan Barcode
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="form-control col-span-1">
                                    <label className="label">Category *</label>
                                    <div className="flex gap-2">
                                        <select
                                            {...register("category_id", { required: "Category is required" })}
                                            className="select select-bordered w-full"
                                            disabled={mode}
                                        >
                                            <option value="">Select</option>
                                            {categoryList.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.title}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            disabled={mode}
                                            onClick={() => setShowCategoryForm(true)}
                                        >
                                            <FaPlus />
                                        </button>
                                    </div>
                                    {errors.category_id && (
                                        <span className="text-error text-sm mt-1">{errors.category_id.message}</span>
                                    )}
                                </div>
                                <div className="form-control">
                                    <label className="label">Brand *</label>
                                    <div className="flex gap-2">
                                        <select
                                            {...register("brand_id", { required: "Brand is required" })}
                                            className="select select-bordered w-full"
                                            disabled={mode}
                                        >
                                            <option value="">Select</option>
                                            {brandList.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.title}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            disabled={mode}
                                            onClick={() => setShowBrandForm(true)}
                                        >
                                            <FaPlus />
                                        </button>
                                    </div>
                                    {errors.brand_id && <span className="text-error">{errors.brand_id.message}</span>}
                                </div>
                                {isUnitFeatureEnabled && (
                                    <div className="form-control">
                                        <label className="label">Unit *</label>
                                        <select
                                            {...register("unit_id", { required: "Unit is required" })}
                                            className="select select-bordered w-full"
                                            disabled={mode}
                                        >
                                            <option value="">Select</option>
                                            {unitList.map((unit) => (
                                                <option key={unit.id} value={unit.id}>
                                                    {unit.unit_name} ({unit.unit_code})
                                                </option>
                                            ))}
                                        </select>
                                        {errors.unit_id && <span className="text-error">{errors.unit_id.message}</span>}
                                    </div>
                                )}
                                <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">VAT (%)</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            max="100"
                                            placeholder="e.g. 15"
                                            {...register("vat", {
                                            min: { value: 0, message: "VAT cannot be negative" },
                                            max: { value: 100, message: "VAT cannot exceed 100%" },
                                            validate: (value) => (
                                                value === "" || Number.isNaN(value) || Number.isInteger(value)
                                                    ? true
                                                    : "VAT must be a whole number"
                                            ),
                                            valueAsNumber: true,
                                        })}
                                        className="input input-bordered w-full"
                                    />
                                    {errors.vat && <span className="text-error text-sm">{errors.vat.message}</span>}
                                </div>
                                </div>
                                {renderGroupPurchaseField()}
                                <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div className="flex items-center gap-4 pb-1">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            id="hasVariant"
                                            disabled={mode}
                                            checked={hasVariant}
                                            onChange={(e) => setHasVariant(e.target.checked)}
                                        />
                                        <label htmlFor="hasVariant" className="me-4">
                                            Add Variant
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-4 pb-1">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            id="hasSegment"
                                            disabled={mode}
                                            checked={hasSegment}
                                            onChange={(e) => setHasSegment(e.target.checked)}
                                        />
                                        <label htmlFor="hasSegment" className="me-4">
                                            Add Segmentations
                                        </label>
                                    </div>
                                    <div className="form-control rounded-lg border border-gray-200 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <label htmlFor="isFeatured" className="cursor-pointer font-medium">
                                                Featured Product
                                            </label>
                                            <input
                                                type="checkbox"
                                                className="toggle toggle-primary"
                                                id="isFeatured"
                                                disabled={mode}
                                                checked={!!isFeatured}
                                                onChange={(e) => handleFeaturedToggle(e.target.checked)}
                                            />
                                        </div>

                                        {isFeatured && (
                                            <div className="mt-4">
                                                <label className="label">
                                                    <span className="label-text">Featured Image</span>
                                                </label>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    disabled={mode}
                                                    onChange={handleFeaturedImageChange}
                                                    className="file-input file-input-bordered w-full"
                                                />
                                                {featuredPreviewImage && (
                                                    <img
                                                        src={featuredPreviewImage}
                                                        alt="Featured Preview"
                                                        className="mt-3 w-44 h-32 object-cover rounded-lg border"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {renderDemandTagsField()}
                                {renderStockVisibilityField()}
                                {salesChannelEnabled && salesChannels.length > 0 && (
                                    <div className="form-control col-span-2">
                                        <label className="label">
                                            <span className="label-text">Sales Channel Percentage</span>
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {salesChannels.map((channel) => (
                                                <div key={channel.code} className="form-control">
                                                    <label className="label">
                                                        <span className="label-text">{channel.value}</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        disabled={mode}
                                                        placeholder="0"
                                                        {...register(`sales_channel.${channel.code}`, {
                                                            min: { value: 0, message: "Percentage cannot be negative" },
                                                            max: { value: 100, message: "Percentage cannot exceed 100%" },
                                                            validate: (value) => (
                                                                value === "" || Number.isInteger(Number(value))
                                                                    ? true
                                                                    : "Percentage must be a whole number"
                                                            ),
                                                        })}
                                                        className="input input-bordered w-full"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isVariantFeatureEnabled && hasVariant && stockTrackingEnabled && (
                                    <div className="space-y-4">
                                        <div className="overflow-x-auto">
                                            <table className="w-full table-auto">
                                                <thead>
                                                    <tr className="text-left">
                                                        <th className="w-1/2 py-2">Variant</th>
                                                        <th className="w-1/2 py-2">Value</th>
                                                        <th className="w-[50px] text-right py-2">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {variantPairs.map((pair, index) => (
                                                        <tr key={index} className="align-top">
                                                            <td className="pr-2 py-2">
                                                                <select
                                                                    className="select select-bordered w-full"
                                                                    disabled={mode}
                                                                    value={pair.variant?.id || ""}
                                                                    onChange={(e) => handleVariantChange(index, e.target.value)}
                                                                >
                                                                    <option value="">Select Variant</option>
                                                                    {variantList.map((v) => (
                                                                        <option key={v.id} value={v.id}>
                                                                            {v.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td className="pr-2 py-2">
                                                                <select
                                                                    className="select select-bordered w-full"
                                                                    value={pair.value?.id || ""}
                                                                    onChange={(e) => {
                                                                        const attr = pair.options.find((a) => a.id == e.target.value);
                                                                        const newPairs = [...variantPairs];
                                                                        newPairs[index].value = attr;
                                                                        setVariantPairs(newPairs);
                                                                    }}
                                                                    disabled={!pair.variant || mode}
                                                                >
                                                                    <option value="">Select Value</option>
                                                                    {pair.options?.map((item) => (
                                                                        <option key={item.id} value={item.id}>
                                                                            {item.attribute_value}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td className="text-right py-2">
                                                                {index === 0 ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-circle btn-primary"
                                                                        disabled={mode}
                                                                        onClick={() => {
                                                                            const last = variantPairs[variantPairs.length - 1];
                                                                            if (!last.variant || !last.value) {
                                                                                toast.error("Please select both variant and value first");
                                                                                return;
                                                                            }
                                                                            const isDuplicate = variantPairs
                                                                                .slice(0, -1)
                                                                                .some(
                                                                                    (p) =>
                                                                                        p.variant?.id === last.variant.id &&
                                                                                        p.value?.id === last.value.id
                                                                                );
                                                                            if (isDuplicate) {
                                                                                toast.error("This variant & value is already added");
                                                                                return;
                                                                            }
                                                                            setVariantPairs((prev) => [
                                                                                ...prev,
                                                                                { variant: null, value: null, options: [] },
                                                                            ]);
                                                                        }}
                                                                    >
                                                                        <FaPlus className="text-sm" />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-circle btn-error"
                                                                        disabled={mode}
                                                                        onClick={() => {
                                                                            const updated = variantPairs.filter((_, i) => i !== index);
                                                                            setVariantPairs(updated);
                                                                            setVariantInventory((previous) => previous.filter((_, i) => i !== index));
                                                                        }}
                                                                    >
                                                                        <FaTrash className="text-sm" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {isVariantFeatureEnabled && hasVariant && !stockTrackingEnabled && (
                                    <div className="col-span-2">
                                        <VariantCombinationEditor
                                            variantList={variantList}
                                            accessToken={accessToken}
                                            dimensions={variantSetup.dimensions}
                                            combinations={variantSetup.combinations}
                                            onChange={setVariantSetup}
                                            disabled={mode}
                                            showPricing={!stockTrackingEnabled}
                                        />
                                    </div>
                                )}
                                {isSegmentationFeatureEnabled && hasSegment && (
                                    <div className="form-control col-span-2">
                                        <div className="flex justify-end items-center mb-2">
                                            <button
                                                disabled={mode}
                                                type="button"
                                                className="btn btn-outline btn-sm"
                                                onClick={() => {
                                                    const first = watch("segments.0.name");
                                                    const second = watch("segments.0.value");
                                                    if (!fields.length || (first?.trim() && second?.trim())) {
                                                        prepend({ name: "", value: "" });
                                                    } else {
                                                        toast.error("Fill previous segment first.");
                                                    }
                                                }}
                                            >
                                                <FaPlus />
                                            </button>
                                        </div>
                                        <div className="space-y-4">
                                            {fields.map((field, index) => (
                                                <div
                                                    key={field.id}
                                                    className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
                                                >
                                                    <div className="md:col-span-5">
                                                        <label className="label text-sm font-medium">Segment Name</label>
                                                        <input
                                                            disabled={mode}
                                                            placeholder="e.g. Color"
                                                            {...register(`segments.${index}.name`, {
                                                                required: "Segment name is required",
                                                            })}
                                                            className="input input-bordered w-full"
                                                        />
                                                        {errors.segments?.[index]?.name && (
                                                            <span className="text-error">
                                                                {errors.segments[index].name.message}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="md:col-span-5">
                                                        <label className="label text-sm font-medium">Segment Value</label>
                                                        <input
                                                            disabled={mode}
                                                            placeholder="e.g. Red"
                                                            {...register(`segments.${index}.value`, {
                                                                required: "Segment value is required",
                                                            })}
                                                            className="input input-bordered w-full"
                                                        />
                                                        {errors.segments?.[index]?.value && (
                                                            <span className="text-error">
                                                                {errors.segments[index].value.message}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="md:col-span-2 flex items-end">
                                                        <button
                                                            disabled={mode}
                                                            type="button"
                                                            onClick={() => remove(index)}
                                                            className="btn btn-error w-full"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                  <div className="form-control col-span-2 mt-3">
                                      {!isAiFeatureEnabled && (
                                          <p className="mt-2 text-sm text-amber-600">
                                              AI feature is not included in the active plan.
                                          </p>
                                      )}
                                      <Controller
                                          name="description"
                                          control={control}
                                          render={({ field }) => (
                                            <AiDescriptionEditor
                                                field={field}
                                                onGenerate={handleGenerateDescription}
                                                isGenerating={isGeneratingDescription}
                                                canGenerate={Boolean(String(productTitle || "").trim()) && isAiFeatureEnabled}
                                                  readOnly={mode}
                                              />
                                        )}
                                    />
                                </div>
                                <div className="form-control col-span-2 mt-3">
                                    <label className="label font-semibold">Product Image</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            disabled={mode}
                                            onChange={handleImageChange}
                                            className="file-input file-input-bordered w-full"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsImageCameraActive(!isImageCameraActive)}
                                            className="btn btn-square btn-outline"
                                            disabled={mode}
                                            title={isImageCameraActive ? "Stop Camera" : "Use Camera"}
                                        >
                                            {isImageCameraActive ? "🛑" : "📷"}
                                        </button>
                                    </div>
                                    {errors.thumbnail && <span className="text-error">{errors.thumbnail.message}</span>}
                                    {isImageCameraActive && (
                                        <div className="mt-4">
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                videoConstraints={videoConstraints}
                                                className="w-3/4 h-48 object-cover rounded-lg border mx-auto"
                                                onUserMediaError={handleCameraError}
                                            />
                                            {cameraError && (
                                                <p className="text-error text-center mt-2">{cameraError}</p>
                                            )}
                                            <div className="flex gap-2 mt-2 justify-center">
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={captureImage}
                                                    disabled={mode}
                                                >
                                                    Capture Image
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {previewImage && (
                                        <img
                                            src={previewImage}
                                            alt="Preview"
                                            className="w-44 h-48 object-cover rounded-lg border"
                                        />
                                    )}
                                </div>
                                <div className="form-control col-span-2 mt-3">
                                    <label className="label font-semibold">Product Gallery</label>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        multiple
                                        disabled={mode}
                                        onChange={handleGalleryChange}
                                        className="file-input file-input-bordered w-full"
                                    />
                                    {galleryPreviews.length > 0 && (
                                        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                                            {galleryPreviews.map((image, index) => (
                                                <div key={image.id} className="relative overflow-hidden rounded-lg border bg-white p-2">
                                                    <img
                                                        src={image.src}
                                                        alt={`Gallery ${index + 1}`}
                                                        className="h-28 w-full rounded object-cover"
                                                    />
                                                    {!mode && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-circle btn-error absolute right-2 top-2"
                                                            onClick={() => removeGalleryImage(image)}
                                                        >
                                                            <PiX className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="form-control col-span-2 mt-3">
                                    <label className="label font-semibold">Product Status</label>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm">Inactive</span>
                                        <input
                                            type="checkbox"
                                            disabled={mode}
                                            className="toggle toggle-primary"
                                            checked={status}
                                            onChange={() => setStatus(!status)}
                                        />
                                        <span className="text-sm">Active</span>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={mode}
                                    className="btn btn-success text-white w-36"
                                >
                                    Update Product
                                </button>
                            </div>
                        ) : (
                            <div>
                                {step === 1 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="form-control col-span-2">
                                            <label className="label">Product Title *</label>
                                            <input
                                                {...register("name", { required: "Title is required" })}
                                                className="input input-bordered w-full"
                                                disabled={mode}
                                            />
                                            {errors.name && <span className="text-error">{errors.name.message}</span>}
                                        </div>
                                        <div className="form-control col-span-2">
                                            <label className="label">Product SKU *</label>
                                            <div className="flex gap-2">
                                                <input
                                                    {...register("sku", { required: "SKU is required" })}
                                                    className="input input-bordered w-full"
                                                    disabled={mode}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-outline"
                                                    disabled={mode}
                                                    onClick={generateSku}
                                                >
                                                    Generate
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsBarcodeCameraActive(!isBarcodeCameraActive);
                                                        if (isBarcodeCameraActive) {
                                                            stopBarcodeScanner();
                                                            setCameraError(null);
                                                        }
                                                    }}
                                                    className="btn btn-square btn-outline"
                                                    disabled={mode}
                                                    title={isBarcodeCameraActive ? "Stop Camera" : "Use Camera"}
                                                >
                                                    {isBarcodeCameraActive ? "🛑" : "📷"}
                                                </button>
                                            </div>
                                            {errors.sku && <span className="text-error">{errors.sku.message}</span>}
                                            {isBarcodeCameraActive && (
                                                <div className="mt-4">
                                                    <Webcam
                                                        audio={false}
                                                        ref={webcamRef}
                                                        screenshotFormat="image/jpeg"
                                                        videoConstraints={videoConstraints}
                                                        className="w-48 h-24 object-cover rounded-lg border"
                                                        onUserMediaError={handleCameraError}
                                                    />
                                                    {cameraError && (
                                                        <p className="text-error text-center mt-2">{cameraError}</p>
                                                    )}
                                                    <div className="flex gap-2 mt-2 justify-left">
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary"
                                                            onClick={scanBarcode}
                                                            disabled={mode}
                                                        >
                                                            Scan Barcode
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="form-control col-span-1">
                                            <label className="label">Category *</label>
                                            <div className="flex gap-2">
                                                <select
                                                    {...register("category_id", { required: "Category is required" })}
                                                    className="select select-bordered w-full"
                                                    disabled={mode}
                                                >
                                                    <option value="">Select</option>
                                                    {categoryList.map((cat) => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.title}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline"
                                                    disabled={mode}
                                                    onClick={() => setShowCategoryForm(true)}
                                                >
                                                    <FaPlus />
                                                </button>
                                            </div>
                                            {errors.category_id && (
                                                <span className="text-error text-sm mt-1">{errors.category_id.message}</span>
                                            )}
                                        </div>
                                        <div className="form-control">
                                            <label className="label">Brand *</label>
                                            <div className="flex gap-2">
                                                <select
                                                    {...register("brand_id", { required: "Brand is required" })}
                                                    className="select select-bordered w-full"
                                                    disabled={mode}
                                                >
                                                    <option value="">Select</option>
                                                    {brandList.map((b) => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.title}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline"
                                                    disabled={mode}
                                                    onClick={() => setShowBrandForm(true)}
                                                >
                                                    <FaPlus />
                                                </button>
                                            </div>
                                            {errors.brand_id && <span className="text-error">{errors.brand_id.message}</span>}
                                        </div>
                                        {isUnitFeatureEnabled && (
                                            <div className="form-control">
                                                <label className="label">Unit *</label>
                                                <select
                                                    {...register("unit_id", { required: "Unit is required" })}
                                                    className="select select-bordered w-full"
                                                    disabled={mode}
                                                >
                                                    <option value="">Select</option>
                                                    {unitList.map((unit) => (
                                                        <option key={unit.id} value={unit.id}>
                                                            {unit.unit_name} ({unit.unit_code})
                                                        </option>
                                                    ))}
                                                </select>
                                                {errors.unit_id && <span className="text-error">{errors.unit_id.message}</span>}
                                            </div>
                                        )}

                                        <div className="col-span-2 grid grid-cols-3 gap-4 items-end">
                                             <div className="form-control">
                                                <label className="label">
                                                    <span className="label-text">VAT (%)</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    max="100"
                                                    value={watch().vat}
                                                    placeholder="e.g. 15"
                                                    {...register("vat", {
                                                    min: { value: 0, message: "VAT cannot be negative" },
                                                    max: { value: 100, message: "VAT cannot exceed 100%" },
                                                    validate: (value) => (
                                                        value === "" || Number.isNaN(value) || Number.isInteger(value)
                                                            ? true
                                                            : "VAT must be a whole number"
                                                    ),
                                                    valueAsNumber: true,
                                                })}
                                                className="input input-bordered w-full"
                                            />
                                            {errors.vat && <span className="text-error text-sm">{errors.vat.message}</span>}
                                        </div>
                                        </div>
                                        {renderGroupPurchaseField()}

                                        <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                            <div className="flex items-center gap-4 pb-1">
                                                <input
                                                    type="checkbox"
                                                    className="toggle toggle-primary"
                                                    id="hasVariant"
                                                    disabled={mode}
                                                    checked={hasVariant}
                                                    onChange={(e) => setHasVariant(e.target.checked)}
                                                />
                                                <label htmlFor="hasVariant" className="me-4">
                                                    Add Variant
                                                </label>
                                            </div>
                                            <div className="flex items-center gap-4 pb-1">
                                                <input
                                                    type="checkbox"
                                                    className="toggle toggle-primary"
                                                    id="hasSegment"
                                                    disabled={mode}
                                                    checked={hasSegment}
                                                    onChange={(e) => setHasSegment(e.target.checked)}
                                                />
                                                <label htmlFor="hasSegment" className="me-4">
                                                    Add Segmentations
                                                </label>
                                            </div>
                                            <div className="form-control rounded-lg border border-gray-200 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <label htmlFor="isFeaturedStep" className="cursor-pointer font-medium">
                                                        Featured Product
                                                    </label>
                                                    <input
                                                        type="checkbox"
                                                        className="toggle toggle-primary"
                                                        id="isFeaturedStep"
                                                        disabled={mode}
                                                        checked={!!isFeatured}
                                                        onChange={(e) => handleFeaturedToggle(e.target.checked)}
                                                    />
                                                </div>

                                                {isFeatured && (
                                                    <div className="mt-4">
                                                        <label className="label">
                                                            <span className="label-text">Featured Image</span>
                                                        </label>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            disabled={mode}
                                                            onChange={handleFeaturedImageChange}
                                                            className="file-input file-input-bordered w-full"
                                                        />
                                                        {featuredPreviewImage && (
                                                            <img
                                                                src={featuredPreviewImage}
                                                                alt="Featured Preview"
                                                                className="mt-3 w-44 h-32 object-cover rounded-lg border"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {renderDemandTagsField()}
                                        {renderStockVisibilityField()}
                                        {salesChannelEnabled && salesChannels.length > 0 && (
                                            <div className="form-control col-span-2">
                                                <label className="label">
                                                    <span className="label-text">Sales Channel Percentage</span>
                                                </label>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    {salesChannels.map((channel) => (
                                                        <div key={channel.code} className="form-control">
                                                            <label className="label">
                                                                <span className="label-text">{channel.value}</span>
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                step="1"
                                                                disabled={mode}
                                                                placeholder="0"
                                                                {...register(`sales_channel.${channel.code}`, {
                                                                    min: { value: 0, message: "Percentage cannot be negative" },
                                                                    max: { value: 100, message: "Percentage cannot exceed 100%" },
                                                                    validate: (value) => (
                                                                        value === "" || Number.isInteger(Number(value))
                                                                            ? true
                                                                            : "Percentage must be a whole number"
                                                                    ),
                                                                })}
                                                                className="input input-bordered w-full"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {step === 2 && isVariantFeatureEnabled && hasVariant && stockTrackingEnabled && (
                                    <div className="space-y-4">
                                        <p>Product Title: {productTitle}</p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full table-auto">
                                                <thead>
                                                    <tr className="text-left">
                                                        <th className="w-1/2 py-2">Variant</th>
                                                        <th className="w-1/2 py-2">Value</th>
                                                        <th className="w-[50px] text-right py-2">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {variantPairs.map((pair, index) => (
                                                        <tr key={index} className="align-top">
                                                            <td className="pr-2 py-2">
                                                                <select
                                                                    className="select select-bordered w-full"
                                                                    disabled={mode}
                                                                    value={pair.variant?.id || ""}
                                                                    onChange={(e) => handleVariantChange(index, e.target.value)}
                                                                >
                                                                    <option value="">Select Variant</option>
                                                                    {variantList.map((v) => (
                                                                        <option key={v.id} value={v.id}>
                                                                            {v.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td className="pr-2 py-2">
                                                                <select
                                                                    className="select select-bordered w-full"
                                                                    value={pair.value?.id || ""}
                                                                    onChange={(e) => {
                                                                        const attr = pair.options.find((a) => a.id == e.target.value);
                                                                        const newPairs = [...variantPairs];
                                                                        newPairs[index].value = attr;
                                                                        setVariantPairs(newPairs);
                                                                    }}
                                                                    disabled={!pair.variant || mode}
                                                                >
                                                                    <option value="">Select Value</option>
                                                                    {pair.options?.map((item) => (
                                                                        <option key={item.id} value={item.id}>
                                                                            {item.attribute_value}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td className="text-right py-2">
                                                                {index === 0 ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-circle btn-primary"
                                                                        disabled={mode}
                                                                        onClick={() => {
                                                                            const last = variantPairs[variantPairs.length - 1];
                                                                            if (!last.variant || !last.value) {
                                                                                toast.error("Please select both variant and value first");
                                                                                return;
                                                                            }
                                                                            const isDuplicate = variantPairs
                                                                                .slice(0, -1)
                                                                                .some(
                                                                                    (p) =>
                                                                                        p.variant?.id === last.variant.id &&
                                                                                        p.value?.id === last.value.id
                                                                                );
                                                                            if (isDuplicate) {
                                                                                toast.error("This variant & value is already added");
                                                                                return;
                                                                            }
                                                                            setVariantPairs((prev) => [
                                                                                ...prev,
                                                                                { variant: null, value: null, options: [] },
                                                                            ]);
                                                                        }}
                                                                    >
                                                                        <FaPlus className="text-sm" />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-circle btn-error"
                                                                        disabled={mode}
                                                                        onClick={() => {
                                                                            const updated = variantPairs.filter((_, i) => i !== index);
                                                                            setVariantPairs(updated);
                                                                            setVariantInventory((previous) => previous.filter((_, i) => i !== index));
                                                                        }}
                                                                    >
                                                                        <FaTrash className="text-sm" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {step === 2 && isVariantFeatureEnabled && hasVariant && !stockTrackingEnabled && (
                                    <VariantCombinationEditor
                                        variantList={variantList}
                                        accessToken={accessToken}
                                        dimensions={variantSetup.dimensions}
                                        combinations={variantSetup.combinations}
                                        onChange={setVariantSetup}
                                        disabled={mode}
                                        showPricing={!stockTrackingEnabled}
                                    />
                                )}
                                {step === 3 && isSegmentationFeatureEnabled && hasSegment && (
                                    <div className="space-y-4">
                                        <p>Product Title: {productTitle}</p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full table-auto">
                                                <thead>
                                                    <tr className="text-left">
                                                        <th className="w-1/2 py-2">Segment Name</th>
                                                        <th className="w-1/2 py-2">Segment Value</th>
                                                        <th className="w-[50px] text-right py-2">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {fields.map((field, index) => (
                                                        <tr key={field.id}>
                                                            <td className="pr-2 py-2 align-top">
                                                                <input
                                                                    disabled={mode}
                                                                    placeholder="e.g. Color"
                                                                    {...register(`segments.${index}.name`, {
                                                                        required: "Segment name is required",
                                                                    })}
                                                                    className="input input-bordered w-full"
                                                                />
                                                                {errors.segments?.[index]?.name && (
                                                                    <span className="text-error text-sm">
                                                                        {errors.segments[index].name.message}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="pr-2 py-2 align-top">
                                                                <input
                                                                    disabled={mode}
                                                                    placeholder="e.g. Red"
                                                                    {...register(`segments.${index}.value`, {
                                                                        required: "Segment value is required",
                                                                    })}
                                                                    className="input input-bordered w-full"
                                                                />
                                                                {errors.segments?.[index]?.value && (
                                                                    <span className="text-error text-sm">
                                                                        {errors.segments[index].value.message}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="text-right py-2 align-top">
                                                                {index === 0 ? (
                                                                    <button
                                                                        disabled={mode}
                                                                        type="button"
                                                                        className="btn btn-sm btn-circle btn-primary"
                                                                        onClick={() => {
                                                                            const first = watch("segments.0.name");
                                                                            const second = watch("segments.0.value");
                                                                            if (!fields.length || (first?.trim() && second?.trim())) {
                                                                                prepend({ name: "", value: "" });
                                                                            } else {
                                                                                toast.error("Fill previous segment first.");
                                                                            }
                                                                        }}
                                                                    >
                                                                        <FaPlus className="text-sm" />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        disabled={mode}
                                                                        type="button"
                                                                        onClick={() => remove(index)}
                                                                        className="btn btn-sm btn-circle btn-error"
                                                                    >
                                                                        <FaTrash className="text-sm" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {step === 4 && (
                                    <div>
                                        <p>Product Title: {productTitle}</p>
                                        {!hasVariant && renderInitialInventoryFields()}
                                        <div className="form-control">
                                        {!isAiFeatureEnabled && (
                                            <p className="mt-2 text-sm text-amber-600">
                                                AI feature is not included in the active plan.
                                            </p>
                                        )}
                                        <Controller
                                            name="description"
                                            control={control}
                                            render={({ field }) => (
                                                <AiDescriptionEditor
                                                    field={field}
                                                    onGenerate={handleGenerateDescription}
                                                    isGenerating={isGeneratingDescription}
                                                    canGenerate={Boolean(String(productTitle || "").trim()) && isAiFeatureEnabled}
                                                    readOnly={mode}
                                                />
                                            )}
                                        />
                                    </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div className="form-control md:col-span-2">
                                                <label className="label cursor-pointer justify-start gap-4">
                                                    <input
                                                        type="checkbox"
                                                        className="toggle toggle-primary"
                                                        disabled={mode}
                                                        checked={!!returnEnabled}
                                                        onChange={(e) =>
                                                            setValue("return_enabled", e.target.checked, {
                                                                shouldDirty: true,
                                                                shouldValidate: true,
                                                            })
                                                        }
                                                    />
                                                    <span className="label-text">Return Enabled</span>
                                                </label>
                                                <p className="text-xs text-gray-500">
                                                    Enable product-specific return rules.
                                                </p>
                                            </div>
                                            <div className="form-control">
                                                <label className="label">Return Day</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    disabled={mode}
                                                    {...register("return_day")}
                                                    className="input input-bordered w-full"
                                                    placeholder="e.g. 7"
                                                    readOnly={!returnEnabled}
                                                />
                                            </div>
                                            <div className="form-control md:col-span-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="label">
                                                        <span className="label-text">Return Conditions</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => appendReturnCondition({ value: "" })}
                                                        className="btn btn-sm btn-outline"
                                                        disabled={mode}
                                                    >
                                                        Add Field
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {returnConditionFields.map((field, index) => (
                                                        <div key={field.id} className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                disabled={mode || !returnEnabled}
                                                                {...register(`return_condition.${index}.value`)}
                                                                className="input input-bordered flex-1"
                                                                placeholder={`Return condition ${index + 1}`}
                                                            />
                                                            <button
                                                                type="button"
                                                                disabled={mode || !returnEnabled}
                                                                onClick={() =>
                                                                    returnConditionFields.length > 1
                                                                        ? removeReturnCondition(index)
                                                                        : replaceReturnCondition([{ value: "" }])
                                                                }
                                                                className="btn btn-outline btn-error"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="form-control">
                                            <label className="label">Product Image</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    disabled={mode}
                                                    onChange={handleImageChange}
                                                    className="file-input file-input-bordered w-full"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setIsImageCameraActive(!isImageCameraActive)}
                                                    className="btn btn-square btn-outline"
                                                    disabled={mode}
                                                    title={isImageCameraActive ? "Stop Camera" : "Use Camera"}
                                                >
                                                    {isImageCameraActive ? "🛑" : "📷"}
                                                </button>
                                            </div>
                                            {errors.thumbnail && <span className="text-error">{errors.thumbnail.message}</span>}
                                            {isImageCameraActive && (
                                                <div className="mt-4">
                                                    <Webcam
                                                        audio={false}
                                                        ref={webcamRef}
                                                        screenshotFormat="image/jpeg"
                                                        videoConstraints={videoConstraints}
                                                        className="w-44 h-48 object-cover rounded-lg border"
                                                        onUserMediaError={handleCameraError}
                                                    />
                                                    {cameraError && (
                                                        <p className="text-error text-center mt-2">{cameraError}</p>
                                                    )}
                                                    <div className="flex gap-2 mt-2 justify-left">
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary"
                                                            onClick={captureImage}
                                                            disabled={mode}
                                                        >
                                                            Capture Image
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {previewImage && (
                                                <img
                                                    src={previewImage}
                                                    alt="Preview"
                                                    className="w-44 h-48 object-cover rounded-lg border"
                                                />
                                            )}
                                        </div>
                                        <div className="form-control mt-4">
                                            <label className="label">Product Gallery</label>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp,image/gif"
                                                multiple
                                                disabled={mode}
                                                onChange={handleGalleryChange}
                                                className="file-input file-input-bordered w-full"
                                            />
                                            {galleryPreviews.length > 0 && (
                                                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                                                    {galleryPreviews.map((image, index) => (
                                                        <div key={image.id} className="relative overflow-hidden rounded-lg border bg-white p-2">
                                                            <img
                                                                src={image.src}
                                                                alt={`Gallery ${index + 1}`}
                                                                className="h-28 w-full rounded object-cover"
                                                            />
                                                            {!mode && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-circle btn-error absolute right-2 top-2"
                                                                    onClick={() => removeGalleryImage(image)}
                                                                >
                                                                    <PiX className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center mt-4">
                                            <label htmlFor="status" className="me-4">Status</label>
                                            <input
                                                type="checkbox"
                                                disabled={mode}
                                                className="toggle toggle-primary"
                                                checked={status}
                                                id="status"
                                                onChange={() => setStatus(!status)}
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-end space-x-2 mt-6">
                                    {step > 1 && (
                                        <button type="button" onClick={prevStep} className="btn">
                                            Previous
                                        </button>
                                    )}
                                    {(step === 1 || step === 2 || step === 3) && (
                                        <button
                                            type="button"
                                            onClick={nextStep}
                                            className="btn btn-primary"
                                        >
                                            Next
                                        </button>
                                    )}
                                    {step === 4 && (
                                        <button
                                            type="submit"
                                            disabled={mode}
                                            className="btn btn-primary text-white"
                                        >
                                            Update Product
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </form>
            ) : showCategoryForm ? (
                <div>
                    <div className="flex items-center gap-6 mb-6">
                        <button
                            type="button"
                            onClick={handleLeftArrowClick}
                            className="btn btn-circle"
                            title="Back"
                        >
                            <PiArrowLeft className="w-5 h-5" />
                        </button>
                        <h3 className="font-bold text-lg">Add Category</h3>
                    </div>
                    <CategoryForm
                        isEdit={false}
                        editableData={null}
                        onSubmit={createCategory}
                        parentCategories={categoryList}
                        onCancel={() => setShowCategoryForm(false)}
                    />
                </div>
            ) : (
                <div>
                    <div className="flex items-center gap-6 mb-6">
                        <button
                            type="button"
                            onClick={handleLeftArrowClick}
                            className="btn btn-circle"
                            title="Back"
                        >
                            <PiArrowLeft className="w-5 h-5" />
                        </button>
                        <h3 className="font-bold text-lg">Add Brand</h3>
                    </div>
                    <BrandForm
                        isEdit={false}
                        editableData={null}
                        onSubmit={createBrand}
                        onCancel={() => setShowBrandForm(false)}
                    />
                </div>
            )}
        </>
    );

    return (
        <>
            {isDrawer ? (
                <div className="drawer drawer-end">
                    <input id="edit_product_drawer" type="checkbox" className="drawer-toggle" />
                    <div className="drawer-content"></div>
                    <div className="drawer-side h-screen z-50">
                        <label htmlFor="edit_product_drawer" className="drawer-overlay"></label>
                        <div className="w-1/2 h-full bg-base-100 text-base-content p-6 overflow-y-auto transition-all duration-300">
                            {modalContent}
                        </div>
                    </div>
                </div>
            ) : (
                <dialog id="edit_product_modal" className="modal">
                    <div className="modal-box w-11/12 max-w-5xl">
                        {modalContent}
                    </div>
                </dialog>
            )}
        </>
    );
}
