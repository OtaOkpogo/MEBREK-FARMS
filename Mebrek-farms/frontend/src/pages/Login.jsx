import { useState } from "react";

import { useNavigate } from "react-router-dom";

import axios from "axios";

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

      localStorage.setItem("role", res.data.role);

      localStorage.setItem("adminName", res.data.name);

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
        flex
        items-center
        justify-center
        bg-gradient-to-br
        from-green-700
        to-green-900
        p-6
      "
    >
      <div
        className="
          bg-white
          rounded-3xl
          shadow-2xl
          w-full
          max-w-md
          p-10
        "
      >
        <div className="text-center mb-8">
          <h1
            className="
              text-4xl
              font-bold
              text-green-700
              mb-2
            "
          >
            Mebrek Farms
          </h1>

          <p className="text-gray-500">Farm Management System</p>
        </div>

        {error && (
          <div
            className="
              bg-red-100
              text-red-600
              p-3
              rounded-lg
              mb-5
            "
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              className="
                block
                mb-2
                font-medium
              "
            >
              Email
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email"
              className="
                w-full
                border
                p-4
                rounded-xl
                focus:outline-none
                focus:ring-2
                focus:ring-green-600
              "
              required
            />
          </div>

          <div>
            <label
              className="
                block
                mb-2
                font-medium
              "
            >
              Password
            </label>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              className="
                w-full
                border
                p-4
                rounded-xl
                focus:outline-none
                focus:ring-2
                focus:ring-green-600
              "
              required
            />
          </div>

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
              transition
            "
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
