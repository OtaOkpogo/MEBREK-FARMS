import { Link as RouterLink } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-green-950 text-white">
      {/* =====================================================
          MAIN FOOTER
      ===================================================== */}
      <div className="site-container py-14 sm:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <RouterLink to="/" className="inline-block">
              <h2 className="text-2xl font-extrabold tracking-tight">
                MEBREK <span className="text-yellow-300">FARMS</span>
              </h2>
            </RouterLink>

            <p className="mt-4 max-w-md leading-7 text-green-100">
              Quality poultry and agricultural products delivered with a
              focus on responsible farming, good farm management and customer
              satisfaction.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20make%20an%20enquiry"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-green-800 px-4 py-2.5 text-sm font-semibold transition hover:bg-green-700"
              >
                💬 WhatsApp
              </a>

              <a
                href="tel:+2349033723103"
                className="inline-flex items-center gap-2 rounded-xl border border-green-700 px-4 py-2.5 text-sm font-semibold transition hover:bg-green-900"
              >
                📞 Call Us
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-yellow-300">
              Quick Links
            </h3>

            <ul className="mt-5 space-y-3">
              <li>
                <RouterLink
                  to="/"
                  className="text-green-100 transition hover:text-yellow-300"
                >
                  Home
                </RouterLink>
              </li>

              <li>
                <RouterLink
                  to="/about"
                  className="text-green-100 transition hover:text-yellow-300"
                >
                  About Us
                </RouterLink>
              </li>

              <li>
                <RouterLink
                  to="/products"
                  className="text-green-100 transition hover:text-yellow-300"
                >
                  Our Products
                </RouterLink>
              </li>

              <li>
                <RouterLink
                  to="/contact"
                  className="text-green-100 transition hover:text-yellow-300"
                >
                  Contact Us
                </RouterLink>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-yellow-300">
              Contact
            </h3>

            <ul className="mt-5 space-y-4">
              <li>
                <a
                  href="tel:+2349033723103"
                  className="flex items-start gap-3 text-green-100 transition hover:text-yellow-300"
                >
                  <span>📞</span>
                  <span>+234 903 372 3103</span>
                </a>
              </li>

              <li>
                <a
                  href="mailto:info@mebrekfarms.com"
                  className="flex items-start gap-3 text-green-100 transition hover:text-yellow-300"
                >
                  <span>✉️</span>
                  <span className="break-all">
                    info@mebrekfarms.com
                  </span>
                </a>
              </li>

              <li>
                <a
                  href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20make%20an%20enquiry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-green-100 transition hover:text-yellow-300"
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
      <div className="border-t border-green-800">
        <div className="site-container flex flex-col gap-3 py-6 text-sm text-green-200 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} MEBREK FARMS. All rights reserved.
          </p>

          <RouterLink
            to="/login"
            className="font-semibold transition hover:text-yellow-300"
          >
            Farm Management Login →
          </RouterLink>
        </div>
      </div>
    </footer>
  );
}
