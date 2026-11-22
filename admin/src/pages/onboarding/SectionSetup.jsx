import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { PiCheck, PiMagnifyingGlass, PiSparkle, PiStorefront, PiRows, PiPalette } from "react-icons/pi";
import { toast } from "react-toastify";
import HeaderStatic from "../../components/layout/HeaderStatic";
import FooterSection from "../../components/sections/FooterSection";
import { API_URL } from "../../config/constants";
import useLandingThemeAssets from "../../hooks/useLandingThemeAssets";
import { applyEcommerceTemplate, getEcommerceSetupData, getPublicEcommerceSetupData } from "../../api/ecommerceSetup";
import StorefrontHomeBuilder from "../company-preference/storefront-home/StorefrontHomeBuilder";

export default function SectionSetup() {
  useLandingThemeAssets();

  const [searchParams] = useSearchParams();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyName = useSelector((state) => state.preferences?.data?.application_name) || "Your Store";
  const isLoggedIn = Boolean(accessToken);
  const seedDemoDataFromCheckout = searchParams.has("seed_demo_data")
    ? searchParams.get("seed_demo_data") === "1"
    : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [builderRefreshKey, setBuilderRefreshKey] = useState(0);
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#2f3a4c");
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadLandingShell = async () => {
      try {
        const [settingsResponse, menuResponse] = await Promise.all([
          fetch(`${API_URL}/landing/settings`, { headers: { Accept: "application/json" } }),
          fetch(`${API_URL}/landing/menu`, { headers: { Accept: "application/json" } }),
        ]);

        const settingsResult = settingsResponse.ok ? await settingsResponse.json() : null;
        const menuResult = menuResponse.ok ? await menuResponse.json() : null;
        const data = settingsResult?.data || {};
        const nextLogo = data?.dark_logo_url || data?.white_logo_url || "";
        const nextColor = data?.base_color || "#2f3a4c";
        const nextMenu = Array.isArray(menuResult?.data)
          ? menuResult.data.filter((item) => {
              const title = String(item?.title || "").trim().toLowerCase();
              const path = String(item?.path || "").trim().toLowerCase();
              return !(title === "home" || path === "/" || path === "/home");
            })
          : [];

        if (mounted) {
          setLogoUrl(nextLogo);
          setBrandColor(nextColor);
          setMenuItems(nextMenu);
        }
      } catch {
        if (mounted) {
          setLogoUrl("");
          setBrandColor("#2f3a4c");
          setMenuItems([]);
        }
      }
    };

    loadLandingShell();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!accessToken) {
        try {
          const result = await getPublicEcommerceSetupData();
          if (!mounted) return;

          const nextPayload = result?.data || null;
          const nextCategoryId = nextPayload?.selected_category?.id || nextPayload?.categories?.[0]?.id || null;
          const nextTemplateId = nextPayload?.selected_template?.id || nextPayload?.templates?.[0]?.id || null;

          setPayload(nextPayload);
          setSelectedCategoryId(nextCategoryId);
          setSelectedTemplateId(nextTemplateId);
        } catch (error) {
          if (mounted) {
            toast.error(error?.response?.data?.message || error?.message || "Failed to load public setup options");
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
        return;
      }

      setLoading(true);
      try {
        const result = await getEcommerceSetupData(accessToken);
        if (!mounted) return;

        const nextPayload = result?.data || null;
        const nextCategoryId = nextPayload?.selected_category?.id || nextPayload?.categories?.[0]?.id || null;
        const nextTemplateId = nextPayload?.selected_template?.id || nextPayload?.templates?.[0]?.id || null;

        setPayload(nextPayload);
        setSelectedCategoryId(nextCategoryId);
        setSelectedTemplateId(nextTemplateId);
      } catch (error) {
        if (mounted) {
          toast.error(error?.response?.data?.message || error?.message || "Failed to load setup options");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const categories = payload?.categories || [];
  const templates = payload?.templates || [];
  const filteredCategories = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    if (!keyword) return categories;
    return categories.filter((item) => String(item?.name || "").toLowerCase().includes(keyword));
  }, [categories, search]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (!selectedCategoryId) return true;
      return (template?.categories || []).some((item) => String(item?.id) === String(selectedCategoryId));
    });
  }, [selectedCategoryId, templates]);

  useEffect(() => {
    if (!filteredTemplates.some((template) => String(template?.id) === String(selectedTemplateId))) {
      setSelectedTemplateId(filteredTemplates[0]?.id || null);
    }
  }, [filteredTemplates, selectedTemplateId]);

  const selectedCategory =
    categories.find((item) => String(item?.id) === String(selectedCategoryId)) || null;
  const selectedTemplate =
    filteredTemplates.find((item) => String(item?.id) === String(selectedTemplateId)) ||
    templates.find((item) => String(item?.id) === String(selectedTemplateId)) ||
    null;
  const selectedTemplateCount = filteredTemplates.length;

  const applyTemplateSelection = async () => {
    if (!selectedCategory || !selectedTemplate) {
      toast.error("Choose a category and template first.");
      return;
    }

    if (!isLoggedIn) {
      setPayload((prev) => ({
        ...(prev || {}),
        selected_category: selectedCategory,
        selected_template: selectedTemplate,
      }));
      toast.info("Public preview updated. Login only when you want to save and continue.");
      return;
    }

    setSaving(true);
    try {
      const templatePayload = {
        category_id: selectedCategory.id,
        template_id: selectedTemplate.id,
      };
      if (seedDemoDataFromCheckout !== null) {
        templatePayload.seed_demo_data = seedDemoDataFromCheckout;
      }
      const result = await applyEcommerceTemplate(accessToken, templatePayload);

      setPayload((prev) => ({
        ...(prev || {}),
        selected_category: result?.data?.category || selectedCategory,
        selected_template: result?.data?.template || selectedTemplate,
      }));
      setBuilderRefreshKey((prev) => prev + 1);
      toast.success("Template applied. You can now arrange sections below.");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to apply template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <HeaderStatic logoUrl={logoUrl} brandColor={brandColor} menuItems={menuItems} />

      <main className="bg-[#f3f6fb] pb-16 pt-[120px] md:pt-[140px]">
        <div className="mx-auto max-w-6xl space-y-5 px-4 md:px-8">
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="px-5 py-6 md:px-8">
              <div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3 transition focus-within:border-slate-900 focus-within:bg-white focus-within:shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
                  <label className="group flex h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4">
                    <input
                      className="h-full w-full bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search business category"
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-focus-within:bg-slate-900 group-focus-within:text-white">
                      <PiMagnifyingGlass className="text-xl" />
                    </div>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Suggested
                  </span>
                  {filteredCategories.slice(0, 6).map((category) => {
                    const active = String(category?.id) === String(selectedCategoryId);
                    return (
                      <button
                        key={`suggested-${category.id}`}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="border-t border-slate-200 px-5 py-6 md:px-8">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <PiPalette size={15} />
                Template Selection
              </div>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                  {selectedCategory?.name ? `${selectedCategory.name} templates` : "Choose a category"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {selectedTemplateCount} matching template{selectedTemplateCount === 1 ? "" : "s"} available for the selected category.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={applyTemplateSelection}
                  disabled={saving || loading || !selectedCategory || !selectedTemplate}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Applying..." : isLoggedIn ? "Apply Template" : "Preview Template"}
                </button>
              </div>

              {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
                  Loading templates...
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
                  No template found for the selected category.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredTemplates.map((template) => {
                    const active = String(template?.id) === String(selectedTemplateId);
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`overflow-hidden rounded-[22px] border text-left transition ${
                          active
                            ? "border-slate-900 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                        }`}
                      >
                        <div className="relative flex h-56 items-center justify-center bg-slate-100">
                          {template.image_url ? (
                            <img src={template.image_url} alt={template.template_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="px-8 text-center">
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                                <PiRows size={22} />
                              </div>
                              <p className="mt-3 text-sm font-medium text-slate-500">Preview coming soon</p>
                            </div>
                          )}

                          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                            {active ? (
                              <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                                Selected
                              </div>
                            ) : (
                              <span />
                            )}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedTemplateId(template.id);
                                  window.open(`/store-setup/preview/${template.id}`, "_blank", "noopener,noreferrer");
                                }}
                                className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-sm transition hover:bg-white"
                              >
                              Preview
                            </button>
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-semibold text-slate-950">{template.template_name}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {template.sections_count} sections, {template.actions_count} actions
                              </p>
                            </div>
                            {active ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                Active
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {isLoggedIn ? (
            <section className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-3">
              <StorefrontHomeBuilder key={builderRefreshKey} />
            </section>
          ) : (
            <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
              <h2 className="text-2xl font-semibold text-slate-900">Builder unlocks after login</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Category and template browsing stays public. When you are ready to save pages, add sections, and publish the storefront structure, log in and reopen this same link.
              </p>
            </section>
          )}
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
