import { BsCheckCircleFill } from "react-icons/bs";
import { normalizeArray, resolveCmsImageUrl } from "./sectionUtils";

export default function AboutSection({ section }) {
  const content = section?.content || {};
  const elements = normalizeArray(section?.elements);

  const mainImage = resolveCmsImageUrl(content?.image);
  const thumbImage = resolveCmsImageUrl(content?.thumbnail);
  const rating = content?.rating || 0;
  const heading = content?.heading || "";
  const subTitle = content?.sub_title || "";
  const buttonTitle = content?.section_button_title || "";
  const buttonLink = content?.section_button_link || "#";
  const generatedCount = content?.img_generation || "";

  return (
    <section className="ot-about-area ot-space" data-section="about">
      <div className="container">
        <div className="row align-items-center justify-content-center justify-content-lg-start">
          <div className="col-xl-5 col-lg-5 col-md-8">
            <div className="ot-about-thumb-wrapp-1 p-relative me-xxl-4 pe-xxl-5">
              <div className="ot-about-thumb bg-mask w-100">{mainImage ? <img src={mainImage} alt="about" /> : null}</div>
              <div className="ot-about-review-box text-center">
                <h3 className="ot-about-review-title text-white">{rating}/5</h3>
                <p className="ot-sec-text text-white">Customer Satisfaction</p>
              </div>
            </div>
          </div>
          <div className="col-xl-7 col-lg-7">
            <div className="ot-about-content p-relative">
              <h3 className="ot-sec-title-2 ot-text-anime-3 mb-20">{heading}</h3>
              <p className="ot-sec-text mb-20">{subTitle}</p>

              <div className="ot-about-list mb-30">
                <ul>
                  {elements.map((element, index) => (
                    <li key={`about-item-${index}`}>
                      <BsCheckCircleFill />
                      {element?.title || ""}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ot-btn-style-2">
                <a href={buttonLink} className="ot-btn-secondary" target="_blank" rel="noreferrer">
                  <span className="z-index-2">{buttonTitle}</span>
                </a>
                <a href={buttonLink} className="ot-btn-secondary-arrow" target="_blank" rel="noreferrer">
                  <span className="ot-btn-arrow arrow-black">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32">
                      <path
                        fill="currentColor"
                        d="m18.72 6.78l-1.44 1.44L24.063 15H4v2h20.063l-6.782 6.78l1.44 1.44l8.5-8.5l.686-.72l-.687-.72z"
                      />
                      <path
                        fill="currentColor"
                        d="m18.72 6.78l-1.44 1.44L24.063 15H4v2h20.063l-6.782 6.78l1.44 1.44l8.5-8.5l.686-.72l-.687-.72z"
                      />
                    </svg>
                  </span>
                </a>
              </div>

              <div
                className="ot-funfact-client-box p-absolute ot-bg-style d-none d-xxl-block"
                style={thumbImage ? { backgroundImage: `url(${thumbImage})` } : undefined}
              >
                <div className="ot-funfact-client-content text-center z-index-2">
                  <h4 className="ot-funfact-title text-white">
                    <span className="purecounter">{generatedCount}</span>M+
                  </h4>
                  <p className="ot-funfact-text fw-5 text-white">Image Generated</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
