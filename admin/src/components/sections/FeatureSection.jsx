import { normalizeArray, resolveCmsImageUrl } from "./sectionUtils";

const CARD_CLASSES = ["tracking", "alerts", "products", "sync", "reports", "locations"];

export default function FeatureSection({ section }) {
  const content = section?.content || {};
  const elements = normalizeArray(section?.elements);

  return (
    <section className="ot-feature-area ot-feature-style1 ot-space" data-section="feature">
      <style>
        {`
          @media (max-width: 767.98px) {
            .ot-feature-area[data-section="feature"] .ot-feature-card {
              position: relative;
              overflow: hidden;
            }

            .ot-feature-area[data-section="feature"] .ot-feature-card::before {
              content: "";
              position: absolute;
              inset: 0;
              z-index: 1;
              background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.1));
              pointer-events: none;
            }

            .ot-feature-area[data-section="feature"] .feature-card-img {
              position: absolute;
              z-index: 0;
              pointer-events: none;
            }

            .ot-feature-area[data-section="feature"] .feature-copy {
              position: relative;
              z-index: 2;
              width: calc(100% - 28px);
              max-width: 360px;
              margin: 0 auto;
              padding: 18px 16px;
              border-radius: 8px;
              background: rgba(255, 255, 255, 0.78);
              border: 1px solid rgba(255, 255, 255, 0.62);
              box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
              backdrop-filter: blur(8px);
              -webkit-backdrop-filter: blur(8px);
            }

            .ot-feature-area[data-section="feature"] .feature-card-title,
            .ot-feature-area[data-section="feature"] .feature-card-text {
              color: #111827 !important;
              text-shadow: none;
            }

            .ot-feature-area[data-section="feature"] .feature-card-title {
              font-size: 1.45rem;
              line-height: 1.15;
            }

            .ot-feature-area[data-section="feature"] .feature-card-text {
              font-size: 0.98rem;
              line-height: 1.45;
            }
          }
        `}
      </style>
      <div className="container">
        <div className="ot-feature-titlebox">
          <div className="row justify-content-center text-center">
            <div className="col-xxl-8 col-xl-9 col-lg-10">
              <span className="ot-sec-subtitle">{content?.sec_subtitle || ""}</span>
              <h2 className="ot-sec-title ot-text-anime-3 text-white">{content?.sec_title || ""}</h2>
            </div>
          </div>
        </div>

        <div className="ot-feature-wrapper">
          <div className="ot-feature-grid">
            {elements.map((element, index) => (
              <article className={`ot-feature-card ${CARD_CLASSES[index] || ""}`} key={`feature-${index}`}>
                <div className="feature-copy">
                  <h3 className="feature-card-title">{element?.feature_title || ""}</h3>
                  <p className="feature-card-text">{element?.feature_text || ""}</p>
                </div>
                {element?.feature_image ? (
                  <img className="feature-card-img" src={resolveCmsImageUrl(element.feature_image)} alt={element?.feature_title || "feature"} />
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
