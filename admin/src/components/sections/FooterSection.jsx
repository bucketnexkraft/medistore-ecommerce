import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../../config/constants";

function FooterNavLink({ link }) {
  const path = link?.path || "#";
  const name = link?.name || "";

  if (!path || path === "#") return null;

  return (
    <li>
      <Link to={path}>{name}</Link>
    </li>
  );
}

export default function FooterSection() {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseError, setResponseError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadFooter = async () => {
      try {
        const response = await fetch(`${API_URL}/landing/sections/footer`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Footer failed: ${response.status}`);

        const result = await response.json();
        if (mounted) {
          setData(result?.data || null);
        }
      } catch (error) {
        if (mounted) {
          setData(null);
        }
      }
    };

    loadFooter();

    return () => {
      mounted = false;
    };
  }, []);

  const newsletterTitle = data?.newsletter_title || "Subscribe to our newsletter";
  const newsletterPlaceholder = data?.newsletter_text || "Enter your email";
  const footerGroups = Array.isArray(data?.footer_groups) ? data.footer_groups : [];
  const footerGridClass =
    footerGroups.length === 1 ? "col-lg-12" : footerGroups.length === 2 ? "col-lg-6" : "col-lg-4";
  const brandLogoUrl = data?.brand_logo_url || "/logo/default-logo.png";
  const brandLabel = data?.brand_label || "Home";
  const copyright = data?.copyright || "";

  const submitNewsletter = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResponseText("");
    setResponseError(false);

    try {
      const response = await fetch(`${API_URL}/landing/newsletter/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();

      if (!response.ok || !result?.status) {
        const errors = result?.errors;
        const firstError = Array.isArray(errors)
          ? errors[0]
          : errors && typeof errors === "object"
            ? Object.values(errors)[0]?.[0]
            : null;
        throw new Error(firstError || result?.message || "Subscription failed.");
      }

      setResponseText(result?.message || "Newsletter subscribed successfully.");
      setResponseError(false);
      setEmail("");
    } catch (error) {
      setResponseText(error?.message || "Subscription failed.");
      setResponseError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="ot-footer-area ot-footer-style">
      <style>
        {`
          .ot-footer-area.ot-footer-style {
            position: relative;
            isolation: isolate;
            overflow: hidden;
            background: linear-gradient(180deg, #eef4ff 0%, #6366f1 72%, #3f3cbb 100%);
          }

          .ot-footer-area.ot-footer-style > .container {
            position: relative;
            z-index: 2;
          }

          .ot-footer-area.ot-footer-style .ot-footer-bottom {
            justify-content: center !important;
            text-align: center;
          }

          .ot-footer-area.ot-footer-style .ot-footer-copyright {
            width: 100%;
            color: #ffffff !important;
            opacity: 0.18;
            font-size: clamp(4.5rem, 9vw, 9.5rem);
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: clip;
          }

          .ot-footer-area.ot-footer-style .ot-footer-copyright * {
            color: inherit !important;
          }

          .ot-footer-area.ot-footer-style .ot-footer-bg-color {
            position: absolute !important;
            inset: auto 0 0 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden;
            pointer-events: none;
            z-index: 0 !important;
          }

          .ot-footer-area.ot-footer-style .ot-footer-bg-color svg {
            position: absolute !important;
            left: 50%;
            bottom: 0;
            width: 100%;
            height: auto;
            transform: translateX(-50%);
            pointer-events: none;
          }

          @media (max-width: 1199.98px) {
            .ot-footer-area.ot-footer-style {
              background: linear-gradient(180deg, #eef4ff 0%, #6366f1 42%, #332f8f 100%);
            }

            .ot-footer-area.ot-footer-style .ot-footer-bg-color {
              display: none !important;
            }
          }

          @media (max-width: 767.98px) {
            .ot-footer-area.ot-footer-style {
              background: linear-gradient(180deg, #eef4ff 0%, #6366f1 34%, #2f2a7f 100%);
            }

            .ot-footer-area.ot-footer-style .ot-footer-widget-title,
            .ot-footer-area.ot-footer-style .ot-footer-widget-menu a,
            .ot-footer-area.ot-footer-style .ot-footer-copyright {
              color: #ffffff !important;
            }

            .ot-footer-area.ot-footer-style .ot-footer-copyright {
              opacity: 0.18;
              font-size: clamp(3.25rem, 14vw, 6rem);
            }

            .ot-footer-area.ot-footer-style .ot-footer-widget-menu a {
              opacity: 0.9;
            }
          }
        `}
      </style>
      <div className="container">
        <div className="ot-footer-wrap">
          <div className="row ot-footer-top-row gy-5 justify-content-between">
            <div className="col-xl-4 col-lg-12">
              <div className="ot-footer-newsletter">
                <Link to="/" className="ot-footer-brand" aria-label={brandLabel}>
                  <img src={brandLogoUrl} alt="footer brand logo" />
                </Link>
                <h3 className="ot-footer-newsletter-title ot-text-anime-3">{newsletterTitle}</h3>

                <form className="ot-footer-newsletter-form" onSubmit={submitNewsletter}>
                  <input
                    type="email"
                    name="email"
                    placeholder={newsletterPlaceholder}
                    aria-label="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Subscribe"}
                  </button>
                </form>
                {responseText ? (
                  <p className={`mt-3 mb-0 text-sm ${responseError ? "text-danger" : "text-white"}`}>{responseText}</p>
                ) : null}
              </div>
            </div>

            <div className="col-xl-8 col-lg-12">
              <div className="row ot-footer-links-row gy-4">
                {footerGroups.map((group, index) => (
                  <div className={`${footerGridClass} col-sm-6`} key={`footer-group-${index}`}>
                    <div className="ot-footer-widget">
                      <h4 className="ot-footer-widget-title ot-text-anime-3">{group?.title || ""}</h4>
                      {group?.subtitle ? <p className="mt-2 mb-3 text-sm text-white/70">{group.subtitle}</p> : null}
                      <ul className="ot-footer-widget-menu">
                        {(group?.links || []).map((link, i) => (
                          <FooterNavLink key={`footer-link-${index}-${i}`} link={link} />
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ot-footer-bottom d-flex justify-content-center align-items-center flex-wrap text-center">
            <p className="ot-footer-copyright ot-text-anime-3 mb-0">{copyright}</p>
          </div>
        </div>
      </div>
      <span className="ot-footer-bg-color" aria-hidden="true">
        <svg width="1920" height="1445" viewBox="0 0 1920 1445" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clipPath="url(#clip0_76_1320)">
            <path d="M1920 1445L1920 816.226C1153.2 1106.9 320.501 788.522 7.44842e-05 593L0 1445L1920 1445Z" fill="url(#paint0_linear_76_1320)" />
            <g filter="url(#filter0_f_76_1320)">
              <path d="M1919 1445L1919 722.5C1152.2 1056.5 319.501 690.667 -0.999914 466L-1 1445L1919 1445Z" fill="#6366F1" />
            </g>
          </g>
          <defs>
            <filter id="filter0_f_76_1320" x="-265" y="202" width="2448" height="1507" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="132" result="effect1_foregroundBlur_76_1320" />
            </filter>
            <linearGradient id="paint0_linear_76_1320" x1="960" y1="1445" x2="984.462" y2="896.997" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1" />
              <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
            </linearGradient>
            <clipPath id="clip0_76_1320">
              <rect width="1920" height="1445" fill="white" transform="translate(1920 1445) rotate(-180)" />
            </clipPath>
          </defs>
        </svg>
      </span>
    </footer>
  );
}
