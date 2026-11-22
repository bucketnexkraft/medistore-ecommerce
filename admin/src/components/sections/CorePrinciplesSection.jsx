import { normalizeArray, resolveCmsImageUrl } from "./sectionUtils";

const CARD_CLASSES = ["soft-lavender", "coral-pink", "sky-blue", "periwinkle-blue"];

export default function CorePrinciplesSection({ section }) {
  const content = section?.content || {};
  const elementsFromSection = normalizeArray(section?.elements);
  const elementsFromContent = normalizeArray(content)
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        ("principles_title" in item ||
          "principles_text" in item ||
          "principles_image" in item ||
          "principal_title" in item ||
          "principal_text" in item ||
          "principal_image" in item)
    );
  const elements = elementsFromSection.length ? elementsFromSection : elementsFromContent;

  return (
    <section className="ot-core-principles-area ot-space-bottom" data-section="core_principles">
      <div className="container">
        {(content?.sec_title || content?.sec_text) ? (
          <div className="ot-principles-title-area text-center mb-45">
            <h3 className="ot-sec-title ot-text-anime-3">{content?.sec_title || ""}</h3>
            <p className="ot-sec-text ot-text-anime-1">{content?.sec_text || ""}</p>
          </div>
        ) : null}
        <div className="row gy-4">
          {elements.map((element, index) => (
            <div className="col-xl-3 col-lg-6 col-md-6" key={`core-principle-${index}`}>
              <div className={`ot-principles-card ${CARD_CLASSES[index] || ""}`}>
                <div className="core-principles-titlebox d-flex gap-2 justify-content-between">
                  <h3 className="core-principles-title ot-text-anime-3">{element?.principles_title || element?.principal_title || ""}</h3>
                  <div className="core-principles-icon">
                    {element?.principles_image || element?.principal_image ? (
                      <img src={resolveCmsImageUrl(element?.principles_image || element?.principal_image)} alt="core principle" />
                    ) : null}
                  </div>
                </div>
                <div className="core-principles-content">
                  <p className="core-principles-text">{element?.principles_text || element?.principal_text || ""}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
