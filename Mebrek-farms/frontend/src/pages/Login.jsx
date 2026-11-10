import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import mebrekLogo from "../assets/logo.PNG";

const FARM_IMAGE =
  "https://handsomebrookfarms.com/cdn/shop/files/2025.06.17_-HBF-Nathan-Schlabach-Solar-_01_522ba905-dff0-467f-a63d-aa57ff894d2e.jpg?v=1776354936&width=3000";

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/login",
        formData,
      );

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("adminName", res.data.name);
      localStorage.setItem("user", JSON.stringify(res.data.admin));

      navigate("/admin");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to sign in. Please check your login details.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#142d20] overflow-hidden">
      {/* FARM PHOTOGRAPH */}

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url("${FARM_IMAGE}")`,
        }}
      />

      {/* PHOTOGRAPH OVERLAY */}

      <div className="absolute inset-0 bg-gradient-to-r from-[#10291d]/95 via-[#10291d]/75 to-[#10291d]/35" />

      <div className="absolute inset-0 bg-gradient-to-t from-[#10291d]/70 via-transparent to-[#10291d]/25" />

      {/* PAGE CONTENT */}

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* HEADER */}

        <header className="px-6 sm:px-10 lg:px-16 py-7 flex items-center justify-between">
          {/* MEBREK FARMS LOGO AND BRANDING */}

          <div className="flex items-center gap-3">
            <img
              src={mebrekLogo}
              alt="Mebrek Farms Logo"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg"
            />

            <div>
              <h1 className="text-white font-bold tracking-[0.18em] text-lg">
                MEBREK FARMS
              </h1>

              <p className="text-[#dfc98f] text-[9px] uppercase tracking-[0.28em] mt-1">
                Quality • Care • Farming
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-white/70 text-xs tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#d8b76b]" />
            FARM MANAGEMENT PORTAL
          </div>
        </header>

        {/* MAIN SECTION */}

        <div className="flex-1 flex items-center px-5 sm:px-10 lg:px-16 py-10">
          <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_470px] gap-12 xl:gap-20 items-center">
            {/* LEFT INTRODUCTION */}

            <section className="text-white max-w-2xl pb-4">
              <div className="inline-flex items-center gap-3 border border-white/20 bg-white/[0.08] backdrop-blur-md rounded-full px-4 py-2 mb-8">
                <span className="w-2 h-2 rounded-full bg-[#d8b76b]" />

                <span className="text-[10px] sm:text-xs uppercase tracking-[0.24em] text-[#e8d7a9] font-semibold">
                  Welcome to Mebrek Farms
                </span>
              </div>

              <h2 className="text-5xl sm:text-6xl xl:text-7xl font-semibold leading-[1.08] tracking-tight">
                Rooted in
                <br />
                <span className="font-serif italic text-[#e2c477]">
                  nature.
                </span>
                <br />
                Driven by
                <br className="hidden sm:block" />
                excellence.
              </h2>

              <p className="text-white/75 text-base sm:text-lg leading-8 mt-7 max-w-lg">
                Every bird, every harvest and every operation matters. Manage
                your farm with clarity, consistency and confidence.
              </p>

              {/* BRAND VALUES */}

              <div className="flex flex-wrap gap-x-8 gap-y-5 mt-12">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-[#d8b76b]/50 flex items-center justify-center text-[#e2c477]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className="w-5 h-5"
                    >
                      <path
                        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Better Operations</p>
                    <p className="text-xs text-white/55 mt-1">
                      Organised daily management
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-[#d8b76b]/50 flex items-center justify-center text-[#e2c477]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className="w-5 h-5"
                    >
                      <path
                        d="M4 19V5m0 14h16M8 15v-4m4 4V7m4 8v-6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Better Decisions</p>
                    <p className="text-xs text-white/55 mt-1">
                      Production and performance
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* LOGIN CARD */}

            <section className="w-full max-w-[470px] mx-auto lg:ml-auto">
              <div className="bg-[#faf9f3] rounded-[28px] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
                {/* CARD HEADER */}

                <div className="px-7 sm:px-10 pt-9 pb-7">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <p className="text-[#a38647] text-[10px] uppercase tracking-[0.25em] font-bold">
                        Management Access
                      </p>

                      <h3 className="text-2xl font-semibold text-[#1c3c29] mt-2">
                        Sign in
                      </h3>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-[#e9eee4] flex items-center justify-center text-[#355e3e]">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        className="w-6 h-6"
                      >
                        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
                        <path
                          d="M9 12l2 2 4-4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 leading-6">
                    Enter your credentials to access the Mebrek Farms management
                    dashboard.
                  </p>
                </div>

                {/* GOLD LINE */}

                <div className="h-[3px] bg-gradient-to-r from-[#a9853d] via-[#e5cf91] to-[#a9853d]" />

                {/* FORM */}

                <div className="px-7 sm:px-10 py-8">
                  {error && (
                    <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* EMAIL */}

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-xs font-bold text-[#38513d] uppercase tracking-wider mb-2"
                      >
                        Email Address
                      </label>

                      <div className="relative">
                        <span className="absolute inset-y-0 left-4 flex items-center text-[#849381] pointer-events-none">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            className="w-5 h-5"
                          >
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <path d="m3 7 9 6 9-6" />
                          </svg>
                        </span>

                        <input
                          id="email"
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Enter your email"
                          autoComplete="username"
                          required
                          className="w-full h-14 rounded-xl border border-[#e4e7dc] bg-white pl-12 pr-4 text-sm text-[#1c3c29] placeholder:text-gray-400 outline-none transition-all focus:border-[#66866b] focus:ring-4 focus:ring-[#66866b]/10"
                        />
                      </div>
                    </div>

                    {/* PASSWORD */}

                    <div>
                      <label
                        htmlFor="password"
                        className="block text-xs font-bold text-[#38513d] uppercase tracking-wider mb-2"
                      >
                        Password
                      </label>

                      <div className="relative">
                        <span className="absolute inset-y-0 left-4 flex items-center text-[#849381] pointer-events-none">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            className="w-5 h-5"
                          >
                            <rect x="4" y="10" width="16" height="11" rx="2" />
                            <path d="M8 10V7a4 4 0 1 1 8 0v3" />
                          </svg>
                        </span>

                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          required
                          className="w-full h-14 rounded-xl border border-[#e4e7dc] bg-white pl-12 pr-14 text-sm text-[#1c3c29] placeholder:text-gray-400 outline-none transition-all focus:border-[#66866b] focus:ring-4 focus:ring-[#66866b]/10"
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          className="absolute inset-y-0 right-0 px-4 text-[#849381] hover:text-[#1c3c29] transition-colors"
                        >
                          {showPassword ? (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              className="w-5 h-5"
                            >
                              <path
                                d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11.4 11.4 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-3.1 3.8M6.2 6.2C4.1 7.6 3 12 3 12s3.5 7 9 7c1.1 0 2.1-.2 3-.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              className="w-5 h-5"
                            >
                              <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* SUBMIT */}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-14 mt-3 rounded-xl bg-[#1b452e] hover:bg-[#285b3b] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-3 shadow-lg shadow-[#1b452e]/15 transition-all duration-300 active:scale-[0.99]"
                    >
                      {loading ? (
                        <>
                          <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Enter Management Portal
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-5 h-5"
                          >
                            <path
                              d="M5 12h14m-6-6 6 6-6 6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>

                  {/* CARD FOOTER */}

                  <div className="mt-8 pt-6 border-t border-[#e8e8de] text-center">
                    <p className="text-[11px] text-gray-500">
                      <span className="font-semibold text-[#38513d]">
                        Authorised personnel only.
                      </span>{" "}
                      Your farm records are protected.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* BOTTOM FOOTER */}

        <footer className="px-6 sm:px-10 lg:px-16 py-5 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-white/50 tracking-wide">
          <span>
            © {new Date().getFullYear()} Mebrek Farms. All rights reserved.
          </span>

          <span>Growing with purpose. Managing with excellence.</span>
        </footer>
      </div>
    </main>
  );
}
