import React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import HeaderStatic from "../components/layout/HeaderStatic";
import HeroSection from "../components/sections/HeroSection";
import FooterSection from "../components/sections/FooterSection";
import FeatureSection from "../components/sections/FeatureSection";
import EcommerceSetupSection from "../components/sections/EcommerceSetupSection";
import WorkingStepSection from "../components/sections/WorkingStepSection";
import TestimonialSection from "../components/sections/TestimonialSection";
import FaqSection from "../components/sections/FaqSection";
import PricingSection from "../components/sections/PricingSection";
import AboutSection from "../components/sections/AboutSection";
import HistorySection from "../components/sections/HistorySection";
import MissionVissionSection from "../components/sections/MissionVissionSection";
import CorePrinciplesSection from "../components/sections/CorePrinciplesSection";
import TeamSection from "../components/sections/TeamSection";
import BlogSection from "../components/sections/BlogSection";
import ContactSection from "../components/sections/ContactSection";
import StorefrontTemplateSection from "../components/sections/StorefrontTemplateSection";
import { API_URL } from "../config/constants";
import useLandingThemeAssets from "../hooks/useLandingThemeAssets";
import FullPageLoader from "../components/common/FullPageLoader";

function SectionFallback({ section }) {
  const name = String(section?.name || "").trim();
  const title = section?.title || `${name.replaceAll("_", " ")} Section`;
  return (
    <section data-section={name}>
      <div className="section-block" data-section={name}>
        <div className="section-header">{title}</div>
      </div>
    </section>
  );
}

function SectionRenderer({ section, brandColor }) {
  const name = String(section?.name || "").trim().toLowerCase();
  const layout = String(section?.layout || "").trim().toLowerCase();
  const variant = String(section?.variant || "").trim().toLowerCase();
  const componentKey = String(section?.template?.component_key || "").trim().toLowerCase();

  if (componentKey === "storefront-header") return null;
  if (componentKey === "storefront-footer") return <FooterSection />;

  if (layout === "template" && variant) {
    return <StorefrontTemplateSection section={section} brandColor={brandColor} />;
  }

  if (layout === "rich_text") {
    return <StorefrontTemplateSection section={section} brandColor={brandColor} />;
  }

  if (name === "feature") return <FeatureSection section={section} />;
  if (name === "ecommerce_setup") return <EcommerceSetupSection section={section} />;
  if (name === "working_step") return <WorkingStepSection section={section} />;
  if (name === "testimonial") return <TestimonialSection section={section} />;
  if (name === "faq") return <FaqSection section={section} />;
  if (name === "pricing") return <PricingSection />;
  if (name === "about") return <AboutSection section={section} />;
  if (name === "history") return <HistorySection section={section} />;
  if (name === "mission_vission") return <MissionVissionSection section={section} />;
  if (name === "core_principles" || name === "core_principal" || name === "core_principle") {
    return <CorePrinciplesSection section={section} />;
  }
  if (name === "team") return <TeamSection section={section} />;
  if (name === "blog") return <BlogSection section={section} isHome />;
  if (name === "contact") return <ContactSection section={section} />;

  return <SectionFallback section={section} />;
}

export default function Home() {
  useLandingThemeAssets();

  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#2f3a4c");
  const [menuItems, setMenuItems] = useState([]);
  const [homeSections, setHomeSections] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const normalizedHomeSections = useMemo(() => {
    const sectionKeys = new Set();
    return homeSections.filter((section) => {
      const key = String(section?.id || section?.name || "").trim().toLowerCase();
      if (!key) return false;
      if (sectionKeys.has(key)) return false;
      sectionKeys.add(key);
      return true;
    });
  }, [homeSections]);

  const headerSection = useMemo(
    () => normalizedHomeSections.find((section) => String(section?.template?.slot || "").toLowerCase() === "header"),
    [normalizedHomeSections],
  );

  const heroSection = useMemo(
    () => normalizedHomeSections.find((section) => String(section?.variant || "").toLowerCase() === "hero"),
    [normalizedHomeSections],
  );

  const footerSection = useMemo(
    () => normalizedHomeSections.find((section) => String(section?.template?.slot || "").toLowerCase() === "footer"),
    [normalizedHomeSections],
  );

  const mainSections = useMemo(
    () =>
      normalizedHomeSections.filter((section) => {
        const slot = String(section?.template?.slot || "").toLowerCase();
        return slot !== "header" && slot !== "footer" && String(section?.variant || "").toLowerCase() !== "hero";
      }),
    [normalizedHomeSections],
  );

  useEffect(() => {
    let mounted = true;

    const loadLandingData = async () => {
      try {
        const [settingsResponse, menuResponse, homeResponse] = await Promise.all([
          fetch(`${API_URL}/landing/settings`, { headers: { Accept: "application/json" } }),
          fetch(`${API_URL}/landing/menu`, { headers: { Accept: "application/json" } }),
          fetch(`${API_URL}/home?react=1`, { headers: { Accept: "application/json" } }),
        ]);

        const settingsResult = settingsResponse.ok ? await settingsResponse.json() : null;
        const menuResult = menuResponse.ok ? await menuResponse.json() : null;
        const homeResult = homeResponse.ok ? await homeResponse.json() : null;

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
        const nextSections = Array.isArray(homeResult?.data?.sections) ? homeResult.data.sections : [];

        if (mounted) {
          setLogoUrl(nextLogo);
          setBrandColor(nextColor);
          setMenuItems(nextMenu);
          setHomeSections(nextSections);
          setPageError("");
          setPageLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setPageError("Landing page failed to load. Please try again.");
          setPageLoading(false);
        }
      }
    };

    loadLandingData();

    return () => {
      mounted = false;
    };
  }, []);

  if (pageLoading) {
    return <FullPageLoader brandColor={brandColor} />;
  }

  if (pageError) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-red-600">{pageError}</p>
        <div className="mt-4 flex gap-3">
          <Link to="/login" className="btn btn-primary">
            Login
          </Link>
          <Link to="/register" className="btn btn-outline">
            Register
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <HeaderStatic
        logoUrl={logoUrl}
        brandColor={brandColor}
        menuItems={Array.isArray(headerSection?.actions) && headerSection.actions.length > 0 ? menuItems : menuItems}
      />
      {heroSection ? <SectionRenderer section={heroSection} brandColor={brandColor} /> : <HeroSection />}
      <main>
        {mainSections.map((section, index) => (
          <SectionRenderer key={`${section?.id || section?.name || "section"}-${index}`} section={section} brandColor={brandColor} />
        ))}
      </main>
      {footerSection ? <SectionRenderer section={footerSection} brandColor={brandColor} /> : <FooterSection />}
    </div>
  );
}
