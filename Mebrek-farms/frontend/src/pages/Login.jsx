import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import mebrekLogo from "../assets/logo.PNG";

import { API_URL, focusRing, FarmStyles, usePageMeta } from "./farmShared";

const farmFeatures = [
  {
    number: "01",
    title: "Poultry Management",
    description: "Monitor flocks, bird health and farm activities.",
  },
  {
    number: "02",
    title: "Egg Production",
    description: "Record and monitor daily egg production.",
  },
  {
    number: "03",
    title: "Inventory Management",
    description: "Manage feed, medication and farm supplies.",
  },
  {
    number: "04",
    title: "Farm Reports",
    description: "Track performance and review farm operations.",
  },
];

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  usePageMeta({
    title: "Admin Login | Mebrek Farms",
    description: "Access the Mebrek Farms management dashboard.",
    noindex: true,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, formData);

      const { token, admin } = res.data;

      if (!token || !admin) {
        throw new Error("Invalid login response. Please try again.");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("role", admin.role);
      localStorage.setItem("adminName", admin.name);
      localStorage.setItem("user", JSON.stringify(admin));

      navigate("/admin");
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to sign in. Please check your email and password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mf-root min-h-screen bg-[#F3F5EF] text-[#183D2C]">
      <FarmStyles />

      {/* TOP HEADER */}
      <header className="border-b border-[#DCE4D9] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={mebrekLogo}
              alt="Mebrek Farms"
              className="h-14 w-14 rounded-lg object-contain"
            />

            <div>
              <h1 className="text-xl font-black tracking-wide text-[#17482F]">
                MEBREK FARMS
              </h1>
              <p className="text-xs font-semibold tracking-wider text-gray-500">
                FARM MANAGEMENT PORTAL
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className={`inline-flex items-center gap-2 rounded-lg border-2 border-[#205B3B] bg-white px-4 py-3 text-sm font-bold text-[#205B3B] hover:bg-[#205B3B] hover:text-white sm:px-6 ${focusRing}`}
          >
            <span aria-hidden="true">←</span>
            <span>Back to Website</span>
          </Link>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:min-h-[calc(100vh-85px)] lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:py-12">
        {/* LEFT INFORMATION PANEL */}
        <section className="overflow-hidden rounded-2xl bg-[#164A32] text-white shadow-xl">
          <div className="p-7 sm:p-10 lg:p-12">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F5C84C]" />
              <span className="text-xs font-bold uppercase tracking-widest text-white">
                Integrated Farm Operations
              </span>
            </div>

            <h2 className="max-w-xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Smarter Farm
              <span className="block text-[#F5CE62]">Management.</span>
              Better Results.
            </h2>

            <p className="mt-6 max-w-xl text-base leading-8 text-green-50 sm:text-lg">
              Welcome to the Mebrek Farms Management System. Your central
              platform for managing poultry operations, monitoring production,
              controlling inventory and keeping farm activities organised.
            </p>

            <div className="mt-10 border-t border-white/20 pt-8">
              <h3 className="mb-6 text-sm font-extrabold uppercase tracking-widest text-[#F5CE62]">
                Manage Your Farm With Confidence
              </h3>

              <div className="grid gap-5 sm:grid-cols-2">
                {farmFeatures.map((feature) => (
                  <div key={feature.number} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5CE62] text-sm font-black text-[#17482F]">
                      {feature.number}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white sm:text-base">
                        {feature.title}
                      </h4>

                      <p className="mt-1 text-sm leading-6 text-green-100">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/20 bg-[#103C28] px-7 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <p className="text-sm font-semibold text-white">
              Fresh Eggs. Quality Poultry Farming.
            </p>

            <p className="text-xs text-green-100">Mebrek Farms Management</p>
          </div>
        </section>

        {/* RIGHT LOGIN PANEL */}
        <section className="mx-auto w-full max-w-lg">
          <div className="rounded-2xl border border-[#DCE4D9] bg-white p-7 shadow-xl sm:p-10">
            {/* FORM HEADING */}
            <div className="mb-8">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-xl border border-[#DCE7D9] bg-[#F1F5ED] p-2">
                <img
                  src={mebrekLogo}
                  alt="Mebrek Farms Logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <p className="text-sm font-extrabold uppercase tracking-widest text-[#668348]">
                Administrator Login
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#183D2C] sm:text-4xl">
                Welcome Back
              </h2>

              <p className="mt-3 text-sm leading-7 text-gray-600">
                Sign in to continue to your farm management dashboard. Enter
                your registered email and password below.
              </p>
            </div>

            {/* LOGIN FORM */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-bold text-[#263D30]"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  autoComplete="username"
                  disabled={loading}
                  required
                  className="w-full rounded-xl border-2 border-[#C8D2C6] bg-[#FAFCF9] px-4 py-4 text-base text-[#183D2C] outline-none placeholder:text-gray-400 focus:border-[#205B3B] focus:ring-4 focus:ring-[#205B3B]/10 disabled:opacity-60"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold text-[#263D30]"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                    className="w-full rounded-xl border-2 border-[#C8D2C6] bg-[#FAFCF9] px-4 py-4 pr-20 text-base text-[#183D2C] outline-none placeholder:text-gray-400 focus:border-[#205B3B] focus:ring-4 focus:ring-[#205B3B]/10 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-[#E9F0E5] px-3 py-2 text-sm font-bold text-[#205B3B] hover:bg-[#DCE8D6] ${focusRing}`}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700"
                >
                  <p className="font-extrabold">Login Failed</p>
                  <p className="mt-1">{error}</p>
                </div>
              )}

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded-xl bg-[#205B3B] px-5 py-4 text-base font-extrabold text-white shadow-md hover:bg-[#17452E] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
              >
                {loading ? "Signing In..." : "SIGN IN TO DASHBOARD"}
              </button>
            </form>

            {/* SECURITY MESSAGE */}
            <div className="mt-8 rounded-xl border border-[#DCE7D9] bg-[#F3F7F0] p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl" aria-hidden="true">
                  🔒
                </span>

                <div>
                  <h3 className="text-sm font-extrabold text-[#205B3B]">
                    Secure Administrator Access
                  </h3>

                  <p className="mt-1 text-xs leading-6 text-gray-600">
                    This portal is restricted to authorised Mebrek Farms
                    personnel. Please keep your login credentials private.
                  </p>
                </div>
              </div>
            </div>

            {/* BACK TO WEBSITE */}
            <Link
              to="/"
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#205B3B] bg-white px-5 py-3.5 text-sm font-extrabold text-[#205B3B] hover:bg-[#EEF4EA] ${focusRing}`}
            >
              <span aria-hidden="true">←</span>
              Return to Mebrek Farms Website
            </Link>

            <div className="mt-7 border-t border-gray-200 pt-5 text-center">
              <p className="text-xs font-medium text-gray-500">
                © {new Date().getFullYear()} Mebrek Farms. All rights reserved.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
