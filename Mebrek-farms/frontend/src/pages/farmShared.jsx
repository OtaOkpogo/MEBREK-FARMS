import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

// =========================================================
// SHARED SETTINGS
// Used by Home, About, Products and Contact so every page
// has the same details, fonts, colours and buttons.
// =========================================================

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const PHONE_DISPLAY = "+234 903 372 3103";
export const PHONE_LINK = "tel:+2349033723103";
export const PHONE_COPY = "+2349033723103";
export const EMAIL = "mebrekng@yahoo.com";
export const WHATSAPP_BASE = "https://wa.me/2349033723103";
export const MAPS_LINK =
  "https://www.google.com/maps/search/?api=1&query=Eket%2C%20Akwa%20Ibom%2C%20Nigeria";

export const whatsappLink = (text) =>
  `${WHATSAPP_BASE}?text=${encodeURIComponent(text)}`;

// =========================================================
// CONTACT VALIDATION
// =========================================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTACT_HINT =
  "Enter a Nigerian phone number like 0903 372 3103, or an email address.";

// Accepts an email, or a Nigerian mobile number written as
// 0903…, +234 903… or 234903… (spaces, dashes and brackets are fine).
// Phone numbers are returned in the +234 format.
export function checkContact(raw) {
  const value = raw.trim();

  if (!value) {
    return { ok: false, error: CONTACT_HINT };
  }

  if (value.includes("@")) {
    return EMAIL_PATTERN.test(value)
      ? { ok: true, value }
      : {
          ok: false,
          error: "That email address does not look right. Please check it.",
        };
  }

  const digits = value.replace(/[\s\-().]/g, "");

  if (/[^\d+]/.test(digits)) {
    return { ok: false, error: CONTACT_HINT };
  }

  const local = digits.replace(/^\+?234/, "0");

  if (!/^0[789][01]\d{8}$/.test(local)) {
    return {
      ok: false,
      error:
        "That phone number does not look right. It should have 11 digits, like 0903 372 3103.",
    };
  }

  return { ok: true, value: `+234${local.slice(1)}` };
}

// =========================================================
// FOCUS RINGS AND BUTTONS
// =========================================================

export const focusRing =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0D3B2B]";

export const focusRingLight =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#F6B93B]";

const btnBase =
  "inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-7 py-3.5 font-bold transition-all duration-300 hover:-translate-y-0.5";

// yellow + ghost are for dark backgrounds; wa + dark + outline for light ones
export const btn = {
  yellow: `${btnBase} bg-[#F6B93B] text-[#14221B] hover:bg-[#FFC94F] ${focusRingLight}`,
  ghost: `${btnBase} border-2 border-white/40 text-white hover:bg-white hover:text-[#0D3B2B] ${focusRingLight}`,
  wa: `${btnBase} bg-[#128C4A] text-white hover:bg-[#0E7440] ${focusRing}`,
  dark: `${btnBase} bg-[#0D3B2B] text-white hover:bg-[#145238] ${focusRing}`,
  outline: `${btnBase} border-2 border-[#0D3B2B] text-[#0D3B2B] hover:bg-[#0D3B2B] hover:text-white ${focusRing}`,
};

// =========================================================
// ICONS
// =========================================================

export function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0"
      fill="currentColor"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.23 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

// =========================================================
// DECORATION
// =========================================================

// Curved edge between two sections. `color` is the colour of the section
// the wave blends into. `flip` puts the wave at the top of a section.
export function Wave({ color, flip = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 block h-8 w-full sm:h-12 lg:h-[4.5rem] ${
        flip ? "top-[-1px] rotate-180" : "bottom-[-1px]"
      }`}
      fill={color}
    >
      <path d="M0 80V44C240 8 480 8 720 36S1200 72 1440 28V80Z" />
    </svg>
  );
}

// Small yellow bar used under section headings
export function Accent({ center = false }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-4 block h-1.5 w-16 rounded-full bg-[#F6B93B] ${
        center ? "mx-auto" : ""
      }`}
    />
  );
}

export function Eyebrow({ children }) {
  return (
    <span className="inline-block rounded-full bg-[#0D3B2B]/10 px-4 py-2 text-sm font-semibold text-[#0D3B2B]">
      {children}
    </span>
  );
}

// Section title block. Extra props (data-reveal, className...) go on the wrapper.
export function SectionHeading({
  eyebrow,
  title,
  text,
  center = false,
  className = "",
  ...rest
}) {
  return (
    <div
      className={`${
        center ? "mx-auto max-w-3xl text-center" : "max-w-2xl"
      } ${className}`}
      {...rest}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}

      <h2 className="mf-display mt-4 text-3xl font-extrabold sm:text-5xl">
        {title}
      </h2>

      <Accent center={center} />

      {text && (
        <p className="mt-4 text-lg leading-8 text-[#14221B]/75">{text}</p>
      )}
    </div>
  );
}

// =========================================================
// PAGE PIECES
// =========================================================

export function BackHome() {
  return (
    <RouterLink
      to="/"
      className={`inline-flex min-h-[2.75rem] items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white hover:text-[#0D3B2B] ${focusRingLight}`}
    >
      <span aria-hidden="true">←</span>
      Back to Home
    </RouterLink>
  );
}

