import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import mebrekLogo from "../assets/logo.PNG";
import {
  API_URL,
  focusRing,
  btn,
  Wave,
  BackHome,
  FarmStyles,
  usePageMeta,
} from "./farmShared";

// ============================================================
// ANIMATED FLYING BIRD
// ============================================================

function Bird({ size = 38 }) {
  return (
    <svg
      width={size}
      height={size * 0.65}
      viewBox="0 0 100 65"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="bird-shape"
    >
      <path
        d="M8 39 C20 22 33 20 50 34 C66 18 81 19 94 36 C77 29 66 34 51 49 C35 34 22 30 8 39Z"
        fill="currentColor"
      />
      <path
        className="bird-wing"
        d="M50 34 C36 9 21 7 8 39 C26 24 38 28 50 34Z"
        fill="currentColor"
      />
      <path
        className="bird-wing bird-wing-right"
        d="M50 34 C64 9 79 7 94 36 C74 23 62 28 50 34Z"
        fill="currentColor"
      />
    </svg>
  );
}

const flyingBirds = [
  { top: "14%", size: 38, duration: "21s", delay: "-4s" },
  { top: "34%", size: 28, duration: "25s", delay: "-15s" },
  { top: "56%", size: 44, duration: "19s", delay: "-9s" },
  { top: "74%", size: 30, duration: "28s", delay: "-20s" },
];

const features = [
  {
    icon: "🐔",
    title: "Poultry management",
    text: "Bird health, flocks and daily care",
  },
  {
    icon: "🥚",
    title: "Egg production",
    text: "Daily collection and production records",
  },
  {
    icon: "📊",
    title: "Farm analytics",
    text: "Performance insights and reports",
  },
  {
    icon: "🌿",
    title: "Farm operations",
    text: "Inventory, staff and daily activities",
  },
];

