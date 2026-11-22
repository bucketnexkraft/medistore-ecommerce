import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { API_URL, formatFeatureLabel } from "../../config/constants";
import { BsCheckCircleFill } from "react-icons/bs";

function formatPrice(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

function formatNumber(value) {
  const amount = Number(value || 0);
  return amount > 0 ? amount.toLocaleString("en-US") : "Unlimited";
}

function pluralize(value, singular, plural) {
  return Number(value || 0) === 1 ? singular : plural;
}

function normalizePlanFeatures(plan = {}) {
  const rawFeatures = plan.features ?? plan.feature_codes ?? plan.unlocked_features ?? [];
  let parsedFeatures = rawFeatures;

  if (typeof rawFeatures === "string") {
    try {
      parsedFeatures = JSON.parse(rawFeatures);
    } catch {
      parsedFeatures = rawFeatures.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }

  if (parsedFeatures && !Array.isArray(parsedFeatures) && typeof parsedFeatures === "object") {
    parsedFeatures = Object.values(parsedFeatures);
  }

  return Array.isArray(parsedFeatures)
    ? parsedFeatures.map((feature) => String(feature)).filter(Boolean)
    : [];
}

function getCoreAccessItems(plan = {}) {
  return [
    Number(plan.inventory_item_limit || 0) > 0 ? `${formatNumber(plan.inventory_item_limit)} Inventory Items` : null,
    Number(plan.monthly_pos_transaction_limit || 0) > 0 ? `${formatNumber(plan.monthly_pos_transaction_limit)} POS Transactions Per Month` : null,
    Number(plan.warehouse_limit || 0) > 0 ? `${formatNumber(plan.warehouse_limit)} ${pluralize(plan.warehouse_limit, "Warehouse Or Store", "Warehouses Or Branches")}` : null,
    Number(plan.user_limit || 0) > 0 ? `${formatNumber(plan.user_limit)} Staff ${pluralize(plan.user_limit, "User", "Users")}` : null,
  ].filter(Boolean);
}

function getAccessGroups(plan = {}) {
  const features = normalizePlanFeatures(plan);
  const coreAccessItems = getCoreAccessItems(plan);
  const marketingLimits = features.filter((feature) =>
    /(inventory|pos transaction|warehouse|staff user|user limit|barcode billing|low-stock|support|onboarding)/i.test(feature)
  );

  return {
    coreAccessItems: coreAccessItems.length > 0 ? coreAccessItems : marketingLimits.map((feature) => formatFeatureLabel(feature)),
  };
}

export default function PricingSection() {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("monthly");
  const [expandedPlanKeys, setExpandedPlanKeys] = useState({});

  useEffect(() => {
    let mounted = true;

    const loadPricing = async () => {
      try {
        const response = await fetch(`${API_URL}/landing/sections/pricing`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Pricing failed: ${response.status}`);
        const result = await response.json();
        if (mounted) setData(result?.data || null);
      } catch {
        if (mounted) setData(null);
      }
    };

    loadPricing();
    return () => {
      mounted = false;
    };
  }, []);

  const plans = useMemo(() => (Array.isArray(data?.plans) ? data.plans : []), [data?.plans]);
  const filteredPlans = useMemo(() => plans.filter((plan) => String(plan?.billing_period || "monthly").toLowerCase() === period), [plans, period]);
  const ctaText = data?.button_text || "Get started";
  const visibleFeatureLimit = 8;

  const togglePlanFeatures = (planKey) => {
    setExpandedPlanKeys((prev) => ({ ...prev, [planKey]: !prev[planKey] }));
  };

  const handlePlanClick = (planId) => {
    const checkoutPath = `/plans/checkout/${planId}`;

    if (accessToken) {
      navigate(checkoutPath);
      return;
    }

    navigate(`/login?redirect=${encodeURIComponent(checkoutPath)}`);
  };

  return (
    <section className="ot-price-area ot-space-bottom" data-section="pricing">
      <div className="container container-1600">
        <div className="ot-price-wrapp p-relative">
          {(data?.sec_title || data?.sec_text) ? (
            <div className="ot-title-area text-center mb-45">
              <h3 className="ot-sec-title ot-text-anime-3">{data?.sec_title || ""}</h3>
              <p className="ot-sec-text ot-text-anime-1">{data?.sec_text || ""}</p>
            </div>
          ) : null}
          <style>
            {`
              .ot-price-switch-box {
                position: relative;
                display: inline-flex;
                align-items: center;
                padding: 6px;
                border-radius: 999px;
                background: rgba(79, 70, 229, 0.12);
                border: 1px solid rgba(99, 102, 241, 0.28);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
                overflow: hidden;
              }
              .ot-price-switch-box .nav-link {
                position: relative;
                z-index: 2;
                min-width: 120px;
                border: 0;
                border-radius: 999px;
                background: transparent;
                color: #4b5563;
                font-weight: 700;
                font-size: 1rem;
                line-height: 1;
                padding: 0.85rem 1.15rem;
                transition: color 0.25s ease;
              }
              .ot-price-switch-box .nav-link.active {
                color: #fff;
              }
              .ot-price-switch-bg {
                position: absolute;
                top: 6px;
                left: 6px;
                width: calc(50% - 6px);
                height: calc(100% - 12px);
                border-radius: 999px;
                background: linear-gradient(90deg, #4f46e5 0%, #6366f1 100%);
                box-shadow: 0 8px 22px rgba(79, 70, 229, 0.3);
                transition: transform 0.28s ease;
                z-index: 1;
              }
              .ot-price-switch-box.is-yearly .ot-price-switch-bg {
                transform: translateX(100%);
              }
              .ot-price-feature-more {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                border: 0;
                border-radius: 999px;
                background: rgba(99, 102, 241, 0.1);
                color: #4f46e5;
                font-size: 0.95rem;
                font-weight: 800;
                line-height: 1;
                padding: 0.78rem 1rem;
                margin-top: 12px;
                transition: background 0.2s ease, transform 0.2s ease;
              }
              .ot-price-feature-more:hover {
                background: rgba(99, 102, 241, 0.16);
                transform: translateY(-1px);
              }
            `}
          </style>
          <div className="ot-pricing-tabs mb-40 text-center">
            <div className="ot-price-switch d-flex justify-content-center">
              <nav>
                <div className={`nav nav-tab ot-price-switch-box ${period === "yearly" ? "is-yearly" : ""}`} role="tablist" id="pricingPeriodSwitcher">
                  <button className={`nav-link monthly ${period === "monthly" ? "active" : ""}`} type="button" data-period="monthly" onClick={() => setPeriod("monthly")}>
                    Monthly
                  </button>
                  <button className={`nav-link yearly ${period === "yearly" ? "active" : ""}`} type="button" data-period="yearly" onClick={() => setPeriod("yearly")}>
                    Yearly
                  </button>
                  <span className="ot-price-switch-bg" />
                </div>
              </nav>
            </div>
          </div>

          <div className="row gy-30 align-items-center">
            {filteredPlans.map((plan, index) => {
              const planKey = String(plan.id || `${plan.name || "plan"}-${index}`);
              const { coreAccessItems } = getAccessGroups(plan);
              const isExpanded = Boolean(expandedPlanKeys[planKey]);
              const visibleCoreAccessItems = isExpanded ? coreAccessItems : coreAccessItems.slice(0, visibleFeatureLimit);
              const hiddenFeatureCount = Math.max(0, coreAccessItems.length - visibleFeatureLimit);

              return (
              <div className="col-xl-3 col-lg-4 col-md-6" key={`plan-${planKey}`}>
                <div className={`ot-price-card ${index === 0 ? "active" : ""} js-pricing-card`} data-plan-period={plan?.billing_period || "monthly"}>
                  <div className="ot-price-head">
                    {plan?.is_free === "free" ? (
                      <h2 className="ot-price-value">{formatPrice(0)}</h2>
                    ) : (
                      <h2 className="ot-price-value mb-5">
                        {formatPrice(plan?.price)}
                        <span className="ot-price-duration">/{plan?.billing_period || period}</span>
                      </h2>
                    )}
                    <h3 className="ot-price-categorie ot-text-anime-3">{plan?.name || ""}</h3>
                  </div>
                  <div className="ot-price-body">
                    {coreAccessItems.length > 0 ? (
                      <ul className="ot-price-list">
                        {visibleCoreAccessItems.map((feature, fIndex) => (
                          <li className="ot-price-list-item" key={`core-${fIndex}`}>
                            <span className="ot-price-list-icon">
                              <BsCheckCircleFill aria-hidden="true" />
                            </span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {hiddenFeatureCount > 0 ? (
                      <button
                        type="button"
                        className="ot-price-feature-more"
                        onClick={() => togglePlanFeatures(planKey)}
                      >
                        {isExpanded ? "Show less" : `+${hiddenFeatureCount} more benefits`}
                      </button>
                    ) : null}

                    {coreAccessItems.length === 0 ? (
                      <ul className="ot-price-list">
                        <li className="ot-price-list-item">
                          <span className="ot-price-list-icon">
                            <BsCheckCircleFill aria-hidden="true" />
                          </span>
                          Core inventory and POS access
                        </li>
                      </ul>
                    ) : null}
                  </div>
                  <div className="ot-price-btnbox">
                    <button
                      type="button"
                      className="ot-price-btn"
                      onClick={() => handlePlanClick(plan?.id)}
                    >
                      {ctaText}
                    </button>
                  </div>
                </div>
              </div>
              );
            })}

            {!filteredPlans.length ? (
              <div className="col-12 text-center" id="pricingNoPlanMessage">
                <p className="ot-price-text mb-0">No plans available for this billing period.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
