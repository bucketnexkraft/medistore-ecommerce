import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Link } from "react-router-dom";
import { API_URL } from "../../config/constants";
import { resolveStorefrontActionHref } from "../../utils/storefrontLinks";
import { HeroBannerLayouts } from "./hero/HeroLayouts";

function ActionLink({ action, className = "", style }) {
  const href = resolveStorefrontActionHref(action);
  const label = String(action?.name || action?.slug || "Explore").trim();
  const isExternal = href.startsWith("http://") || href.startsWith("https://");

  if (isExternal) {
    return (
      <a href={href} className={className} style={style} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  return (
    <Link to={href} className={className} style={style}>
      {label}
    </Link>
  );
}

function SectionShell({ section, brandColor, children }) {
  return (
    <section className="py-5" data-variant={section?.variant || ""}>
      <div className="container">
        <div
          className="rounded-4 p-4 p-lg-5"
          style={{
            background: "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(255,255,255,1) 100%)",
            border: "1px solid rgba(226,232,240,0.95)",
            boxShadow: "0 18px 48px rgba(15,23,42,0.06)",
          }}
        >
          <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-3 mb-4">
            <div>
              {section?.title ? <h2 className="mb-2" style={{ color: "#0f172a" }}>{section.title}</h2> : null}
              {section?.subtitle ? <p className="mb-0 text-muted">{section.subtitle}</p> : null}
            </div>
            {Array.isArray(section?.actions) && section.actions.length > 0 ? (
              <div className="d-flex flex-wrap gap-2">
                {section.actions.map((action) => (
                  <ActionLink
                    key={action.id || action.slug}
                    action={action}
                    className="btn"
                    style={{ backgroundColor: brandColor, color: "#fff" }}
                  />
                ))}
              </div>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

function useTemplateFeed(section) {
  const [state, setState] = useState({ loading: false, items: [] });
  const variant = String(section?.variant || "").trim().toLowerCase();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      let endpoint = "";

      if (variant === "hot_category" || variant === "category_grid") {
        endpoint = `${API_URL}/landing/categories`;
      } else if (variant === "product_carousel" || variant === "brand_strip") {
        endpoint = `${API_URL}/landing/products?perPage=12`;
      }

      if (!endpoint) {
        setState({ loading: false, items: [] });
        return;
      }

      setState((current) => ({ ...current, loading: true }));

      try {
        const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
        const result = response.ok ? await response.json() : null;

        if (!mounted) return;

        if (variant === "hot_category" || variant === "category_grid") {
          const items = Array.isArray(result?.data?.categories) ? result.data.categories.slice(0, 8) : [];
          setState({ loading: false, items });
          return;
        }

        if (variant === "product_carousel") {
          const items = Array.isArray(result?.data?.products) ? result.data.products.slice(0, 8) : [];
          setState({ loading: false, items });
          return;
        }

        if (variant === "brand_strip") {
          const items = Array.isArray(result?.data?.products)
            ? result.data.products
                .map((product) => String(product?.brand || "").trim())
                .filter(Boolean)
                .filter((brand, index, list) => list.indexOf(brand) === index)
                .slice(0, 12)
                .map((brand) => ({ brand }))
            : [];
          setState({ loading: false, items });
          return;
        }

        setState({ loading: false, items: [] });
      } catch {
        if (mounted) {
          setState({ loading: false, items: [] });
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [variant]);

  return state;
}

export default function StorefrontTemplateSection({ section, brandColor = "#2f3a4c" }) {
  const layout = String(section?.layout || "").trim().toLowerCase();
  const variant = String(section?.variant || "").trim().toLowerCase();
  const { loading, items } = useTemplateFeed(section);
  const richTextHtml = useMemo(
    () => DOMPurify.sanitize(String(section?.rich_text_html || section?.content?.html || "")),
    [section],
  );

  if (layout === "rich_text") {
    return (
      <SectionShell section={section} brandColor={brandColor}>
        <div dangerouslySetInnerHTML={{ __html: richTextHtml }} />
      </SectionShell>
    );
  }

  if (variant === "hero") {
    return (
      <HeroBannerLayouts
        componentKey={section?.template?.component_key || section?.component_key || "storefront-hero"}
        actions={Array.isArray(section?.actions) ? section.actions : []}
      />
    );
  }

  if (variant === "hot_category" || variant === "category_grid") {
    return (
      <SectionShell section={section} brandColor={brandColor}>
        <div className="row g-3">
          {loading ? (
            <p className="mb-0 text-muted">Loading categories...</p>
          ) : items.length > 0 ? (
            items.map((item) => (
              <div key={item.id || item.slug} className="col-6 col-lg-3">
                <Link
                  to={`/products?category=${item.slug}`}
                  className="d-flex h-100 flex-column rounded-4 border bg-white p-3 text-decoration-none"
                  style={{ borderColor: "#e2e8f0", minHeight: 200 }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="mb-3 rounded-3"
                    style={{ width: "100%", height: 120, objectFit: "cover" }}
                  />
                  <strong className="text-dark">{item.name}</strong>
                  <span className="mt-1 text-muted">{item.products_count || 0} products</span>
                </Link>
              </div>
            ))
          ) : (
            <p className="mb-0 text-muted">No categories found for this section.</p>
          )}
        </div>
      </SectionShell>
    );
  }

  if (variant === "product_carousel") {
    return (
      <SectionShell section={section} brandColor={brandColor}>
        <div className="row g-3">
          {loading ? (
            <p className="mb-0 text-muted">Loading products...</p>
          ) : items.length > 0 ? (
            items.map((item) => (
              <div key={item.id || item.slug} className="col-6 col-lg-3">
                <Link
                  to={`/product/${item.slug}`}
                  className="d-flex h-100 flex-column rounded-4 border bg-white p-3 text-decoration-none"
                  style={{ borderColor: "#e2e8f0", minHeight: 260 }}
                >
                  <img
                    src={item.thumbnail}
                    alt={item.name}
                    className="mb-3 rounded-3"
                    style={{ width: "100%", height: 150, objectFit: "cover" }}
                  />
                  <strong className="text-dark">{item.name}</strong>
                  <span className="mt-1 text-muted">{item.brand || "Storefront item"}</span>
                  <span className="mt-2 fw-semibold" style={{ color: brandColor }}>
                    ${Number(item.price || 0).toFixed(2)}
                  </span>
                </Link>
              </div>
            ))
          ) : (
            <p className="mb-0 text-muted">No products found for this section.</p>
          )}
        </div>
      </SectionShell>
    );
  }

  if (variant === "brand_strip") {
    return (
      <SectionShell section={section} brandColor={brandColor}>
        <div className="d-flex flex-wrap gap-3">
          {loading ? (
            <p className="mb-0 text-muted">Loading brands...</p>
          ) : items.length > 0 ? (
            items.map((item, index) => (
              <div
                key={`${item.brand}-${index}`}
                className="rounded-pill bg-white px-4 py-3 fw-semibold"
                style={{ border: "1px solid #e2e8f0", color: brandColor }}
              >
                {item.brand}
              </div>
            ))
          ) : (
            <p className="mb-0 text-muted">No brands found for this section.</p>
          )}
        </div>
      </SectionShell>
    );
  }

  if (variant === "promo_banner" || variant === "two_column_feature") {
    return (
      <SectionShell section={section} brandColor={brandColor}>
        <div className="row g-4 align-items-center">
          <div className="col-lg-7">
            <div
              className="rounded-4 p-4 p-lg-5 text-white"
              style={{ background: `linear-gradient(135deg, ${brandColor} 0%, #0f172a 100%)` }}
            >
              <p className="mb-2 text-uppercase opacity-75">{section?.template?.label || "Template Section"}</p>
              <h3 className="mb-3">{section?.title || "Section Title"}</h3>
              <p className="mb-0">{section?.subtitle || "Use title, subtitle and actions from the builder to control this block."}</p>
            </div>
          </div>
          <div className="col-lg-5">
            <div className="rounded-4 border bg-white p-4" style={{ borderColor: "#e2e8f0" }}>
              <h4 className="mb-3 text-dark">Builder Data</h4>
              <p className="mb-2 text-muted">Name: {section?.name || "-"}</p>
              <p className="mb-2 text-muted">Layout: {section?.layout || "-"}</p>
              <p className="mb-0 text-muted">Variant: {section?.variant || "-"}</p>
            </div>
          </div>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} brandColor={brandColor}>
      <div className="rounded-4 border bg-white p-4 text-muted" style={{ borderColor: "#e2e8f0" }}>
        This template is not mapped yet. Variant: <strong>{section?.variant || "unknown"}</strong>
      </div>
    </SectionShell>
  );
}
