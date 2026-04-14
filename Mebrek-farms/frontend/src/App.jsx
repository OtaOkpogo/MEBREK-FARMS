import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import About from "./pages/About";
import Products from "./pages/Products";
import Contact from "./pages/Contact";

import ProtectedRoute from "./routes/ProtectedRoute";

import AdminLayout from "./admin/AdminLayout";
import Dashboard from "./admin/Dashboard";
import Orders from "./admin/Orders";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ================= PUBLIC ROUTES ================= */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/contact" element={<Contact />} />

        {/* ================= PROTECTED ADMIN ROUTES ================= */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* /admin */}
          <Route index element={<Dashboard />} />

          {/* /admin/orders */}
          <Route path="orders" element={<Orders />} />
        </Route>

        {/* ================= FALLBACK ================= */}
        <Route
          path="*"
          element={
            <div className="flex items-center justify-center h-screen text-xl">
              404 - Page Not Found
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
