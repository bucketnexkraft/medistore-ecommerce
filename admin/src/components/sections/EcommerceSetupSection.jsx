import { Link } from "react-router-dom";

const normalizeSteps = (items) =>
  Array.isArray(items)
    ? items.filter((item) => item && (item.step_number || item.step_title || item.step_text))
    : [];

const resolveHref = (value, fallback = "#") => {
  const href = String(value || "").trim();
  if (!href) return fallback;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("/") || href.startsWith("#")) {
    return href;
  }
  return `/${href.replace(/^\/+/, "")}`;
};

function ActionButton({ href, children, variant = "primary" }) {
  const className =
    variant === "primary"
      ? "inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-slate-800"
      : "inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 no-underline transition hover:border-slate-400 hover:text-slate-900";

  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

export default function EcommerceSetupSection({ section }) {
  const content = section?.content || {};
  const steps = normalizeSteps(section?.elements);
  const badgeText = content?.badge_text || "Store Launch Flow";
  const title = content?.sec_title || "Complete your ecommerce setup in a few guided steps";
  const description =
    content?.sec_text ||
    "Organize the information you need before publishing. Add the brand basics, choose a category, connect a domain, and prepare your storefront sections.";
  const primaryButtonText = content?.primary_button_text || "Start Setup";
  const secondaryButtonText = content?.secondary_button_text || "Browse Sections";
  const primaryHref = resolveHref(content?.primary_button_link, "/login");
  const secondaryHref = resolveHref(content?.secondary_button_link, "/onboarding/section-setup");

  return (
    <section className="py-16 md:py-24 bg-[linear-gradient(180deg,#fff8ef_0%,#ffffff_100%)]">
      <div className="container">
        <div className="mx-auto max-w-6xl rounded-[32px] border border-[#ead7ba] bg-white/90 p-6 shadow-[0_30px_80px_rgba(84,52,21,0.08)] md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <span className="inline-flex rounded-full border border-[#ddc6a2] bg-[#fff3df] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#7a5c36]">
                {badgeText}
              </span>
              <h2 className="mt-5 text-3xl font-semibold leading-tight text-slate-900 md:text-5xl">
                {title}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">{description}</p>

              <div className="mt-7 flex flex-wrap gap-3">
                <ActionButton href={primaryHref}>{primaryButtonText}</ActionButton>
                {secondaryButtonText ? (
                  <ActionButton href={secondaryHref} variant="secondary">
                    {secondaryButtonText}
                  </ActionButton>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {steps.length > 0 ? (
                steps.map((step, index) => (
                  <article
                    key={`${step?.step_number || index}-${step?.step_title || "step"}`}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6b4f2a] text-sm font-semibold text-white">
                      {step?.step_number || String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">{step?.step_title || `Step ${index + 1}`}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {step?.step_text || "Add the required storefront information from backoffice and keep the launch flow moving."}
                    </p>
                  </article>
                ))
              ) : (
                <>
                  {[
                    ["01", "Store Identity", "Add your brand name, logo, color, and storefront look."],
                    ["02", "Store Category", "Choose the business type so the site starts with the right structure."],
                    ["03", "Store Domain", "Connect the public address customers will use to visit your shop."],
                    ["04", "Sections & Pages", "Create pages from backoffice and attach the sections you want to show."],
                  ].map(([number, heading, text]) => (
                    <article key={number} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6b4f2a] text-sm font-semibold text-white">
                        {number}
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-slate-900">{heading}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                    </article>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
