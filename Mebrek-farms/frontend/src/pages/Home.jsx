import { Link as RouterLink } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  API_URL,
  PHONE_DISPLAY,
  PHONE_LINK,
  PHONE_COPY,
  EMAIL,
  MAPS_LINK,
  whatsappLink,
  checkContact,
  focusRing,
  WhatsAppIcon,
  PhoneIcon,
  Wave,
  Accent,
  FarmImage,
  SkipLink,
  BackToTop,
  FarmStyles,
  QuickContact,
  usePageMeta,
} from "./farmShared";

// =========================================================
// CONFIG
// =========================================================

const CUSTOMER_STORAGE_KEY = "mebrek_customer_details";

const PAGE_TITLE = "Mebrek Farms | Fresh Eggs, Poultry & Farm Manure in Eket";

const PAGE_DESCRIPTION =
  "Order fresh eggs, poultry and quality farm manure directly from Mebrek Farms in Eket, Akwa Ibom. Contact us to confirm availability and pricing.";

// Local business details for search engines
const LOCAL_BUSINESS = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Mebrek Farms",
  description: "Poultry farm supplying fresh eggs, poultry and farm manure.",
  telephone: PHONE_COPY,
  email: EMAIL,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Eket",
    addressRegion: "Akwa Ibom",
    addressCountry: "NG",
  },
};

const GENERAL_ORDER_MESSAGE =
  "Hello Mebrek Farms, I want to order farm products.";

const IMAGES = {
  hero: "https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg",
  hens: "https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg",
  eggs: "https://cdn.britannica.com/94/151894-050-F72A5317/Brown-eggs.jpg",
  manure:
    "https://media.istockphoto.com/id/469085306/photo/soil-with-a-garden-trowel.jpg?s=612x612&w=0&k=20&c=yOFsnxK_9g5puQIeaYLCFo6Hu1NypryTMDzWfyLEnGA=",
};

const PRODUCTS = [
  {
    key: "Fresh eggs",
    price: "From ₦4,000 per crate",
    image: IMAGES.eggs,
    text: "Fresh eggs in different sizes and categories. Ask us what is available today.",
  },
  {
    key: "Poultry",
    price: "Price on request",
    image: IMAGES.hens,
    text: "Professionally managed poultry, available according to farm stock.",
  },
  {
    key: "Farm manure",
    price: "Price on request",
    image: IMAGES.manure,
    text: "Poultry manure for farms, gardens and soil improvement.",
  },
];

const STEPS = [
  { title: "Pick a product", text: "Choose eggs, poultry or manure below." },
  { title: "Message us", text: "Tap WhatsApp or fill in the short form." },
  { title: "We reply", text: "We confirm what is available and the price." },
];

const REASONS = [
  {
    icon: "🌿",
    title: "Clean farm",
    text: "Hygienic, well-managed production.",
  },
  {
    icon: "🐔",
    title: "Healthy birds",
    text: "Bird health always comes first.",
  },
  {
    icon: "✅",
    title: "Consistent quality",
    text: "The same care with every order.",
  },
  {
    icon: "🤝",
    title: "Easy to reach",
    text: "Call, WhatsApp, email or use the form.",
  },
];

const QUICK_QUANTITIES = ["1", "2", "5", "10"];

// =========================================================
// ORDER MESSAGE (used for the WhatsApp buttons)
// =========================================================

function buildOrderMessage(order, contact) {
  return [
    "Hello Mebrek Farms, I would like to place an order.",
    "",
    `Product: ${order.product || "Not selected"}`,
    `Name: ${order.name || "Not provided"}`,
    `Contact: ${contact || order.contact || "Not provided"}`,
    order.details || order.message
      ? `Quantity/details: ${(order.details || order.message).trim()}`
      : "",
    "",
    "Please confirm availability and pricing. Thank you.",
  ]
    .filter(Boolean)
    .join("\n");
}

// =========================================================
// HOME PAGE
// =========================================================