// Dark green page header used by About, Products and Contact.
// hooks="data"    keeps the data-hero-* attributes (About, Products)
// hooks="contact" keeps the .contact-hero-item class (Contact)
// so the animations in PageMotion.jsx keep working.
export function PageHero({
  badge,
  title,
  accent,
  text,
  hooks = "data",
  aside = null,
  waveColor,
  children,
}) {
  const hookClass = hooks === "contact" ? "contact-hero-item" : "";
  const hook = (name) =>
    hooks === "data" ? { [`data-hero-${name}`]: true } : {};

  return (
    <section className="mf-bg-steps relative text-white">
      <div className="site-container pt-6">
        <BackHome />
      </div>

      <div
        className={`site-container grid items-center gap-10 pb-28 pt-10 sm:pb-32 sm:pt-14 lg:pb-40 ${
          aside ? "lg:grid-cols-[1.1fr_0.9fr] lg:gap-14" : ""
        }`}
      >
        <div className="max-w-3xl">
          <span
            {...hook("badge")}
            className={`${hookClass} inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-green-50 ring-1 ring-white/20`}
          >
            {badge}
          </span>

          <h1
            {...hook("title")}
            className={`${hookClass} mf-display mt-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl`}
          >
            {title}
            <span className="block text-[#F6B93B]">{accent}</span>
          </h1>

          <p
            {...hook("description")}
            className={`${hookClass} mt-6 max-w-2xl text-lg leading-8 text-green-50/90`}
          >
            {text}
          </p>

          {children && (
            <div
              {...hook("buttons")}
              className={`${hookClass} mt-8 flex flex-col gap-3 sm:flex-row`}
            >
              {children}
            </div>
          )}
        </div>

        {aside}
      </div>

      <Wave color={waveColor} />
    </section>
  );
}

// Floating WhatsApp pill (tablet and desktop) + Call/WhatsApp bar (phones)
export function QuickContact({
  message = "Hello Mebrek Farms, I want to order farm products.",
}) {
  const href = whatsappLink(message);

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Order on WhatsApp"
        className="fixed bottom-5 right-5 z-50 hidden min-h-[3.5rem] items-center gap-2 rounded-full bg-[#128C4A] px-5 py-3 font-bold text-white shadow-xl ring-2 ring-white transition-transform duration-300 hover:scale-105 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0D3B2B] sm:flex"
      >
        <WhatsAppIcon />
        <span>Order on WhatsApp</span>
      </a>

      <div
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 gap-3 border-t border-[#14221B]/10 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <a
          href={PHONE_LINK}
          className={`flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full border-2 border-[#0D3B2B] font-bold text-[#0D3B2B] ${focusRing}`}
        >
          <PhoneIcon />
          Call
        </a>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-[#128C4A] font-bold text-white ${focusRing}`}
        >
          <WhatsAppIcon />
          WhatsApp
        </a>
      </div>
    </>
  );
}

// Shows a branded green placeholder if a remote photo fails to load
export function FarmImage({ src, alt, className = "", loading = "lazy" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt}. Image unavailable.`}
        className={`flex items-center justify-center bg-gradient-to-br from-[#173D2C] to-[#315E43] p-6 text-center text-white ${className}`}
      >
        <div>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-3xl">
            🐔
          </div>
          <p className="font-bold">Mebrek Farms</p>
          <p className="mt-1 text-sm text-white/75">{alt}</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

// "Skip to main content" link for keyboard users (needs id="main-content")
export function SkipLink() {
  return (
    <a href="#main-content" className="mf-skip-link">
      Skip to main content
    </a>
  );
}

// Round button that appears after scrolling down
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  const goTop = () => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Back to top"
      title="Back to top"
      className={`fixed bottom-24 left-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#173D2C] text-2xl font-bold text-white shadow-xl ring-2 ring-white transition-transform hover:-translate-y-1 sm:bottom-6 ${focusRingLight}`}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-[#173D2C] px-5 py-8 pb-28 text-white sm:pb-8">
      <div className="site-container flex flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
        <div>
          <p className="mf-display text-xl font-bold">Mebrek Farms</p>
          <p className="mt-1 text-sm text-white/70">
            Fresh eggs, quality poultry farming and farm manure.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-white/85"
        >
          {[
            ["/", "Home"],
            ["/about", "About"],
            ["/products", "Products"],
            ["/contact", "Contact"],
          ].map(([to, label]) => (
            <RouterLink
              key={to}
              to={to}
              className={`rounded px-1 py-1 hover:text-[#F6B93B] ${focusRingLight}`}
            >
              {label}
            </RouterLink>
          ))}
        </nav>
      </div>

      <div className="site-container mt-6 border-t border-white/15 pt-5 text-center text-sm text-white/60">
        © {new Date().getFullYear()} Mebrek Farms. All rights reserved.
      </div>
    </footer>
  );
}

// Sets the browser tab title, search description and (optionally) local
// business data for a page, and puts everything back when the page closes.
export function usePageMeta({ title, description, jsonLd, noindex = false }) {
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const previousTitle = document.title;
    const undo = [];

    if (title) document.title = title;

    const setMeta = (name, content) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      let previous = null;
      let created = false;

      if (tag) {
        previous = tag.content;
      } else {
        tag = document.createElement("meta");
        tag.name = name;
        document.head.appendChild(tag);
        created = true;
      }

      tag.content = content;

      undo.push(() => {
        if (created) tag.remove();
        else tag.content = previous;
      });
    };

    if (description) setMeta("description", description);
    if (noindex) setMeta("robots", "noindex, nofollow");

    let script = null;

    if (jsonLdText) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = jsonLdText;
      document.head.appendChild(script);
    }

    return () => {
      document.title = previousTitle;
      undo.forEach((fn) => fn());
      if (script) script.remove();
    };
  }, [title, description, noindex, jsonLdText]);
}

