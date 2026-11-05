import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PageMotion from "./components/PageMotion";
import SEO from "./components/SEO";

import ProtectedRoute from "./routes/ProtectedRoute";

// ============================================================
// LAZY-LOADED PUBLIC PAGES
// ============================================================

const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Products = lazy(() => import("./pages/Products"));
const Contact = lazy(() => import("./pages/Contact"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));

// ============================================================
// LAZY-LOADED ADMIN PAGES
// ============================================================

const Notifications = lazy(() => import("./admin/Notifications"));
const Reports = lazy(() => import("./admin/Reports"));
const AdminLayout = lazy(() => import("./admin/AdminLayout"));
const Dashboard = lazy(() => import("./admin/Dashboard"));
const Orders = lazy(() => import("./admin/Orders"));
const Workers = lazy(() => import("./admin/Workers"));
const Production = lazy(() => import("./admin/Production"));
const FeedInventory = lazy(() => import("./admin/FeedInventory"));
const FeedInvoices = lazy(() => import("./admin/FeedInvoices"));
const Warehouse = lazy(() => import("./admin/Warehouse"));
const RoomInventory = lazy(() => import("./admin/RoomInventory"));
const Vaccinations = lazy(() => import("./admin/Vaccinations"));
const Mortality = lazy(() => import("./admin/Mortality"));
const BirdHealth = lazy(() => import("./admin/BirdHealth"));
const Medications = lazy(() => import("./admin/Medications"));
const Attendance = lazy(() => import("./admin/Attendance"));
const StaffAccounts = lazy(() => import("./admin/StaffAccounts"));
const Profile = lazy(() => import("./admin/Profile"));
const Backup = lazy(() => import("./admin/Backup"));
const BulkSMS = lazy(() => import("./admin/BulkSMS"));

// NEW: LOGIN ACTIVITY PAGE
const LoginActivity = lazy(() => import("./admin/LoginActivity"));

// ============================================================
// LAZY-LOADED SALES AND MANAGEMENT PAGES
// ============================================================

const EggSales = lazy(() => import("./pages/EggSales"));
const ManureSales = lazy(() => import("./pages/ManureSales"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Flocks = lazy(() => import("./pages/Flocks"));
const Customers = lazy(() => import("./pages/Customers"));

// ============================================================
// LOADING SCREEN
// ============================================================

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-green-100 border-t-green-800" />

        <p className="mt-4 text-sm font-medium text-stone-600">
          Loading Mebrek Farms...
        </p>
      </div>
    </div>
  );
}

// ============================================================
// PUBLIC WEBSITE LAYOUT
// ============================================================

function PublicLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-white" data-farm-motion-root>
      <SEO />
      <PageMotion />

      <Navbar />

      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}

// ============================================================
// ADMIN ROUTE ACCESS
// ============================================================

function AdminPage({ children, allowedRoles }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>
  );
}

// ============================================================
// APPLICATION
// ============================================================

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ==================================================
              PUBLIC WEBSITE
              ================================================== */}

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

          {/* Login and unauthorized pages */}
          <Route path="/login" element={<Login />} />

          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ==================================================
              ADMIN PANEL
              ================================================== */}

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            {/* ALL ROLES */}

            <Route index element={<Dashboard />} />

            <Route
              path="notifications"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <Notifications />
                </AdminPage>
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

            <Route path="customers" element={<Customers />} />

            {/* SUPERADMIN ONLY */}

            <Route
              path="workers"
              element={
                <AdminPage allowedRoles={["superadmin"]}>
                  <Workers />
                </AdminPage>
              }
            />

            <Route
              path="expenses"
              element={
                <AdminPage allowedRoles={["superadmin"]}>
                  <Expenses />
                </AdminPage>
              }
            />

            {/* MANAGER AND SUPERADMIN */}

            <Route
              path="egg-sales"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <EggSales />
                </AdminPage>
              }
            />

            <Route
              path="bulk-sms"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <BulkSMS />
                </AdminPage>
              }
            />

            <Route
              path="flocks"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <Flocks />
                </AdminPage>
              }
            />

            <Route
              path="manure-sales"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <ManureSales />
                </AdminPage>
              }
            />

            <Route
              path="reports"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <Reports />
                </AdminPage>
              }
            />

            <Route
              path="feeds"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <FeedInventory />
                </AdminPage>
              }
            />

            <Route
              path="feed-invoices"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <FeedInvoices />
                </AdminPage>
              }
            />

            <Route
              path="warehouse"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <Warehouse />
                </AdminPage>
              }
            />

            <Route
              path="room-inventory"
              element={
                <AdminPage allowedRoles={["superadmin", "manager"]}>
                  <RoomInventory />
                </AdminPage>
              }
            />

            {/* SUPERADMIN ONLY */}

            <Route
              path="staff"
              element={
                <AdminPage allowedRoles={["superadmin"]}>
                  <StaffAccounts />
                </AdminPage>
              }
            />

            <Route
              path="backup"
              element={
                <AdminPage allowedRoles={["superadmin"]}>
                  <Backup />
                </AdminPage>
              }
            />

            {/* LOGIN ACTIVITY - SUPERADMIN ONLY */}

            <Route
              path="login-activity"
              element={
                <AdminPage allowedRoles={["superadmin"]}>
                  <LoginActivity />
                </AdminPage>
              }
            />
          </Route>

          {/* ==================================================
              404 PAGE
              ================================================== */}

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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
