import { useEffect, useRef } from "react";
import { normalizeArray, resolveCmsImageUrl } from "./sectionUtils";
import { BsStarFill } from "react-icons/bs";

function StarRow({ count }) {
  const rating = Math.max(1, Math.min(5, Number(count) || 0));
  return (
    <div className="ot-testimonial-review">
      {Array.from({ length: rating }).map((_, index) => (
        <BsStarFill key={`star-${index}`} />
      ))}
    </div>
  );
}

export default function TestimonialSection({ section }) {
  const content = section?.content || {};
  const elements = normalizeArray(section?.elements);
  const sliderRef = useRef(null);
  const prevRef = useRef(null);
  const nextRef = useRef(null);

  useEffect(() => {
    let swiperInstance = null;
    let retryTimer = null;
    let isMounted = true;

    const initSlider = () => {
      if (!isMounted || !sliderRef.current) return;

      if (!window.Swiper) {
        retryTimer = window.setTimeout(initSlider, 100);
        return;
      }

      if (swiperInstance) {
        swiperInstance.destroy(true, true);
      }

      swiperInstance = new window.Swiper(sliderRef.current, {
        slidesPerView: 1,
        loop: elements.length > 1,
        speed: 900,
        effect: "slide",
        spaceBetween: 24,
        grabCursor: true,
        autoplay: elements.length > 1
          ? {
              delay: 4500,
              disableOnInteraction: false,
            }
          : false,
        navigation: {
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        },
      });
    };

    initSlider();

    return () => {
      isMounted = false;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      if (swiperInstance) {
        swiperInstance.destroy(true, true);
      }
    };
  }, [elements.length]);

  return (
    <section className="ot-testimonial-area" data-section="testimonial">
      <div className="container">
        <div className="ot-testimonial-titlebox text-center">
          <span className="ot-sec-subtitle blue left">{content?.sec_subtitle || ""}</span>
          <h3 className="ot-sec-title ot-text-anime-3">{content?.sec_title || ""}</h3>
        </div>

        <div className="ot-testimonial-layout">
          <div className="ot-testimonial-imgbox">
            {content?.testimonial_image ? (
              <img src={resolveCmsImageUrl(content.testimonial_image)} alt="Testimonial" />
            ) : null}

            <div className="ot-testimonial-funfact">
              <h4 className="ot-testimonial-funfact-title">
                <span className="purecounter">{content?.counter_number || "0"}</span>%
              </h4>
              <p className="ot-testimonial-funfact-text">{content?.counter_text || ""}</p>
            </div>
          </div>

          <div className="ot-testimonial-content">
            <div className="swiper ot-testimonial-main-active" ref={sliderRef}>
              <div className="swiper-wrapper">
                {(elements.length ? elements : [{}]).map((item, index) => (
                  <div className="swiper-slide" data-testimonial-person={index} key={`testimonial-${index}`}>
                    <article className="ot-testimonial-card">
                      <StarRow count={item?.client_rating} />
                      <h4 className="ot-testimonial-heading">{item?.title || "No Testimonial Yet"}</h4>
                      <p className="ot-testimonial-text">{item?.client_text ? `"${item.client_text}"` : "Please add testimonial items from section builder."}</p>
                      {item?.client_name ? <h5 className="ot-testimonial-name">{item.client_name}</h5> : null}
                      {item?.designation ? <span className="ot-testimonial-designation">{item.designation}</span> : null}
                    </article>
                  </div>
                ))}
              </div>
            </div>

            <div className="ot-testimonial-nav">
              <button ref={prevRef} className="ot-testimonial-arrow ot-testimonial-prev" type="button" aria-label="Previous testimonial" />
              <button ref={nextRef} className="ot-testimonial-arrow ot-testimonial-next" type="button" aria-label="Next testimonial" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
