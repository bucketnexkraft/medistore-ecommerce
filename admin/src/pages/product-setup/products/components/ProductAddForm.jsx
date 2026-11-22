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
  getVariantAttributes,
  generateProductDescription,
  storeProduct,
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
import AiDescriptionEditor from "../../../../components/common/AiDescriptionEditor";
import VariantCombinationEditor from "./VariantCombinationEditor";

export default function ProductAddForm({ fetchData, onClose }) {
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
    const [hasVariant, setHasVariant] = useState(false);
    const [hasSegment, setHasSegment] = useState(false);
    const [isFeatured, setIsFeatured] = useState(false);
    const [status, setStatus] = useState(true);
    const [variantSetup, setVariantSetup] = useState({
        dimensions: [{ variant: null, options: [] }],
        combinations: [{ values: {}, quantity: "", selling_price: "" }],
    });
    // Kept for backwards-compatible reset paths; the combination editor is the active UI.
    const [variantPairs, setVariantPairs] = useState([{ variant: null, value: null, options: [] }]);
    const [variantInventory, setVariantInventory] = useState([]);
    const [isBarcodeCameraActive, setIsBarcodeCameraActive] = useState(false);
    const [isImageCameraActive, setIsImageCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [showBrandForm, setShowBrandForm] = useState(false);
    const [salesChannelEnabled, setSalesChannelEnabled] = useState(false);
    const [stockVisibilityControlEnabled, setStockVisibilityControlEnabled] = useState(false);
    const [salesChannels, setSalesChannels] = useState([]);
    const [demandTagOptions, setDemandTagOptions] = useState([]);
    const [featuredImage, setFeaturedImage] = useState(null);
    const [featuredPreviewImage, setFeaturedPreviewImage] = useState(null);
    const [galleryFiles, setGalleryFiles] = useState([]);
    const [galleryPreviews, setGalleryPreviews] = useState([]);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const webcamRef = useRef(null);
    const quaggaTimeoutRef = useRef(null);
    const quaggaInitializedRef = useRef(false);

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
    const returnEnabled = watch("return_enabled");
    const stockVisibility = watch("stock_visibility");
    const stockTrackingEnabled = ![false, 0, "0", "false"].includes(companyPreferences?.stock_tracking_enabled);
    const isGroupPurchaseAvailable = watch("is_group_purchase_available");
    const isAiFeatureEnabled = isFeatureIncludedInPlan(selectedPlanFeatures, "ftr_ai");
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
                            value={tag.value}
                            {...register("demand_tags")}
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
                    <div>
                        <label className="label p-0">
                            <span className="label-text font-medium">Show Stock Quantity to Buyers</span>
                        </label>
                    </div>
                    <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        {...register("stock_visibility")}
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
                <input type="checkbox" className="toggle toggle-primary" {...register("is_group_purchase_available")} />
            </div>

            {isGroupPurchaseAvailable && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Discount Type</span>
                        </label>
                        <select {...register("group_purchase_discount_type")} className="select select-bordered w-full">
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

    const normalizeSegmentsForRequest = (segments = []) =>
        (Array.isArray(segments) ? segments : [])
            .map((segment) => ({
                name: String(segment?.name || "").trim(),
                value: String(segment?.value || "").trim(),
            }))
            .filter((segment) => segment.name && segment.value);

    const { fields, prepend, remove } = useFieldArray({
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
        const formatted = [];
        variantSetup.dimensions.forEach((dimension) => {
            const key = dimension.variant?.name?.toLowerCase();
            if (!key) return;
            const values = [...new Set(variantSetup.combinations.map((combination) => combination.values?.[key]).filter(Boolean))];
            values.forEach((value) => formatted.push({ [key]: value }));
        });
        return formatted;
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

    const handleVariantChange = async (index, variantId) => {
        const variant = variantList.find((item) => item.id == variantId);
        const response = await getVariantAttributes(accessToken, { variant_id: variantId });
        const next = [...variantPairs];
        next[index] = { variant, value: null, options: response.status ? response.data || [] : [] };
        setVariantPairs(next);
    };

    const buildSalesChannelPercentages = (salesChannelValues = {}) =>
        salesChannels.reduce((acc, channel) => {
            const percentage = parseFloat(salesChannelValues?.[channel.code]) || 0;
            acc[channel.code] = percentage;
            return acc;
        }, {});

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
            setBrandList(allDependency.data.brands);
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
            setCategoryList(allDependency.data.categories);
            toast.success("Category created successfully!");
            setShowCategoryForm(false);
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
        if (returnConditionFields.length === 0) appendReturnCondition({ value: "" });
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
            setFeaturedImage(file);
            setValue("featured_image", file, { shouldValidate: true });
            setFeaturedPreviewImage(URL.createObjectURL(file));
        } else {
            setFeaturedImage(null);
            setValue("featured_image", null, { shouldValidate: true });
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
                id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
                src: URL.createObjectURL(file),
            })),
        ]);

        e.target.value = "";
    };

    const removeGalleryImage = (indexToRemove) => {
        setGalleryFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
        setGalleryPreviews((prev) => prev.filter((_, index) => index !== indexToRemove));
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
                    const code = result.codeResult.code;
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

            if (!stockTrackingEnabled) {
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
                    toast.error("Add initial quantity and selling price.");
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
            if (!stockTrackingEnabled) {
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
            formData.append("is_featured", isFeatured ? 1 : 0);
            if (isFeatured && featuredImage instanceof File) {
                formData.append("featured_image", featuredImage);
            }
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

            if (data.thumbnail instanceof File) {
                formData.append("thumbnail", data.thumbnail);
            } else if (data.thumbnail instanceof FileList && data.thumbnail[0] instanceof File) {
                formData.append("thumbnail", data.thumbnail[0]);
            } else {
                console.warn("No valid thumbnail file:", data.thumbnail);
            }

            galleryFiles.forEach((file) => {
                formData.append("images[]", file);
            });

            const response = await storeProduct(accessToken, formData);
            if (response.status) {
                toast.success("Product created successfully!");
                fetchData();
                onClose();
                setStep(1);
                reset();
                setPreviewImage(null);
                setFeaturedImage(null);
                setFeaturedPreviewImage(null);
                setIsFeatured(false);
                setGalleryFiles([]);
                setGalleryPreviews([]);
                setVariantSetup({
                    dimensions: [{ variant: null, options: [] }],
                    combinations: [{ values: {}, quantity: "", selling_price: "" }],
                });
                setVariantPairs([{ variant: null, value: null, options: [] }]);
                setVariantInventory([]);
                setStatus(true);
            }
        } catch (error) {
            if (error.response?.status === 422 && error.response?.data?.errors) {
                const errorMessages = Object.values(error.response.data.errors).flat();
                toast.error(errorMessages.join("\n"));
            } else {
                toast.error(error.response?.data?.message || error.message || "Failed to create product");
            }
        }
    };

    const handleLeftArrowClick = () => {
        if (showCategoryForm) {
            setShowCategoryForm(false);
        } else if (showBrandForm) {
            setShowBrandForm(false);
        } else {
            onClose();
        }
    };

    return (
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
                        <h3 className="font-bold text-lg">Create Product</h3>
                    </div>

                    <div className="mt-10">
                        {step === 1 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="form-control col-span-2">
                                    <label className="label">Product Title *</label>
                                    <input
                                        {...register("name", { required: "Title is required" })}
                                        className="input input-bordered w-full"
                                    />
                                    {errors.name && <span className="text-error">{errors.name.message}</span>}
                                </div>
                                <div className="form-control col-span-2">
                                    <label className="label">Product SKU *</label>
                                    <div className="flex gap-2">
                                        <input
                                            {...register("sku", { required: "SKU is required" })}
                                            className="input input-bordered w-full"
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-outline"
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
                                            checked={hasVariant}
                                            onChange={(e) => setHasVariant(e.target.checked)}
                                        />
                                        <label htmlFor="hasVariant" className="cursor-pointer">
                                            Add Variant
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-4 pb-1">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            id="hasSegment"
                                            checked={hasSegment}
                                            onChange={(e) => setHasSegment(e.target.checked)}
                                        />
                                        <label htmlFor="hasSegment" className="cursor-pointer">
                                            Add Segmentations
                                        </label>
                                    </div>


                                    <div className="flex items-center gap-4 pb-1">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            id="isFeatured"
                                            checked={isFeatured}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setIsFeatured(checked);

                                                if (!checked) {
                                                    setFeaturedImage(null);
                                                    setValue("featured_image", null, { shouldValidate: true });
                                                    setFeaturedPreviewImage(null);
                                                }
                                            }}
                                        />
                                        <label htmlFor="isFeatured" className="cursor-pointer">
                                            Featured Product
                                        </label>
                                    </div>

                                    {isFeatured && (
                                        <div className="form-control col-span-2 rounded-lg border border-gray-200 p-4">
                                            <label htmlFor="featuredImage" className="label">
                                                <span className="label-text font-medium">Featured Image</span>
                                            </label>
                                            <input
                                                id="featuredImage"
                                                type="file"
                                                accept="image/*"
                                                className="file-input file-input-bordered w-full"
                                                onChange={handleFeaturedImageChange}
                                            />
                                            {featuredPreviewImage && (
                                                <img
                                                    src={featuredPreviewImage}
                                                    alt="Featured Preview"
                                                    className="mt-3 w-44 h-48 object-cover rounded-lg border"
                                                />
                                            )}
                                        </div>
                                    )}

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
                                        <p className="text-sm text-base-content/70">
                                            Select values for each variant. Quantity and price are entered per generated combination.
                                        </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full table-auto">
                                        <thead>
                                            <tr className="text-left">
                                                <th className="w-1/2 py-2">Variant</th>
                                                <th className="w-1/2 py-2">Attribute Value</th>
                                                <th className="w-[50px] text-right py-2">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {variantPairs.map((pair, index) => (
                                                <tr key={index}>
                                                    <td className="pr-2 py-2 align-top">
                                                        <select
                                                            className="select select-bordered w-full"
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
                                                    <td className="pr-2 py-2 align-top">
                                                        <select
                                                            className="select select-bordered w-full"
                                                            value={pair.value?.id || ""}
                                                            onChange={(e) => {
                                                                const attr = pair.options.find((a) => a.id == e.target.value);
                                                                const newPairs = [...variantPairs];
                                                                newPairs[index].value = attr;
                                                                setVariantPairs(newPairs);
                                                            }}
                                                            disabled={!pair.variant}
                                                        >
                                                            <option value="">Select Value</option>
                                                            {pair.options.map((item) => (
                                                                <option key={item.id} value={item.id}>
                                                                    {item.attribute_value}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="text-right py-2 align-top">
                                                        {index === 0 ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-circle btn-primary"
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
                                {!stockTrackingEnabled && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                        <p className="mb-3 font-medium text-amber-900">
                                            Opening stock and selling price per combination
                                        </p>
                                        <div className="space-y-2">
                                            {getVariantCombinations().map((combination) => {
                                                const row = inventoryForCombination(combination);
                                                return (
                                                <div key={combinationKey(combination)} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                                                    <div className="flex items-center md:col-span-1">
                                                        <span className="text-sm">
                                                            {Object.entries(combination).map(([key, value]) => `${key}: ${value}`).join(" / ")}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder="Quantity"
                                                        value={row.quantity ?? ""}
                                                        onChange={(e) => updateCombinationInventory(combination, "quantity", e.target.value)}
                                                        className="input input-bordered w-full"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="Selling price"
                                                        value={row.selling_price ?? ""}
                                                        onChange={(e) => updateCombinationInventory(combination, "selling_price", e.target.value)}
                                                        className="input input-bordered w-full"
                                                    />
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {step === 2 && isVariantFeatureEnabled && hasVariant && !stockTrackingEnabled && (
                            <div className="space-y-4">
                                <p>Product Title: {productTitle}</p>
                                <VariantCombinationEditor
                                    variantList={variantList}
                                    accessToken={accessToken}
                                    dimensions={variantSetup.dimensions}
                                    combinations={variantSetup.combinations}
                                    onChange={setVariantSetup}
                                    showPricing={!stockTrackingEnabled}
                                />
                            </div>
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
                                {!stockTrackingEnabled && !hasVariant && (
                                    <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 md:grid-cols-2">
                                        <div className="form-control">
                                            <label className="label">
                                                <span className="label-text font-medium">Opening Quantity *</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                {...register("initial_quantity", {
                                                    validate: (value) => (
                                                        value === "" || Number.isInteger(Number(value))
                                                            ? true
                                                            : "Quantity must be a whole number"
                                                    ),
                                                })}
                                                className="input input-bordered w-full"
                                            />
                                            {errors.initial_quantity && <span className="text-error text-sm">{errors.initial_quantity.message}</span>}
                                        </div>
                                        <div className="form-control">
                                            <label className="label">
                                                <span className="label-text font-medium">Selling Price *</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                {...register("initial_selling_price")}
                                                className="input input-bordered w-full"
                                            />
                                        </div>
                                    </div>
                                )}
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
                                                {...register("return_enabled")}
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
                                            {...register("return_day")}
                                            className="input input-bordered w-full"
                                            placeholder="e.g. 7"
                                            disabled={!returnEnabled}
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
                                            >
                                                Add Field
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {returnConditionFields.map((field, index) => (
                                                <div key={field.id} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        {...register(`return_condition.${index}.value`)}
                                                        className="input input-bordered flex-1"
                                                        placeholder={`Return condition ${index + 1}`}
                                                        disabled={!returnEnabled}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            returnConditionFields.length > 1
                                                                ? removeReturnCondition(index)
                                                                : replaceReturnCondition([{ value: "" }])
                                                        }
                                                        className="btn btn-outline btn-error"
                                                        disabled={!returnEnabled}
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
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            onChange={handleImageChange}
                                            className="file-input file-input-bordered w-full"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsImageCameraActive(!isImageCameraActive)}
                                            className="btn btn-square btn-outline"
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
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-circle btn-error absolute right-2 top-2"
                                                        onClick={() => removeGalleryImage(index)}
                                                    >
                                                        <PiX className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center mt-4">
                                    <label htmlFor="status" className="me-4">Status</label>
                                    <input
                                        type="checkbox"
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
                                    className="btn btn-primary text-white"
                                >
                                    Create Product
                                </button>
                            )}
                        </div>
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
}
