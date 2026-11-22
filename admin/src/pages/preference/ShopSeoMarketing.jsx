import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import {
  PiArrowLeft,
  PiCopy,
  PiFacebookLogo,
  PiGoogleLogo,
  PiHash,
  PiTiktokLogo,
} from "react-icons/pi";
import { getPreference } from "../../api/preference";
import { updateCompanyPreference } from "../../api/companyPreferances";

function IntegrationCard({ icon, title, description, children }) {
  const Icon = icon;

  return (
    <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <Icon size={22} />
        </span>
        <div>
          <h2 className="text-[1.9rem] font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-xl leading-8 text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-3 block text-xl font-medium text-slate-900">{label}</span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-16 w-full rounded-2xl border border-slate-200 bg-white px-5 text-xl text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function CopyField({ value, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-5 py-4">
      <span className="min-w-0 truncate text-lg text-violet-700">{value}</span>
      <button
        type="button"
        onClick={onCopy}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
      >
        <PiCopy size={22} />
      </button>
    </div>
  );
}

export default function ShopSeoMarketing() {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);
  const [siteBaseUrl, setSiteBaseUrl] = useState("https://your-store.com");
  const [gtmId, setGtmId] = useState("");
  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [facebookPixelAccessToken, setFacebookPixelAccessToken] = useState("");
  const [facebookTestEventId, setFacebookTestEventId] = useState("");
  const [tiktokPixelId, setTiktokPixelId] = useState("");
  const [tiktokPixelAccessToken, setTiktokPixelAccessToken] = useState("");
  const [tiktokTestEventCode, setTiktokTestEventCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!accessToken || !companyId) return;

      try {
        const response = await getPreference(companyId, accessToken);
        const preferences = Array.isArray(response?.data) ? response.data : [];

        const readValue = (key) => {
          const item = preferences.find((entry) => entry?.key === key);
          return typeof item?.value === "string" ? item.value : item?.value || "";
        };

        const domain = String(readValue("domain") || "").trim();
        const fallbackOrigin = typeof window !== "undefined" ? window.location.origin : "https://your-store.com";
        const normalizedBaseUrl = domain
          ? `https://${domain.replace(/^https?:\/\//, "")}`
          : fallbackOrigin;

        setSiteBaseUrl(normalizedBaseUrl);
        setGtmId(String(readValue("gtm_id") || ""));
        setFacebookPixelId(String(readValue("facebook_pixel_id") || ""));
        setFacebookPixelAccessToken(String(readValue("facebook_pixel_access_token") || ""));
        setFacebookTestEventId(String(readValue("facebook_test_event_id") || ""));
        setTiktokPixelId(String(readValue("tiktok_pixel_id") || ""));
        setTiktokPixelAccessToken(String(readValue("tiktok_pixel_access_token") || ""));
        setTiktokTestEventCode(String(readValue("tiktok_test_event_code") || ""));
      } catch (error) {
        console.error("Failed to load SEO and marketing preferences", error);
      }
    };

    loadPreferences();
  }, [accessToken, companyId]);

  const sitemapUrl = useMemo(() => `${siteBaseUrl.replace(/\/$/, "")}/api/sitemaps.xml`, [siteBaseUrl]);
  const facebookFeedUrl = useMemo(() => `${siteBaseUrl.replace(/\/$/, "")}/api/facebook-product-feed.xml`, [siteBaseUrl]);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const saveSeoMarketing = async () => {
    try {
      setIsSaving(true);

      const formData = new FormData();
      formData.append("gtm_id", gtmId);
      formData.append("facebook_pixel_id", facebookPixelId);
      formData.append("facebook_pixel_access_token", facebookPixelAccessToken);
      formData.append("facebook_test_event_id", facebookTestEventId);
      formData.append("tiktok_pixel_id", tiktokPixelId);
      formData.append("tiktok_pixel_access_token", tiktokPixelAccessToken);
      formData.append("tiktok_test_event_code", tiktokTestEventCode);

      await updateCompanyPreference(accessToken, formData);

      Swal.fire({
        icon: "success",
        title: "Success",
        text: "SEO and marketing integrations updated successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update SEO and marketing integrations");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/company-preference/shop-setup")}
            className="grid h-16 w-16 place-items-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:border-primary/30 hover:text-primary"
          >
            <PiArrowLeft size={30} />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            SEO & Marketing Integrations
          </h1>
        </div>

        <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <IntegrationCard
            icon={PiGoogleLogo}
            title="Sitemaps for Search Engine"
            description="Add sitemaps to 'Google Search Console' to rank your website."
          >
            <CopyField value={sitemapUrl} onCopy={() => handleCopy(sitemapUrl)} />
          </IntegrationCard>

          <IntegrationCard
            icon={PiFacebookLogo}
            title="Facebook Data Feed"
            description="Add/Upload data feed to the Facebook catalog."
          >
            <CopyField value={facebookFeedUrl} onCopy={() => handleCopy(facebookFeedUrl)} />
          </IntegrationCard>

          <IntegrationCard icon={PiHash} title="Setup Google Tag Manager">
            <TextInput
              label="GTM ID"
              value={gtmId}
              onChange={(e) => setGtmId(e.target.value)}
              placeholder="GTM ID"
            />
          </IntegrationCard>

          <IntegrationCard icon={PiFacebookLogo} title="Setup Facebook Conversion API and Pixel">
            <div className="space-y-4">
              <TextInput
                label="Pixel ID"
                value={facebookPixelId}
                onChange={(e) => setFacebookPixelId(e.target.value)}
                placeholder="Pixel ID"
              />
              <TextInput
                label="Pixel Access Token"
                value={facebookPixelAccessToken}
                onChange={(e) => setFacebookPixelAccessToken(e.target.value)}
                placeholder="Pixel Access Token"
              />
              <TextInput
                label="Pixel Test Event Id (Just to test. Clear after testing is done)"
                value={facebookTestEventId}
                onChange={(e) => setFacebookTestEventId(e.target.value)}
                placeholder="Pixel Test Event Id"
              />
            </div>
          </IntegrationCard>

          <IntegrationCard
            icon={PiTiktokLogo}
            title="Setup TikTok Pixel and Events API"
            description="Track customer actions and optimize your TikTok advertising campaigns with pixel integration and server-side events."
          >
            <div className="space-y-4">
              <TextInput
                label="TikTok Pixel ID"
                value={tiktokPixelId}
                onChange={(e) => setTiktokPixelId(e.target.value)}
                placeholder="TikTok Pixel ID"
              />
              <TextInput
                label="TikTok Pixel Access Token"
                value={tiktokPixelAccessToken}
                onChange={(e) => setTiktokPixelAccessToken(e.target.value)}
                placeholder="TikTok Pixel Access Token"
              />
              <TextInput
                label="TikTok Pixel Test Event Code (Optional - for testing. Clear after testing is done)"
                value={tiktokTestEventCode}
                onChange={(e) => setTiktokTestEventCode(e.target.value)}
                placeholder="TikTok Pixel Test Event Code"
              />
            </div>
          </IntegrationCard>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={saveSeoMarketing}
              className="inline-flex min-h-14 items-center justify-center rounded-2xl border-0 bg-[#6a11d8] px-12 py-4 text-2xl font-semibold text-white shadow-sm transition hover:bg-[#5b0fc0]"
              disabled={isSaving}
            >
              {isSaving ? "Updating..." : "Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
