import { resolveCmsImageUrl } from "./sectionUtils";

export default function MissionVissionSection({ section }) {
  const content = section?.content || {};
  const missionImage = resolveCmsImageUrl(content?.missionImage);

  return (
    <section className="ot-missionVission-area ot-space-bottom" data-section="mission_vission">
      <div className="container">
        {(content?.sec_title || content?.sec_text) ? (
          <div className="ot-title-area text-center mb-45">
            <h3 className="ot-sec-title ot-text-anime-3">{content?.sec_title || ""}</h3>
            <p className="ot-sec-text ot-text-anime-1">{content?.sec_text || ""}</p>
          </div>
        ) : null}
        <div className="ot-mission-wrapp">
          <div className="row g-5">
            <div className="col-xl-4 order-1 order-lg-0">
              <div className="ot-mission-card">
                <h3 className="ot-mission-title ot-text-anime-3">{content?.mission_title || ""}</h3>
                <p className="ot-mission-text">{content?.mission_text || ""}</p>
              </div>
            </div>
            <div className="col-xl-4 order-0 order-lg-1">
              <div className="ot-mission-img ot-img-hover">{missionImage ? <img src={missionImage} alt="Mission" /> : null}</div>
            </div>
            <div className="col-xl-4 order-2 order-lg-2 d-flex align-items-end">
              <div className="ot-mission-card">
                <h3 className="ot-mission-title ot-text-anime-3">{content?.vission_title || ""}</h3>
                <p className="ot-mission-text">{content?.vission_text || ""}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
