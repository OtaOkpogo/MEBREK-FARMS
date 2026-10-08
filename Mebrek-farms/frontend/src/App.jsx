import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Login from "./pages/Login";
import Home from "./pages/Home";
import About from "./pages/About";
import Products from "./pages/Products";
import Contact from "./pages/Contact";
import Unauthorized from "./pages/Unauthorized";

import Notifications from "./admin/Notifications";
import ProtectedRoute from "./routes/ProtectedRoute";
import EggSales from "./pages/EggSales";
import ManureSales from "./pages/ManureSales";
import Reports from "./admin/Reports";

import AdminLayout from "./admin/AdminLayout";
import Dashboard from "./admin/Dashboard";
import Orders from "./admin/Orders";
import Workers from "./admin/Workers";
import Production from "./admin/Production";
import FeedInventory from "./admin/FeedInventory";
import FeedInvoices from "./admin/FeedInvoices";
import Warehouse from "./admin/Warehouse";
import RoomInventory from "./admin/RoomInventory";
import Vaccinations from "./admin/Vaccinations";
import Mortality from "./admin/Mortality";
import BirdHealth from "./admin/BirdHealth";
import Medications from "./admin/Medications";
import Attendance from "./admin/Attendance";
import StaffAccounts from "./admin/StaffAccounts";
import Profile from "./admin/Profile";
import Backup from "./admin/Backup";

import Expenses from "./pages/Expenses";
import Flocks from "./pages/Flocks";

/* =========================================================
   PUBLIC WEBSITE LAYOUT
   ========================================================= */

function PublicLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}

/* =========================================================
   APP
   ========================================================= */

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =====================================================
            PUBLIC WEBSITE
            ===================================================== */}

        <Route
          path="/"
          element={
            <PublicLayout>
              <Home />
            </PublicLayout>
          }
        />

        <Route
          path="/about"
          element={
            <PublicLayout>
              <About />
            </PublicLayout>
          }
        />

        <Route
          path="/products"
          element={
            <PublicLayout>
              <Products />
            </PublicLayout>
          }
        />

        <Route
          path="/contact"
          element={
            <PublicLayout>
              <Contact />
            </PublicLayout>
          }
        />

        {/* Login stays separate from the public website navigation */}
        <Route path="/login" element={<Login />} />

        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* =====================================================
            ADMIN PANEL
            ===================================================== */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* ===================================================
              ALL ROLES
              =================================================== */}

          <Route index element={<Dashboard />} />

          <Route
            path="notifications"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager", "staff"]}>
                <Notifications />
              </ProtectedRoute>
            }
          />

          <Route path="orders" element={<Orders />} />

          <Route path="production" element={<Production />} />

          <Route path="attendance" element={<Attendance />} />

          <Route path="vaccinations" element={<Vaccinations />} />

          <Route path="bird-health" element={<BirdHealth />} />

          <Route path="medications" element={<Medications />} />

          <Route path="mortality" element={<Mortality />} />

          <Route path="profile" element={<Profile />} />

          {/* ===================================================
              SUPERADMIN ONLY
              =================================================== */}

          <Route
            path="workers"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <Workers />
              </ProtectedRoute>
            }
          />

          <Route
            path="expenses"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <Expenses />
              </ProtectedRoute>
            }
          />

          {/* ===================================================
              MANAGER + SUPERADMIN
              =================================================== */}

          <Route
            path="egg-sales"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <EggSales />
              </ProtectedRoute>
            }
          />

          <Route
            path="flocks"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <Flocks />
              </ProtectedRoute>
            }
          />

          <Route
            path="manure-sales"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <ManureSales />
              </ProtectedRoute>
            }
          />

          <Route
            path="reports"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <Reports />
              </ProtectedRoute>
            }
          />

          <Route
            path="feeds"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <FeedInventory />
              </ProtectedRoute>
            }
          />

          <Route
            path="feed-invoices"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <FeedInvoices />
              </ProtectedRoute>
            }
          />

          <Route
            path="warehouse"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <Warehouse />
              </ProtectedRoute>
            }
          />

          <Route
            path="room-inventory"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <RoomInventory />
              </ProtectedRoute>
            }
          />

          {/* ===================================================
              SUPERADMIN ONLY
              =================================================== */}

          <Route
            path="staff"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <StaffAccounts />
              </ProtectedRoute>
            }
          />

          <Route
            path="backup"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <Backup />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* =====================================================
            404
            ===================================================== */}

        <Route
          path="*"
          element={
            <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-center">
              <div>
                <p className="text-7xl font-black text-green-900">404</p>

                <h1 className="mt-4 text-3xl font-extrabold text-stone-900">
                  Page Not Found
                </h1>

                <p className="mt-3 text-stone-600">
                  The page you are looking for does not exist.
                </p>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
