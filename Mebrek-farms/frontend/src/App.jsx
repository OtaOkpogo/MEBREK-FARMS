import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import About from "./pages/About";
import Products from "./pages/Products";
import Contact from "./pages/Contact";
import Unauthorized from "./pages/Unauthorized";

import ProtectedRoute from "./routes/ProtectedRoute";

import AdminLayout from "./admin/AdminLayout";
import Dashboard from "./admin/Dashboard";
import Orders from "./admin/Orders";
import Workers from "./admin/Workers";
import Production from "./admin/Production";
import FeedInventory from "./admin/FeedInventory";
import FeedInvoices from "./admin/FeedInvoices";
import Warehouse from "./admin/Warehouse";
import Vaccinations from "./admin/Vaccinations";
import Mortality from "./admin/Mortality";
import BirdHealth from "./admin/BirdHealth";
import Medications from "./admin/Medications";
import Attendance from "./admin/Attendance";
import Expenses from "./pages/Expenses";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* ADMIN PANEL */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* BOTH ADMIN & STAFF */}
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="production" element={<Production />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="vaccinations" element={<Vaccinations />} />
          <Route path="bird-health" element={<BirdHealth />} />
          <Route path="medications" element={<Medications />} />
          <Route path="mortality" element={<Mortality />} />

          {/* ADMIN ONLY */}
          <Route
            path="workers"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Workers />
              </ProtectedRoute>
            }
          />

          <Route
            path="expenses"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Expenses />
              </ProtectedRoute>
            }
          />

          <Route
            path="feeds"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <FeedInventory />
              </ProtectedRoute>
            }
          />

          <Route
            path="feed-invoices"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <FeedInvoices />
              </ProtectedRoute>
            }
          />

          <Route
            path="warehouse"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Warehouse />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="flex items-center justify-center h-screen text-3xl font-bold">
              404 - Page Not Found
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
