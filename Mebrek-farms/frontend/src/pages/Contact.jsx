import { Link as RouterLink } from "react-router-dom";
import { useRef, useState } from "react";
import axios from "axios";
import {
  API_URL,
  PHONE_DISPLAY,
  PHONE_LINK,
  EMAIL,
  MAPS_LINK,
  whatsappLink,
  checkContact,
  focusRing,
  focusRingLight,
  btn,
  WhatsAppIcon,
  PhoneIcon,
  Wave,
  Eyebrow,
  Accent,
  PageHero,
  FarmStyles,
  QuickContact,
} from "./farmShared";

const initialForm = {
  topic: "",
  name: "",
  contact: "",
  message: "",
  website: "", // honeypot: real visitors never see or fill this
};

const TOPICS = ["Fresh eggs", "Poultry", "Farm manure", "Something else"];

const ENQUIRY_MESSAGE = "Hello Mebrek Farms, I want to make an enquiry.";

// One row in the "reach us directly" list
function InfoCard({
  href,
  external = false,
  tint,
  icon,
  label,
  value,
  ariaLabel,
  title,
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={ariaLabel}
      title={title}
      className={`contact-info-card group flex min-h-[3.5rem] items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#14221B]/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${focusRing}`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${tint}`}
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm text-[#14221B]/65">{label}</span>
        <span className="block break-words font-bold text-[#14221B] group-hover:text-[#0D3B2B]">
          {value}
        </span>
      </span>
    </a>
  );
}

export default function Contact() {
  const [form, setForm] = useState(initialForm);
  const [contactError, setContactError] = useState("");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);

  const contactRef = useRef(null);
  const openedAt = useRef(Date.now());

  // ============================================================
  // FORM HANDLING
  // ============================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));

    if (name === "contact") setContactError("");

    setStatus({ type: "", text: "" });
  };

  const handleContactBlur = () => {
    if (!form.contact.trim()) return;

    const result = checkContact(form.contact);
    setContactError(result.ok ? "" : result.error);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    // Spam check: bots fill the hidden field or submit within moments of
    // loading the page. Pretend it worked, but send nothing.
    const filledHoneypot = form.website.trim() !== "";
    const tooFast = Date.now() - openedAt.current < 3000;

    if (filledHoneypot || tooFast) {
      setStatus({ type: "success", text: "sent" });
      return;
    }

    const contactCheck = checkContact(form.contact);

    if (!contactCheck.ok) {
      setContactError(contactCheck.error);
      contactRef.current?.focus();
      return;
    }

    setLoading(true);
    setStatus({ type: "", text: "" });

    const message = [
      form.topic ? `Topic: ${form.topic}` : "",
      form.message.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await axios.post(`${API_URL}/api/orders`, {
        name: form.name,
        contact: contactCheck.value,
        message,
      });

      setStatus({ type: "success", text: "sent" });
      setForm(initialForm);
      setContactError("");
    } catch (error) {
      console.error("ORDER SUBMISSION ERROR:", error);

      setStatus({ type: "error", text: "failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mf-root min-h-screen overflow-x-hidden bg-[#F4EFE4] text-[#14221B]">
      <FarmStyles />

      {/* HERO */}
      <PageHero
        hooks="contact"
        badge="Contact Mebrek Farms"
        title="Let’s talk about"
        accent="your farm product needs."
        text="Looking for eggs, poultry products or agricultural products? Send us an enquiry and our team can help you with availability, quantities and current pricing."
        waveColor="#F8F4EA"
      >
        <a href="#enquiry" className={btn.yellow}>
          Send an enquiry
        </a>

        <a
          href={whatsappLink(ENQUIRY_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
          className={btn.ghost}
        >
          <WhatsAppIcon />
          Chat on WhatsApp
        </a>
      </PageHero>

      {/* CONTACT DETAILS + FORM */}
      <section
        id="enquiry"
        className="mf-bg-hero relative scroll-mt-4 pb-28 pt-16 sm:py-24"
      >
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">
            {/* CONTACT INFORMATION */}
            <div className="lg:col-span-2">
              <div className="contact-section-heading">
                <Eyebrow>Get in touch</Eyebrow>

                <h2 className="mf-display mt-4 text-3xl font-extrabold sm:text-5xl">
                  We’d love to hear from you
                </h2>

                <Accent />

                <p className="mt-4 text-lg leading-8 text-[#14221B]/75">
                  Whether you want to order eggs, enquire about poultry
                  products, ask about manure or discuss another farm
                  requirement, you can contact Mebrek Farms directly.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                <InfoCard
                  href={PHONE_LINK}
                  tint="bg-[#0D3B2B] text-white"
                  icon={<PhoneIcon />}
                  label="Phone"
                  value={PHONE_DISPLAY}
                  ariaLabel={`Call Mebrek Farms at ${PHONE_DISPLAY}`}
                  title="Tap to call Mebrek Farms"
                />

                <InfoCard
                  href={whatsappLink(ENQUIRY_MESSAGE)}
                  external
                  tint="bg-[#128C4A] text-white"
                  icon={<WhatsAppIcon />}
                  label="WhatsApp"
                  value="Chat with Mebrek Farms"
                  ariaLabel="Chat with Mebrek Farms on WhatsApp"
                />

                <InfoCard
                  href={`mailto:${EMAIL}`}
                  tint="bg-[#F6B93B]"
                  icon={<span aria-hidden="true">✉️</span>}
                  label="Email"
                  value={EMAIL}
                  ariaLabel={`Email Mebrek Farms at ${EMAIL}`}
                  title="Open your email application"
                />

                <InfoCard
                  href={MAPS_LINK}
                  external
                  tint="bg-[#EEF1E8]"
                  icon={<span aria-hidden="true">📍</span>}
                  label="Farm location · Open map"
                  value="Eket, Akwa Ibom, Nigeria"
                  ariaLabel="Open Mebrek Farms location in Google Maps"
                  title="Open location in Google Maps"
                />
              </div>

              {/* PRODUCT LINK */}
              <div className="contact-product-panel mf-bg-steps mt-8 rounded-3xl p-7 text-white shadow-xl">
                <p className="text-sm font-semibold text-[#F6B93B]">
                  Looking for a product?
                </p>

                <h3 className="mf-display mt-2 text-2xl font-bold">
                  Browse our farm products
                </h3>

                <p className="mt-3 leading-7 text-green-50/90">
                  See our egg sizes and prices before sending your enquiry.
                </p>

                <RouterLink
                  to="/products"
                  className={`mt-5 inline-flex min-h-[3rem] items-center gap-2 font-bold text-[#F6B93B] hover:underline ${focusRingLight}`}
                >
                  View products
                  <span aria-hidden="true">→</span>
                </RouterLink>
              </div>
            </div>

            {/* ENQUIRY FORM */}
            <div className="contact-form-panel lg:col-span-3">
              <div className="rounded-3xl border-t-8 border-[#F6B93B] bg-white p-6 shadow-2xl ring-1 ring-[#14221B]/10 sm:p-8 lg:p-10">
                <h2 className="mf-display text-3xl font-extrabold">
                  How can we help?
                </h2>

                <p className="mt-2 text-[#14221B]/70">
                  Fill in the form below and tell us what you need.
                </p>

                {status.type === "success" && (
                  <div
                    role="status"
                    className="mt-6 rounded-2xl bg-green-50 p-4 leading-7 text-green-900"
                  >
                    <strong>Enquiry sent successfully.</strong>
                    <br />
                    Thank you for contacting Mebrek Farms. We will get back to
                    you as soon as possible.
                  </div>
                )}

                {status.type === "error" && (
                  <div
                    role="alert"
                    className="mt-6 rounded-2xl bg-red-50 p-4 leading-7 text-red-800"
                  >
                    <strong>We could not send your enquiry.</strong>
                    <br />
                    Please try again, or contact us directly by phone or
                    WhatsApp.
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  {/* Honeypot: hidden from people and screen readers, bots fill it in */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: "-10000px",
                      width: "1px",
                      height: "1px",
                      overflow: "hidden",
                    }}
                  >
                    <label htmlFor="website">Website (leave this empty)</label>
                    <input
                      id="website"
                      type="text"
                      name="website"
                      value={form.website}
                      onChange={handleChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label htmlFor="topic" className="mb-2 block font-semibold">
                      What is this about?{" "}
                      <span className="font-normal text-[#14221B]/60">
                        (optional)
                      </span>
                    </label>

                    <select
                      id="topic"
                      name="topic"
                      value={form.topic}
                      onChange={handleChange}
                      disabled={loading}
                      className="mf-field"
                    >
                      <option value="">Choose a topic</option>
                      {TOPICS.map((topic) => (
                        <option key={topic} value={topic}>
                          {topic}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="name" className="mb-2 block font-semibold">
                      Your name
                    </label>

                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      autoComplete="name"
                      required
                      disabled={loading}
                      className="mf-field"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact"
                      className="mb-2 block font-semibold"
                    >
                      Phone number or email
                    </label>

                    <input
                      id="contact"
                      ref={contactRef}
                      name="contact"
                      type="text"
                      value={form.contact}
                      onChange={handleChange}
                      onBlur={handleContactBlur}
                      placeholder="e.g. 0903 372 3103 or name@email.com"
                      autoComplete="off"
                      aria-invalid={contactError ? "true" : "false"}
                      aria-describedby={
                        contactError ? "contact-error" : undefined
                      }
                      required
                      disabled={loading}
                      className="mf-field"
                    />

                    {contactError && (
                      <p
                        id="contact-error"
                        role="alert"
                        className="mt-2 text-sm font-medium text-red-700"
                      >
                        {contactError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="mb-2 block font-semibold"
                    >
                      Your message
                    </label>

                    <textarea
                      id="message"
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell us what you would like to order or ask about..."
                      rows={5}
                      required
                      disabled={loading}
                      className="mf-field resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`${btn.dark} w-full text-lg disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {loading ? "Sending…" : "Send enquiry"}
                  </button>

                  <p className="text-center text-sm text-[#14221B]/60">
                    Your enquiry goes straight to Mebrek Farms.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM WHATSAPP CTA */}
      <section className="mf-bg-steps relative pb-32 pt-24 text-white sm:pb-28 sm:pt-28">
        <Wave color="#F8F4EA" flip />

        <div className="site-container relative">
          <div className="contact-bottom-cta flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
            <div>
              <p className="font-semibold text-[#F6B93B]">Prefer WhatsApp?</p>

              <h2 className="mf-display mt-2 text-3xl font-extrabold sm:text-5xl">
                Chat with us directly.
              </h2>

              <p className="mt-3 text-lg text-green-50/90">
                Send us a message and tell us what you need.
              </p>
            </div>

            <a
              href={whatsappLink(ENQUIRY_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              className={btn.yellow}
            >
              <WhatsAppIcon />
              Open WhatsApp
            </a>
          </div>
        </div>
      </section>

      <QuickContact message={ENQUIRY_MESSAGE} />
    </main>
  );
}
