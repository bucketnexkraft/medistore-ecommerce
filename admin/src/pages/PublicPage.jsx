import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { API_URL } from "../config/constants";
import HeaderStatic from "../components/layout/HeaderStatic";
import FooterSection from "../components/sections/FooterSection";
import BreadcrumbSection from "../components/sections/BreadcrumbSection";
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
import useLandingThemeAssets from "../hooks/useLandingThemeAssets";
import FullPageLoader from "../components/common/FullPageLoader";
import NotFound from "../components/common/NotFound";

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

function SectionRenderer({ section }) {
  const name = String(section?.name || "").trim().toLowerCase();

  if (name === "hero" || name === "footer") return null;
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
  if (name === "blog") return <BlogSection section={section} />;
  if (name === "contact") return <ContactSection section={section} />;

  return <SectionFallback section={section} />;
}

export default function PublicPage() {
  useLandingThemeAssets();

  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [pageContentHtml, setPageContentHtml] = useState("");
  const [pageMeta, setPageMeta] = useState(null);
  const [sections, setSections] = useState([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#2f3a4c");
  const [menuItems, setMenuItems] = useState([]);
  const sanitizedPageContent = useMemo(() => DOMPurify.sanitize(pageContentHtml || ""), [pageContentHtml]);
  const hasSectionContent = sections.length > 0;
  const pageBody = hasSectionContent ? (
    <main>
      {sections.map((section, index) => (
        <SectionRenderer key={`${section?.name || "section"}-${index}`} section={section} />
      ))}
    </main>
  ) : sanitizedPageContent ? (
    <div dangerouslySetInnerHTML={{ __html: sanitizedPageContent }} />
  ) : (
    <div className="container py-5">
      <p className="mb-0">No page content is available yet.</p>
    </div>
  );

  const apiUrl = useMemo(() => {
    const safeSlug = encodeURIComponent((slug || "").trim().toLowerCase());
    return `${API_URL}/pages/${safeSlug}?react=1`;
  }, [slug]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [settingsResponse, menuResponse, pageResponse] = await Promise.all([
          fetch(`${API_URL}/landing/settings`, { headers: { Accept: "application/json" } }),
          fetch(`${API_URL}/landing/menu`, { headers: { Accept: "application/json" } }),
          fetch(apiUrl, { headers: { Accept: "application/json" } }),
        ]);

        if (!pageResponse.ok) {
          if (pageResponse.status === 404) {
            throw new Error("NOT_FOUND");
          }
          throw new Error(`Page failed with status ${pageResponse.status}`);
        }

        const settingsResult = settingsResponse.ok ? await settingsResponse.json() : null;
        const menuResult = menuResponse.ok ? await menuResponse.json() : null;
        const pageResult = await pageResponse.json();

        const settingsData = settingsResult?.data || {};
        const pageData = pageResult?.data || {};

        if (mounted) {
          setLogoUrl(settingsData?.dark_logo_url || settingsData?.white_logo_url || "");
          setBrandColor(settingsData?.base_color || "#2f3a4c");
          setMenuItems(
            Array.isArray(menuResult?.data)
              ? menuResult.data.filter((item) => {
                  const title = String(item?.title || "").trim().toLowerCase();
                  const path = String(item?.path || "").trim().toLowerCase();
                  return !(title === "home" || path === "/" || path === "/home");
                })
              : []
          );
          setPageMeta(pageData?.page || null);
          setPageContentHtml(pageData?.content_html || "");
          setSections(Array.isArray(pageData?.sections) ? pageData.sections : []);
          setNotFound(false);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof Error && err.message === "NOT_FOUND") {
            setNotFound(true);
            setError("");
            setLoading(false);
            return;
          }

          setNotFound(false);
          setError("Page failed to load. Please try again.");
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [apiUrl]);

  if (loading) {
    return <FullPageLoader brandColor={brandColor} />;
  }

  if (notFound) {
    return <NotFound />;
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-red-600">{error}</p>
        <div className="mt-4 flex gap-3">
          <Link to="/" className="btn btn-outline">
            Home
          </Link>
          <Link to="/login" className="btn btn-primary">
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <HeaderStatic logoUrl={logoUrl} brandColor={brandColor} menuItems={menuItems} />
      <BreadcrumbSection page={pageMeta} />
      {pageBody}
      <FooterSection />
    </div>
  );
}
