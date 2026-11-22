import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  PiBank,
  PiChatsCircle,
  PiGoogleLogo,
  PiGlobeHemisphereWest,
  PiMegaphone,
  PiChatText,
  PiStorefront,
  PiTruck,
} from "react-icons/pi";
import { isFeatureIncludedInPlan } from "../../utils/planFeatures";
import { getproductSettings } from "../../api/productSettings";

const shopCards = [
  {
    title: "Shop Settings",
    description: "General shop configurations customize your shop's core settings for a seamless experience.",
    icon: PiStorefront,
    to: "/company-preference/general-preference",
    featureRequired: "ftr_general_preference",
  },
  {
    title: "Shop Domain",
    description: "Manage your shop's core configurations, including domain setup and general settings.",
    icon: PiGlobeHemisphereWest,
    to: "/company-preference/shop-setup/domain",
    featureRequired: "ftr_shop_domain_setup",
  },
  {
    title: "Store Template",
    description: "Choose or change the storefront template used by your online store.",
    icon: PiStorefront,
    to: "/onboarding/ecommerce-template",
    featureRequired: "ftr_storefront_home",
  },
  {
    title: "Delivery Support",
    description: "Manage your shop's delivery settings to ensure smooth and efficient order fulfillment.",
    icon: PiTruck,
    to: "/company-preference/shop-setup/delivery-support",
    featureRequired: "ftr_shop_delivery_support",
  },
  {
    title: "Payment Gateway",
    description: "Choose which system payment gateways this company can use during checkout.",
    icon: PiBank,
    to: "/company-preference/shop-setup/payment-gateway",
    featureRequired: "ftr_payment_gateway",
  },
  {
    title: "Social Authentication",
    description: "Configure Google sign-in credentials for this company.",
    icon: PiGoogleLogo,
    to: "/company-preference/shop-setup/social-auth",
    featureRequired: "ftr_social_auth",
  },
  {
    title: "SEO & Marketing Integrations",
    description: "Enhance your shop's visibility with SEO tools and channel integrations for better engagement.",
    icon: PiMegaphone,
    to: "/company-preference/shop-setup/seo-marketing",
    featureRequired: "ftr_shop_seo_marketing",
  },
  {
    title: "Chat Support",
    description: "Provide instant communication and assistance to customers with chat support system.",
    icon: PiChatsCircle,
    to: "/company-preference/shop-setup/chat-support",
    featureRequired: "ftr_shop_chat_support",
  },
  {
    title: "SMS Support",
    description: "Enable SMS notifications and support to keep your customers informed with real-time updates.",
    icon: PiChatText,
    to: "/company-preference/shop-setup/sms-support",
    featureRequired: "ftr_shop_sms_support",
  },
];

function ShopSetupCard({ card, locked }) {
  const Icon = card.icon;

  return (
    <Link
      to={card.to}
      className="group relative rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_18px_40px_rgba(109,40,217,0.08)]"
    >
      {card.badge ? (
        <span className="absolute right-6 top-5 rounded-full border-2 border-emerald-300 bg-violet-700 px-4 py-1 text-sm font-semibold text-white">
          {card.badge}
        </span>
      ) : null}
      {locked ? (
        <span className="absolute right-6 top-5 rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-sm font-semibold text-amber-700">
          Upgrade required
        </span>
      ) : null}

      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
        <Icon size={28} />
      </span>

      <h2 className="mt-8 text-[2rem] font-semibold tracking-tight text-slate-900">
        {card.title}
      </h2>
      <p className="mt-4 max-w-2xl text-xl leading-9 text-slate-500">
        {card.description}
      </p>
    </Link>
  );
}

export default function ShopSetup() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  const [activeFeatures, setActiveFeatures] = useState(new Set());

  const loadActiveFeatures = useCallback(async () => {
    if (!accessToken || isSuperAdmin) return;

    try {
      const response = await getproductSettings(accessToken);
      const activeCodes = (response?.data?.preferences || [])
        .filter((preference) => preference?.is_active)
        .map((preference) => preference.code)
        .filter(Boolean);
      setActiveFeatures(new Set(activeCodes));
    } catch {
      setActiveFeatures(new Set());
    }
  }, [accessToken, isSuperAdmin]);

  useEffect(() => {
    loadActiveFeatures();
  }, [loadActiveFeatures]);

  const visibleCards = useMemo(
    () => shopCards.filter((card) => {
      if (isSuperAdmin) return true;
      return activeFeatures.has(card.featureRequired);
    }),
    [activeFeatures, isSuperAdmin]
  );

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-8">
          <h1 className="text-5xl font-bold tracking-tight text-slate-950">
            Manage Shop
          </h1>
          <p className="mt-3 text-2xl text-slate-500">
            Set up and customize your shop to ensure a smooth and efficient experience.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {visibleCards.map((card) => (
            <ShopSetupCard
              key={card.title}
              card={card}
              locked={
                !isSuperAdmin &&
                !isFeatureIncludedInPlan(selectedPlanFeatures, card.featureRequired)
              }
            />
          ))}
        </section>
      </div>
    </div>
  );
}
