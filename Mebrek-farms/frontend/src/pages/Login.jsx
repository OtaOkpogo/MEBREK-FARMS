import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import logo from "../assets/logo.png";

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

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

      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
        min-h-screen
        grid
        md:grid-cols-2
        bg-gray-100
      "
    >
      {/* LEFT SIDE */}

      <div
        className="
          hidden
          md:flex
          flex-col
          justify-center
          items-center
          bg-gradient-to-br
          from-green-700
          to-green-900
          text-white
          p-12
        "
      >
        <img
          src={logo}
          alt="Mebrek Logo"
          className="
            w-40
            h-40
            object-contain
            bg-white
            rounded-full
            p-4
            shadow-2xl
            mb-8
          "
        />

        <h1 className="text-5xl font-bold mb-4">Mebrek Farms</h1>

        <p className="text-xl text-green-100 text-center max-w-md">
          Smart Farm Management System for livestock, production, inventory,
          analytics, and operations.
        </p>
      </div>

      {/* RIGHT SIDE */}

      <div
        className="
          flex
          justify-center
          items-center
          p-6
          bg-gray-100
        "
      >
        <div
          className="
            w-full
            max-w-md
            bg-white/90
            backdrop-blur-lg
            rounded-3xl
            shadow-2xl
            p-10
          "
        >
          {/* MOBILE LOGO */}

          <div className="md:hidden text-center mb-6">
            <img
              src={logo}
              alt="Logo"
              className="
                w-24
                mx-auto
                mb-4
                bg-white
                rounded-full
                p-2
                shadow
              "
            />

            <h1 className="text-3xl font-bold text-green-700">Mebrek Farms</h1>
          </div>

          {/* HEADER */}

          <div className="mb-8 text-center">
            <h2
              className="
                text-4xl
                font-bold
                text-green-700
                mb-2
              "
            >
              Welcome Back 👋
            </h2>

            <p className="text-gray-500">
              Login to continue to the admin dashboard
            </p>
          </div>

          {/* ERROR */}

          {error && (
            <div
              className="
                bg-red-100
                text-red-600
                p-3
                rounded-lg
                mb-6
                text-sm
              "
            >
              {error}
            </div>
          )}

          {/* FORM */}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* EMAIL */}

            <div>
              <label
                className="
                  block
                  mb-2
                  font-medium
                  text-gray-700
                "
              >
                Email Address
              </label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                className="
                  w-full
                  border
                  border-gray-300
                  p-4
                  rounded-xl
                  focus:outline-none
                  focus:ring-2
                  focus:ring-green-600
                "
                required
              />
            </div>

            {/* PASSWORD */}

            <div>
              <label
                className="
                  block
                  mb-2
                  font-medium
                  text-gray-700
                "
              >
                Password
              </label>

              <input
                type="password"
                name="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                className="
                  w-full
                  border
                  border-gray-300
                  p-4
                  rounded-xl
                  focus:outline-none
                  focus:ring-2
                  focus:ring-green-600
                "
                required
              />
            </div>

            {/* BUTTON */}

            <button
              type="submit"
              disabled={loading}
              className="
                w-full
                bg-green-700
                hover:bg-green-800
                text-white
                py-4
                rounded-xl
                font-semibold
                text-lg
                transition
                shadow-lg
              "
            >
              {loading ? "Logging in..." : "Login to Dashboard"}
            </button>
          </form>

          {/* FOOTER */}

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate("/")}
              className="
                text-green-700
                hover:underline
                font-medium
              "
            >
              ← Back to Farm Website
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
