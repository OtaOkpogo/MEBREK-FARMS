import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import About from "./pages/About";
import Products from "./pages/Products";
import Contact from "./pages/Contact";
import Unauthorized from "./pages/Unauthorized";
import Notifications from "./admin/Notifications";
import ProtectedRoute from "./routes/ProtectedRoute";
import EggSales from "./pages/EggSales";
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

function App() {
  return (
    <BrowserRouter>
      {" "}
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
          <Route
            path="notifications"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager", "staff"]}>
                <Notifications />
              </ProtectedRoute>
            }
          />
          {/* ALL ROLES */}
          <Route index element={<Dashboard />} />

          <Route path="orders" element={<Orders />} />

          <Route path="production" element={<Production />} />

          <Route path="attendance" element={<Attendance />} />

          <Route path="vaccinations" element={<Vaccinations />} />

          <Route path="bird-health" element={<BirdHealth />} />

          <Route path="medications" element={<Medications />} />

          <Route path="mortality" element={<Mortality />} />

          <Route path="profile" element={<Profile />} />

          {/* MANAGER + SUPERADMIN */}
          <Route
            path="workers"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <Workers />
              </ProtectedRoute>
            }
          />

          <Route
            path="expenses"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <Expenses />
              </ProtectedRoute>
            }
          />

          <Route
            path="egg-sales"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "manager"]}>
                <EggSales />
              </ProtectedRoute>
            }
          />

          <Route
            path="reports"
            element={
              <ProtectedRoute>
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

          {/* SUPERADMIN ONLY */}
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
