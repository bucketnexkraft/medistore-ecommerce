import { normalizeArray, resolveCmsImageUrl } from "./sectionUtils";

export default function FaqSection({ section }) {
  const content = section?.content || {};
  const items = normalizeArray(section?.elements);
  const faqTitle = content?.sec_title || content?.faq_title || "";
  const faqText = content?.sec_text || content?.faq_text || "";
  const faqButtonText = content?.button_text || "Contact Support";
  const faqButtonUrl = content?.button_link || "#";
  const faqImage = resolveCmsImageUrl(content?.faq_image);

  return (
    <section className="ot-faq-area ot-faq-style ot-space" data-section="faq">
      <div className="container">
        <div className="row ot-faq-row gy-5 align-items-start">
          <div className="col-xl-auto ot-faq-left">
            <div className="ot-faq-titlebox text-center">
              <span className="ot-sec-subtitle">{content?.subheading || "FAQ"}</span>
              <h3 className="ot-sec-title ot-text-anime-3">{faqTitle}</h3>
              <p className="ot-faq-text">{faqText}</p>
            </div>

            <div className="ot-faq-contact-card text-center">
              <h4 className="ot-faq-contact-title">{content?.contact_title || "Still Have Questions?"}</h4>
              <p className="ot-faq-contact-text">{content?.contact_subtitle || "Reach out to our team any time"}</p>
              <div className="ot-faq-contact-users">{faqImage ? <img src={faqImage} alt="Support team member" /> : null}</div>
              <a href={faqButtonUrl} className="ot-faq-contact-btn">
                {faqButtonText}
              </a>
            </div>
          </div>

          <div className="col-xl-auto ot-faq-right">
            <div className="accordion ot-faq-accordion" id="otFaqAccordion">
              {items.map((item, index) => (
                <div className="accordion-item" key={`faq-${index}`}>
                  <h3 className="accordion-header" id={`otFaqHeading${index}`}>
                    <button
                      className={`accordion-button ${index === 0 ? "" : "collapsed"}`}
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#otFaqCollapse${index}`}
                      aria-expanded={index === 0 ? "true" : "false"}
                      aria-controls={`otFaqCollapse${index}`}
                    >
                      <span className="ot-faq-question-text">{item?.question || ""}</span>
                    </button>
                  </h3>
                  <div
                    id={`otFaqCollapse${index}`}
                    className={`accordion-collapse collapse${index === 0 ? " show" : ""}`}
                    aria-labelledby={`otFaqHeading${index}`}
                    data-bs-parent="#otFaqAccordion"
                  >
                    <div className="accordion-body">
                      <p className="mb-0">{item?.answer || ""}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
