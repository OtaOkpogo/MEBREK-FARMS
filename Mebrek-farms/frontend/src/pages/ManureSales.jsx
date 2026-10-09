import { useEffect, useMemo, useState } from "react";
import ManureInvoiceModal from "../components/ManureInvoiceModal";

import {
  fetchSales,
  createSale,
  updateSale,
  deleteSale,
  restoreSale,
} from "../services/manureSalesService";

import { getCurrentUser } from "../services/authService";
import { fetchCustomers, createCustomer } from "../services/customerService";

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

// Keep these prices synchronized with the backend.
const MANURE_CATEGORY_PRICES = {
  dry: 1000,
  wet: 500,
};

const MANURE_CATEGORY_LABELS = {
  dry: "Dry Manure",
  wet: "Wet Manure",
};

const PAYMENT_METHODS = ["cash", "transfer", "pos"];

const emptyLineItem = () => ({
  category: "dry",
  bags: "",
});

const emptyPayments = () => ({
  cash: "",
  transfer: "",
  pos: "",
});

const emptyForm = () => ({
  customer: "",
  phone: "",
  date: "",
  discount: "",
  transportCharge: "",
  remarks: "",
});

const money = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  });

const getPaymentMethod = (payments) => {
  const methods = PAYMENT_METHODS.filter(
    (method) => Number(payments?.[method] || 0) > 0,
  );

  if (methods.length > 1) return "Mixed";
  if (methods.length === 1) {
    return methods[0][0].toUpperCase() + methods[0].slice(1);
  }

  return "Cash";
};

// Supports both new sales with payment breakdowns and older records
// that only stored amountPaid and paymentMethod.
const getPaymentsForSale = (sale) => {
  if (sale?.payments && typeof sale.payments === "object") {
    const payments = {
      cash: Number(sale.payments.cash || 0),
      transfer: Number(sale.payments.transfer || 0),
      pos: Number(sale.payments.pos || 0),
    };

    const breakdownTotal = PAYMENT_METHODS.reduce(
      (sum, method) => sum + payments[method],
      0,
    );

    if (breakdownTotal > 0 || Number(sale.amountPaid || 0) === 0) {
      return Object.fromEntries(
        PAYMENT_METHODS.map((method) => [
          method,
          String(payments[method] || ""),
        ]),
      );
    }
  }

  const amount = Number(sale?.amountPaid || 0);
  const method = String(sale?.paymentMethod || "Cash").toLowerCase();

  return {
    cash: method === "cash" || method === "mixed" ? String(amount || "") : "",
    transfer: method === "transfer" ? String(amount || "") : "",
    pos: method === "pos" ? String(amount || "") : "",
  };
};

