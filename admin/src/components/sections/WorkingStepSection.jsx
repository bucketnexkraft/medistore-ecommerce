import { normalizeArray, resolveCmsImageUrl } from "./sectionUtils";

export default function WorkingStepSection({ section }) {
  const content = section?.content || {};
  const elements = normalizeArray(section?.elements);
  const bgImage = resolveCmsImageUrl(content?.["work-bg-1"]);

  return (
    <section className="ot-working-step-area ot-working-step-style1" data-section="working_step">
      <div
        className="ot-working-step-wrap ot-bg-style"
        style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
      >
        <div className="container-fluid">
          <div className="row gy-5 align-items-start justify-content-between">
            <div className="col-xl-4 col-lg-12">
              <div className="ot-working-titlebox mt-50">
                <span className="ot-sec-subtitle">{content?.sec_subtitle || ""}</span>
                <h3 className="ot-sec-title ot-text-anime-3">{content?.sec_title || ""}</h3>
                <p className="ot-sec-text ot-text-anime-1">{content?.sec_text || ""}</p>
              </div>
            </div>
            <div className="col-xl-7">
              <div className="ot-working-step-list">
                {elements.map((element, index) => (
                  <div className="ot-working-step-item" key={`work-${index}`}>
                    <div className="ot-working-step-item-top">
                      <span className="ot-working-step-icon">
                        {element?.working_icon ? (
                          <img src={resolveCmsImageUrl(element.working_icon)} alt={element?.working_title || "working step"} />
                        ) : null}
                      </span>
                      <h3 className="ot-box-title">
                        {index + 1}. {element?.working_title || ""}
                      </h3>
                    </div>
                    <p className="ot-working-step-text">{element?.working_text || ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
