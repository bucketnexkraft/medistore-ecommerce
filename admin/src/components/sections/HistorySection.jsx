import { useEffect, useRef, useState } from "react";
import { normalizeArray } from "./sectionUtils";

function AnimatedCounter({ value, suffix = "" }) {
  const ref = useRef(null);
  const [displayValue, setDisplayValue] = useState("0");
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || hasAnimatedRef.current) return undefined;

    const rawValue = String(value ?? "").trim();
    const parsedValue = Number(rawValue.replace(/,/g, ""));

    if (!rawValue || Number.isNaN(parsedValue)) {
      setDisplayValue(rawValue);
      return undefined;
    }

    const duration = 1200;
    const decimalPlaces = rawValue.includes(".") ? rawValue.split(".")[1].length : 0;
    let animationFrame = 0;

    const animate = (startTime) => {
      const step = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = parsedValue * eased;
        const nextValue = decimalPlaces > 0 ? currentValue.toFixed(decimalPlaces) : Math.floor(currentValue).toString();

        setDisplayValue(nextValue);

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(step);
          return;
        }

        setDisplayValue(decimalPlaces > 0 ? parsedValue.toFixed(decimalPlaces) : String(parsedValue));
      };

      animationFrame = window.requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        hasAnimatedRef.current = true;
        animate(performance.now());
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [value]);

  return (
    <span ref={ref}>
      {displayValue}
      {suffix}
    </span>
  );
}

function buildFunfacts(content) {
  return [
    {
      number: content?.funfact_one_number || "50",
      suffix: content?.funfact_one_suffix || "k+",
      text: content?.funfact_one_text || "Teams Empowered",
    },
    {
      number: content?.funfact_two_number || "10",
      suffix: content?.funfact_two_suffix || "m+",
      text: content?.funfact_two_text || "Documents Managed",
    },
    {
      number: content?.funfact_three_number || "99",
      suffix: content?.funfact_three_suffix || ".9%",
      text: content?.funfact_three_text || "Platform Uptime",
    },
    {
      number: content?.funfact_four_number || "5",
      suffix: content?.funfact_four_suffix || "+",
      text: content?.funfact_four_text || "Customer retention",
    },
  ];
}

export default function HistorySection({ section }) {
  const content = section?.content || {};
  const elements = normalizeArray(section?.elements);
  const funfacts = buildFunfacts(content);

  return (
    <section className="ot-history-area ot-space-bottom" data-section="history">
      <div className="ot-history-wrap">
        <div className="container">
          {(content?.sec_title || content?.sec_text) ? (
            <div className="ot-title-area text-center mb-45">
              <h3 className="ot-sec-title ot-text-anime-3">{content?.sec_title || ""}</h3>
              <p className="ot-sec-text ot-text-anime-1">{content?.sec_text || ""}</p>
            </div>
          ) : null}
          <div className="row ot-history-row">
            <div className="col-xl-6">
              {elements.map((element, index) => (
                <div className="ot-history-card" key={`history-item-${index}`}>
                  <h3 className="ot-history-title ot-text-anime-3 mb-30">{element?.history_title || ""}</h3>
                  <p className="ot-history-text">{element?.history_text || ""}</p>
                </div>
              ))}
            </div>

            <div className="col-xl-6">
              <div className="ot-history-funfact ot-funfact-wrapp">
                <div className="ot-funfact-box-2 p-relative text-center">
                  <div className="funfact-shape">
                    <svg width="760" height="695" viewBox="0 0 760 695" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M380 310C380 327.673 394.327 342 412 342H728C745.673 342 760 356.327 760 374V663C760 680.673 745.673 695 728 695H412C394.327 695 380 680.673 380 663V386C380 368.327 365.673 354 348 354H32C14.3269 354 0 339.673 0 322V32C0 14.3269 14.3269 0 32 0H348C365.673 0 380 14.3269 380 32V310Z"
                        fill="#FF9696"
                      />
                    </svg>
                  </div>

                  <div className="funfact-wrapp">
                    {funfacts.map((funfact, index) => (
                      <div className="funfact-card" key={`funfact-${index}`}>
                        <h4 className="funfact-number">
                          <AnimatedCounter value={funfact.number} suffix={funfact.suffix} />
                        </h4>
                        <p className="funfact-text">{funfact.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
