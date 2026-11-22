import { normalizeArray } from "./sectionUtils";
import { useState } from "react";
import { PiCalendarBlank, PiClock, PiEnvelopeSimple, PiPaperPlaneTilt, PiPhone } from "react-icons/pi";
import { API_URL } from "../../config/constants";

export default function ContactSection({ section }) {
  const content = section?.content || {};
  const elements = normalizeArray(section?.elements);
  const [submitting, setSubmitting] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseError, setResponseError] = useState(false);

  const sideTitle = content?.side_section_title || "Talk to Sales";
  const sideText =
    content?.side_section_text ||
    "Need a custom plan for your large-scale influencer campaigns? Our sales team can help you build the perfect solution.";
  const demoBtnText = content?.side_section_button_title || "BOOK A DEMO";
  const demoBtnUrl = content?.side_section_button_url || "#";
  const chipText = content?.side_section_last_text || "Enterprise Solutions";

  const getItemByType = (type, fallbackIndex) =>
    elements.find((item) => String(item?.type || "").toLowerCase() === type) || elements[fallbackIndex] || {};

  const emailItem = getItemByType("email", 0);
  const phoneItem = getItemByType("phone", 1);
  const hoursItem = getItemByType("hours", 2);

  const emailLabel = emailItem?.label || "Email Support";
  const phoneLabel = phoneItem?.label || "Phone Support";
  const hoursLabel = hoursItem?.label || "Working Hours";

  const emailValue = emailItem?.value || "sales@inflio.com";
  const phoneValue = phoneItem?.value || "+1 (555) 123-4567";
  const hoursValue = hoursItem?.value || "Mon-Fri, 9AM-6PM";

  const submit = async (e) => {
    e.preventDefault();
    const formElement = e.currentTarget;
    const payload = Object.fromEntries(new FormData(formElement));

    setSubmitting(true);
    setResponseText("");
    setResponseError(false);

    try {
      const response = await fetch(`${API_URL}/landing/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result?.status) {
        const errors = result?.errors;
        const firstError = Array.isArray(errors)
          ? errors[0]
          : errors && typeof errors === "object"
            ? Object.values(errors)[0]?.[0]
            : null;
        throw new Error(firstError || result?.message || "Failed to send message.");
      }

      setResponseText(result?.message || "Your message has been sent successfully.");
      setResponseError(false);
      formElement.reset();
    } catch (error) {
      setResponseText(error?.message || "Failed to send message.");
      setResponseError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ot-contact-area ot-contact-style ot-space-bottom" data-section="contact">
      <style>{`
        .ot-contact-form input,
        .ot-contact-form textarea {
          position: relative;
          z-index: 2;
          pointer-events: auto;
          user-select: text;
          color: #111827 !important;
          caret-color: #111827;
        }
        .ot-contact-form input:focus,
        .ot-contact-form textarea:focus {
          border-color: #ffffff !important;
          background: rgba(255, 255, 255, 0.18) !important;
        }
        .ot-contact-info-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }
        .ot-contact-info-icon svg {
          width: 24px;
          height: 24px;
        }
      `}</style>
      <div className="container">
        <div className="row gy-4 align-items-stretch">
          <div className="col-xl-6">
            <div className="ot-contact-panel ot-contact-form-panel">
              <div className="ot-contact-titlebox">
                <h2 className="ot-sec-title ot-contact-title ot-text-anime-3">{content?.card_heading || "GET IN TOUCH"}</h2>
                <p className="ot-sec-text ot-contact-text ot-text-anime-1 mb-0">
                  {content?.form_description || "Fill out the form below and our team will get back to you within 24 hours."}
                </p>
              </div>

              <form className="ot-contact-form" onSubmit={submit}>
                <div className="row gy-10">
                  <div className="col-12">
                    <div className="ot-contact-field">
                      <label htmlFor="contact-name">Full Name</label>
                      <input
                        id="contact-name"
                        type="text"
                        name="name"
                        placeholder="Jane Doe"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="ot-contact-field">
                      <label htmlFor="contact-email">Email Address</label>
                      <input
                        id="contact-email"
                        type="email"
                        name="email"
                        placeholder="jane@example.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="ot-contact-field">
                      <label htmlFor="contact-subject">Subject</label>
                      <input
                        id="contact-subject"
                        type="text"
                        name="subject"
                        placeholder="Enter subject"
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="ot-contact-field">
                      <label htmlFor="contact-message">Message</label>
                      <textarea
                        id="contact-message"
                        name="message"
                        placeholder="How can we help you?"
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>

                  <div className="col-12">
                    <button className="ot-contact-submit d-flex align-items-center justify-content-center gap-2" type="submit" disabled={submitting}>
                      <span>{submitting ? "SENDING..." : "SEND MESSAGE"}</span>
                      <PiPaperPlaneTilt />
                    </button>
                  </div>
                </div>
                <p className={`ajax-response mb-0 ${responseError ? "text-danger" : "text-success"}`}>{responseText}</p>
              </form>
            </div>
          </div>

          <div className="col-xl-6">
            <div className="ot-contact-panel ot-contact-info-panel">
              <div className="ot-contact-chip">{chipText}</div>
              <h3 className="ot-contact-info-title ot-text-anime-3">{sideTitle}</h3>
              <p className="ot-sec-text ot-contact-info-text mb-0">{sideText}</p>

              <div className="ot-contact-info-list">
                <div className="ot-contact-info-item">
                  <div className="ot-contact-info-copy">
                    <span className="ot-contact-info-label">{emailLabel}</span>
                    <a href={`mailto:${emailValue}`} className="ot-contact-info-value">
                      {emailValue}
                    </a>
                  </div>
                  <div className="ot-contact-info-icon">
                    <PiEnvelopeSimple aria-hidden="true" />
                  </div>
                </div>

                <div className="ot-contact-info-item">
                  <div className="ot-contact-info-copy">
                    <span className="ot-contact-info-label">{phoneLabel}</span>
                    <a href={`tel:${String(phoneValue).replace(/[^\d+]/g, "")}`} className="ot-contact-info-value">
                      {phoneValue}
                    </a>
                  </div>
                  <div className="ot-contact-info-icon">
                    <PiPhone aria-hidden="true" />
                  </div>
                </div>

                <div className="ot-contact-info-item">
                  <div className="ot-contact-info-copy">
                    <span className="ot-contact-info-label">{hoursLabel}</span>
                    <span className="ot-contact-info-value">{hoursValue}</span>
                  </div>
                  <div className="ot-contact-info-icon">
                    <PiClock aria-hidden="true" />
                  </div>
                </div>
              </div>

              <a href={demoBtnUrl} className="ot-contact-submit ot-contact-demo-btn d-flex align-items-center justify-content-center gap-2">
                <span>{demoBtnText}</span>
                <PiCalendarBlank />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
