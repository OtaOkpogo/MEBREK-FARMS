import { useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import { animate, stagger } from "animejs";

export default function Footer() {
  const footerRef = useRef(null);

  // ============================================================
  // FOOTER SCROLL ANIMATION
  // ============================================================

  useEffect(() => {
    const footer = footerRef.current;

    if (!footer) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) return;

    const animations = [];
    let observer;

    const mainContent = footer.querySelector(".footer-main");
    const footerSections = Array.from(
      footer.querySelectorAll(".footer-section"),
    );
    const bottomBar = footer.querySelector(".footer-bottom");

    // Hide animated elements only when animation is supported.
    if (mainContent) mainContent.style.opacity = "0";

    footerSections.forEach((section) => {
      section.style.opacity = "0";
    });

    if (bottomBar) bottomBar.style.opacity = "0";

    const runFooterAnimation = () => {
      if (mainContent) {
        animations.push(
          animate(mainContent, {
            opacity: [0, 1],
            translateY: [25, 0],
            duration: 850,
            ease: "out(3)",
          }),
        );
      }

      if (footerSections.length) {
        animations.push(
          animate(footerSections, {
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 700,
            delay: stagger(120, { start: 150 }),
            ease: "out(3)",
          }),
        );
      }

      if (bottomBar) {
        animations.push(
          animate(bottomBar, {
            opacity: [0, 1],
            translateY: [12, 0],
            duration: 650,
            delay: 550,
            ease: "out(3)",
          }),
        );
      }
    };

    // Fallback for browsers without IntersectionObserver.
    if (!("IntersectionObserver" in window)) {
      runFooterAnimation();

      return () => {
        animations.forEach((animation) => animation.cancel());
      };
    }

    observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (!isVisible) return;

        runFooterAnimation();

        observer.disconnect();
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -30px 0px",
      },
    );

    observer.observe(footer);

    return () => {
      observer?.disconnect();

      animations.forEach((animation) => {
        animation.cancel();
      });
    };
  }, []);

  return (
    <footer ref={footerRef} className="bg-green-950 text-white">
      {/* =====================================================
          MAIN FOOTER
      ===================================================== */}

      <div className="site-container footer-main py-14 sm:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* BRAND */}
          <div className="footer-section lg:col-span-2">
            <RouterLink
              to="/"
              className="group inline-block rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-300"
            >
              <h2 className="text-2xl font-extrabold tracking-tight transition-transform duration-300 group-hover:translate-x-1">
                MEBREK <span className="text-yellow-300">FARMS</span>
              </h2>
            </RouterLink>

            <p className="mt-4 max-w-md leading-7 text-green-100">
              Quality poultry and agricultural products delivered with a focus
              on responsible farming, good farm management and customer
              satisfaction.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20make%20an%20enquiry"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-green-800 px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-1 hover:bg-green-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-yellow-300"
              >
                💬 WhatsApp
              </a>

              <a
                href="tel:+2349033723103"
                className="inline-flex items-center gap-2 rounded-xl border border-green-700 px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-1 hover:border-yellow-300 hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
              >
                📞 Call Us
              </a>
            </div>
          </div>

          {/* QUICK LINKS */}
          <div className="footer-section">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-yellow-300">
              Quick Links
            </h3>

            <ul className="mt-5 space-y-3">
              <li>
                <RouterLink
                  to="/"
                  className="inline-block text-green-100 transition-all duration-200 hover:translate-x-1 hover:text-yellow-300"
                >
                  Home
                </RouterLink>
              </li>

              <li>
                <RouterLink
                  to="/about"
                  className="inline-block text-green-100 transition-all duration-200 hover:translate-x-1 hover:text-yellow-300"
                >
                  About Us
                </RouterLink>
              </li>

              <li>
                <RouterLink
                  to="/products"
                  className="inline-block text-green-100 transition-all duration-200 hover:translate-x-1 hover:text-yellow-300"
                >
                  Our Products
                </RouterLink>
              </li>

              <li>
                <RouterLink
                  to="/contact"
                  className="inline-block text-green-100 transition-all duration-200 hover:translate-x-1 hover:text-yellow-300"
                >
                  Contact Us
                </RouterLink>
              </li>
            </ul>
          </div>

          {/* CONTACT */}
          <div className="footer-section">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-yellow-300">
              Contact
            </h3>

            <ul className="mt-5 space-y-4">
              <li>
                <a
                  href="tel:+2349033723103"
                  className="flex items-start gap-3 text-green-100 transition-colors duration-200 hover:text-yellow-300"
                >
                  <span>📞</span>
                  <span>+234 903 372 3103</span>
                </a>
              </li>

              <li>
                <a
                  href="mailto:info@mebrekfarms.com"
                  className="flex items-start gap-3 text-green-100 transition-colors duration-200 hover:text-yellow-300"
                >
                  <span>✉️</span>
                  <span className="break-all">info@mebrekfarms.com</span>
                </a>
              </li>

              <li>
                <a
                  href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20make%20an%20enquiry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-green-100 transition-colors duration-200 hover:text-yellow-300"
                >
                  <span>💬</span>
                  <span>Chat on WhatsApp</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* =====================================================
          BOTTOM BAR
      ===================================================== */}

      <div className="footer-bottom border-t border-green-800">
        <div className="site-container flex flex-col gap-3 py-6 text-sm text-green-200 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-6">
            © {new Date().getFullYear()} MEBREK FARMS. All rights reserved.
          </p>

          <RouterLink
            to="/login"
            className="inline-block w-fit font-semibold transition-all duration-200 hover:translate-x-1 hover:text-yellow-300"
          >
            Farm Management Login →
          </RouterLink>
        </div>
      </div>
    </footer>
  );
}
