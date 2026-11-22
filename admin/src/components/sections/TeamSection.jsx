import { normalizeArray, resolveCmsImageUrl } from "./sectionUtils";

const CARD_CLASSES = ["soft-lavender", "coral-pink", "sky-blue", "periwinkle-blue"];

function TeamSocialLinks({ element }) {
  const socialItems = [1, 2, 3]
    .map((index) => ({
      icon: element?.[`social_icon_${index}`],
      link: element?.[`social_link_${index}`] || "#",
    }))
    .filter((item) => !!item.icon);

  return (
    <div className="ot-team-socialbox">
      {element?.social_text ? <span className="ot-team-social-text">{element.social_text}</span> : null}
      {socialItems.map((item, index) => (
        <a
          key={`team-social-${index}`}
          href={item.link || "#"}
          className="ot-team-social-icon"
          target={item.link && item.link !== "#" ? "_blank" : undefined}
          rel={item.link && item.link !== "#" ? "noopener noreferrer" : undefined}
        >
          <img src={resolveCmsImageUrl(item.icon)} alt="social icon" />
        </a>
      ))}
    </div>
  );
}

export default function TeamSection({ section }) {
  const content = section?.content || {};
  const elements = normalizeArray(section?.elements);

  return (
    <section className="ot-team-area ot-space" data-section="team">
      <div className="container">
        <div className="ot-title-area ot-team-titlebox text-center mb-45">
          <h3 className="ot-sec-title ot-text-anime-3">{content?.sec_title || ""}</h3>
          <p className="ot-sec-text ot-text-anime-1">{content?.sec_text || ""}</p>
        </div>
        <div className="ot-team-wrapp">
          <div className="row gy-3 justify-content-center">
            {elements.map((element, index) => (
              <div className="col-xl-3 col-lg-4 col-md-6" key={`team-${index}`}>
                <div className="ot-team-card">
                  <div className="ot-team-img ot-img-hover">
                    {element?.image ? <img src={resolveCmsImageUrl(element.image)} alt="team member" /> : null}
                  </div>
                  <div className={`ot-team-content ${CARD_CLASSES[index] || ""}`}>
                    <div className="ot-team-dsc">
                      <h3 className="ot-team-name">
                        <a
                          href={element?.name_link || "#"}
                          className="ot-line-hover"
                          target={element?.name_link && element?.name_link !== "#" ? "_blank" : undefined}
                          rel={element?.name_link && element?.name_link !== "#" ? "noopener noreferrer" : undefined}
                        >
                          {element?.name || ""}
                        </a>
                      </h3>
                      <h3 className="ot-team-designation">{element?.designation || ""}</h3>
                    </div>
                    <TeamSocialLinks element={element} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
