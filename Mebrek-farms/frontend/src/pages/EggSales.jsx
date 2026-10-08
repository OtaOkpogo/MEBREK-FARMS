import { useEffect, useMemo, useState } from "react";
import InvoiceModal from "../components/InvoiceModal";

import {
  fetchSales,
  createSale,
  updateSale,
  deleteSale,
  restoreSale,
  fetchCustomerSales,
} from "../services/eggSalesService";

import { fetchCustomers, createCustomer } from "../services/customerService";

import { getCurrentUser } from "../services/authService";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// =====================================================
// EGG CATEGORY PRICES
// =====================================================
// IMPORTANT:
// These values MUST match EGG_CATEGORY_PRICES in
// backend/models/EggSale.js.

const EGG_CATEGORY_PRICES = {
  big: 5100,
  jumbo: 5800,
  turkey: 6000,
  normal: 5000,
  small: 4000,
};

const EGG_CATEGORY_LABELS = {
  big: "Big",
  jumbo: "Jumbo",
  turkey: "Turkey Egg",
  normal: "Normal",
  small: "Small",
};

const emptyLineItem = () => ({
  category: "big",
  cratesSold: "",
  looseEggs: "",
});

const emptyCustomer = {
  name: "",
  phone: "",
  email: "",
  address: "",
  customerType: "Individual",
  notes: "",
};

