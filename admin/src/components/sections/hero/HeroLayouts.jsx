import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../../../config/constants";
import { resolveStorefrontActionHref } from "../../../utils/storefrontLinks";

function useLandingHeroContent() {
  const [loading, setLoading] = useState(true);
  const [hero, setHero] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadHero = async () => {
      try {
        const response = await fetch(`${API_URL}/landing/sections/hero`, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Hero failed: ${response.status}`);
        }

        const result = await response.json();

        if (mounted) {
          setHero(result?.data || null);
        }
      } catch {
        if (mounted) {
          setHero(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadHero();

    return () => {
      mounted = false;
    };
  }, []);

  return { hero, loading };
}

function HeroActionButton({ href, children, variant = "primary" }) {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  const className =
    variant === "secondary"
      ? "hero-pill hero-pill-secondary"
      : "hero-pill hero-pill-primary";

  if (isExternal) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
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

function HeroCopy({ hero, loading, titleClassName = "", subtitleClassName = "" }) {
  const heading = hero?.heading || "Inventory & POS Management";
  const subHeading = hero?.sub_heading || "Welcome to stoqio";
  const heroText =
    hero?.hero_text || "Manage stock, sales, purchases, and business operations from one place.";
  const buttonText = hero?.button_text_1 || "Log In";
  const buttonLink = hero?.button_link_1 || "/login";
  const tag1 = hero?.hero_tag1 || "";
  const tag2 = hero?.hero_tag2 || "";

  return (
    <div className="hero-copy-stack">
      <div className="hero-copy-eyebrow">
        <span className="hero-eyebrow-dot" />
        <span>{loading ? "" : subHeading}</span>
      </div>
      <h1 className={titleClassName}>{loading ? "" : heading}</h1>
      <p className={subtitleClassName}>{loading ? "" : heroText}</p>
      <div className="hero-tag-row">
        {loading ? null : tag1 ? <span className="hero-chip">{tag1}</span> : null}
        {loading ? null : tag2 ? <span className="hero-chip hero-chip-soft">{tag2}</span> : null}
      </div>
      <div className="hero-primary-actions">
        <HeroActionButton href={buttonLink}>
          <span>{loading ? "" : buttonText}</span>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M3 9H15M15 9L10.5 4.5M15 9L10.5 13.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </HeroActionButton>
      </div>
    </div>
  );
}

function HeroActionPills({ actions = [] }) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return null;
  }

  return (
    <div className="hero-action-pills">
      {actions.slice(0, 3).map((action) => {
        const href = resolveStorefrontActionHref(action);
        const label = String(action?.label || action?.name || action?.slug || "Explore").trim();

        return (
          <HeroActionButton key={action.id || action.slug || label} href={href} variant="secondary">
            {label}
          </HeroActionButton>
        );
      })}
    </div>
  );
}

function HeroImageFrame({ hero, loading, layoutClassName = "" }) {
  const heroImageUrl = hero?.hero_image_url || "";
  const heroBgImageUrl = hero?.hero_bg_image_url || "";

  return (
    <div className={`hero-image-frame ${layoutClassName}`}>
      <div
        className="hero-image-backdrop"
        style={heroBgImageUrl ? { backgroundImage: `url(${heroBgImageUrl})` } : undefined}
      />
      <div className="hero-image-orbit hero-image-orbit-one" />
      <div className="hero-image-orbit hero-image-orbit-two" />
      <div className="hero-image-panel">
        {!loading && heroImageUrl ? (
          <img src={heroImageUrl} alt={hero?.heading || "Hero visual"} />
        ) : (
          <div className="hero-image-placeholder">
            <div className="hero-image-placeholder-inner">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeroMetric({ label, value, compact = false }) {
  return (
    <div className={`hero-metric-card${compact ? " hero-metric-card-compact" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HeroClassicLayout({ hero, loading, actions = [] }) {
  return (
    <section className="hero-layout hero-layout-classic">
      <div className="hero-layout-bg hero-layout-bg-classic" />
      <div className="container position-relative">
        <div className="row align-items-center g-4 g-xl-5">
          <div className="col-lg-6">
            <HeroCopy
              hero={hero}
              loading={loading}
              titleClassName="hero-title hero-title-classic"
              subtitleClassName="hero-text hero-text-classic"
            />
          </div>
          <div className="col-lg-6">
            <HeroImageFrame hero={hero} loading={loading} />
            <HeroActionPills actions={actions} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMusicStageLayout({ hero, loading, actions = [] }) {
  return (
    <section className="hero-layout hero-layout-music-stage">
      <div className="hero-layout-bg hero-layout-bg-stage" />
      <div className="container position-relative">
        <div className="hero-stage-shell">
          <div className="hero-stage-spotlight" />
          <div className="row align-items-center g-4 g-xl-5">
            <div className="col-lg-6">
              <HeroCopy
                hero={hero}
                loading={loading}
                titleClassName="hero-title hero-title-stage"
                subtitleClassName="hero-text hero-text-stage"
              />
              <div className="hero-stage-notes">
                <HeroMetric label="Premium sound" value="Studio grade" />
                <HeroMetric label="Delivery" value="Fast shipping" compact />
              </div>
            </div>
            <div className="col-lg-6">
              <HeroImageFrame hero={hero} loading={loading} layoutClassName="hero-image-frame-stage" />
              <div className="hero-floating-cards">
                <HeroMetric label="Featured gear" value={hero?.hero_tag1 || "Guitars"} />
                <HeroMetric label="Best fit" value={hero?.hero_tag2 || "Instruments"} compact />
              </div>
              <HeroActionPills actions={actions} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMusicShowcaseLayout({ hero, loading, actions = [] }) {
  return (
    <section className="hero-layout hero-layout-music-showcase">
      <div className="hero-layout-bg hero-layout-bg-showcase" />
      <div className="container position-relative">
        <div className="hero-showcase-shell">
          <div className="row align-items-center g-4 g-xl-5">
            <div className="col-xl-5 col-lg-6 order-2 order-lg-1">
              <HeroCopy
                hero={hero}
                loading={loading}
                titleClassName="hero-title hero-title-showcase"
                subtitleClassName="hero-text hero-text-showcase"
              />
              <div className="hero-showcase-metrics">
                <HeroMetric label="Tone" value="Warm, bright, bold" />
                <HeroMetric label="Collection" value={hero?.heading || "Musical instruments"} compact />
              </div>
            </div>
            <div className="col-xl-7 col-lg-6 order-1 order-lg-2">
              <div className="hero-showcase-visual-wrap">
                <HeroImageFrame hero={hero} loading={loading} layoutClassName="hero-image-frame-showcase" />
                <div className="hero-showcase-ribbon">
                  <span>{hero?.sub_heading || "Musical collection"}</span>
                </div>
              </div>
              <HeroActionPills actions={actions} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSplitLayout({ hero, loading, actions = [] }) {
  return (
    <section className="hero-layout hero-layout-split">
      <div className="hero-layout-bg hero-layout-bg-split" />
      <div className="container position-relative">
        <div className="row align-items-center g-4 g-xl-5">
          <div className="col-lg-7">
            <HeroCopy
              hero={hero}
              loading={loading}
              titleClassName="hero-title hero-title-split"
              subtitleClassName="hero-text hero-text-split"
            />
            <HeroActionPills actions={actions} />
          </div>
          <div className="col-lg-5">
            <div className="hero-split-card">
              <HeroImageFrame hero={hero} loading={loading} layoutClassName="hero-image-frame-split" />
              <div className="hero-split-side">
                <HeroMetric label="New arrivals" value="Limited drop" />
                <HeroMetric label="Top picks" value="String, keys, percussion" compact />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function getHeroLayoutFromComponentKey(componentKey) {
  const normalized = String(componentKey || "").trim().toLowerCase();

  if (normalized === "storefront-hero-music-stage") {
    return "music-stage";
  }

  if (normalized === "storefront-hero-music-showcase") {
    return "music-showcase";
  }

  if (normalized === "storefront-hero-split") {
    return "split";
  }

  return "classic";
}

export function HeroBannerLayouts({
  componentKey,
  hero: heroOverride = null,
  loading: loadingOverride = null,
  actions = [],
}) {
  const { hero: fetchedHero, loading } = useLandingHeroContent();
  const hero = heroOverride || fetchedHero;
  const isLoading = loadingOverride ?? loading;
  const layout = getHeroLayoutFromComponentKey(componentKey);

  const layoutComponent = useMemo(() => {
    switch (layout) {
      case "music-stage":
        return HeroMusicStageLayout;
      case "music-showcase":
        return HeroMusicShowcaseLayout;
      case "split":
        return HeroSplitLayout;
      default:
        return HeroClassicLayout;
    }
  }, [layout]);

  const LayoutComponent = layoutComponent;

  return (
    <>
      <style>{`
        .hero-layout {
          position: relative;
          overflow: hidden;
          padding: 5rem 0;
        }
        .hero-layout-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .hero-layout-bg::before,
        .hero-layout-bg::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          filter: blur(12px);
          opacity: 0.75;
        }
        .hero-layout-bg-classic {
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.92), transparent 34%),
            linear-gradient(135deg, #f8fafc 0%, #eef2ff 48%, #fff7ed 100%);
        }
        .hero-layout-bg-classic::before {
          width: 28rem;
          height: 28rem;
          left: -8rem;
          top: -10rem;
          background: rgba(251, 191, 36, 0.28);
        }
        .hero-layout-bg-classic::after {
          width: 20rem;
          height: 20rem;
          right: -5rem;
          bottom: -7rem;
          background: rgba(59, 130, 246, 0.18);
        }
        .hero-layout-bg-stage {
          background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.18), transparent 32%),
            linear-gradient(135deg, #09090b 0%, #111827 42%, #1f2937 100%);
        }
        .hero-layout-bg-stage::before {
          width: 32rem;
          height: 32rem;
          left: -10rem;
          top: -8rem;
          background: rgba(249, 115, 22, 0.22);
        }
        .hero-layout-bg-stage::after {
          width: 24rem;
          height: 24rem;
          right: -4rem;
          bottom: -8rem;
          background: rgba(59, 130, 246, 0.16);
        }
        .hero-layout-bg-showcase {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 247, 237, 0.92)),
            radial-gradient(circle at top right, rgba(251, 146, 60, 0.24), transparent 28%);
        }
        .hero-layout-bg-showcase::before {
          width: 30rem;
          height: 30rem;
          left: -10rem;
          top: -12rem;
          background: rgba(15, 118, 110, 0.18);
        }
        .hero-layout-bg-showcase::after {
          width: 18rem;
          height: 18rem;
          right: -5rem;
          bottom: -4rem;
          background: rgba(251, 191, 36, 0.24);
        }
        .hero-layout-bg-split {
          background:
            linear-gradient(135deg, #f8fafc 0%, #ffffff 62%, #eef2ff 100%);
        }
        .hero-copy-stack {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
        }
        .hero-copy-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          width: fit-content;
          padding: 0.45rem 0.8rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
          color: #0f172a;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .hero-eyebrow-dot {
          width: 0.55rem;
          height: 0.55rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #f97316, #f59e0b);
          box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.12);
          flex-shrink: 0;
        }
        .hero-title {
          margin: 0;
          color: #0f172a;
          font-weight: 800;
          line-height: 0.96;
          letter-spacing: -0.05em;
        }
        .hero-text {
          margin: 0;
          max-width: 40rem;
          color: #475569;
          font-size: 1.05rem;
          line-height: 1.8;
        }
        .hero-title-classic,
        .hero-title-showcase {
          font-size: clamp(2.9rem, 6vw, 5.8rem);
        }
        .hero-title-stage {
          font-size: clamp(3.2rem, 6.2vw, 6.3rem);
          color: #ffffff;
        }
        .hero-title-split {
          font-size: clamp(3rem, 5.8vw, 5.7rem);
        }
        .hero-text-stage {
          color: rgba(226, 232, 240, 0.82);
          max-width: 34rem;
        }
        .hero-text-split {
          max-width: 34rem;
        }
        .hero-tag-row,
        .hero-primary-actions,
        .hero-action-pills,
        .hero-stage-notes,
        .hero-showcase-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .hero-tag-row {
          gap: 0.6rem;
        }
        .hero-chip,
        .hero-pill,
        .hero-metric-card {
          border-radius: 999px;
        }
        .hero-chip {
          padding: 0.6rem 0.95rem;
          background: rgba(15, 23, 42, 0.06);
          color: #0f172a;
          font-weight: 700;
          font-size: 0.9rem;
        }
        .hero-chip-soft {
          background: rgba(249, 115, 22, 0.12);
          color: #9a3412;
        }
        .hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          width: fit-content;
          padding: 0.92rem 1.15rem;
          text-decoration: none;
          font-weight: 700;
          border: 1px solid transparent;
          transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
        }
        .hero-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
        }
        .hero-pill-primary {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: #ffffff;
          box-shadow: 0 16px 34px rgba(249, 115, 22, 0.28);
        }
        .hero-pill-secondary {
          background: rgba(255, 255, 255, 0.82);
          color: #0f172a;
          border-color: rgba(148, 163, 184, 0.18);
        }
        .hero-image-frame {
          position: relative;
          min-height: 22rem;
          border-radius: 2rem;
          overflow: hidden;
        }
        .hero-image-backdrop {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0.16;
          transform: scale(1.05);
          filter: saturate(1.1);
        }
        .hero-image-orbit {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
        }
        .hero-image-orbit-one {
          width: 12rem;
          height: 12rem;
          left: -4rem;
          top: -3rem;
          background: rgba(249, 115, 22, 0.24);
          filter: blur(8px);
        }
        .hero-image-orbit-two {
          width: 10rem;
          height: 10rem;
          right: -3rem;
          bottom: -2rem;
          background: rgba(59, 130, 246, 0.18);
          filter: blur(8px);
        }
        .hero-image-panel {
          position: relative;
          z-index: 1;
          height: 100%;
          min-height: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.04)),
            rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(12px);
        }
        .hero-image-panel img {
          width: 100%;
          height: auto;
          max-height: 36rem;
          object-fit: contain;
          filter: drop-shadow(0 28px 48px rgba(15, 23, 42, 0.18));
        }
        .hero-image-placeholder {
          width: 100%;
          min-height: 20rem;
          border-radius: 1.5rem;
          background:
            radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), transparent 32%),
            linear-gradient(135deg, rgba(249, 115, 22, 0.32), rgba(15, 23, 42, 0.28));
          display: grid;
          place-items: center;
        }
        .hero-image-placeholder-inner {
          display: flex;
          align-items: end;
          gap: 0.55rem;
          height: 7rem;
        }
        .hero-image-placeholder-inner span {
          width: 0.85rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.8);
        }
        .hero-image-placeholder-inner span:nth-child(1) {
          height: 2.5rem;
        }
        .hero-image-placeholder-inner span:nth-child(2) {
          height: 4.75rem;
        }
        .hero-image-placeholder-inner span:nth-child(3) {
          height: 3.25rem;
        }
        .hero-layout-classic .hero-image-frame,
        .hero-layout-music-showcase .hero-image-frame,
        .hero-layout-split .hero-image-frame {
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.12);
        }
        .hero-layout-music-stage .hero-image-frame {
          background: rgba(2, 6, 23, 0.38);
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.28);
        }
        .hero-image-frame-stage {
          transform: perspective(1200px) rotateY(-6deg) rotateX(2deg);
        }
        .hero-image-frame-showcase {
          min-height: 28rem;
          transform: perspective(1200px) rotateY(-8deg);
          border-radius: 2.5rem;
        }
        .hero-image-frame-split {
          min-height: 24rem;
        }
        .hero-stage-shell,
        .hero-showcase-shell,
        .hero-split-card {
          position: relative;
          z-index: 2;
          border-radius: 2.25rem;
        }
        .hero-stage-shell {
          padding: clamp(1.2rem, 3vw, 2rem);
          background: rgba(2, 6, 23, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 32px 72px rgba(15, 23, 42, 0.24);
          backdrop-filter: blur(18px);
        }
        .hero-stage-spotlight {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 22% 24%, rgba(251, 146, 60, 0.3), transparent 24%),
            radial-gradient(circle at 74% 30%, rgba(59, 130, 246, 0.18), transparent 24%);
          pointer-events: none;
        }
        .hero-stage-notes {
          margin-top: 1.25rem;
        }
        .hero-floating-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
          margin-top: 0.9rem;
        }
        .hero-metric-card {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.9rem 1rem;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }
        .hero-layout-music-stage .hero-metric-card {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.12);
        }
        .hero-layout-music-stage .hero-metric-card span {
          color: rgba(255, 255, 255, 0.62);
        }
        .hero-metric-card span {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
          font-weight: 700;
        }
        .hero-metric-card strong {
          font-size: 1rem;
          line-height: 1.2;
        }
        .hero-metric-card-compact {
          background: rgba(15, 23, 42, 0.04);
        }
        .hero-layout-music-showcase .hero-showcase-shell {
          padding: clamp(1.2rem, 3vw, 2rem);
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 30px 70px rgba(15, 23, 42, 0.09);
          backdrop-filter: blur(12px);
        }
        .hero-showcase-ribbon {
          position: absolute;
          top: 1.2rem;
          right: 1.2rem;
          z-index: 3;
          padding: 0.65rem 1rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.92);
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: 0 16px 28px rgba(15, 23, 42, 0.16);
        }
        .hero-showcase-visual-wrap {
          position: relative;
        }
        .hero-split-card {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 24px 58px rgba(15, 23, 42, 0.09);
        }
        .hero-split-side {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
          margin-top: 0.9rem;
        }
        @media (max-width: 1199.98px) {
          .hero-title-stage {
            font-size: clamp(2.8rem, 6vw, 5.4rem);
          }
        }
        @media (max-width: 991.98px) {
          .hero-layout {
            padding: 4.2rem 0;
          }
          .hero-title,
          .hero-title-stage,
          .hero-title-showcase,
          .hero-title-split {
            line-height: 1.02;
          }
          .hero-image-frame-stage {
            transform: none;
          }
          .hero-image-frame-showcase {
            transform: none;
          }
          .hero-stage-shell,
          .hero-showcase-shell,
          .hero-split-card {
            border-radius: 1.75rem;
          }
        }
        @media (max-width: 767.98px) {
          .hero-layout {
            padding: 3.5rem 0;
          }
          .hero-title-classic,
          .hero-title-showcase,
          .hero-title-split,
          .hero-title-stage {
            font-size: clamp(2.35rem, 12vw, 3.75rem);
          }
          .hero-text {
            font-size: 1rem;
          }
          .hero-image-frame {
            min-height: 17rem;
          }
          .hero-floating-cards,
          .hero-split-side {
            grid-template-columns: 1fr;
          }
          .hero-showcase-ribbon {
            top: 0.9rem;
            right: 0.9rem;
          }
        }
      `}</style>
      <LayoutComponent hero={hero} loading={isLoading} actions={actions} />
    </>
  );
}