// ============================================================
// LOGIN COMPONENT
// ============================================================

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // The admin sign-in page should not appear in search results
  usePageMeta({
    title: "Admin sign in | Mebrek Farms",
    description: "Sign in to the Mebrek Farms management dashboard.",
    noindex: true,
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, formData);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.admin.role);
      localStorage.setItem("adminName", res.data.admin.name);
      localStorage.setItem("user", JSON.stringify(res.data.admin));

      navigate("/admin");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to sign in. Please check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mf-root min-h-screen overflow-x-hidden bg-[#F8F4EA] text-[#14221B]">
      <FarmStyles />

      {/* Flying birds (only used on this page) */}
      <style>{`
        .login-sky { --fly: 62vw; }

        @media (max-width: 1023px) {
          .login-sky { --fly: 112vw; }
        }

        .bird-flight {
          position: absolute;
          left: -80px;
          color: rgba(255, 255, 255, 0.7);
          animation: flyAcross linear infinite;
          will-change: transform;
          filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.25));
        }

        .bird-shape {
          overflow: visible;
          animation: birdBob 1.4s ease-in-out infinite;
        }

        .bird-wing {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: wingFlap 0.55s ease-in-out infinite alternate;
        }

        .bird-wing-right { animation-delay: -0.12s; }

        @keyframes flyAcross {
          0% { transform: translate3d(-10vw, 0, 0) scale(0.75); opacity: 0; }
          8% { opacity: 0.85; }
          50% { transform: translate3d(calc(var(--fly) * 0.5), -30px, 0) scale(1); opacity: 0.8; }
          92% { opacity: 0.85; }
          100% { transform: translate3d(var(--fly), 16px, 0) scale(0.85); opacity: 0; }
        }

        @keyframes wingFlap {
          from { transform: scaleY(1); }
          to { transform: scaleY(0.18); }
        }

        @keyframes birdBob {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -5px; }
        }

        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }

        .login-spinner {
          width: 1.125rem;
          height: 1.125rem;
          border: 2px solid rgb(255 255 255 / 0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: login-spin 0.7s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .login-sky { display: none; }
        }
      `}</style>

      <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* =====================================================
            LEFT: BRAND PANEL
        ===================================================== */}

        <section className="mf-bg-steps relative overflow-hidden text-white">
          <div
            className="login-sky pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            {flyingBirds.map((bird, index) => (
              <div
                key={index}
                className="bird-flight"
                style={{
                  top: bird.top,
                  animationDuration: bird.duration,
                  animationDelay: bird.delay,
                }}
              >
                <Bird size={bird.size} />
              </div>
            ))}
          </div>

          <div className="relative z-10 flex h-full flex-col px-5 pb-28 pt-6 sm:px-10 lg:px-14 lg:pb-12 lg:pt-8">
            {/* Top row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 py-2 pl-2 pr-5 ring-1 ring-white/20 backdrop-blur">
                <img
                  src={mebrekLogo}
                  alt="Mebrek Farms logo"
                  className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1"
                />

                <div>
                  <p className="mf-display text-base font-bold leading-tight tracking-wide">
                    MEBREK FARMS
                  </p>
                  <p className="text-xs font-semibold text-[#F6B93B]">
                    Quality • Care • Farming
                  </p>
                </div>
              </div>

              <BackHome />
            </div>

            {/* Headline */}
            <div className="my-auto max-w-xl py-10 lg:py-14">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-green-50 ring-1 ring-white/20">
                <span
                  className="h-2 w-2 rounded-full bg-[#F6B93B]"
                  aria-hidden="true"
                />
                Smart poultry management
              </p>

              <h1 className="mf-display mt-5 text-4xl font-extrabold leading-[1.05] sm:text-5xl xl:text-6xl">
                Growing better.
                <span className="block text-[#F6B93B]">Managing smarter.</span>
              </h1>

              <p className="mt-5 hidden max-w-lg text-lg leading-8 text-green-50/90 sm:block">
                Welcome to the Mebrek Farms management platform. Monitor your
                poultry operations, manage production, track your inventory and
                keep your farm growing with confidence.
              </p>

              <ul className="mt-8 hidden gap-4 lg:grid xl:grid-cols-2">
                {features.map((feature) => (
                  <li
                    key={feature.title}
                    className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur transition-colors duration-300 hover:bg-white/15"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F6B93B]/20 text-2xl"
                    >
                      {feature.icon}
                    </span>

                    <div>
                      <p className="mf-display font-bold">{feature.title}</p>
                      <p className="mt-0.5 text-sm text-green-50/80">
                        {feature.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="hidden items-center gap-3 text-sm font-semibold text-green-50/75 lg:flex">
              <span
                className="h-1 w-10 rounded-full bg-[#F6B93B]"
                aria-hidden="true"
              />
              Fresh eggs. Quality farming. Better future.
            </p>
          </div>

          {/* Curved edge into the sign-in area (phones and tablets) */}
          <div className="lg:hidden">
            <Wave color="#F8F4EA" />
          </div>
        </section>

        {/* =====================================================
            RIGHT: SIGN-IN CARD
        ===================================================== */}

        <section className="mf-bg-hero relative z-10 -mt-14 flex items-center justify-center px-5 pb-12 pt-4 sm:px-10 lg:mt-0 lg:py-14">
          <div className="w-full max-w-md rounded-3xl border-t-8 border-[#F6B93B] bg-white p-6 shadow-2xl ring-1 ring-[#14221B]/10 sm:p-9">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#EEF1E8] ring-1 ring-[#14221B]/10">
              <img
                src={mebrekLogo}
                alt=""
                className="h-full w-full object-contain p-1.5"
              />
            </div>

            <p className="mt-5 inline-block rounded-full bg-[#0D3B2B]/10 px-4 py-1.5 text-sm font-semibold text-[#0D3B2B]">
              Farm management portal
            </p>

            <h2 className="mf-display mt-3 text-3xl font-extrabold sm:text-4xl">
              Welcome back!
            </h2>

            <span
              aria-hidden="true"
              className="mt-3 block h-1.5 w-16 rounded-full bg-[#F6B93B]"
            />

            <p className="mt-4 leading-7 text-[#14221B]/75">
              Sign in to access your farm management dashboard. Your farm
              operations are just one step away.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block font-semibold">
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  name="email"
                  className="mf-field"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="username"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block font-semibold">
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="mf-field"
                    style={{ paddingRight: "5.5rem" }}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    disabled={loading}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-pressed={showPassword}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className={`absolute right-2 top-1/2 min-h-[2.5rem] min-w-[4.25rem] -translate-y-1/2 rounded-xl bg-[#EEF1E8] px-3 text-sm font-bold text-[#0D3B2B] transition-colors hover:bg-[#0D3B2B] hover:text-white ${focusRing}`}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl bg-red-50 p-4 font-medium leading-6 text-red-800"
                >
                  <span aria-hidden="true">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`${btn.dark} w-full text-lg disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {loading ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Access dashboard
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-[#14221B]/65">
              <span aria-hidden="true">🔐</span>
              Secure access to your farm operations
            </p>

            <p className="mt-5 border-t border-[#14221B]/10 pt-5 text-center text-sm text-[#14221B]/60">
              © {new Date().getFullYear()}{" "}
              <strong className="text-[#0D3B2B]">Mebrek Farms</strong>. All
              rights reserved.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