export default function EggSales() {
  // =====================================================
  // STATE
  // =====================================================

  const [sales, setSales] = useState([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [selectedSale, setSelectedSale] = useState(null);

  const [showInvoice, setShowInvoice] = useState(false);

  const [statusFilter, setStatusFilter] = useState("All");

  const [user, setUser] = useState(null);

  // =====================================================
  // SALE FORM
  // =====================================================

  const [formData, setFormData] = useState({
    customerId: "",
    customer: "",
    phone: "",
    date: "",
    discount: "",
    transportCharge: "",
    amountPaid: "",
    paymentMethod: "Cash",
    remarks: "",
  });

  // One row per egg category.
  const [lineItems, setLineItems] = useState([emptyLineItem()]);

  // Non-null while editing.
  const [editingId, setEditingId] = useState(null);

  const [saving, setSaving] = useState(false);

  // =====================================================
  // CUSTOMER STATE
  // =====================================================

  const [customers, setCustomers] = useState([]);

  const [customerSearch, setCustomerSearch] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [customerLoading, setCustomerLoading] = useState(false);

  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);

  const [newCustomer, setNewCustomer] = useState(emptyCustomer);

  const [savingCustomer, setSavingCustomer] = useState(false);

  // =====================================================
  // CUSTOMER HISTORY
  // =====================================================

  const [customerHistory, setCustomerHistory] = useState(null);

  const [historyLoading, setHistoryLoading] = useState(false);

  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {
    loadUser();
    loadSales();
    loadCustomers();
  }, []);

  const loadUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser(data);
    } catch (err) {
      console.error("LOAD CURRENT USER ERROR:", err);
    }
  };

  const loadSales = async () => {
    try {
      setLoading(true);

      const response = await fetchSales();

      let list = [];

      if (Array.isArray(response)) {
        list = response;
      } else if (Array.isArray(response?.sales)) {
        list = response.sales;
      } else if (Array.isArray(response?.data)) {
        list = response.data;
      } else if (Array.isArray(response?.data?.sales)) {
        list = response.data.sales;
      }

      setSales(list);
    } catch (err) {
      console.error("LOAD SALES ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      setCustomerLoading(true);

      const response = await fetchCustomers();

      let list = [];

      if (Array.isArray(response)) {
        list = response;
      } else if (Array.isArray(response?.customers)) {
        list = response.customers;
      } else if (Array.isArray(response?.data)) {
        list = response.data;
      } else if (Array.isArray(response?.data?.customers)) {
        list = response.data.customers;
      }

      setCustomers(
        list.filter(
          (customer) =>
            customer.isActive !== false && customer.isDeleted !== true,
        ),
      );
    } catch (err) {
      console.error("LOAD CUSTOMERS ERROR:", err);
    } finally {
      setCustomerLoading(false);
    }
  };

  // =====================================================
  // SALE FORM CHANGE
  // =====================================================

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // =====================================================
  // CUSTOMER SEARCH
  // =====================================================

  const filteredCustomerOptions = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();

    if (!query) {
      return customers.slice(0, 10);
    }

    return customers
      .filter((customer) => {
        return (
          customer.name?.toLowerCase().includes(query) ||
          customer.phone?.toLowerCase().includes(query) ||
          customer.email?.toLowerCase().includes(query)
        );
      })
      .slice(0, 10);
  }, [customers, customerSearch]);

  // =====================================================
  // SELECT CUSTOMER
  // =====================================================

  const selectCustomer = async (customer) => {
    setSelectedCustomer(customer);

    setCustomerSearch(customer.name || "");

    setShowCustomerDropdown(false);

    setFormData((previous) => ({
      ...previous,
      customerId: customer._id || "",
      customer: customer.name || "",
      phone: customer.phone || "",
    }));

    if (customer._id) {
      await loadCustomerHistory(customer._id);
    }
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);

    setCustomerSearch("");

    setCustomerHistory(null);

    setFormData((previous) => ({
      ...previous,
      customerId: "",
      customer: "",
      phone: "",
    }));
  };

  // =====================================================
  // CUSTOMER HISTORY
  // =====================================================

  const loadCustomerHistory = async (customerId) => {
    if (!customerId) {
      setCustomerHistory(null);
      return;
    }

    try {
      setHistoryLoading(true);

      const response = await fetchCustomerSales(customerId);

      setCustomerHistory(response || null);
    } catch (err) {
      console.error("LOAD CUSTOMER HISTORY ERROR:", err);

      setCustomerHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  // =====================================================
  // CUSTOMER INPUT
  // =====================================================

  const handleCustomerSearchChange = (e) => {
    const value = e.target.value;

    setCustomerSearch(value);

    setShowCustomerDropdown(true);

    // If the user changes the selected
    // customer text, remove the old link.
    if (selectedCustomer && value !== selectedCustomer.name) {
      setSelectedCustomer(null);

      setCustomerHistory(null);

      setFormData((previous) => ({
        ...previous,
        customerId: "",
        customer: value,
      }));
    } else {
      setFormData((previous) => ({
        ...previous,
        customer: value,
      }));
    }
  };

  // =====================================================
  // QUICK ADD CUSTOMER
  // =====================================================

  const handleNewCustomerChange = (e) => {
    setNewCustomer((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  };

  const handleQuickAddCustomer = async (e) => {
    e.preventDefault();

    if (!newCustomer.name.trim()) {
      alert("Customer name is required.");
      return;
    }

    try {
      setSavingCustomer(true);

      const response = await createCustomer(newCustomer);

      const created =
        response?.customer ||
        response?.data?.customer ||
        response?.data ||
        response;

      if (!created?._id) {
        throw new Error(
          "Customer was saved but no customer record was returned.",
        );
      }

      setCustomers((previous) => {
        const exists = previous.some((item) => item._id === created._id);

        if (exists) {
          return previous;
        }

        return [...previous, created].sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );
      });

      await selectCustomer(created);

      setNewCustomer(emptyCustomer);

      setShowQuickAddCustomer(false);

      alert("Customer added successfully.");
    } catch (err) {
      console.error("QUICK ADD CUSTOMER ERROR:", err);

      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to add customer.",
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  // =====================================================
  // LINE ITEM HANDLING
  // =====================================================

  const handleLineItemChange = (index, field, value) => {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const addLineItemRow = () => {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  };

  const removeLineItemRow = (index) => {
    setLineItems((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  };

  // =====================================================
  // LIVE CALCULATIONS
  // =====================================================

  const lineItemsWithSubtotal = useMemo(() => {
    return lineItems.map((item) => {
      const cratePrice = EGG_CATEGORY_PRICES[item.category] || 0;

      const eggPrice = Math.round(cratePrice / 30);

      const cratesSold = Number(item.cratesSold || 0);

      const looseEggs = Number(item.looseEggs || 0);

      const subtotal = cratesSold * cratePrice + looseEggs * eggPrice;

      return {
        ...item,
        cratePrice,
        eggPrice,
        cratesSold,
        looseEggs,
        subtotal,
      };
    });
  }, [lineItems]);

  const itemsTotal = lineItemsWithSubtotal.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );

  const grandTotal =
    itemsTotal +
    Number(formData.transportCharge || 0) -
    Number(formData.discount || 0);

  const balance = grandTotal - Number(formData.amountPaid || 0);

  const paymentStatus =
    balance <= 0 && grandTotal > 0
      ? "Paid"
      : Number(formData.amountPaid) > 0
        ? "Part Paid"
        : "Unpaid";

  // =====================================================
  // EDIT MODE
  // =====================================================

  const startEdit = async (sale) => {
    setEditingId(sale._id);

    setFormData({
      customerId: sale.customerId?._id || sale.customerId || "",
      customer: sale.customer || "",
      phone: sale.phone || "",
      date: sale.date ? new Date(sale.date).toISOString().slice(0, 10) : "",
      discount: sale.discount ?? "",
      transportCharge: sale.transportCharge ?? "",
      amountPaid: sale.amountPaid ?? "",
      paymentMethod: sale.paymentMethod || "Cash",
      remarks: sale.remarks || "",
    });

    // -------------------------------------------------
    // Restore linked customer
    // -------------------------------------------------

    if (sale.customerId) {
      let customer =
        typeof sale.customerId === "object" ? sale.customerId : null;

      if (!customer && sale.customerId) {
        customer =
          customers.find((item) => item._id === sale.customerId) || null;
      }

      if (customer) {
        setSelectedCustomer(customer);

        setCustomerSearch(customer.name || "");

        await loadCustomerHistory(customer._id);
      } else {
        setSelectedCustomer(null);

        setCustomerSearch(sale.customer || "");

        setCustomerHistory(null);
      }
    } else {
      // Legacy sale without customerId.
      setSelectedCustomer(null);

      setCustomerSearch(sale.customer || "");

      setCustomerHistory(null);
    }

    setLineItems(
      (sale.lineItems || []).length
        ? sale.lineItems.map((item) => ({
            category: item.category,
            cratesSold: item.cratesSold ?? "",
            looseEggs: item.looseEggs ?? "",
          }))
        : [emptyLineItem()],
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);

    setSelectedCustomer(null);

    setCustomerSearch("");

    setCustomerHistory(null);

    setFormData({
      customerId: "",
      customer: "",
      phone: "",
      date: "",
      discount: "",
      transportCharge: "",
      amountPaid: "",
      paymentMethod: "Cash",
      remarks: "",
    });

    setLineItems([emptyLineItem()]);
  };

  // =====================================================
  // SAVE SALE
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validLineItems = lineItemsWithSubtotal.filter(
      (item) => item.cratesSold > 0 || item.looseEggs > 0,
    );

    if (validLineItems.length === 0) {
      alert("Add at least one egg category with a quantity.");
      return;
    }

    if (!formData.customer.trim()) {
      alert("Enter or select a customer.");
      return;
    }

    const payload = {
      ...formData,

      // Important:
      // customerId is blank for old/manual customers,
      // but present for registered customers.
      customerId: formData.customerId || undefined,

      lineItems: validLineItems.map((item) => ({
        category: item.category,
        cratesSold: item.cratesSold,
        looseEggs: item.looseEggs,
      })),

      discount: Number(formData.discount || 0),

      transportCharge: Number(formData.transportCharge || 0),

      amountPaid: Number(formData.amountPaid || 0),
    };

    setSaving(true);

    try {
      if (editingId) {
        await updateSale(editingId, payload);

        alert("Sale updated successfully.");

        setEditingId(null);
      } else {
        await createSale(payload);

        alert("Sale recorded successfully.");
      }

      setSelectedCustomer(null);

      setCustomerSearch("");

      setCustomerHistory(null);

      setFormData({
        customerId: "",
        customer: "",
        phone: "",
        date: "",
        discount: "",
        transportCharge: "",
        amountPaid: "",
        paymentMethod: "Cash",
        remarks: "",
      });

      setLineItems([emptyLineItem()]);

      await loadSales();
    } catch (err) {
      console.error("SAVE SALE ERROR:", err);

      alert(
        err?.response?.data?.message ||
          err?.message ||
          `Unable to ${editingId ? "update" : "save"} sale.`,
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (id) => {
    if (!window.confirm("Delete sale?")) {
      return;
    }

    try {
      await deleteSale(id);

      if (editingId === id) {
        cancelEdit();
      }

      await loadSales();
    } catch (err) {
      console.error("DELETE SALE ERROR:", err);

      alert(err?.response?.data?.message || "Unable to delete sale.");
    }
  };

  // =====================================================
  // RESTORE
  // =====================================================

  const handleRestore = async (id) => {
    try {
      await restoreSale(id);

      await loadSales();
    } catch (err) {
      console.error("RESTORE SALE ERROR:", err);

      alert(err?.response?.data?.message || "Unable to restore sale.");
    }
  };

  // =====================================================
  // INVOICE
  // =====================================================

  const openInvoice = (sale) => {
    setSelectedSale(sale);
    setShowInvoice(true);
  };

  const closeInvoice = () => {
    setShowInvoice(false);
    setSelectedSale(null);
  };

  // =====================================================
  // FILTERED SALES
  // =====================================================

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const query = search.toLowerCase().trim();

      const customer = sale.customer?.toLowerCase().includes(query);

      const phone = sale.phone?.toLowerCase().includes(query);

      const invoice = sale.invoiceNumber?.toLowerCase().includes(query);

      const matchesSearch = !query || customer || phone || invoice;

      const matchesStatus =
        statusFilter === "All" ? true : sale.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sales, search, statusFilter]);

  // =====================================================
  // ACTIVE SALES
  // =====================================================

  const activeSales = useMemo(
    () => filteredSales.filter((sale) => !sale.isDeleted),
    [filteredSales],
  );

  // =====================================================
  // LINE ITEM HELPER
  // =====================================================

  const sumLineItemField = (sale, field) =>
    (sale.lineItems || []).reduce(
      (sum, item) => sum + Number(item[field] || 0),
      0,
    );

  // =====================================================
  // KPI CARDS
  // =====================================================

  const totalRevenue = activeSales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount || 0),
    0,
  );

  const amountReceived = activeSales.reduce(
    (sum, sale) => sum + Number(sale.amountPaid || 0),
    0,
  );

  const outstanding = activeSales.reduce(
    (sum, sale) => sum + Number(sale.balance || 0),
    0,
  );

  const totalCrates = activeSales.reduce(
    (sum, sale) => sum + sumLineItemField(sale, "cratesSold"),
    0,
  );

  const uniqueCustomerCount = new Set(
    activeSales.map(
      (sale) =>
        sale.customerId?._id ||
        sale.customerId ||
        `${sale.customer || ""}|${sale.phone || ""}`,
    ),
  ).size;

  // =====================================================
  // PAYMENT CHART
  // =====================================================

  const paymentChart = [
    {
      name: "Paid",
      value: activeSales.filter((x) => x.status === "Paid").length,
    },
    {
      name: "Part Paid",
      value: activeSales.filter((x) => x.status === "Part Paid").length,
    },
    {
      name: "Unpaid",
      value: activeSales.filter((x) => x.status === "Unpaid").length,
    },
  ];

  const COLORS = ["#16a34a", "#f59e0b", "#dc2626"];

  // =====================================================
  // DAILY / WEEKLY / MONTHLY SALES
  // =====================================================

  const toUTCDayNumber = (value) => {
    const d = new Date(value);

    return Math.floor(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) /
        (1000 * 60 * 60 * 24),
    );
  };

  const today = new Date();

  const todayUTCDay = toUTCDayNumber(today);

  const dailySales = activeSales
    .filter((sale) => sale.date && toUTCDayNumber(sale.date) === todayUTCDay)
    .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);

  const weeklySales = activeSales
    .filter((sale) => {
      if (!sale.date) return false;

      const diffDays = todayUTCDay - toUTCDayNumber(sale.date);

      return diffDays >= 0 && diffDays <= 6;
    })
    .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);

  const monthlySales = activeSales
    .filter((sale) => {
      if (!sale.date) return false;

      const d = new Date(sale.date);

      return (
        d.getUTCMonth() === today.getUTCMonth() &&
        d.getUTCFullYear() === today.getUTCFullYear()
      );
    })
    .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);

  const isSuperadmin = user?.role === "superadmin";

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return <div className="p-8">Loading Sales...</div>;
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-green-700">
            Egg Sales Management 🥚
          </h1>

          <p className="text-gray-500 mt-2">
            Track egg sales, customer payments and revenue.
          </p>
        </div>
      </div>

      {/* =================================================
          KPI CARDS
      ================================================= */}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Total Sales</h3>

          <p className="text-3xl font-bold text-green-600 mt-2">
            ₦{totalRevenue.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Amount Paid</h3>

          <p className="text-3xl font-bold text-blue-600 mt-2">
            ₦{amountReceived.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Outstanding</h3>

          <p className="text-3xl font-bold text-red-600 mt-2">
            ₦{outstanding.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Crates Sold</h3>

          <p className="text-3xl font-bold text-yellow-500 mt-2">
            {totalCrates}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Customers</h3>

          <p className="text-3xl font-bold text-purple-600 mt-2">
            {uniqueCustomerCount}
          </p>
        </div>
      </div>

      {/* =================================================
          SEARCH
      ================================================= */}

      <div className="bg-white rounded-xl shadow p-5 mb-8">
        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search customer, phone or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg p-3"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg p-3"
          >
            <option value="All">All Payments</option>

            <option value="Paid">Paid</option>

            <option value="Part Paid">Part Paid</option>

            <option value="Unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      {/* =================================================
          QUICK SUMMARY
      ================================================= */}

      {isSuperadmin && (
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-green-100 rounded-xl p-5">
            <h3 className="font-semibold text-green-700">Daily Sales</h3>

            <p className="text-2xl font-bold mt-3">
              ₦{dailySales.toLocaleString()}
            </p>
          </div>

          <div className="bg-blue-100 rounded-xl p-5">
            <h3 className="font-semibold text-blue-700">Weekly Sales</h3>

            <p className="text-2xl font-bold mt-3">
              ₦{weeklySales.toLocaleString()}
            </p>
          </div>

          <div className="bg-yellow-100 rounded-xl p-5">
            <h3 className="font-semibold text-yellow-700">Monthly Sales</h3>

            <p className="text-2xl font-bold mt-3">
              ₦{monthlySales.toLocaleString()}
            </p>
          </div>

          <div className="bg-red-100 rounded-xl p-5">
            <h3 className="font-semibold text-red-700">Outstanding Balance</h3>

            <p className="text-2xl font-bold mt-3">
              ₦{outstanding.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* =================================================
          CHARTS
      ================================================= */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-6">Payment Status</h2>

          <div
            style={{
              width: "100%",
              height: 350,
            }}
          >
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={paymentChart}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={120}
                  label
                >
                  {paymentChart.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>

                <Tooltip />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-6">Revenue Overview</h2>

          <div
            style={{
              width: "100%",
              height: 350,
            }}
          >
            <ResponsiveContainer>
              <BarChart
                data={[
                  {
                    name: "Revenue",
                    amount: totalRevenue,
                  },
                  {
                    name: "Received",
                    amount: amountReceived,
                  },
                  {
                    name: "Outstanding",
                    amount: outstanding,
                  },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="name" />

                <YAxis />

                <Tooltip />

                <Bar dataKey="amount" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* =================================================
          SALES ENTRY FORM
      ================================================= */}

      <div className="bg-white rounded-xl shadow p-6 mb-10">
        <h2 className="text-2xl font-bold mb-6">
          {editingId ? "Edit Egg Sale" : "Record Egg Sale"}
        </h2>

        {editingId && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 mb-6">
            <span className="font-semibold">
              Editing this sale — update the fields below and save.
            </span>

            <button
              type="button"
              onClick={cancelEdit}
              className="text-blue-700 underline hover:no-underline"
            >
              Cancel edit
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* =================================================
              CUSTOMER SECTION
          ================================================= */}

          <div className="bg-green-50 border border-green-100 rounded-xl p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-green-800">Customer</h3>

                <p className="text-sm text-gray-600">
                  Search an existing customer or add a new one.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQuickAddCustomer(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
              >
                + New Customer
              </button>
            </div>

            {/* Customer Search */}

            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search customer by name, phone or email..."
                  value={customerSearch}
                  onChange={handleCustomerSearchChange}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="border rounded-lg p-3 flex-1 bg-white"
                />

                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={clearSelectedCustomer}
                    className="bg-gray-200 hover:bg-gray-300 px-4 rounded-lg text-gray-700 font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {showCustomerDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-72 overflow-y-auto">
                  {customerLoading ? (
                    <div className="p-4 text-gray-500">
                      Loading customers...
                    </div>
                  ) : filteredCustomerOptions.length > 0 ? (
                    filteredCustomerOptions.map((customer) => (
                      <button
                        key={customer._id}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="w-full text-left px-4 py-3 hover:bg-green-50 border-b last:border-b-0"
                      >
                        <div className="font-semibold text-gray-800">
                          {customer.name}
                        </div>

                        <div className="text-sm text-gray-500 flex flex-wrap gap-3">
                          {customer.phone && <span>{customer.phone}</span>}

                          {customer.email && <span>{customer.email}</span>}

                          <span className="text-green-700">
                            {customer.customerType}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-gray-500">
                      No matching customer found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Customer */}

            {selectedCustomer && (
              <div className="mt-4 bg-white rounded-lg border p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      Selected Customer
                    </p>

                    <h4 className="text-xl font-bold text-green-700 mt-1">
                      {selectedCustomer.name}
                    </h4>

                    <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400">Phone</span>

                        <p className="font-medium">
                          {selectedCustomer.phone || "-"}
                        </p>
                      </div>

                      <div>
                        <span className="text-gray-400">Email</span>

                        <p className="font-medium break-all">
                          {selectedCustomer.email || "-"}
                        </p>
                      </div>

                      <div>
                        <span className="text-gray-400">Type</span>

                        <p className="font-medium">
                          {selectedCustomer.customerType}
                        </p>
                      </div>

                      <div>
                        <span className="text-gray-400">Address</span>

                        <p className="font-medium">
                          {selectedCustomer.address || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Name / Phone / Sale Date */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Customer Name
                </label>

                <input
                  type="text"
                  name="customer"
                  placeholder="Customer Name"
                  value={formData.customer}
                  onChange={handleChange}
                  readOnly={!!selectedCustomer}
                  className={`border rounded-lg p-3 w-full ${
                    selectedCustomer
                      ? "bg-gray-100 cursor-not-allowed text-gray-600"
                      : "bg-white"
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Phone Number
                </label>

                <input
                  type="text"
                  name="phone"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={handleChange}
                  readOnly={!!selectedCustomer}
                  className={`border rounded-lg p-3 w-full ${
                    selectedCustomer
                      ? "bg-gray-100 cursor-not-allowed text-gray-600"
                      : "bg-white"
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Sale Date
                </label>

                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="border rounded-lg p-3 w-full bg-white"
                  required
                />
              </div>
            </div>

            {/* Selected customer history */}

            {selectedCustomer && (
              <div className="mt-5 bg-gray-50 rounded-xl border p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">
                      Customer Purchase History
                    </h3>

                    <p className="text-sm text-gray-500">
                      Previous egg purchases linked to this customer.
                    </p>
                  </div>

                  {historyLoading && (
                    <span className="text-sm text-gray-500 mt-2 md:mt-0">
                      Loading history...
                    </span>
                  )}
                </div>

                {!historyLoading && customerHistory && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-500">Transactions</p>

                        <p className="text-xl font-bold">
                          {Number(
                            customerHistory?.summary?.transactionCount || 0,
                          )}
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-500">Purchases</p>

                        <p className="text-xl font-bold text-green-700">
                          ₦
                          {Number(
                            customerHistory?.summary?.totalPurchases || 0,
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-500">Paid</p>

                        <p className="text-xl font-bold text-blue-700">
                          ₦
                          {Number(
                            customerHistory?.summary?.totalPaid || 0,
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-500">Outstanding</p>

                        <p className="text-xl font-bold text-red-600">
                          ₦
                          {Number(
                            customerHistory?.summary?.totalOutstanding || 0,
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-500">Crates</p>

                        <p className="text-xl font-bold text-purple-700">
                          {Number(customerHistory?.summary?.totalCrates || 0)}
                        </p>
                      </div>
                    </div>

                    {Array.isArray(customerHistory.sales) &&
                      customerHistory.sales.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="p-2 text-left">Date</th>

                                <th className="p-2 text-left">Invoice</th>

                                <th className="p-2 text-right">Total</th>

                                <th className="p-2 text-right">Paid</th>

                                <th className="p-2 text-right">Balance</th>

                                <th className="p-2 text-center">Status</th>
                              </tr>
                            </thead>

                            <tbody>
                              {customerHistory.sales
                                .slice(0, 10)
                                .map((historySale) => (
                                  <tr
                                    key={historySale._id}
                                    className="border-b last:border-b-0"
                                  >
                                    <td className="p-2">
                                      {historySale.date
                                        ? new Date(
                                            historySale.date,
                                          ).toLocaleDateString()
                                        : "-"}
                                    </td>

                                    <td className="p-2 font-medium">
                                      {historySale.invoiceNumber}
                                    </td>

                                    <td className="p-2 text-right">
                                      ₦
                                      {Number(
                                        historySale.totalAmount || 0,
                                      ).toLocaleString()}
                                    </td>

                                    <td className="p-2 text-right">
                                      ₦
                                      {Number(
                                        historySale.amountPaid || 0,
                                      ).toLocaleString()}
                                    </td>

                                    <td className="p-2 text-right text-red-600">
                                      ₦
                                      {Number(
                                        historySale.balance || 0,
                                      ).toLocaleString()}
                                    </td>

                                    <td className="p-2 text-center">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                          historySale.status === "Paid"
                                            ? "bg-green-100 text-green-700"
                                            : historySale.status === "Part Paid"
                                              ? "bg-yellow-100 text-yellow-700"
                                              : "bg-red-100 text-red-700"
                                        }`}
                                      >
                                        {historySale.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                    {(!customerHistory.sales ||
                      customerHistory.sales.length === 0) && (
                      <p className="text-sm text-gray-500">
                        No previous purchases are linked to this customer.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* =================================================
              PAYMENT / SALE FIELDS
          ================================================= */}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              className="border rounded-lg p-3"
            >
              <option>Cash</option>

              <option>Transfer</option>

              <option>POS</option>
            </select>
          </div>

          {/* =================================================
              EGG CATEGORY LINE ITEMS
          ================================================= */}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Egg Categories</h3>

              <button
                type="button"
                onClick={addLineItemRow}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                + Add Category
              </button>
            </div>

            <div className="space-y-3">
              {lineItemsWithSubtotal.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center bg-gray-50 rounded-lg p-3"
                >
                  <select
                    value={item.category}
                    onChange={(e) =>
                      handleLineItemChange(index, "category", e.target.value)
                    }
                    className="border rounded-lg p-3"
                  >
                    {Object.keys(EGG_CATEGORY_PRICES).map((cat) => (
                      <option key={cat} value={cat}>
                        {EGG_CATEGORY_LABELS[cat]} (₦
                        {EGG_CATEGORY_PRICES[cat].toLocaleString()}
                        /crate)
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    placeholder="Crates"
                    value={item.cratesSold}
                    onChange={(e) =>
                      handleLineItemChange(index, "cratesSold", e.target.value)
                    }
                    className="border rounded-lg p-3"
                  />

                  <input
                    type="number"
                    min="0"
                    placeholder="Loose Eggs"
                    value={item.looseEggs}
                    onChange={(e) =>
                      handleLineItemChange(index, "looseEggs", e.target.value)
                    }
                    className="border rounded-lg p-3"
                  />

                  <div className="text-sm text-gray-500">
                    ₦{item.cratePrice.toLocaleString()}
                    /crate · ₦{item.eggPrice}
                    /egg
                  </div>

                  <div className="font-bold text-green-700">
                    ₦{item.subtotal.toLocaleString()}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLineItemRow(index)}
                    disabled={lineItems.length === 1}
                    className="bg-red-100 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 px-3 py-2 rounded-lg text-sm font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* =================================================
              DISCOUNT / TRANSPORT / PAID / REMARKS
          ================================================= */}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <input
              type="number"
              min="0"
              name="discount"
              placeholder="Discount"
              value={formData.discount}
              onChange={handleChange}
              className="border rounded-lg p-3"
            />

            <input
              type="number"
              min="0"
              name="transportCharge"
              placeholder="Transport Charge"
              value={formData.transportCharge}
              onChange={handleChange}
              className="border rounded-lg p-3"
            />

            <input
              type="number"
              min="0"
              name="amountPaid"
              placeholder="Amount Paid"
              value={formData.amountPaid}
              onChange={handleChange}
              className="border rounded-lg p-3"
            />

            <textarea
              name="remarks"
              placeholder="Remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="border rounded-lg p-3"
            />
          </div>

          {/* =================================================
              LIVE TOTALS
          ================================================= */}

          <div className="bg-gray-50 rounded-xl p-5 mb-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-500">Items Total</p>

                <p className="font-bold text-lg">
                  ₦{itemsTotal.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Grand Total</p>

                <p className="font-bold text-green-700 text-lg">
                  ₦{grandTotal.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Balance</p>

                <p className="font-bold text-red-600 text-lg">
                  ₦{Math.max(0, balance).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Status</p>

                <p className="font-bold text-blue-700 text-lg">
                  {paymentStatus}
                </p>
              </div>
            </div>
          </div>

          {/* =================================================
              SAVE BUTTONS
          ================================================= */}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-60"
            >
              {saving
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                  ? "Update Sale"
                  : "Save Sale"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* =================================================
          QUICK ADD CUSTOMER MODAL
      ================================================= */}

      {showQuickAddCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <div>
                <h2 className="text-2xl font-bold text-green-700">
                  Add New Customer
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  The new customer will automatically be selected for this sale.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQuickAddCustomer(false)}
                className="text-gray-500 hover:text-gray-800 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Customer Name *
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={newCustomer.name}
                    onChange={handleNewCustomerChange}
                    className="border rounded-lg p-3 w-full"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Phone
                  </label>

                  <input
                    type="text"
                    name="phone"
                    value={newCustomer.phone}
                    onChange={handleNewCustomerChange}
                    className="border rounded-lg p-3 w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Customer Type
                  </label>

                  <select
                    name="customerType"
                    value={newCustomer.customerType}
                    onChange={handleNewCustomerChange}
                    className="border rounded-lg p-3 w-full"
                  >
                    <option>Individual</option>
                    <option>Supermarket</option>
                    <option>Restaurant</option>
                    <option>Hotel</option>
                    <option>Wholesaler</option>
                    <option>Retailer</option>
                    <option>Distributor</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Email
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={newCustomer.email}
                    onChange={handleNewCustomerChange}
                    className="border rounded-lg p-3 w-full"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Address
                  </label>

                  <input
                    type="text"
                    name="address"
                    value={newCustomer.address}
                    onChange={handleNewCustomerChange}
                    className="border rounded-lg p-3 w-full"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={newCustomer.notes}
                    onChange={handleNewCustomerChange}
                    className="border rounded-lg p-3 w-full"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowQuickAddCustomer(false)}
                  disabled={savingCustomer}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-60"
                >
                  {savingCustomer ? "Saving..." : "Save & Select Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================
          SALES TABLE
      ================================================= */}

      <div className="bg-white rounded-xl shadow p-6 mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-2xl font-bold">Sales Records</h2>

          <span className="text-gray-500">
            {filteredSales.length} Record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="p-3 text-left">Date</th>

                <th className="p-3 text-left">Customer</th>

                <th className="p-3 text-left">Phone</th>

                <th className="p-3 text-left">Categories</th>

                <th className="p-3 text-right">Total</th>

                <th className="p-3 text-right">Paid</th>

                <th className="p-3 text-right">Balance</th>

                <th className="p-3 text-center">Status</th>

                <th className="p-3 text-center">Method</th>

                {isSuperadmin && (
                  <th className="p-3 text-center">Record Status</th>
                )}

                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperadmin ? 11 : 10}
                    className="text-center py-12 text-gray-500"
                  >
                    No sales found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale._id}
                    className={`border-b hover:bg-gray-50 ${
                      sale.isDeleted
                        ? "bg-red-50"
                        : sale._id === editingId
                          ? "bg-blue-50"
                          : ""
                    }`}
                  >
                    <td className="p-3">
                      {sale.date
                        ? new Date(sale.date).toLocaleDateString()
                        : "-"}
                    </td>

                    <td className="p-3 font-medium">{sale.customer}</td>

                    <td className="p-3">{sale.phone || "-"}</td>

                    <td className="p-3 text-sm">
                      {(sale.lineItems || [])
                        .map(
                          (item) =>
                            `${
                              EGG_CATEGORY_LABELS[item.category] ||
                              item.category
                            } (${item.cratesSold || 0}c${
                              item.looseEggs ? ` +${item.looseEggs}` : ""
                            })`,
                        )
                        .join(", ") || "-"}
                    </td>

                    <td className="p-3 text-right font-semibold text-green-700">
                      ₦{Number(sale.totalAmount || 0).toLocaleString()}
                    </td>

                    <td className="p-3 text-right">
                      ₦{Number(sale.amountPaid || 0).toLocaleString()}
                    </td>

                    <td className="p-3 text-right text-red-600">
                      ₦{Number(sale.balance || 0).toLocaleString()}
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          sale.status === "Paid"
                            ? "bg-green-100 text-green-700"
                            : sale.status === "Part Paid"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>

                    <td className="p-3 text-center">{sale.paymentMethod}</td>

                    {isSuperadmin && (
                      <td className="p-3 text-center">
                        {sale.isDeleted ? (
                          <div className="text-xs">
                            <span className="inline-block bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-full mb-1">
                              Deleted
                            </span>

                            <div className="text-gray-500 capitalize">
                              by {sale.deletedBy?.role || "Unknown"}
                              {sale.deletedAt &&
                                ` on ${new Date(
                                  sale.deletedAt,
                                ).toLocaleDateString()}`}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-block bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full text-xs">
                            Active
                          </span>
                        )}
                      </td>
                    )}

                    <td className="p-3 space-x-2">
                      {sale.isDeleted ? (
                        isSuperadmin && (
                          <button
                            onClick={() => handleRestore(sale._id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                          >
                            Restore
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(sale)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => openInvoice(sale)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                          >
                            Invoice
                          </button>

                          <button
                            onClick={() => handleDelete(sale._id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================
          SALES SUMMARY
      ================================================= */}

      {isSuperadmin && (
        <div className="bg-white rounded-xl shadow p-6 mb-10">
          <h2 className="text-2xl font-bold mb-6">Sales Summary</h2>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-green-50 rounded-lg p-5">
              <p className="text-gray-500">Revenue</p>

              <h3 className="text-2xl font-bold text-green-700 mt-2">
                ₦{totalRevenue.toLocaleString()}
              </h3>
            </div>

            <div className="bg-blue-50 rounded-lg p-5">
              <p className="text-gray-500">Amount Received</p>

              <h3 className="text-2xl font-bold text-blue-700 mt-2">
                ₦{amountReceived.toLocaleString()}
              </h3>
            </div>

            <div className="bg-yellow-50 rounded-lg p-5">
              <p className="text-gray-500">Outstanding</p>

              <h3 className="text-2xl font-bold text-yellow-600 mt-2">
                ₦{outstanding.toLocaleString()}
              </h3>
            </div>

            <div className="bg-purple-50 rounded-lg p-5">
              <p className="text-gray-500">Crates Sold</p>

              <h3 className="text-2xl font-bold text-purple-700 mt-2">
                {totalCrates}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          FOOTER
      ================================================= */}

      <div className="text-center text-gray-500 text-sm py-6 border-t">
        <p>Egg Sales Management System</p>

        <p className="mt-1">Built for efficient poultry farm sales tracking.</p>
      </div>

      {/* =================================================
          INVOICE
      ================================================= */}

      <InvoiceModal
        open={showInvoice}
        sale={selectedSale}
        onClose={closeInvoice}
      />
    </div>
  );
}
