import { useState } from "react";
import { Link as RouterLink, NavLink } from "react-router-dom";
import logo from "../assets/logo.PNG";

const navItems = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Products", to: "/products" },
  { label: "Contact", to: "/contact" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="site-container">
        <div className="flex h-20 items-center justify-between">
          {/* =================================================
              LOGO
          ================================================= */}
          <RouterLink
            to="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-3"
          >
            <img
              src={logo}
              alt="MEBREK FARMS"
              className="h-12 w-auto object-contain"
            />

            <div className="hidden sm:block">
              <p className="text-lg font-extrabold leading-none text-green-900">
                MEBREK FARMS
              </p>

              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Quality • Care • Farming
              </p>
            </div>
          </RouterLink>

          {/* =================================================
              DESKTOP NAVIGATION
          ================================================= */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                    isActive
                      ? "bg-green-50 text-green-800"
                      : "text-gray-600 hover:bg-gray-50 hover:text-green-800",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}

            <RouterLink
              to="/login"
              className="ml-4 inline-flex items-center gap-2 rounded-xl bg-green-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-800 hover:shadow-lg"
            >
              <span>Management Login</span>
              <span aria-hidden="true">→</span>
            </RouterLink>
          </nav>

          {/* =================================================
              MOBILE MENU BUTTON
          ================================================= */}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:border-green-200 hover:bg-green-50 hover:text-green-800 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>

        {/* ===================================================
            MOBILE NAVIGATION
        =================================================== */}
        {mobileOpen && (
          <nav className="border-t border-gray-100 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    [
                      "rounded-xl px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-green-50 text-green-800"
                        : "text-gray-700 hover:bg-gray-50 hover:text-green-800",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <RouterLink
                to="/login"
                onClick={closeMobileMenu}
                className="mt-2 flex items-center justify-center rounded-xl bg-green-900 px-5 py-3 font-bold text-white transition hover:bg-green-800"
              >
                Management Login
              </RouterLink>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
