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
import Workers from "./admin/Workers";
import Production from "./admin/Production";
import FeedInventory from "./admin/FeedInventory";
import FeedInvoices from "./admin/FeedInvoices";
import Warehouse from "./admin/Warehouse";
import Vaccinations from "./admin/Vaccinations";
import Mortality from "./admin/Mortality";
import BirdHealth from "./admin/BirdHealth";
import Medications from "./admin/Medications";
import Unauthorized from "./pages/Unauthorized";

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

        {/* ADMIN ROUTES */}

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route path="orders" element={<Orders />} />

          <Route
            path="workers"
            element={
              localStorage.getItem("role") === "superadmin" ? (
                <Workers />
              ) : (
                <Unauthorized />
              )
            }
          />

          <Route path="production" element={<Production />} />

          <Route path="feeds" element={<FeedInventory />} />

          <Route path="feed-invoices" element={<FeedInvoices />} />

          <Route path="warehouse" element={<Warehouse />} />

          <Route path="vaccinations" element={<Vaccinations />} />

          <Route path="bird-health" element={<BirdHealth />} />

          <Route path="medications" element={<Medications />} />

          <Route path="mortality" element={<Mortality />} />
        </Route>

        {/* 404 */}

        <Route
          path="*"
          element={
            <div className="flex items-center justify-center h-screen">
              404 - Page Not Found
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