export default function ManureSales() {
  // ==========================================
  // STATE
  // ==========================================

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    customerType: "Individual",
    notes: "",
    isActive: true,
  });

  const [formData, setFormData] = useState(emptyForm);
  const [payments, setPayments] = useState(emptyPayments);
  const [lineItems, setLineItems] = useState([emptyLineItem()]);

  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ==========================================
  // LOAD SALES AND CURRENT USER
  // ==========================================

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
      console.error("Unable to load current user:", err);
    }
  };

  const loadSales = async () => {
    try {
      setLoading(true);
      const data = await fetchSales();
      setSales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Unable to load manure sales:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetchCustomers();
      let list = [];
      if (Array.isArray(response)) list = response;
      else if (Array.isArray(response?.customers)) list = response.customers;
      else if (Array.isArray(response?.data)) list = response.data;
      else if (Array.isArray(response?.data?.customers))
        list = response.data.customers;
      setCustomers(list.filter((customer) => customer?.isActive !== false));
    } catch (err) {
      console.error("Unable to load customers:", err);
      setCustomers([]);
    }
  };

  const matchingCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers.slice(0, 8);
    return customers
      .filter(
        (customer) =>
          customer?.name?.toLowerCase().includes(query) ||
          customer?.phone?.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [customers, customerSearch]);

  const selectCustomer = (customer) => {
    setFormData((previous) => ({
      ...previous,
      customer: customer.name || "",
      phone: customer.phone || "",
    }));
    setCustomerSearch(customer.name || "");
    setShowCustomerResults(false);
  };

  const handleCustomerSearchChange = (event) => {
    const value = event.target.value;
    setCustomerSearch(value);
    setShowCustomerResults(true);
    setFormData((previous) => ({
      ...previous,
      customer: value,
      // Clear the previous phone when the name is changed manually so a
      // different customer's phone is not accidentally carried into the sale.
      phone: value === previous.customer ? previous.phone : "",
    }));
  };

  const openQuickCustomer = () => {
    setNewCustomer({
      name: customerSearch.trim() || formData.customer.trim(),
      phone: formData.phone || "",
      email: "",
      address: "",
      customerType: "Individual",
      notes: "",
      isActive: true,
    });
    setShowCustomerResults(false);
    setShowQuickCustomer(true);
  };

  const handleQuickCustomerSubmit = async (event) => {
    event.preventDefault();
    if (!newCustomer.name.trim()) {
      alert("Customer name is required.");
      return;
    }

    try {
      setCustomerSaving(true);
      const response = await createCustomer({
        ...newCustomer,
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        isActive: true,
      });
      await loadCustomers();

      const created =
        response?.customer ||
        response?.data?.customer ||
        response?.data ||
        response;

      const selected =
        created && typeof created === "object" && created.name
          ? created
          : {
              ...newCustomer,
              name: newCustomer.name.trim(),
              phone: newCustomer.phone.trim(),
              isActive: true,
            };

      selectCustomer(selected);
      setShowQuickCustomer(false);
      alert("Customer added and selected for this sale.");
    } catch (err) {
      console.error("Unable to create customer:", err);
      alert(err.response?.data?.message || "Unable to add customer.");
    } finally {
      setCustomerSaving(false);
    }
  };

  // ==========================================
  // FORM CHANGES
  // ==========================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;

    setPayments((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ==========================================
  // LINE ITEM HANDLING
  // ==========================================

  const handleLineItemChange = (index, field, value) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
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

  // ==========================================
  // LIVE CALCULATIONS
  // ==========================================

  const lineItemsWithSubtotal = useMemo(
    () =>
      lineItems.map((item) => {
        const pricePerBag = MANURE_CATEGORY_PRICES[item.category] || 0;
        const bags = Number(item.bags || 0);

        return {
          ...item,
          bags,
          pricePerBag,
          subtotal: bags * pricePerBag,
        };
      }),
    [lineItems],
  );

  const itemsTotal = lineItemsWithSubtotal.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );

  const discount = Number(formData.discount || 0);
  const transportCharge = Number(formData.transportCharge || 0);

  const grandTotal = itemsTotal + transportCharge - discount;

  const totalPaid = PAYMENT_METHODS.reduce(
    (sum, method) => sum + Number(payments[method] || 0),
    0,
  );

  const balance = Math.max(0, grandTotal - totalPaid);

  const paymentStatus =
    balance === 0 ? "Paid" : totalPaid > 0 ? "Part Paid" : "Unpaid";

  const paymentMethod = getPaymentMethod(
    Object.fromEntries(
      PAYMENT_METHODS.map((method) => [method, Number(payments[method] || 0)]),
    ),
  );

  // ==========================================
  // RESET AND EDIT
  // ==========================================

  const resetForm = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setCustomerSearch("");
    setShowCustomerResults(false);
    setPayments(emptyPayments());
    setLineItems([emptyLineItem()]);
  };

  const startEdit = (sale) => {
    if (sale.isDeleted) {
      alert("A deleted sale cannot be edited. Restore it first.");
      return;
    }

    setEditingId(sale._id);

    setFormData({
      customer: sale.customer || "",
      phone: sale.phone || "",
      date: sale.date ? new Date(sale.date).toISOString().slice(0, 10) : "",
      discount: sale.discount ?? "",
      transportCharge: sale.transportCharge ?? "",
      remarks: sale.remarks || "",
    });

    setCustomerSearch(sale.customer || "");
    setShowCustomerResults(false);
    setPayments(getPaymentsForSale(sale));

    setLineItems(
      sale.lineItems?.length
        ? sale.lineItems.map((item) => ({
            category: item.category,
            bags: item.bags ?? "",
          }))
        : [emptyLineItem()],
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    resetForm();
  };

  // ==========================================
  // SAVE SALE
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validLineItems = lineItemsWithSubtotal.filter(
      (item) => item.bags > 0,
    );

    if (!validLineItems.length) {
      alert("Add at least one manure category with a bag quantity.");
      return;
    }

    if (
      validLineItems.some(
        (item) => !Number.isFinite(item.bags) || item.bags <= 0,
      )
    ) {
      alert("Every manure quantity must be greater than zero.");
      return;
    }

    if (
      !Number.isFinite(discount) ||
      !Number.isFinite(transportCharge) ||
      discount < 0 ||
      transportCharge < 0
    ) {
      alert(
        "Discount and transport charge must be valid non-negative amounts.",
      );
      return;
    }

    if (grandTotal < 0) {
      alert("Discount cannot exceed the total items and transport charge.");
      return;
    }

    const normalizedPayments = {
      cash: Number(payments.cash || 0),
      transfer: Number(payments.transfer || 0),
      pos: Number(payments.pos || 0),
    };

    if (
      PAYMENT_METHODS.some(
        (method) =>
          !Number.isFinite(normalizedPayments[method]) ||
          normalizedPayments[method] < 0,
      )
    ) {
      alert(
        "Cash, transfer, and POS amounts must be valid non-negative amounts.",
      );
      return;
    }

    if (totalPaid > grandTotal) {
      alert(
        `Total payment (₦${money(totalPaid)}) cannot exceed the sale total (₦${money(grandTotal)}).`,
      );
      return;
    }

    const payload = {
      ...formData,
      lineItems: validLineItems.map((item) => ({
        category: item.category,
        bags: item.bags,
      })),
      discount,
      transportCharge,
      payments: normalizedPayments,
      amountPaid: totalPaid,
      paymentMethod: getPaymentMethod(normalizedPayments),
    };

    setSaving(true);

    try {
      if (editingId) {
        await updateSale(editingId, payload);
        alert("Sale updated successfully.");
      } else {
        await createSale(payload);
        alert("Sale recorded successfully.");
      }

      resetForm();
      await loadSales();
    } catch (err) {
      console.error("Unable to save manure sale:", err);

      alert(
        err.response?.data?.message ||
          `Unable to ${editingId ? "update" : "save"} sale.`,
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // DELETE, RESTORE, AND INVOICE
  // ==========================================

  const handleDelete = async (id) => {
    if (!window.confirm("Delete sale?")) return;

    try {
      await deleteSale(id);

      if (editingId === id) {
        resetForm();
      }

      await loadSales();
    } catch (err) {
      console.error("Unable to delete sale:", err);
      alert(err.response?.data?.message || "Unable to delete sale.");
    }
  };

  const handleRestore = async (id) => {
    if (!window.confirm("Restore this manure sale?")) return;

    try {
      await restoreSale(id);
      await loadSales();
    } catch (err) {
      console.error("Unable to restore sale:", err);
      alert(err.response?.data?.message || "Unable to restore sale.");
    }
  };

  const openInvoice = (sale) => {
    setSelectedSale(sale);
    setShowInvoice(true);
  };

  const closeInvoice = () => {
    setShowInvoice(false);
    setSelectedSale(null);
  };

  // ==========================================
  // FILTERED SALES
  // ==========================================

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        const query = search.toLowerCase();

        const matchesSearch =
          sale.customer?.toLowerCase().includes(query) ||
          sale.invoiceNumber?.toLowerCase().includes(query);

        const matchesStatus =
          statusFilter === "All" || sale.status === statusFilter;

        return Boolean(matchesSearch) && matchesStatus;
      }),
    [sales, search, statusFilter],
  );

  // Exclude deleted sales from KPIs and charts.
  const activeSales = useMemo(
    () => filteredSales.filter((sale) => !sale.isDeleted),
    [filteredSales],
  );

  // ==========================================
  // KPI CARDS AND CHART DATA
  // ==========================================

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

  const totalBags = activeSales.reduce(
    (sum, sale) =>
      sum +
      (sale.lineItems || []).reduce(
        (itemSum, item) => itemSum + Number(item.bags || 0),
        0,
      ),
    0,
  );

  const paymentChart = [
    {
      name: "Paid",
      value: activeSales.filter((sale) => sale.status === "Paid").length,
    },
    {
      name: "Part Paid",
      value: activeSales.filter((sale) => sale.status === "Part Paid").length,
    },
    {
      name: "Unpaid",
      value: activeSales.filter((sale) => sale.status === "Unpaid").length,
    },
  ];

  const COLORS = ["#16a34a", "#f59e0b", "#dc2626"];
  const isSuperadmin = user?.role === "superadmin";

  if (loading) {
    return <div className="p-8">Loading Manure Sales...</div>;
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-amber-800">
            Manure Sales Management 🌾
          </h1>
          <p className="text-gray-500 mt-2">
            Track dry and wet manure sales, customer payments and revenue.
          </p>
        </div>
      </div>

      {/* KPI CARDS */}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Total Sales</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            ₦{money(totalRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Amount Paid</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            ₦{money(amountReceived)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Outstanding</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">
            ₦{money(outstanding)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Bags Sold</h3>
          <p className="text-3xl font-bold text-amber-600 mt-2">{totalBags}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-gray-500">Sales Records</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">
            {activeSales.length}
          </p>
        </div>
      </div>

      {/* SEARCH */}

      <div className="bg-white rounded-xl shadow p-5 mb-8">
        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search customer or invoice..."
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

      {/* CHARTS */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-6">Payment Status</h2>

          <div style={{ width: "100%", height: 350 }}>
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
                    <Cell
                      key={entry.name}
                      fill={COLORS[index % COLORS.length]}
                    />
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

          <div style={{ width: "100%", height: 350 }}>
            <ResponsiveContainer>
              <BarChart
                data={[
                  { name: "Revenue", amount: totalRevenue },
                  { name: "Received", amount: amountReceived },
                  { name: "Outstanding", amount: outstanding },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `₦${money(value)}`} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} fill="#b45309" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SALE ENTRY FORM */}

      <div className="bg-white rounded-xl shadow p-6 mb-10">
        <h2 className="text-2xl font-bold mb-6">
          {editingId ? "Edit Manure Sale" : "Record Manure Sale"}
        </h2>

        {editingId && (
          <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 mb-6">
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
          {/* CUSTOMER DETAILS */}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="relative">
              <label className="block text-sm font-medium mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                name="customer"
                placeholder="Search customer by name or phone..."
                value={customerSearch}
                onChange={handleCustomerSearchChange}
                onFocus={() => setShowCustomerResults(true)}
                onBlur={() =>
                  setTimeout(() => setShowCustomerResults(false), 150)
                }
                autoComplete="off"
                className="border rounded-lg p-3 w-full"
                required
              />
              {showCustomerResults && (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {matchingCustomers.length > 0 ? (
                    matchingCustomers.map((customer) => (
                      <button
                        type="button"
                        key={
                          customer._id || `${customer.name}-${customer.phone}`
                        }
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectCustomer(customer)}
                        className="block w-full border-b px-4 py-3 text-left hover:bg-amber-50"
                      >
                        <span className="block font-semibold text-gray-800">
                          {customer.name}
                        </span>
                        <span className="block text-sm text-gray-500">
                          {customer.phone || "No phone number"}
                          {customer.customerType
                            ? ` • ${customer.customerType}`
                            : ""}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-3 text-sm text-gray-500">
                      No matching active customer.
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={openQuickCustomer}
                    className="w-full px-4 py-3 text-left font-semibold text-green-700 hover:bg-green-50"
                  >
                    + Add new customer
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Search your saved customers or add a new customer without
                leaving this page.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleChange}
                className="border rounded-lg p-3 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Sale Date *
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="border rounded-lg p-3 w-full"
                required
              />
            </div>
          </div>

          {/* MANURE LINE ITEMS */}

          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Manure Categories</h3>
              <button
                type="button"
                onClick={addLineItemRow}
                className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                + Add Category
              </button>
            </div>

            <div className="space-y-3">
              {lineItemsWithSubtotal.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center bg-gray-50 rounded-lg p-3"
                >
                  <select
                    value={item.category}
                    onChange={(e) =>
                      handleLineItemChange(index, "category", e.target.value)
                    }
                    className="border rounded-lg p-3"
                    aria-label={`Manure category ${index + 1}`}
                  >
                    {Object.keys(MANURE_CATEGORY_PRICES).map((category) => (
                      <option key={category} value={category}>
                        {MANURE_CATEGORY_LABELS[category]} (₦
                        {money(MANURE_CATEGORY_PRICES[category])}/bag)
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Number of bags"
                    value={item.bags}
                    onChange={(e) =>
                      handleLineItemChange(index, "bags", e.target.value)
                    }
                    className="border rounded-lg p-3"
                    aria-label={`Number of bags for category ${index + 1}`}
                  />

                  <div className="text-sm text-gray-500">
                    ₦{money(item.pricePerBag)}/bag
                  </div>

                  <div className="font-bold text-amber-700">
                    ₦{money(item.subtotal)}
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

          {/* DISCOUNT AND TRANSPORT */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <label className="block text-sm font-medium mb-1">
                Discount (₦)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                name="discount"
                placeholder="0"
                value={formData.discount}
                onChange={handleChange}
                className="border rounded-lg p-3 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Transport Charge (₦)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                name="transportCharge"
                placeholder="0"
                value={formData.transportCharge}
                onChange={handleChange}
                className="border rounded-lg p-3 w-full"
              />
            </div>
          </div>

          {/* MULTIPLE PAYMENT METHODS */}

          <div className="border border-amber-200 bg-amber-50 rounded-xl p-5 mb-8">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-amber-900">
                Payment Breakdown
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Enter the amount received through each method. You can use one
                method or combine cash, transfer and POS.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Cash Received (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="cash"
                  placeholder="0"
                  value={payments.cash}
                  onChange={handlePaymentChange}
                  className="border rounded-lg p-3 w-full bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Transfer Received (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="transfer"
                  placeholder="0"
                  value={payments.transfer}
                  onChange={handlePaymentChange}
                  className="border rounded-lg p-3 w-full bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  POS Received (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="pos"
                  placeholder="0"
                  value={payments.pos}
                  onChange={handlePaymentChange}
                  className="border rounded-lg p-3 w-full bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm text-gray-500">Total Payment Received</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">
                  ₦{money(totalPaid)}
                </p>
              </div>

              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="text-2xl font-bold text-amber-800 mt-1">
                  {paymentMethod}
                </p>
              </div>

              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm text-gray-500">Payment Status</p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    paymentStatus === "Paid"
                      ? "text-green-700"
                      : paymentStatus === "Part Paid"
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {paymentStatus}
                </p>
              </div>
            </div>

            {totalPaid > grandTotal && (
              <p className="text-red-700 text-sm font-semibold mt-3">
                Total payment cannot exceed the grand total.
              </p>
            )}
          </div>

          {/* REMARKS */}

          <div className="mb-8">
            <label className="block text-sm font-medium mb-1">Remarks</label>
            <textarea
              name="remarks"
              placeholder="Additional notes about this sale"
              value={formData.remarks}
              onChange={handleChange}
              rows={3}
              className="border rounded-lg p-3 w-full"
            />
          </div>

          {/* LIVE TOTALS */}

          <div className="bg-gray-50 rounded-xl p-5 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-gray-500">Items Total</p>
                <p className="font-bold text-lg">₦{money(itemsTotal)}</p>
              </div>

              <div>
                <p className="text-gray-500">Discount</p>
                <p className="font-bold text-lg">₦{money(discount)}</p>
              </div>

              <div>
                <p className="text-gray-500">Grand Total</p>
                <p className="font-bold text-amber-700 text-lg">
                  ₦{money(grandTotal)}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Balance</p>
                <p
                  className={`font-bold text-lg ${
                    balance > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  ₦{money(balance)}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Transport</p>
                <p className="font-bold text-lg">₦{money(transportCharge)}</p>
              </div>
            </div>
          </div>

          {/* FORM ACTIONS */}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || totalPaid > grandTotal || grandTotal < 0}
              className="bg-amber-700 hover:bg-amber-800 text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
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

      {/* SALES TABLE */}

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
              <tr className="bg-amber-700 text-white">
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Invoice</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">Categories</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-left">Payment Breakdown</th>

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
                    colSpan={isSuperadmin ? 12 : 11}
                    className="text-center py-12 text-gray-500"
                  >
                    No sales found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const salePayments = getPaymentsForSale(sale);
                  const saleMethod = getPaymentMethod(
                    Object.fromEntries(
                      PAYMENT_METHODS.map((method) => [
                        method,
                        Number(salePayments[method] || 0),
                      ]),
                    ),
                  );

                  return (
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
                      <td className="p-3 whitespace-nowrap">
                        {sale.date
                          ? new Date(sale.date).toLocaleDateString()
                          : "-"}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {sale.invoiceNumber || "-"}
                      </td>

                      <td className="p-3 font-medium">{sale.customer}</td>

                      <td className="p-3">{sale.phone || "-"}</td>

                      <td className="p-3 text-sm">
                        {(sale.lineItems || [])
                          .map(
                            (item) =>
                              `${MANURE_CATEGORY_LABELS[item.category] || item.category} (${item.bags || 0} bags)`,
                          )
                          .join(", ") || "-"}
                      </td>

                      <td className="p-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                        ₦{money(sale.totalAmount)}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        ₦{money(sale.amountPaid)}
                      </td>

                      <td className="p-3 text-right text-red-600 whitespace-nowrap">
                        ₦{money(sale.balance)}
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            sale.status === "Paid"
                              ? "bg-green-100 text-green-700"
                              : sale.status === "Part Paid"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {sale.status || "Unpaid"}
                        </span>
                      </td>

                      <td className="p-3 text-sm">
                        <div className="font-semibold mb-1">{saleMethod}</div>
                        {Number(salePayments.cash || 0) > 0 && (
                          <div>Cash: ₦{money(salePayments.cash)}</div>
                        )}
                        {Number(salePayments.transfer || 0) > 0 && (
                          <div>Transfer: ₦{money(salePayments.transfer)}</div>
                        )}
                        {Number(salePayments.pos || 0) > 0 && (
                          <div>POS: ₦{money(salePayments.pos)}</div>
                        )}
                        {Number(sale.amountPaid || 0) === 0 && (
                          <span className="text-gray-500">No payment</span>
                        )}
                      </td>

                      {isSuperadmin && (
                        <td className="p-3 text-center">
                          {sale.isDeleted ? (
                            <div className="text-xs">
                              <span className="inline-block bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-full mb-1">
                                Deleted
                              </span>
                              <div className="text-gray-500">
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

                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {sale.isDeleted ? (
                            isSuperadmin && (
                              <button
                                type="button"
                                onClick={() => handleRestore(sale._id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                              >
                                Restore
                              </button>
                            )
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(sale)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => openInvoice(sale)}
                                className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-1 rounded"
                              >
                                Invoice
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(sale._id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER */}

      <div className="text-center text-gray-500 text-sm py-6 border-t">
        <p>Manure Sales Management</p>
        <p className="mt-1">
          Built for efficient poultry farm byproduct sales tracking.
        </p>
      </div>

      {showQuickCustomer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Add New Customer
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Save the customer and select them for this manure sale.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCustomer(false)}
                disabled={customerSaving}
                className="rounded-lg px-3 py-1 text-2xl text-gray-400 hover:bg-gray-100"
                aria-label="Close add customer form"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleQuickCustomerSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Customer Name *
                </label>
                <input
                  required
                  value={newCustomer.name}
                  onChange={(event) =>
                    setNewCustomer((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border p-3"
                  placeholder="Customer or business name"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(event) =>
                      setNewCustomer((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border p-3"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(event) =>
                      setNewCustomer((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border p-3"
                    placeholder="Email (optional)"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Customer Type
                </label>
                <select
                  value={newCustomer.customerType}
                  onChange={(event) =>
                    setNewCustomer((prev) => ({
                      ...prev,
                      customerType: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border bg-white p-3"
                >
                  {[
                    "Individual",
                    "Supermarket",
                    "Restaurant",
                    "Hotel",
                    "Wholesaler",
                    "Retailer",
                    "Distributor",
                    "Other",
                  ].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Address
                </label>
                <input
                  value={newCustomer.address}
                  onChange={(event) =>
                    setNewCustomer((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border p-3"
                  placeholder="Address (optional)"
                />
              </div>
              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowQuickCustomer(false)}
                  disabled={customerSaving}
                  className="rounded-lg border px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customerSaving}
                  className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {customerSaving
                    ? "Saving Customer..."
                    : "Save and Select Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ManureInvoiceModal
        open={showInvoice}
        sale={selectedSale}
        onClose={closeInvoice}
      />
    </div>
  );
}