export default function Home() {
  const [form, setForm] = useState({
    product: "",
    name: "",
    contact: "",
    message: "",
    website: "", // honeypot: real visitors never see or fill this
  });

  const [contactError, setContactError] = useState("");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [hasSavedDetails, setHasSavedDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const formRef = useRef(null);
  const nameRef = useRef(null);
  const contactRef = useRef(null);
  const openedAt = useRef(Date.now());

  // Page title, search description and local business data
  usePageMeta({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    jsonLd: LOCAL_BUSINESS,
  });

  // -------------------------------------------------------
  // REMEMBER RETURNING CUSTOMERS (saved only in this browser)
  // -------------------------------------------------------

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);

      if (saved) {
        const customer = JSON.parse(saved);

        if (customer.name || customer.contact) {
          setForm((previous) => ({
            ...previous,
            name: customer.name || "",
            contact: customer.contact || "",
          }));
          setHasSavedDetails(true);
        }
      }
    } catch (error) {
      console.warn("Could not load saved customer details:", error);
    }
  }, []);

  const clearSavedDetails = () => {
    try {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch (error) {
      console.warn("Could not clear saved customer details:", error);
    }

    setForm((previous) => ({ ...previous, name: "", contact: "" }));
    setContactError("");
    setHasSavedDetails(false);
    nameRef.current?.focus();
  };

  // -------------------------------------------------------
  // FORM HANDLERS
  // -------------------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({ ...previous, [name]: value }));

    if (name === "contact") setContactError("");

    // Starting a new order hides the previous confirmation
    if (name === "product") setLastOrder(null);

    setStatus({ type: "", text: "" });
  };

  const handleContactBlur = () => {
    if (!form.contact.trim()) return;

    const result = checkContact(form.contact);
    setContactError(result.ok ? "" : result.error);
  };

  // "Use the form instead" on a product card
  const chooseProduct = (productKey) => {
    setForm((previous) => ({ ...previous, product: productKey }));
    setStatus({ type: "", text: "" });
    setLastOrder(null);

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    formRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });

    window.setTimeout(
      () => nameRef.current?.focus({ preventScroll: true }),
      reduceMotion ? 0 : 600,
    );
  };

  // Quick egg quantity buttons
  const addQuantity = (quantity) => {
    setForm((previous) => {
      const rest = previous.message
        .split("\n")
        .filter((line) => !/^Quantity:/i.test(line.trim()))
        .join("\n")
        .trim();

      return {
        ...previous,
        product: "Fresh eggs",
        message: [
          `Quantity: ${quantity} ${quantity === "1" ? "crate" : "crates"}`,
          rest,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    });

    setLastOrder(null);
    setStatus({ type: "", text: "" });
  };

  // -------------------------------------------------------
  // SEND THE FORM ON WHATSAPP INSTEAD
  // -------------------------------------------------------

  const handleWhatsAppOrder = () => {
    const contactCheck = form.contact.trim()
      ? checkContact(form.contact)
      : { ok: true, value: "" };

    if (!contactCheck.ok) {
      setContactError(contactCheck.error);
      contactRef.current?.focus();
      return;
    }

    window.open(
      whatsappLink(buildOrderMessage(form, contactCheck.value || form.contact)),
      "_blank",
      "noopener,noreferrer",
    );
  };

  // -------------------------------------------------------
  // COPY PHONE NUMBER
  // -------------------------------------------------------

  const copyPhoneNumber = async () => {
    const markCopied = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    };

    try {
      await navigator.clipboard.writeText(PHONE_COPY);
      markCopied();
    } catch {
      // Older browsers: fall back to a hidden text box
      const input = document.createElement("textarea");
      input.value = PHONE_COPY;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();

      try {
        if (document.execCommand("copy")) markCopied();
      } catch {
        setCopied(false);
      }

      input.remove();
    }
  };

  // -------------------------------------------------------
  // SHARE THE PAGE
  // -------------------------------------------------------

  const handleShare = async () => {
    const url = window.location.href;
    const text =
      "Discover Mebrek Farms in Eket, Akwa Ibom. Fresh eggs, poultry and farm manure.";

    // Phones: use the built-in share sheet. Others: WhatsApp.
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mebrek Farms", text, url });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    window.open(
      whatsappLink(`${text} Visit: ${url}`),
      "_blank",
      "noopener,noreferrer",
    );
  };

  // -------------------------------------------------------
  // SUBMIT ORDER
  // -------------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Spam protection: bots fill the hidden field or submit within moments
    // of loading the page. Nothing is sent, and no confirmation is shown.
    const filledHoneypot = form.website.trim() !== "";
    const tooFast = Date.now() - openedAt.current < 3000;

    if (filledHoneypot || tooFast) {
      setStatus({
        type: "error",
        text: "Please wait a moment and try submitting your order again.",
      });
      return;
    }

    if (!form.product) {
      setStatus({
        type: "error",
        text: "Please select a product before submitting.",
      });
      return;
    }

    if (!form.name.trim()) {
      setStatus({ type: "error", text: "Please enter your name." });
      nameRef.current?.focus();
      return;
    }

    const contactCheck = checkContact(form.contact);

    if (!contactCheck.ok) {
      setContactError(contactCheck.error);
      contactRef.current?.focus();
      return;
    }

    setStatus({ type: "", text: "" });
    setIsSubmitting(true);

    const submitted = {
      product: form.product,
      name: form.name.trim(),
      contact: contactCheck.value,
      details: form.message.trim(),
    };

    const message = [
      `Product: ${submitted.product}`,
      submitted.details ? `Details: ${submitted.details}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await axios.post(`${API_URL}/api/orders`, {
        name: submitted.name,
        contact: submitted.contact,
        message,
      });

      setLastOrder(submitted);

      // Save name and contact for next time, on this device only
      try {
        localStorage.setItem(
          CUSTOMER_STORAGE_KEY,
          JSON.stringify({ name: submitted.name, contact: submitted.contact }),
        );
        setHasSavedDetails(true);
      } catch (error) {
        console.warn("Could not save customer details:", error);
      }

      // Keep name and contact for repeat orders
      setForm({
        product: "",
        name: submitted.name,
        contact: submitted.contact,
        message: "",
        website: "",
      });

      setContactError("");
    } catch (error) {
      console.error("ORDER SUBMIT ERROR:", error);

      setStatus({
        type: "error",
        text: "We could not send your order right now. Please call us or order through WhatsApp.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------

  return (
    <div
      id="top"
      className="mf-root min-h-screen overflow-x-hidden bg-[#F4EFE4] text-[#14221B]"
    >
      <FarmStyles />
      <SkipLink />

      <main id="main-content">
        {/* =====================================================
            HERO
        ===================================================== */}

        <section className="mf-bg-hero relative">
          <div className="site-container grid items-center gap-10 pb-20 pt-12 sm:pb-24 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:pb-32 lg:pt-24">
            <div>
              <p
                data-farm-hero-item
                className="inline-block rounded-full bg-[#0D3B2B]/10 px-4 py-2 text-sm font-semibold text-[#0D3B2B]"
              >
                Poultry farm in Eket, Akwa Ibom
              </p>

              <h1
                data-farm-hero-item
                className="mf-display mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl xl:text-7xl"
              >
                Fresh eggs and poultry from our farm.
              </h1>

              <p
                data-farm-hero-item
                className="mt-5 max-w-xl text-lg leading-8 text-[#14221B]/75"
              >
                Order eggs, poultry or farm manure directly from Mebrek Farms.
                Message us and we will confirm what is available.
              </p>

              <p
                data-farm-hero-item
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F6B93B]/30 px-4 py-2 font-semibold text-[#5C4000]"
              >
                <span aria-hidden="true">🥚</span>
                Fresh eggs from ₦4,000 per crate
              </p>

              <div
                data-farm-hero-item
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <a
                  href={whatsappLink(GENERAL_ORDER_MESSAGE)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-[3.5rem] items-center justify-center gap-3 rounded-full bg-[#128C4A] px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-[#0E7440] ${focusRing}`}
                >
                  <WhatsAppIcon />
                  Order on WhatsApp
                </a>

                <a
                  href="#contact-section"
                  className={`inline-flex min-h-[3.5rem] items-center justify-center gap-3 rounded-full border-2 border-[#0D3B2B] px-8 py-4 text-lg font-bold text-[#0D3B2B] transition-colors hover:bg-[#0D3B2B] hover:text-white ${focusRing}`}
                >
                  <PhoneIcon />
                  Contact us
                </a>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className={`mt-5 inline-flex min-h-[3rem] items-center gap-2 rounded px-1 font-semibold text-[#0D3B2B] underline-offset-4 hover:underline ${focusRing}`}
              >
                <span aria-hidden="true">↗</span>
                Share Mebrek Farms
              </button>
            </div>

            <div
              data-farm-hero-item
              className="relative mx-auto w-full max-w-xl pb-3 pr-3 sm:pb-5 sm:pr-5 lg:max-w-none"
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-[#F6B93B] sm:translate-x-5 sm:translate-y-5"
              />

              <FarmImage
                src={IMAGES.hero}
                alt="Hens at Mebrek Farms"
                loading="eager"
                className="relative h-72 w-full rounded-3xl object-cover shadow-2xl ring-4 ring-white sm:h-[28rem] lg:h-[32rem]"
              />

              <div className="absolute bottom-7 left-4 flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 text-sm font-bold shadow-lg backdrop-blur sm:bottom-10 sm:left-6">
                <span aria-hidden="true">🐔</span>
                Farm-direct products
              </div>

              <div className="absolute right-7 top-4 flex items-center gap-2 rounded-full bg-[#0D3B2B] px-4 py-2 text-sm font-semibold text-white shadow-lg sm:right-10 sm:top-6">
                <span aria-hidden="true">📍</span>
                Eket, Akwa Ibom
              </div>
            </div>
          </div>

          <Wave color="#E9E0D0" />
        </section>

        {/* =====================================================
            PRODUCTS
        ===================================================== */}

        <section id="products" className="mf-bg-products py-16 sm:py-24">
          <div className="site-container">
            <div data-farm-reveal className="max-w-2xl">
              <h2 className="mf-display text-3xl font-extrabold sm:text-5xl">
                What would you like to buy?
              </h2>
              <Accent />
              <p className="mt-3 text-lg leading-8 text-[#14221B]/75">
                Tap a button to order. Stock changes, so we always confirm
                availability first.
              </p>
            </div>

            <div className="mf-noscroll mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:pb-0">
              {PRODUCTS.map((product) => (
                <article
                  key={product.key}
                  data-farm-reveal
                  className="group flex w-[82%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#14221B]/10 transition-all duration-300 sm:w-[46%] lg:w-auto lg:hover:-translate-y-1.5 lg:hover:shadow-2xl"
                >
                  <div className="relative h-52 overflow-hidden sm:h-56">
                    <FarmImage
                      src={product.image}
                      alt={product.key}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />

                    <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1.5 text-sm font-bold shadow">
                      {product.price}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="mf-display text-2xl font-bold">
                      {product.key}
                    </h3>

                    <p className="mt-3 flex-1 leading-7 text-[#14221B]/75">
                      {product.text}
                    </p>

                    <div className="mt-6 space-y-3">
                      <a
                        href={whatsappLink(
                          `Hello Mebrek Farms, I want to order ${product.key.toLowerCase()}.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-[#128C4A] px-5 py-3 font-bold text-white transition-colors hover:bg-[#0E7440] ${focusRing}`}
                      >
                        <WhatsAppIcon />
                        Order on WhatsApp
                      </a>

                      <button
                        type="button"
                        onClick={() => chooseProduct(product.key)}
                        className={`flex min-h-[3.25rem] w-full items-center justify-center rounded-full border-2 border-[#14221B]/20 px-5 py-3 font-semibold transition-colors hover:border-[#0D3B2B] hover:bg-[#0D3B2B]/5 ${focusRing}`}
                      >
                        Use the form instead
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <p className="flex items-center gap-2 text-sm font-medium text-[#14221B]/60 lg:hidden">
              <span aria-hidden="true">↔</span>
              Swipe sideways to see all products
            </p>

            <div className="mt-6 lg:mt-8">
              <RouterLink
                to="/products"
                className={`inline-flex min-h-[3rem] items-center font-bold text-[#0D3B2B] underline-offset-4 hover:underline ${focusRing}`}
              >
                See the full product list
              </RouterLink>
            </div>
          </div>
        </section>

        {/* =====================================================
            HOW TO ORDER
        ===================================================== */}

        <section className="mf-bg-steps relative pb-24 pt-24 text-white sm:pb-28 sm:pt-28">
          <Wave color="#E9E0D0" flip />
          <Wave color="#EEF1E8" />

          <div className="site-container relative">
            <h2
              data-farm-reveal
              className="mf-display text-3xl font-extrabold sm:text-5xl"
            >
              How to order
            </h2>
            <Accent />

            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  data-farm-reveal
                  className="relative flex items-start gap-5 md:after:absolute md:after:left-[4.25rem] md:after:top-7 md:after:w-[calc(100%-3rem)] md:after:border-t-2 md:after:border-dashed md:after:border-white/30 md:after:content-[''] md:last:after:hidden"
                >
                  <span
                    aria-hidden="true"
                    className="mf-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F6B93B] text-2xl font-extrabold text-[#14221B]"
                  >
                    {index + 1}
                  </span>

                  <div>
                    <h3 className="mf-display text-xl font-bold">
                      {step.title}
                    </h3>
                    <p className="mt-1 leading-7 text-green-50/90">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* =====================================================
            WHY US
        ===================================================== */}

        <section className="mf-bg-why py-16 sm:py-24">
          <div className="site-container">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div data-farm-reveal>
                <h2 className="mf-display text-3xl font-extrabold sm:text-5xl">
                  Why customers choose Mebrek Farms
                </h2>
                <Accent />

                <p className="mt-4 max-w-md text-lg leading-8 text-[#14221B]/75">
                  We combine responsible farm management with attention to bird
                  health, so you get dependable products.
                </p>

                <RouterLink
                  to="/about"
                  className={`mt-6 inline-flex min-h-[3rem] items-center font-bold text-[#0D3B2B] underline-offset-4 hover:underline ${focusRing}`}
                >
                  Learn more about the farm
                </RouterLink>
              </div>

              <ul data-farm-reveal className="grid gap-5 sm:grid-cols-2">
                {REASONS.map((reason) => (
                  <li
                    key={reason.title}
                    className="flex items-start gap-4 rounded-2xl bg-[#EAF2E8] p-5 shadow-sm ring-1 ring-[#14221B]/10 transition-shadow hover:shadow-md"
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F6B93B]/25 text-2xl"
                      aria-hidden="true"
                    >
                      {reason.icon}
                    </span>

                    <div>
                      <h3 className="mf-display text-lg font-bold">
                        {reason.title}
                      </h3>
                      <p className="mt-1 leading-7 text-[#14221B]/75">
                        {reason.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* =====================================================
            ORDER FORM + CONTACT
        ===================================================== */}

        <section
          id="order"
          ref={formRef}
          className="mf-bg-order scroll-mt-6 pb-28 pt-16 sm:py-24"
        >
          <div className="site-container">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
              {/* Contact details */}

              <div
                id="contact-section"
                className="scroll-mt-24"
                data-farm-reveal
              >
                <h2 className="mf-display text-3xl font-extrabold sm:text-5xl">
                  Send us your order
                </h2>
                <Accent />

                <p className="mt-4 max-w-md text-lg leading-8 text-[#14221B]/75">
                  Fill in the form and we will reply with availability and
                  price. You can also reach us directly:
                </p>

                <ul className="mt-8 space-y-4">
                  <li>
                    <div className="flex items-center gap-2 rounded-2xl bg-white p-4 ring-1 ring-[#14221B]/10">
                      <a
                        href={PHONE_LINK}
                        aria-label={`Call Mebrek Farms at ${PHONE_DISPLAY}`}
                        title="Tap to call Mebrek Farms"
                        className={`flex min-h-[3rem] min-w-0 flex-1 items-center gap-4 rounded-xl ${focusRing}`}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0D3B2B] text-white">
                          <PhoneIcon />
                        </span>

                        <span className="min-w-0">
                          <span className="block text-sm text-[#14221B]/65">
                            Call
                          </span>
                          <span className="block font-bold">
                            {PHONE_DISPLAY}
                          </span>
                        </span>
                      </a>

                      <button
                        type="button"
                        onClick={copyPhoneNumber}
                        aria-live="polite"
                        className={`min-h-[2.75rem] shrink-0 rounded-full border border-[#0D3B2B]/25 px-4 text-sm font-bold text-[#0D3B2B] hover:bg-[#0D3B2B]/5 ${focusRing}`}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </li>

                  <li>
                    <a
                      href={whatsappLink(GENERAL_ORDER_MESSAGE)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex min-h-[3.5rem] items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#14221B]/10 transition-colors hover:bg-[#0D3B2B]/5 ${focusRing}`}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#128C4A] text-white">
                        <WhatsAppIcon />
                      </span>

                      <span>
                        <span className="block text-sm text-[#14221B]/65">
                          WhatsApp
                        </span>
                        <span className="block font-bold">
                          Chat with Mebrek Farms
                        </span>
                      </span>
                    </a>
                  </li>

                  <li>
                    <a
                      href={`mailto:${EMAIL}`}
                      aria-label={`Email Mebrek Farms at ${EMAIL}`}
                      title="Open your email application"
                      className={`flex min-h-[3.5rem] items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#14221B]/10 transition-colors hover:bg-[#0D3B2B]/5 ${focusRing}`}
                    >
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6B93B] text-xl"
                        aria-hidden="true"
                      >
                        ✉️
                      </span>

                      <span className="min-w-0">
                        <span className="block text-sm text-[#14221B]/65">
                          Email
                        </span>
                        <span className="block break-all font-bold">
                          {EMAIL}
                        </span>
                      </span>
                    </a>
                  </li>

                  <li>
                    <a
                      href={MAPS_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open Mebrek Farms location in Google Maps"
                      title="Open location in Google Maps"
                      className={`flex min-h-[3.5rem] items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#14221B]/10 transition-colors hover:bg-[#0D3B2B]/5 ${focusRing}`}
                    >
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl ring-1 ring-[#14221B]/10"
                        aria-hidden="true"
                      >
                        📍
                      </span>

                      <span>
                        <span className="block text-sm text-[#14221B]/65">
                          Farm location · Open map
                        </span>
                        <span className="block font-bold">
                          Eket, Akwa Ibom, Nigeria
                        </span>
                      </span>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Order form */}

              <div
                data-farm-reveal
                className="rounded-3xl border-t-8 border-[#F6B93B] bg-white p-6 shadow-2xl ring-1 ring-[#14221B]/10 sm:p-10"
              >
                <h3 className="mf-display text-2xl font-extrabold">
                  Order form
                </h3>

                {/* Errors */}

                {status.type === "error" && (
                  <div
                    role="alert"
                    className="mt-5 rounded-xl bg-red-50 p-4 font-medium text-red-800"
                  >
                    {status.text}
                  </div>
                )}

                {/* Order confirmation */}

                {lastOrder && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-xl text-white"
                      >
                        ✓
                      </span>

                      <div>
                        <h4 className="font-bold text-green-900">
                          Order request received!
                        </h4>
                        <p className="text-sm text-green-800">
                          Thank you for choosing Mebrek Farms.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-green-200 pt-4 text-sm text-green-950">
                      <p>
                        <strong>Customer:</strong> {lastOrder.name}
                      </p>
                      <p>
                        <strong>Contact:</strong> {lastOrder.contact}
                      </p>
                      <p>
                        <strong>Product:</strong> {lastOrder.product}
                      </p>

                      {lastOrder.details && (
                        <p className="whitespace-pre-line">
                          <strong>Quantity/details:</strong> {lastOrder.details}
                        </p>
                      )}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-green-800">
                      Our team will contact you to confirm availability and
                      pricing. This is an order request, not a payment
                      confirmation.
                    </p>

                    <a
                      href={whatsappLink(
                        buildOrderMessage(lastOrder, lastOrder.contact),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-4 flex min-h-[3rem] items-center justify-center gap-2 rounded-full bg-[#128C4A] px-5 py-3 font-bold text-white hover:bg-[#0E7440] ${focusRing}`}
                    >
                      <WhatsAppIcon />
                      Continue on WhatsApp
                    </a>
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
                    <label
                      htmlFor="product"
                      className="mb-2 block font-semibold"
                    >
                      1. What do you need?
                    </label>

                    <select
                      id="product"
                      name="product"
                      value={form.product}
                      onChange={handleChange}
                      className="mf-field"
                      required
                    >
                      <option value="" disabled>
                        Choose a product
                      </option>

                      {PRODUCTS.map((product) => (
                        <option key={product.key} value={product.key}>
                          {product.key}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="name" className="mb-2 block font-semibold">
                      2. Your name
                    </label>

                    <input
                      id="name"
                      ref={nameRef}
                      type="text"
                      name="name"
                      placeholder="Enter your name"
                      value={form.name}
                      onChange={handleChange}
                      className="mf-field"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact"
                      className="mb-2 block font-semibold"
                    >
                      3. Phone number or email
                    </label>

                    <input
                      id="contact"
                      ref={contactRef}
                      type="text"
                      name="contact"
                      placeholder="e.g. 0903 372 3103 or name@email.com"
                      value={form.contact}
                      onChange={handleChange}
                      onBlur={handleContactBlur}
                      className="mf-field"
                      autoComplete="off"
                      aria-invalid={contactError ? "true" : "false"}
                      aria-describedby={
                        contactError ? "contact-error" : undefined
                      }
                      required
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

                    {hasSavedDetails && (
                      <p className="mt-2 text-sm text-[#14221B]/65">
                        We filled in your details from your last visit.{" "}
                        <button
                          type="button"
                          onClick={clearSavedDetails}
                          className={`rounded font-bold text-[#0D3B2B] underline underline-offset-4 ${focusRing}`}
                        >
                          Not you? Clear them
                        </button>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="mb-2 block font-semibold"
                    >
                      4. Quantity or other details{" "}
                      <span className="font-normal text-[#14221B]/60">
                        (optional)
                      </span>
                    </label>

                    <textarea
                      id="message"
                      name="message"
                      placeholder="For example: 3 crates of eggs"
                      value={form.message}
                      onChange={handleChange}
                      className="mf-field resize-none"
                      rows={4}
                    />

                    <div className="mt-3">
                      <p className="mb-2 text-sm font-semibold text-[#14221B]/70">
                        Quick egg quantity:
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {QUICK_QUANTITIES.map((quantity) => (
                          <button
                            key={quantity}
                            type="button"
                            onClick={() => addQuantity(quantity)}
                            className={`min-h-[2.75rem] rounded-full border border-[#0D3B2B]/25 px-4 text-sm font-bold text-[#0D3B2B] transition-colors hover:bg-[#0D3B2B] hover:text-white ${focusRing}`}
                          >
                            {quantity} {quantity === "1" ? "crate" : "crates"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-[#0D3B2B] px-7 py-4 text-lg font-bold text-white transition-colors hover:bg-[#145238] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                  >
                    {isSubmitting ? "Sending…" : "Send my order"}
                  </button>

                  <button
                    type="button"
                    onClick={handleWhatsAppOrder}
                    className={`flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-full border-2 border-[#128C4A] px-7 py-4 font-bold text-[#128C4A] transition-colors hover:bg-[#128C4A] hover:text-white ${focusRing}`}
                  >
                    <WhatsAppIcon />
                    Send this form on WhatsApp
                  </button>

                  <p className="text-center text-sm leading-6 text-[#14221B]/60">
                    Your information is used to respond to your order request.
                    We do not collect payment through this form. Your name and
                    contact are remembered only in this browser.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <BackToTop />
      <QuickContact message={GENERAL_ORDER_MESSAGE} />
    </div>
  );
}
