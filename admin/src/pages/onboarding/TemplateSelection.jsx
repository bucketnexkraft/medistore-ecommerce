import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { PiCheck, PiMagnifyingGlass, PiRows, PiSlidersHorizontal } from "react-icons/pi";
import { applyEcommerceTemplate, getEcommerceSetupData } from "../../api/ecommerceSetup";
import { setPlanAccess } from "../../slice/authSlice";

const fallbackImages = [
  "/themes/themes-1.png",
  "/themes/themes-2.png",
  "/themes/themes-3.png",
  "/themes/themes-4.png",
];

const typeLabel = (value) => {
  const labels = { FREE: "Free", PRMT: "Premium", PTSU: "Premium Single Use" };
  return labels[String(value || "").toUpperCase()] || "Premium";
};

const isFree = (value) => String(value || "").toUpperCase() === "FREE";

export default function TemplateSelection() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seedDemoDataFromCheckout = searchParams.has("seed_demo_data")
    ? searchParams.get("seed_demo_data") === "1"
    : null;
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [templateType, setTemplateType] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let active = true;
    getEcommerceSetupData(accessToken, { includePaid: true })
      .then((response) => {
        if (!active) return;
        const nextPayload = response?.data || {};
        setPayload(nextPayload);
        setSelectedId(nextPayload?.selected_template?.id || null);
      })
      .catch((error) => {
        if (active) toast.error(error?.response?.data?.message || error?.message || "Failed to load templates.");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [accessToken]);

  const categories = payload?.categories || [];
  const templates = payload?.templates || [];
  const activeCategory = categories.find((item) => String(item.id) === String(categoryId));
  const typeOptions = [...new Set(templates.map((item) => String(item.template_type || "").trim()).filter(Boolean))];

  const visibleTemplates = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return templates.filter((template) => {
      const categoryMatch = !activeCategory || (template.categories || []).some(
        (item) => String(item.id) === String(activeCategory.id) || String(item.name || "").toLowerCase() === String(activeCategory.name || "").toLowerCase(),
      );
      const typeMatch = templateType === "all" || String(template.template_type || "").toUpperCase() === templateType.toUpperCase();
      const searchMatch = !keyword || [template.template_name, template.short_description].join(" ").toLowerCase().includes(keyword);
      return categoryMatch && typeMatch && searchMatch;
    });
  }, [activeCategory, search, templateType, templates]);

  const selectTemplate = async (template) => {
    const templateCategory = activeCategory || categories.find((category) =>
      (template.categories || []).some((item) => String(item.id) === String(category.id)),
    ) || categories[0];

    if (!templateCategory) {
      toast.error("This template has no category.");
      return;
    }

    setSelectedId(template.id);
    setSavingId(template.id);
    try {
      const templatePayload = {
        template_id: template.id,
        category_id: templateCategory.id,
      };
      if (seedDemoDataFromCheckout !== null) {
        templatePayload.seed_demo_data = seedDemoDataFromCheckout;
      }
      const response = await applyEcommerceTemplate(accessToken, templatePayload);
      setPayload((current) => ({
        ...(current || {}),
        selected_category: response?.data?.category || templateCategory,
        selected_template: response?.data?.template || template,
      }));
      dispatch(setPlanAccess({
        needs_ecommerce_setup: false,
        selected_e_template_id: response?.data?.template?.id || template.id,
      }));
      toast.success("Template selected successfully.");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to select template.");
    } finally {
      setSavingId(null);
    }
  };

  const startTemplatePurchase = (template) => {
    const templateCategory = activeCategory || categories.find((category) =>
      (template.categories || []).some((item) => String(item.id) === String(category.id)),
    ) || payload?.selected_category;

    navigate(`/templates/checkout/${template.id}`, {
      state: { categoryId: templateCategory?.id || null },
    });
  };

  return (
    <main className="min-h-full bg-[#fcfbf7] px-5 pb-20 pt-10 text-[#121217] lg:px-8 lg:pt-14">
      <div className="mx-auto max-w-[1500px]">
        <section className="mx-auto max-w-[760px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5423e7]">Store setup</p>
          <h1 className="mt-4 text-[42px] font-semibold tracking-[-0.06em] sm:text-[58px]">Browse all themes</h1>
          <p className="mx-auto mt-4 max-w-[700px] text-[15px] leading-7 text-[#5f6b80]">Choose a storefront template for your store. You can change it anytime from here.</p>
          <label className="mx-auto mt-7 flex h-14 max-w-[690px] items-center gap-3 rounded-full border border-[#5423e7] bg-white px-5 shadow-[0_10px_28px_rgba(84,35,231,0.08)]">
            <PiMagnifyingGlass className="size-5 text-[#667085]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search themes" className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#8a93a3]" />
          </label>
        </section>

        <div className="mt-12 flex flex-col gap-5 border-b border-[#e7e1d8] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="mr-1 font-semibold text-[#212124]">Popular:</span>
            <button type="button" onClick={() => setCategoryId(null)} className={`rounded-full px-4 py-2 font-semibold ${!categoryId ? "bg-[#5423e7] text-white" : "border border-[#e5e0d8] bg-white text-[#687386]"}`}>All</button>
            {categories.slice(0, 4).map((category) => (
              <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} className={`rounded-full px-4 py-2 ${String(categoryId) === String(category.id) ? "bg-[#5423e7] font-semibold text-white" : "border border-[#e5e0d8] bg-white text-[#687386]"}`}>{category.name}</button>
            ))}
          </div>
          <div className="relative flex items-center gap-2">
            <PiSlidersHorizontal className="size-4 text-[#5423e7]" />
            <select value={templateType} onChange={(event) => setTemplateType(event.target.value)} className="h-10 min-w-44 rounded-full border border-[#e5e0d8] bg-white px-4 text-sm font-semibold text-[#212124] outline-none focus:border-[#5423e7]">
              <option value="all">All themes</option>
              {typeOptions.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#212124]">{activeCategory?.name || "All themes"}</p>
          <p className="text-[12px] text-[#7d8798]">{visibleTemplates.length} templates</p>
        </div>

        {loading ? (
          <div className="mt-5 grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-[444/464] bg-[#eee9e2]" /><div className="mt-4 h-5 w-2/3 rounded bg-[#eee9e2]" /><div className="mt-3 h-3 w-full rounded bg-[#eee9e2]" /></div>)}
          </div>
        ) : visibleTemplates.length === 0 ? (
          <div className="mt-5 border border-[#eadfd5] bg-white px-5 py-10 text-center text-sm text-[#6b7280]">No themes found.</div>
        ) : (
          <div className="mt-5 grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {visibleTemplates.map((template, index) => {
              const free = isFree(template.template_type);
              const active = String(selectedId) === String(template.id);
              const canUse = free || Boolean(template.has_access);
              const previewUrl = template.demo_preview_url || `/store-setup/preview/${template.id}`;
              return (
                <article key={template.id} className="group min-w-0">
                  <h2 className="mb-4 text-[16px] font-medium text-[#5a5a59]">{template.template_name}</h2>
                  <div className={`relative aspect-[444/464] overflow-hidden border bg-white ${active ? "border-[#5423e7]" : "border-[#e5e0d8]"}`}>
                    {template.image_url ? <img src={template.image_url} alt={`${template.template_name} theme preview`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="flex h-full items-center justify-center bg-[#f1ede7]"><PiRows className="size-10 text-[#aaa39a]" /></div>}
                    <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold ${free ? "bg-[#dcfce7] text-[#16834a]" : "bg-[#f0e8ff] text-[#6e26f2]"}`}>{free ? "Free" : typeLabel(template.template_type)}</span>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      <button type="button" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")} className="pointer-events-auto rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#121217]">Preview</button>
                      {canUse ? (
                        <button type="button" onClick={() => void selectTemplate(template)} disabled={savingId !== null} className="pointer-events-auto rounded-full bg-[#7f00ff] px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">{savingId === template.id ? "Saving..." : "Use this template"}</button>
                      ) : (
                        <button type="button" onClick={() => startTemplatePurchase(template)} className="pointer-events-auto rounded-full bg-[#7f00ff] px-5 py-2.5 text-[13px] font-semibold text-white">Buy for ${Number(template.discounted_price ?? template.price ?? 0).toFixed(2)}</button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[#212124]">{free ? "Free" : typeLabel(template.template_type)}{!free && Number(template.price || 0) > 0 ? <span className="ml-2 text-[#6e26f2]">${Number(template.price).toFixed(2)}</span> : null}</p>
                      {template.short_description ? <p className="mt-3 truncate text-[12px] text-[#6b7280]">{template.short_description}</p> : null}
                    </div>
                    {active ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f0e8ff] px-3 py-1 text-[11px] font-semibold text-[#6e26f2]"><PiCheck className="size-3" />Selected</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
