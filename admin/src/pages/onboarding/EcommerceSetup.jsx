import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  PiArrowLeft,
  PiArrowRight,
  PiArrowsDownUp,
  PiCheckCircle,
  PiCheck,
  PiFloppyDisk,
  PiGlobeHemisphereWest,
  PiPaintBrush,
  PiSparkle,
  PiStorefront,
  PiRows,
  PiArrowUp,
  PiArrowDown,
} from "react-icons/pi";
import { getPreference } from "../../api/preference";
import { getSettingSection } from "../../api/backoffice/configurations";
import {
  connectCustomDomain as connectCustomDomainApi,
  getCompany,
  updateCompanyInfo,
  validateCustomDomainStore as validateCustomStoreApi,
} from "../../api/backoffice/company";
import { updateCompanyPreference } from "../../api/companyPreferances";
import { applyEcommerceTemplate, getEcommerceSetupData } from "../../api/ecommerceSetup";
import { getStorefrontHomeBuilder, updateStorefrontHomeBuilder } from "../../api/storefrontBuilder";
import { setPlanAccess } from "../../slice/authSlice";
import CustomDomainFlow from "./CustomDomainFlow";

const FONT_OPTIONS = [
  { value: "Georgia, serif", label: "Georgia" },
  { value: "\"Times New Roman\", serif", label: "Times New Roman" },
  { value: "Garamond, serif", label: "Garamond" },
  { value: "\"Trebuchet MS\", sans-serif", label: "Trebuchet MS" },
];

const STEPS = [
  { id: "brand", title: "Store Identity", icon: PiPaintBrush },
  { id: "category", title: "Store Category", icon: PiStorefront },
  { id: "domain", title: "Store Domain", icon: PiGlobeHemisphereWest },
  { id: "builder", title: "Section Setup", icon: PiSparkle },
];

const buildPreferenceMap = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((acc, item) => {
    if (item?.key) {
      acc[item.key] = item.value ?? "";
    }
    return acc;
  }, {});

const createBuilderId = (prefix) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createDefaultBuilder = () => ({
  version: 1,
  pages: [],
  sections: [],
  actions: [],
  settings: {},
  meta: {
    template_variants: [],
    section_presets: {},
  },
});