// =========================================================
// PAGE STYLES (fonts, backgrounds, form fields)
// Render <FarmStyles /> once at the top of every page.
// =========================================================

export function FarmStyles() {
  return (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=DM+Sans:wght@400;500;600;700&display=swap');

        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
        }
        .mf-root { font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 1.0625rem; }
        .mf-display { font-family: 'Bricolage Grotesque', 'DM Sans', system-ui, sans-serif; letter-spacing: -0.02em; }
        .mf-field {
          width: 100%;
          min-height: 3.25rem;
          border-radius: 0.9rem;
          border: 1.5px solid rgb(20 34 27 / 0.25);
          background: #fff;
          padding: 0.8rem 1rem;
          font-size: 1.0625rem;
          color: #14221B;
          transition: border-color .2s, box-shadow .2s;
        }
        .mf-field::placeholder { color: rgb(20 34 27 / 0.5); }

        /* ---------- Section backgrounds ---------- */

        /* Hero: warm copper glow top-right, green shade bottom-left, fine dot grid */
        .mf-bg-hero {
          background-color: #F8F4EA;
          background-image:
            radial-gradient(48rem 26rem at 88% -8%, rgb(196 122 53 / 0.17), transparent 62%),
            radial-gradient(40rem 26rem at -8% 108%, rgb(23 61 44 / 0.12), transparent 62%),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='2' cy='2' r='1.3' fill='%23173D2C' fill-opacity='.12'/%3E%3C/svg%3E");
        }

        /* Products: soft glows over faint field-row stripes */
        .mf-bg-products {
          background-color: #E9E0D0;
          background-image:
            radial-gradient(36rem 22rem at 100% 0%, rgb(196 122 53 / 0.15), transparent 65%),
            radial-gradient(34rem 22rem at 0% 100%, rgb(23 61 44 / 0.10), transparent 65%),
            repeating-linear-gradient(135deg, rgb(89 72 48 / 0.045) 0 2px, transparent 2px 24px);
        }

        /* How to order: deep green with a golden glow and light dots */
        .mf-bg-steps {
          background-color: #173D2C;
          background-image:
            radial-gradient(34rem 20rem at 100% 0%, rgb(217 164 65 / 0.26), transparent 65%),
            radial-gradient(30rem 20rem at 0% 100%, rgb(37 211 102 / 0.1), transparent 65%),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='2' cy='2' r='1.3' fill='%23ffffff' fill-opacity='.1'/%3E%3C/svg%3E"),
            linear-gradient(180deg, #1D4935 0%, #102F22 100%);
        }

        /* Why us: pale sage with a gentle copper glow */
        .mf-bg-why {
          background-color: #E7EDE2;
          background-image:
            radial-gradient(34rem 20rem at 0% 0%, rgb(196 122 53 / 0.14), transparent 65%),
            linear-gradient(180deg, #EEF1E8 0%, #DCE5D7 100%);
        }

        /* Order: warm sand field with glows and stripes */
        .mf-bg-order {
          background-color: #F0E4CF;
          background-image:
            radial-gradient(40rem 24rem at 100% 100%, rgb(196 122 53 / 0.18), transparent 65%),
            radial-gradient(36rem 24rem at 0% 0%, rgb(23 61 44 / 0.12), transparent 65%),
            repeating-linear-gradient(135deg, rgb(89 72 48 / 0.04) 0 2px, transparent 2px 24px);
        }

        /* Mobile product carousel: swipe without a visible scrollbar */
        .mf-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
        .mf-noscroll::-webkit-scrollbar { display: none; }

        .mf-field:focus {
          outline: none;
          border-color: #0D3B2B;
          box-shadow: 0 0 0 4px rgb(246 185 59 / 0.55);
        }
        @media (prefers-reduced-motion: reduce) {
          .mf-root *, .mf-root *::before, .mf-root *::after {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
          }
        }
      
        .mf-skip-link {
          position: fixed;
          top: 1rem;
          left: 1rem;
          z-index: 100;
          transform: translateY(-160%);
          border-radius: 999px;
          background: #173D2C;
          padding: .75rem 1.25rem;
          color: #fff;
          font-weight: 700;
          transition: transform .2s;
        }
        .mf-skip-link:focus { transform: translateY(0); }
      `}</style>
  );
}