const slugifyStoreHandle = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export default function EcommerceSetup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);

  const [loading, setLoading] = useState(true);
  const [savingStep, setSavingStep] = useState(false);
  const [payload, setPayload] = useState(null);
  const [company, setCompany] = useState(null);
  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof window === "undefined") return 0;
    const params = new URLSearchParams(window.location.search);
    const requestedStep = params.get("step");
    const paymentState = params.get("plan_payment");

    if (requestedStep === "domain") return 2;
    if (requestedStep === "template") return 1;
    return paymentState === "success" || paymentState === "already_paid" ? 1 : 0;
  });
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [brandForm, setBrandForm] = useState({
    application_name: "",
    site_color: "#6b4f2a",
    font_family: FONT_OPTIONS[0].value,
  });
  const [brandFiles, setBrandFiles] = useState({
    site_logo: null,
    site_favicon: null,
  });
  const [savedBrandAssetUrls, setSavedBrandAssetUrls] = useState({
    site_logo: "",
    site_favicon: "",
  });
  const [brandPreviewUrls, setBrandPreviewUrls] = useState({
    site_logo: "",
    site_favicon: "",
  });
  const [domain, setDomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [domainMode, setDomainMode] = useState("subdomain");
  const [storeHandle, setStoreHandle] = useState("store");
  const [platformDomain, setPlatformDomain] = useState("ecommerce.com");
  const [useDemoData, setUseDemoData] = useState(false);
  const [builderState, setBuilderState] = useState(createDefaultBuilder());
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderReady, setBuilderReady] = useState(false);
  const [draggingPresetId, setDraggingPresetId] = useState("");
  const [draggingSectionId, setDraggingSectionId] = useState("");
  const [expandedBuilderGroups, setExpandedBuilderGroups] = useState({});

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [setupResponse, preferenceResponse, companyResponse, settingsResponse] = await Promise.all([
          getEcommerceSetupData(accessToken),
          getPreference(companyId, accessToken),
          getCompany(accessToken, companyId),
          getSettingSection(accessToken, "ecommerce_store").catch(() => null),
        ]);

        if (!mounted) return;

        const nextPayload = setupResponse?.data || null;
        const preferenceMap = buildPreferenceMap(preferenceResponse?.data || []);
        const nextCompany = companyResponse?.data || null;

        setPayload(nextPayload);
        setCompany(nextCompany);
        setSelectedCategoryId(nextPayload?.selected_category?.id || nextPayload?.categories?.[0]?.id || null);
        setSelectedTemplateId(nextPayload?.selected_template?.id || null);
        if (!nextPayload?.selected_template?.id && new URLSearchParams(window.location.search).get("step") === "domain") {
          setCurrentStep(1);
        }
        setBrandForm({
          application_name: preferenceMap.application_name || nextCompany?.name || "",
          site_color: preferenceMap.site_color || "#6b4f2a",
          font_family: window.localStorage.getItem(`storefront-font-${companyId}`) || FONT_OPTIONS[0].value,
        });
        setSavedBrandAssetUrls({
          site_logo: preferenceMap.site_logo || "",
          site_favicon: preferenceMap.site_favicon || "",
        });
        setDomain(nextCompany?.domain || "");

        const configuredPlatformDomain = String(
          settingsResponse?.data?.platform_store_domain || "",
        )
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\/.*$/, "");
        const existingDomain = String(nextCompany?.domain || "").trim().toLowerCase();
        const inferredPlatformDomain =
          existingDomain.split(".").length > 2
            ? existingDomain.split(".").slice(-2).join(".")
            : "ecommerce.com";
        const nextPlatformDomain = configuredPlatformDomain || inferredPlatformDomain;
        setPlatformDomain(nextPlatformDomain);
        if (existingDomain.endsWith(`.${nextPlatformDomain}`)) {
          setDomainMode("subdomain");
          setStoreHandle(existingDomain.slice(0, -(nextPlatformDomain.length + 1)) || "store");
        } else if (existingDomain.includes(".")) {
          setDomainMode("custom");
          setCustomDomain(nextCompany?.custom_domain || existingDomain);
          setStoreHandle(slugifyStoreHandle(nextCompany?.name) || "store");
        } else {
          setDomainMode("subdomain");
          setStoreHandle(slugifyStoreHandle(existingDomain) || slugifyStoreHandle(nextCompany?.name) || "store");
        }
      } catch (error) {
        if (mounted) {
          toast.error(error?.response?.data?.message || error?.message || "Failed to load ecommerce setup");
          navigate("/subscription/plans", { replace: true });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (accessToken && companyId) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [accessToken, companyId, navigate]);

  const categories = payload?.categories || [];
  const templates = payload?.templates || [];

  const filteredCategories = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    if (!keyword) return categories;
    return categories.filter((item) => String(item.name || "").toLowerCase().includes(keyword));
  }, [categories, search]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (!selectedCategoryId) return true;
      return (template.categories || []).some((item) => String(item.id) === String(selectedCategoryId));
    });
  }, [selectedCategoryId, templates]);

  useEffect(() => {
    if (
      selectedTemplateId &&
      !filteredTemplates.some((template) => String(template.id) === String(selectedTemplateId))
    ) {
      setSelectedTemplateId(null);
    }
  }, [filteredTemplates, selectedTemplateId]);

  const selectedTemplate =
    filteredTemplates.find((template) => String(template.id) === String(selectedTemplateId)) ||
    templates.find((template) => String(template.id) === String(selectedTemplateId)) ||
    null;

  const selectedCategory =
    categories.find((item) => String(item.id) === String(selectedCategoryId)) || null;
  const selectedTemplatePresetRefs = useMemo(
    () => selectedTemplate?.section_preset_refs || payload?.selected_template?.section_preset_refs || [],
    [payload?.selected_template?.section_preset_refs, selectedTemplate?.section_preset_refs],
  );
  const builderPages = useMemo(() => builderState?.pages || [], [builderState?.pages]);
  const builderSections = useMemo(() => builderState?.sections || [], [builderState?.sections]);
  const builderTemplateVariants = useMemo(
    () => builderState?.meta?.template_variants || [],
    [builderState?.meta?.template_variants],
  );
  const builderSectionPresets = useMemo(
    () => builderState?.meta?.section_presets || {},
    [builderState?.meta?.section_presets],
  );
  const builderPageId = useMemo(() => {
    const homePage =
      builderPages.find((page) => String(page.slug || "").trim().toLowerCase() === "home") ||
      builderPages[0] ||
      null;
    return homePage?.id || "";
  }, [builderPages]);
  const builderPage = useMemo(
    () => builderPages.find((page) => page.id === builderPageId) || builderPages[0] || null,
    [builderPageId, builderPages],
  );
  const canvasSections = useMemo(
    () =>
      builderSections
        .filter((section) => section.page_id === builderPageId)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [builderPageId, builderSections],
  );
  const selectedTemplatePresetKeySet = useMemo(
    () =>
      new Set(
        (selectedTemplatePresetRefs || [])
          .map((item) => String(item?.preset_key || ""))
          .filter(Boolean),
      ),
    [selectedTemplatePresetRefs],
  );
  const allowedPresetLibrary = useMemo(() => {
    const hasTemplatePresetSelection = selectedTemplatePresetKeySet.size > 0;

    const matchesCategory = (preset) => {
      if (hasTemplatePresetSelection) return true;
      if (!selectedCategoryId) return true;
      const categoryRefs = Array.isArray(preset?.categories) ? preset.categories : [];
      if (categoryRefs.length === 0) return true;
      return categoryRefs.some((item) => String(item.id) === String(selectedCategoryId));
    };

    const matchesTemplate = (preset) => {
      if (selectedTemplatePresetKeySet.size === 0) return true;
      return selectedTemplatePresetKeySet.has(String(preset?.preset_key || ""));
    };

    return Object.entries(builderSectionPresets || {}).reduce((acc, [variant, presets]) => {
      const filtered = (Array.isArray(presets) ? presets : []).filter(
        (preset) => matchesCategory(preset) && matchesTemplate(preset),
      );
      if (filtered.length > 0) {
        acc[variant] = filtered;
      }
      return acc;
    }, {});
  }, [builderSectionPresets, selectedCategoryId, selectedTemplatePresetKeySet]);
  const allowedPresetVariants = useMemo(
    () =>
      builderTemplateVariants.filter(
        (variant) => Array.isArray(allowedPresetLibrary?.[variant.value]) && allowedPresetLibrary[variant.value].length > 0,
      ),
    [allowedPresetLibrary, builderTemplateVariants],
  );

  useEffect(() => {
    setExpandedBuilderGroups((prev) =>
      allowedPresetVariants.reduce((acc, variant, index) => {
        acc[variant.value] = Object.prototype.hasOwnProperty.call(prev, variant.value) ? prev[variant.value] : index === 0;
        return acc;
      }, {}),
    );
  }, [allowedPresetVariants]);

  const handleFileChange = (field, file) => {
    if (!file) return;
    setBrandFiles((prev) => ({ ...prev, [field]: file }));
  };

  useEffect(() => {
    const nextPreviewUrls = {
      site_logo: savedBrandAssetUrls.site_logo,
      site_favicon: savedBrandAssetUrls.site_favicon,
    };
    const objectUrls = [];

    if (brandFiles.site_logo instanceof File) {
      const logoUrl = URL.createObjectURL(brandFiles.site_logo);
      objectUrls.push(logoUrl);
      nextPreviewUrls.site_logo = logoUrl;
    }

    if (brandFiles.site_favicon instanceof File) {
      const faviconUrl = URL.createObjectURL(brandFiles.site_favicon);
      objectUrls.push(faviconUrl);
      nextPreviewUrls.site_favicon = faviconUrl;
    }

    setBrandPreviewUrls(nextPreviewUrls);

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [brandFiles.site_logo, brandFiles.site_favicon, savedBrandAssetUrls.site_favicon, savedBrandAssetUrls.site_logo]);

  const saveBrandStep = async () => {
    const formData = new FormData();
    formData.append("application_name", brandForm.application_name || "");
    formData.append("site_color", brandForm.site_color || "#6b4f2a");

    if (brandFiles.site_logo instanceof File) {
      formData.append("site_logo", brandFiles.site_logo, brandFiles.site_logo.name);
    }

    if (brandFiles.site_favicon instanceof File) {
      formData.append("site_favicon", brandFiles.site_favicon, brandFiles.site_favicon.name);
    }

    await updateCompanyPreference(accessToken, formData);
    window.localStorage.setItem(`storefront-font-${companyId}`, brandForm.font_family);
  };

  const saveCategoryStep = async () => {
    if (!selectedTemplate || !selectedCategory) {
      throw new Error("Choose a category and starter style first.");
    }

    const result = await applyEcommerceTemplate(accessToken, {
      template_id: selectedTemplate.id,
      category_id: selectedCategory.id,
    });

    dispatch(
      setPlanAccess({
        needs_ecommerce_setup: false,
        selected_e_template_id: result?.data?.template?.id || selectedTemplate.id,
        ecommerce_setup_completed_at:
          result?.data?.company?.ecommerce_setup_completed_at || new Date().toISOString(),
      })
    );
  };

  const saveDomainStep = async () => {
    const nextDomain = domainMode === "subdomain"
      ? `${slugifyStoreHandle(storeHandle) || "store"}.${platformDomain}`
      : domain.trim();

    if (!nextDomain) {
      throw new Error("Store domain is required.");
    }

    await updateCompanyInfo(accessToken, companyId, {
      name: company?.name || brandForm.application_name || "",
      contact_name: company?.contact_name || brandForm.application_name || "",
      phone_number: company?.phone_number || "",
      email: company?.email || "",
      domain: nextDomain,
      seed_demo_data: useDemoData,
    });
    setDomain(nextDomain);
  };

  const validateCustomDomainStore = async (storeDomain) => {
    const response = await validateCustomStoreApi(accessToken, companyId, storeDomain);
    return {
      valid: Boolean(response?.data?.valid),
      message: String(response?.data?.message || ""),
      suggestions: Array.isArray(response?.data?.suggestions) ? response.data.suggestions : [],
    };
  };

  const handleCustomDomainConnect = async ({ customDomain: connectedDomain, storeDomain, verificationToken }) => {
    setSavingStep(true);
    try {
      await connectCustomDomainApi(accessToken, companyId, {
        custom_domain: connectedDomain,
        store_domain: storeDomain,
        verification_token: verificationToken,
      });
      setDomain(storeDomain);
      setCustomDomain(connectedDomain);
      toast.success("Custom domain connected successfully.");
      navigate("/onboarding/section-setup?setup=1", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.msg || error?.message || "Failed to connect custom domain.");
    } finally {
      setSavingStep(false);
    }
  };

  const loadInlineBuilder = async () => {
    setBuilderLoading(true);
    try {
      const response = await getStorefrontHomeBuilder(accessToken);
      const nextBuilder = response?.data || createDefaultBuilder();
      setBuilderState({
        ...createDefaultBuilder(),
        ...nextBuilder,
        meta: {
          ...createDefaultBuilder().meta,
          ...(nextBuilder.meta || {}),
        },
        settings: {
          ...nextBuilder.settings,
          brand_name: brandForm.application_name,
          brand_color: brandForm.site_color,
          brand_font_family: brandForm.font_family,
          ecommerce_category_id: selectedCategoryId,
        },
      });
      setBuilderReady(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load builder.");
    } finally {
      setBuilderLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 3 && accessToken && !builderReady) {
      loadInlineBuilder();
    }
  }, [accessToken, builderReady, currentStep]);

  const resequenceCanvasSections = (nextSections) =>
    nextSections.map((section, index) => ({
      ...section,
      order: index + 1,
    }));

  const updateCanvasSections = (nextCanvasSections) => {
    const resequenced = resequenceCanvasSections(nextCanvasSections);
    const sectionMap = new Map(resequenced.map((section) => [section.id, section]));

    setBuilderState((prev) => ({
      ...prev,
      sections: (prev.sections || []).map((section) => sectionMap.get(section.id) || section),
    }));
  };

  const addPresetToCanvas = (preset) => {
    if (!builderPageId) {
      toast.info("No builder page found for this template yet.");
      return;
    }

    const nextSection = {
      id: createBuilderId("section"),
      page_id: builderPageId,
      name: String(preset?.name || preset?.label || preset?.section_type || "section")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_"),
      title: preset?.name || preset?.label || "New Section",
      subtitle: "",
      layout: "template",
      variant: preset?.section_type || "hero",
      preset_key: preset?.preset_key || "",
      order: canvasSections.length + 1,
      query_sql: "",
      query_json: "",
      rich_text_html: "",
      query_config: {},
      category_refs:
        Array.isArray(preset?.categories) && preset.categories.length > 0
          ? preset.categories
          : selectedCategoryId
            ? [{ id: selectedCategoryId, name: selectedCategory?.name || "" }]
            : [],
    };

    setBuilderState((prev) => ({
      ...prev,
      sections: [...(prev.sections || []), nextSection],
    }));
  };

  const moveCanvasSection = (sectionId, direction) => {
    const currentIndex = canvasSections.findIndex((section) => section.id === sectionId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= canvasSections.length) {
      return;
    }

    const reordered = [...canvasSections];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
    updateCanvasSections(reordered);
  };

  const removeCanvasSection = (sectionId) => {
    const filteredCanvasSections = resequenceCanvasSections(
      canvasSections.filter((section) => section.id !== sectionId),
    );
    const pageSectionMap = new Map(filteredCanvasSections.map((section) => [section.id, section]));

    setBuilderState((prev) => ({
      ...prev,
      sections: (prev.sections || [])
        .filter((section) => section.id !== sectionId)
        .map((section) => pageSectionMap.get(section.id) || section),
      actions: (prev.actions || []).map((action) =>
        action.section_id === sectionId ? { ...action, section_id: "" } : action,
      ),
    }));
  };

  const handlePresetDragStart = (event, preset) => {
    event.dataTransfer.setData("application/ecommerce-preset", JSON.stringify(preset));
    event.dataTransfer.effectAllowed = "copy";
    setDraggingPresetId(String(preset?.id || ""));
  };

  const handleSectionDragStart = (event, sectionId) => {
    event.dataTransfer.setData("application/ecommerce-section", sectionId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingSectionId(sectionId);
  };

  const handleCanvasDrop = (event) => {
    event.preventDefault();

    const presetPayload = event.dataTransfer.getData("application/ecommerce-preset");
    if (presetPayload) {
      try {
        addPresetToCanvas(JSON.parse(presetPayload));
      } catch {
        toast.error("Unable to add this preset.");
      }
      setDraggingPresetId("");
      return;
    }

    const sourceSectionId = event.dataTransfer.getData("application/ecommerce-section");
    if (!sourceSectionId) {
      return;
    }

    const targetSectionId = event.currentTarget.getAttribute("data-section-id") || "";
    if (!targetSectionId || sourceSectionId === targetSectionId) {
      setDraggingSectionId("");
      return;
    }

    const reordered = [...canvasSections];
    const sourceIndex = reordered.findIndex((section) => section.id === sourceSectionId);
    const targetIndex = reordered.findIndex((section) => section.id === targetSectionId);

    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingSectionId("");
      return;
    }

    const [movedSection] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, movedSection);
    updateCanvasSections(reordered);
    setDraggingSectionId("");
  };

  const saveInlineBuilder = async () => {
    setBuilderSaving(true);
    try {
      await updateStorefrontHomeBuilder(accessToken, {
        ...builderState,
        settings: {
          ...(builderState.settings || {}),
          brand_font_family: brandForm.font_family,
          brand_color: brandForm.site_color,
          brand_name: brandForm.application_name,
          ecommerce_category_id: selectedCategoryId,
        },
      });
      toast.success("Builder layout saved.");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to save builder.");
    } finally {
      setBuilderSaving(false);
    }
  };

  const toggleBuilderGroup = (groupKey) => {
    setExpandedBuilderGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const handleContinue = async () => {
    setSavingStep(true);

    try {
      if (currentStep === 0) {
        if (!brandForm.application_name.trim()) {
          throw new Error("Store name is required.");
        }

        await saveBrandStep();
        setCurrentStep(1);
        toast.success("Store identity saved.");
      } else if (currentStep === 1) {
        await saveCategoryStep();
        setCurrentStep(2);
        toast.success("Store category saved.");
      } else if (currentStep === 2) {
        await saveDomainStep();
        toast.success("Domain saved.");
        navigate("/onboarding/section-setup?setup=1", { replace: true });
      } else {
        await saveInlineBuilder();
        navigate("/onboarding/section-setup?setup=1", { replace: true });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to continue.");
    } finally {
      setSavingStep(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading ecommerce setup...</div>;
  }

  const currentStepId = STEPS[currentStep]?.id || "brand";
  const progressPercent = STEPS.length > 1 ? (currentStep / (STEPS.length - 1)) * 100 : 0;

  if (currentStepId === "domain") {
    return (
      <div className="min-h-full bg-[#fcfbf7] px-4 pb-16 pt-8 text-[#111827] sm:px-6 lg:px-8 lg:pt-12">
        <div className="mx-auto max-w-[1162px]">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f4f6] px-3 py-2 text-[11px] font-medium leading-none text-[#4b5563] transition hover:bg-[#edeff3]"
          >
            <PiArrowLeft className="size-3.5" />
            Back
          </button>

          <div className="mt-8 max-w-[560px]">
            <h1 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#111827] sm:text-[56px]">
              Set up your store
              <br />
              domain
            </h1>
            <p className="mt-5 text-[13px] leading-[1.42] tracking-[-0.02em] text-[#6b7280] sm:text-sm">
              Choose how customers will find your store online. You can change this later.
            </p>
          </div>

          <div className="mt-8 rounded-[20px] border border-[#e5e7eb] bg-white p-4 shadow-[0_16px_40px_rgba(17,24,39,0.05)] sm:p-5">
            <div className="flex w-full flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDomainMode("subdomain")}
                className={`inline-flex min-w-[132px] items-center gap-2 rounded-[10px] border px-4 py-3 text-[12px] font-medium leading-none transition ${domainMode === "subdomain" ? "border-[#e5e7eb] bg-[#f6f2ff] text-[#212124]" : "border-[#e5e7eb] bg-white text-[#8b8ba3]"}`}
              >
                <span className={`size-2 rounded-full ${domainMode === "subdomain" ? "bg-[#7c3aed]" : "bg-white ring-1 ring-[#e5e7eb]"}`} />
                Sub Domain
              </button>
              <button
                type="button"
                onClick={() => setDomainMode("custom")}
                className={`inline-flex min-w-[136px] items-center gap-2 rounded-[10px] border px-4 py-3 text-[12px] font-medium leading-none transition ${domainMode === "custom" ? "border-[#e5e7eb] bg-[#f6f2ff] text-[#212124]" : "border-[#e5e7eb] bg-white text-[#8b8ba3]"}`}
              >
                <span className={`size-2 rounded-full ${domainMode === "custom" ? "bg-[#7c3aed]" : "bg-white ring-1 ring-[#e5e7eb]"}`} />
                Custom Domain
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-[18px] border border-[#ece7f5] bg-white">
              {domainMode === "subdomain" ? (
                <div className="border-b border-[#ece7f5] bg-[linear-gradient(135deg,#fbf9ff_0%,#ffffff_62%,#f4faf7_100%)] px-5 py-6 sm:px-7">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7c3aed]">Instant storefront</p>
                  <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[#212124]">Choose your store address</h2>
                  <p className="mt-2 max-w-[620px] text-[12px] leading-5 text-[#72727e]">Pick a short, memorable name. We will create the store link instantly.</p>
                </div>
              ) : null}

              {domainMode === "subdomain" ? (
                <div className="p-5 sm:p-7">
                  <label className="block text-[12px] font-semibold text-[#212124]">Store name</label>
                  <div className="mt-2 flex min-w-0 overflow-hidden rounded-[13px] border border-[#ded9e8] bg-[#fcfcfd] focus-within:border-[#9f7aea] focus-within:ring-4 focus-within:ring-[#7c3aed]/5">
                    <span className="hidden items-center border-r border-[#e6e3eb] bg-[#f6f4f8] px-4 text-[11px] font-medium text-[#72727e] sm:flex">
                      https://
                    </span>
                    <input
                      type="text"
                      value={storeHandle}
                      onChange={(event) => setStoreHandle(slugifyStoreHandle(event.target.value))}
                      className="h-[52px] min-w-0 flex-1 bg-transparent px-4 text-[15px] font-semibold text-[#212124] outline-none placeholder:font-normal placeholder:text-[#b6b6c0]"
                      placeholder="your-store"
                    />
                    <span className="flex items-center border-l border-[#e6e3eb] bg-[#f6f4f8] px-3 text-[11px] font-medium text-[#5f5f69] sm:px-4">
                      .{platformDomain}
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-[#8b8ba3]">
                    Use your brand or store name. This will be your public storefront address.
                  </p>

                  <div className="mt-5 flex flex-col gap-4 border-t border-[#eeebf2] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={useDemoData}
                        onChange={(event) => setUseDemoData(event.target.checked)}
                        className="mt-0.5 size-4 rounded border-[#c4b5fd] text-[#7c3aed] focus:ring-[#7c3aed]"
                      />
                      <span>
                        <span className="block text-[11px] font-semibold text-[#212124]">Use demo data for this store</span>
                        <span className="mt-1 block max-w-[500px] text-[10px] leading-4 text-[#8b8ba3]">Add sample products and categories to explore the store.</span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={handleContinue}
                      disabled={savingStep || !storeHandle.trim()}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#7c3aed] px-5 py-3 text-[12px] font-semibold text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {savingStep ? "Saving..." : "Save Store Link"}
                      {!savingStep ? <PiArrowRight className="size-3.5" /> : null}
                    </button>
                  </div>
                </div>
              ) : (
                <CustomDomainFlow
                  initialDomain={customDomain}
                  initialStoreName={storeHandle}
                  platformTarget={platformDomain}
                  saving={savingStep}
                  validateStore={validateCustomDomainStore}
                  onConnect={handleCustomDomainConnect}
                />
              )}
            </div>
          </div>

          <div className="mt-5 rounded-[18px] border border-[#ece9e3] bg-[linear-gradient(90deg,#fff0f5,#f7f8f0)] px-5 py-5 shadow-[0_10px_30px_rgba(17,24,39,0.04)] sm:px-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-[360px]">
                <h2 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.03em] text-[#212124]">Need help connecting your domain?</h2>
                <p className="mt-3 text-[12px] leading-[1.5] tracking-[-0.02em] text-[#8b8ba3]">Follow our step-by-step guide or contact support if you need help configuring DNS.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="inline-flex items-center gap-2 rounded-full bg-[#212124] px-5 py-3 text-[12px] font-semibold leading-none text-white transition hover:bg-[#111827]">View Domain Guide <PiArrowRight className="size-3.5" /></button>
                <button type="button" className="text-[12px] font-medium leading-none text-[#212124] underline underline-offset-2">Contact Support</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#fcfbf7] px-4 py-8 text-[#172033] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] space-y-6">
        <section className="rounded-2xl border border-[#e4def5] bg-white p-6 shadow-[0_12px_30px_rgba(42,28,80,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ddd0ff] bg-[#f3efff] px-3 py-1 text-xs font-semibold text-[#6d28d9]">
                <PiCheckCircle className="size-4" />
                Subscription Active
              </div>
              <h1 className="mt-4 text-[30px] font-semibold tracking-tight text-[#172033]">
                Set up your store
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748b]">
                Finish your brand, category, and domain first. Then we open the dedicated section setup page.
              </p>
            </div>

            <button
              type="button"
              className="rounded-xl border border-[#ddd0ff] bg-white px-5 py-3 text-sm font-semibold text-[#6d28d9] transition hover:bg-[#f7f3ff]"
              onClick={() => navigate("/onboarding/section-setup")}
            >
              Open Section Setup
            </button>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl border border-[#e4def5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                  Setup Progress
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  Step {currentStep + 1} of {STEPS.length}
                </p>
              </div>
                <p className="text-sm font-semibold text-[#6d28d9]">{Math.round(progressPercent)}%</p>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eee9fb]">
              <div
                className="h-full rounded-full bg-[#7c3aed] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const active = index === currentStep;
                const completed = index < currentStep;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (index <= currentStep) setCurrentStep(index);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-[#7c3aed] bg-[#f7f3ff] text-[#6d28d9] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]"
                        : completed
                          ? "border-[#ddd0ff] bg-[#f3efff] text-[#6d28d9]"
                          : "border-[#e4def5] bg-white text-slate-600"
                    }`}
                    style={active ? { backgroundColor: "#f7f3ff", color: "#6d28d9" } : undefined}
                  >
                    <div
                      className={`grid size-10 shrink-0 place-items-center rounded-full ${
                        active ? "bg-[#7c3aed] text-white" : "bg-[#f7f3ff]"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-medium uppercase tracking-[0.14em] ${active ? "text-[#6a5237]" : "opacity-70"}`}>
                        Step {index + 1}
                      </p>
                      <p className={`mt-1 truncate text-sm font-medium ${active ? "text-[#2f2318]" : ""}`}>{step.title}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="rounded-2xl border border-[#e4def5] bg-white p-5 shadow-[0_12px_30px_rgba(42,28,80,0.06)]">
            <div key={currentStepId} className="space-y-5" style={{ animation: "ecommerceSetupFade 220ms ease" }}>
              {currentStepId === "brand" ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Step 1</p>
                    <h2 className="mt-2 text-[26px] font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                      Store Identity
                    </h2>
                    <p className="mt-2 text-sm text-stone-600">
                      Add store name, logo, icon, color, and font.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <p className="mb-2 text-sm font-medium text-stone-900">Store Name</p>
                      <input
                        className="h-12 w-full rounded-xl border border-[#d8c7ab] bg-white px-4 text-sm outline-none transition focus:border-[#8a6b45] focus:ring-4 focus:ring-[#efe3cd]"
                        value={brandForm.application_name}
                        onChange={(e) => setBrandForm((prev) => ({ ...prev, application_name: e.target.value }))}
                        placeholder="Nova Fashion House"
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-stone-900">Brand Logo</p>
                        {brandPreviewUrls.site_logo ? (
                          <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c7ab] bg-[#f8f1e5]">
                            <img
                              src={brandPreviewUrls.site_logo}
                              alt="Brand logo preview"
                              className="h-full w-full object-contain p-3"
                            />
                          </div>
                        ) : null}
                        <input
                          type="file"
                          accept="image/*"
                          className="file-input file-input-bordered h-12 w-full rounded-xl border-[#d8c7ab]"
                          onChange={(e) => handleFileChange("site_logo", e.target.files?.[0])}
                        />
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-stone-900">Brand Icon</p>
                        {brandPreviewUrls.site_favicon ? (
                          <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c7ab] bg-[#f8f1e5]">
                            <img
                              src={brandPreviewUrls.site_favicon}
                              alt="Brand icon preview"
                              className="h-20 w-20 rounded-2xl object-cover"
                            />
                          </div>
                        ) : null}
                        <input
                          type="file"
                          accept="image/*"
                          className="file-input file-input-bordered h-12 w-full rounded-xl border-[#d8c7ab]"
                          onChange={(e) => handleFileChange("site_favicon", e.target.files?.[0])}
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-stone-900">Brand Color</p>
                        <div className="flex h-12 items-center gap-3 rounded-xl border border-[#d8c7ab] bg-white px-3">
                          <input
                            type="color"
                            className="h-8 w-10 rounded border-0 bg-transparent"
                            value={brandForm.site_color}
                            onChange={(e) => setBrandForm((prev) => ({ ...prev, site_color: e.target.value }))}
                          />
                          <span className="text-sm text-stone-700">{brandForm.site_color}</span>
                        </div>
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-stone-900">Store Font</p>
                        <select
                          className="h-12 w-full rounded-xl border border-[#d8c7ab] bg-white px-4 text-sm outline-none transition focus:border-[#8a6b45] focus:ring-4 focus:ring-[#efe3cd]"
                          value={brandForm.font_family}
                          onChange={(e) => setBrandForm((prev) => ({ ...prev, font_family: e.target.value }))}
                        >
                          {FONT_OPTIONS.map((font) => (
                            <option key={font.value} value={font.value}>
                              {font.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStepId === "category" ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7c3aed]">Step 2</p>
                    <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-[#172033]">
                      Store Category
                    </h2>
                    <p className="mt-2 text-sm text-stone-600">
                      Pick your business type and starter style.
                    </p>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <aside className="rounded-2xl border border-[#e4def5] bg-[#faf8ff] p-5 shadow-[0_12px_26px_rgba(42,28,80,0.06)]">
                      <div className="mb-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Category Picker</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          Choose your store niche first. Template styles will stay focused on this business type.
                        </p>
                      </div>

                      <input
                        className="h-12 w-full rounded-xl border border-[#ddd6f2] bg-white px-4 text-sm outline-none transition focus:border-[#7c3aed] focus:ring-4 focus:ring-[#eee9fb]"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search category"
                      />

                      <div className="mt-5 flex flex-wrap gap-3">
                        {filteredCategories.map((category) => {
                          const active = String(category.id) === String(selectedCategoryId);
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => setSelectedCategoryId(category.id)}
                              className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border px-5 py-2.5 text-left text-base transition ${
                                active
                                  ? "border-[#7c3aed] bg-[#7c3aed] text-white shadow-[0_10px_22px_rgba(124,58,237,0.24)]"
                                  : "border-[#ddd6f2] bg-white text-slate-700 hover:border-[#a78bfa] hover:bg-[#faf8ff]"
                              }`}
                              style={active ? { backgroundColor: "#7c3aed", color: "#ffffff" } : undefined}
                            >
                              {active ? (
                                <span className="grid size-5 place-items-center rounded-full bg-white text-[#7c3aed]">
                                  <PiCheck className="size-3.5" />
                                </span>
                              ) : null}
                              <p className={`font-semibold ${active ? "text-[#fffaf2]" : ""}`}>{category.name}</p>
                            </button>
                          );
                        })}
                      </div>
                    </aside>

                    <section className="space-y-4">
                      <div className="flex items-center justify-between rounded-2xl border border-[#e4def5] bg-white px-5 py-4">
                        <div>
                          <h3 className="text-lg font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                            Starter Styles
                          </h3>
                          <p className="mt-1 text-sm text-stone-600">Choose one style to start from.</p>
                        </div>
                        <span className="rounded-full border border-[#ddd6f2] bg-[#f7f3ff] px-3 py-1 text-xs font-medium text-[#6d28d9]">
                          {filteredTemplates.length} styles
                        </span>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {filteredTemplates.map((template) => {
                          const active = String(template.id) === String(selectedTemplateId);
                          return (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => setSelectedTemplateId(template.id)}
                              className={`overflow-hidden rounded-[18px] border text-left transition ${
                                active
                                  ? "border-[#7c3aed] bg-[#faf8ff] text-slate-800 shadow-[0_16px_30px_rgba(124,58,237,0.14)]"
                                  : "border-[#e4def5] bg-white text-slate-700 hover:border-[#a78bfa] hover:bg-[#faf8ff]"
                              }`}
                            >
                              <div className="relative aspect-[16/10] overflow-hidden border-b border-[#eee9fb] bg-[#f7f3ff]">
                                {template.image_url ? (
                                  <img src={template.image_url} alt={template.template_name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-sm font-medium text-stone-500">
                                    Preview coming soon
                                  </div>
                                )}
                                {active ? (
                                  <div className="absolute left-3 top-3 rounded-full bg-black/30 p-1 backdrop-blur-sm">
                                    <span className="block rounded-full border border-[#2f2318] bg-[#3b2a1b] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fffaf2] shadow-[0_8px_18px_rgba(30,20,10,0.35)]">
                                      Selected
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                              <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-base font-medium text-stone-900">{template.template_name}</p>
                                  {active ? (
                                    <span className="rounded-full border border-[#ddd0ff] bg-[#f3efff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6d28d9]">
                                      Active
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs text-stone-500">
                                  {template.sections_count} sections, {template.actions_count} actions
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}

              {currentStepId === "domain" ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7c3aed]">Step 3</p>
                    <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-[#172033]">
                      Store Domain
                    </h2>
                    <p className="mt-2 text-sm text-stone-600">
                      Add the domain customers will use to visit your store.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#e4def5] bg-[#faf8ff] p-6 shadow-[0_12px_26px_rgba(42,28,80,0.06)]">
                    <label className="block">
                      <p className="mb-2 text-sm font-medium text-stone-900">Storefront Domain</p>
                      <input
                        className="h-14 w-full rounded-xl border border-[#ddd6f2] bg-white px-4 text-base outline-none transition focus:border-[#7c3aed] focus:ring-4 focus:ring-[#eee9fb]"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="shop.yourbrand.com"
                      />
                    </label>

                    <div className="mt-4 rounded-xl border border-[#e4def5] bg-white p-4 text-sm text-slate-600">
                      Example: <code>shop.yourbrand.com</code>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStepId === "builder" ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Step 4</p>
                    <h2 className="mt-2 text-[26px] font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                      Section Setup
                    </h2>
                    <p className="mt-2 text-sm text-stone-600">
                      Next step-e dedicated section setup page open hobe. Oikhane page create kore section add korle sheta website-e show korbe.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[16px] border border-[#d8c7ab] bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Brand</p>
                      <p className="mt-3 text-base font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                        {brandForm.application_name || "Store name"}
                      </p>
                    </div>
                    <div className="rounded-[16px] border border-[#d8c7ab] bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Category</p>
                      <p className="mt-3 text-base font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                        {selectedCategory?.name || "Not selected"}
                      </p>
                    </div>
                    <div className="rounded-[16px] border border-[#d8c7ab] bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Domain</p>
                      <p className="mt-3 text-base font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                        {domain || "Will configure later"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="rounded-[18px] border border-[#d8c7ab] bg-[#fffaf0] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Preset Library</p>
                          <h3 className="mt-2 text-xl font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                            {selectedTemplate?.template_name || "Selected Template"}
                          </h3>
                        </div>
                        <span className="rounded-full border border-[#d8c7ab] bg-white px-3 py-1 text-xs font-medium text-stone-500">
                          {allowedPresetVariants.length} groups
                        </span>
                      </div>

                      {builderLoading ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-[#d8c7ab] bg-white px-4 py-10 text-center text-sm text-stone-500">
                          Loading builder presets...
                        </div>
                      ) : allowedPresetVariants.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-[#d8c7ab] bg-white px-4 py-10 text-center text-sm text-stone-500">
                          No section presets available for this template yet.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          {allowedPresetVariants.map((variant) => (
                            <div key={variant.value} className="rounded-2xl border border-[#e6dccb] bg-white p-3">
                              <button
                                type="button"
                                onClick={() => toggleBuilderGroup(variant.value)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-stone-900">{variant.label}</p>
                                  <p className="mt-1 text-xs text-stone-400">
                                    {(allowedPresetLibrary?.[variant.value] || []).length} styles
                                  </p>
                                </div>
                                <span className="text-xs text-stone-400">
                                  {expandedBuilderGroups[variant.value] ? "Hide" : "Show"}
                                </span>
                              </button>

                              {expandedBuilderGroups[variant.value] ? (
                                <div className="mt-3 space-y-2">
                                  {(allowedPresetLibrary?.[variant.value] || []).map((preset) => (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      draggable
                                      onDragStart={(event) => handlePresetDragStart(event, preset)}
                                      onDragEnd={() => setDraggingPresetId("")}
                                      onClick={() => addPresetToCanvas(preset)}
                                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                                        draggingPresetId === String(preset.id)
                                          ? "border-[#5e4730] bg-[#f3e7d4]"
                                          : "border-[#e6dccb] bg-[#fffdf8] hover:border-[#c7b392] hover:bg-[#fff8ed]"
                                      }`}
                                    >
                                      <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f5ecda]">
                                        {preset.preview_image_url ? (
                                          <img src={preset.preview_image_url} alt={preset.name} className="h-full w-full object-cover" />
                                        ) : (
                                          <PiRows className="size-5 text-[#7b6140]" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-stone-900">{preset.name}</p>
                                        <p className="mt-1 text-xs text-stone-500">Drag or click to add</p>
                                      </div>
                                      <PiArrowsDownUp className="size-4 text-stone-400" />
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </aside>

                    <section className="rounded-[18px] border border-[#d8c7ab] bg-[#fffaf0] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Canvas</p>
                          <h3 className="mt-2 text-xl font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                            {builderPage?.name || "Storefront Layout"}
                          </h3>
                          <p className="mt-1 text-sm text-stone-600">
                            Preset drop koro, tarpor up/down ba drag kore position shuffle koro.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={saveInlineBuilder}
                          disabled={builderSaving || builderLoading}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8c7ab] bg-white px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-[#f8f1e5] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <PiFloppyDisk className="size-4" />
                          {builderSaving ? "Saving..." : "Save Layout"}
                        </button>
                      </div>

                      <div
                        className="mt-4 min-h-[420px] rounded-[22px] border border-dashed border-[#cdb892] bg-[linear-gradient(180deg,#fffdf8_0%,#fbf4e8_100%)] p-4"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          if (event.target === event.currentTarget) {
                            handleCanvasDrop(event);
                          }
                        }}
                      >
                        {builderLoading ? (
                          <div className="flex h-[360px] items-center justify-center text-sm text-stone-500">
                            Preparing builder canvas...
                          </div>
                        ) : canvasSections.length === 0 ? (
                          <div className="flex h-[360px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#d8c7ab] bg-white/60 text-center">
                            <PiSparkle className="size-8 text-[#7b6140]" />
                            <p className="mt-4 text-base font-semibold text-stone-900">Drop presets here</p>
                            <p className="mt-2 max-w-md text-sm text-stone-500">
                              Left sidebar theke preset drag kore ekhane chere dao. Click korleo add hobe.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {canvasSections.map((section, index) => (
                              <div
                                key={section.id}
                                data-section-id={section.id}
                                draggable
                                onDragStart={(event) => handleSectionDragStart(event, section.id)}
                                onDragEnd={() => setDraggingSectionId("")}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={handleCanvasDrop}
                                className={`rounded-[18px] border bg-white p-4 shadow-sm transition ${
                                  draggingSectionId === section.id
                                    ? "border-[#5e4730] shadow-[0_10px_26px_rgba(94,71,48,0.16)]"
                                    : "border-[#dfd0b5]"
                                }`}
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f3e7d4] text-[#5e4730]">
                                      <PiRows className="size-5" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-400">
                                        {section.variant || "section"}
                                      </p>
                                      <h4 className="mt-1 text-lg font-medium text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                                        {section.title || section.name || "Untitled Section"}
                                      </h4>
                                      <p className="mt-1 text-sm text-stone-500">
                                        Position {index + 1} {section.preset_key ? `• ${section.preset_key}` : ""}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => moveCanvasSection(section.id, -1)}
                                      disabled={index === 0}
                                      className="rounded-xl border border-[#d8c7ab] bg-white px-3 py-2 text-stone-700 disabled:opacity-40"
                                    >
                                      <PiArrowUp className="size-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveCanvasSection(section.id, 1)}
                                      disabled={index === canvasSections.length - 1}
                                      className="rounded-xl border border-[#d8c7ab] bg-white px-3 py-2 text-stone-700 disabled:opacity-40"
                                    >
                                      <PiArrowDown className="size-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeCanvasSection(section.id)}
                                      className="rounded-xl border border-[#e4c7c0] bg-[#fff7f5] px-3 py-2 text-[#9a4d3f]"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 border-t border-[#eee9fb] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="rounded-xl border border-[#ddd6f2] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#faf8ff] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                  disabled={currentStep === 0 || savingStep}
                >
                  Back
                </button>

                <button
                  type="button"
                  className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl border border-[#7c3aed] !bg-[#7c3aed] px-6 py-3 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(124,58,237,0.22)] transition hover:!bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: "#7c3aed", color: "#ffffff" }}
                  onClick={handleContinue}
                  disabled={savingStep || (currentStep === STEPS.length - 1 && builderLoading)}
                >
                  {savingStep ? "Saving..." : currentStep === STEPS.length - 1 ? "Save And Open Section Setup" : "Continue"}
                  {!savingStep ? <PiArrowRight className="size-4" /> : null}
                </button>
              </div>
            </div>
          </section>
        </section>
      </div>

      <style>{`
        @keyframes ecommerceSetupFade {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
