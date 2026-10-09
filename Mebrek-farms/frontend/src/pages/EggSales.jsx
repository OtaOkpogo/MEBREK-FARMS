import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

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

// =====================================================
// OFFICIAL EGG PRICES
// =====================================================

const EGG_CATEGORY_PRICES = {
  big: 5100,
  jumbo: 5800,
  turkey: 6000,
  normal: 5000,
  small: 4000,
};

const EGG_CATEGORIES = [
  { value: "big", label: "Big" },
  { value: "jumbo", label: "Jumbo" },
  { value: "turkey", label: "Turkey Egg" },
  { value: "normal", label: "Normal" },
  { value: "small", label: "Small" },
];

const PAYMENT_METHODS = ["Cash", "Transfer", "POS"];

const PAYMENT_STATUS_COLORS = {
  Paid: "#22C55E",
  "Part Paid": "#F59E0B",
  Unpaid: "#EF4444",
};

const PAGE_SIZE = 10;

// =====================================================
// HELPERS
// =====================================================

const emptyPayment = () => ({
  method: "Cash",
  amount: "",
});

const emptyLineItem = () => ({
  category: "big",
  cratesSold: "",
  looseEggs: "",
});

const emptyForm = () => ({
  customerId: "",
  customer: "",
  phone: "",
  date: new Date().toISOString().split("T")[0],
  discount: "",
  transportCharge: "",
  amountPaid: "",
  paymentMethod: "Cash",
  remarks: "",
});

const formatCurrency = (value) => `₦${Number(value || 0).toLocaleString()}`;

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getResponseArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.data)) return response.data;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];

    if (Array.isArray(response?.data?.[key])) {
      return response.data[key];
    }
  }

  return [];
};

const getCustomerFromSale = (sale) => {
  if (sale?.customerId && typeof sale.customerId === "object") {
    return sale.customerId;
  }

  return null;
};

// =====================================================
// COMPONENT
// =====================================================

export default function EggSales() {
  // USER
  const [user, setUser] = useState(null);

  // SALES
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showDeleted, setShowDeleted] = useState(false);

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);

  // SALE FORM
  const [formData, setFormData] = useState(emptyForm());
  const [lineItems, setLineItems] = useState([emptyLineItem()]);
  const [payments, setPayments] = useState([emptyPayment()]);
  const [editingId, setEditingId] = useState(null);

  // CUSTOMER
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    customerType: "Individual",
    notes: "",
  });

  // CUSTOMER HISTORY
  const [customerHistory, setCustomerHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // INVOICE
  const [selectedSale, setSelectedSale] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  // ===================================================
  // LOAD USER
  // ===================================================

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedRole = localStorage.getItem("role");

      if (storedUser) {
        setUser({
          ...JSON.parse(storedUser),
          role: storedRole || undefined,
        });
      } else {
        setUser({ role: storedRole || "" });
      }
    } catch {
      setUser({
        role: localStorage.getItem("role") || "",
      });
    }
  }, []);

  const isSuperadmin = user?.role === "superadmin";

  // ===================================================
  // LOAD SALES
  // ===================================================

  const loadSales = async () => {
    try {
      setLoading(true);

      const response = await fetchSales();
      const data = getResponseArray(response, ["sales"]);

      setSales(data);
    } catch (error) {
      console.error("LOAD EGG SALES ERROR:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to load egg sales.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // LOAD CUSTOMERS
  // ===================================================

  const loadCustomers = async () => {
    try {
      setCustomerLoading(true);

      const response = await fetchCustomers();
      const data = getResponseArray(response, ["customers"]);

      setCustomers(data);
    } catch (error) {
      console.error("LOAD CUSTOMERS ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Unable to load customers.",
      );
    } finally {
      setCustomerLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
    loadCustomers();
  }, []);

  // ===================================================
  // FORM CHANGE
  // ===================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ===================================================
  // CUSTOMER SEARCH
  // ===================================================

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();

    if (!query) return customers.slice(0, 10);

    return customers
      .filter((customer) => {
        const name = String(customer?.name || "").toLowerCase();
        const phone = String(customer?.phone || "").toLowerCase();
        const email = String(customer?.email || "").toLowerCase();

        return (
          name.includes(query) || phone.includes(query) || email.includes(query)
        );
      })
      .slice(0, 10);
  }, [customers, customerSearch]);

  // ===================================================
  // SELECT CUSTOMER
  // ===================================================

  const selectCustomer = async (customer) => {
    if (!customer) return;

    setSelectedCustomer(customer);

    setFormData((previous) => ({
      ...previous,
      customerId: customer._id || customer.id || "",
      customer: customer.name || "",
      phone: customer.phone || "",
    }));

    setCustomerSearch(customer.name || "");
    setShowCustomerDropdown(false);

    await loadCustomerHistory(customer._id || customer.id);
  };

  // ===================================================
  // CLEAR CUSTOMER
  // ===================================================

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

  // ===================================================
  // CUSTOMER HISTORY
  // ===================================================

  const loadCustomerHistory = async (customerId) => {
    if (!customerId) {
      setCustomerHistory(null);
      return;
    }

    try {
      setHistoryLoading(true);

      const response = await fetchCustomerSales(customerId);

      setCustomerHistory(response?.data || response || null);
    } catch (error) {
      console.error("CUSTOMER HISTORY ERROR:", error);
      setCustomerHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ===================================================
  // QUICK ADD CUSTOMER
  // ===================================================

  const handleNewCustomerChange = (event) => {
    const { name, value } = event.target;

    setNewCustomer((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCreateCustomer = async (event) => {
    event.preventDefault();

    const name = newCustomer.name.trim();

    if (!name) {
      toast.error("Customer name is required.");
      return;
    }

    try {
      setSavingCustomer(true);

      const response = await createCustomer({
        name,
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim(),
        address: newCustomer.address.trim(),
        customerType: newCustomer.customerType,
        notes: newCustomer.notes.trim(),
      });

      const createdCustomer =
        response?.customer ||
        response?.data?.customer ||
        response?.data ||
        response;

      if (!createdCustomer) {
        throw new Error(
          "Customer was created but no customer record was returned.",
        );
      }

      setCustomers((previous) => [
        createdCustomer,
        ...previous.filter(
          (item) => String(item?._id) !== String(createdCustomer?._id),
        ),
      ]);

      await selectCustomer(createdCustomer);

      setNewCustomer({
        name: "",
        phone: "",
        email: "",
        address: "",
        customerType: "Individual",
        notes: "",
      });

      setShowQuickAddCustomer(false);

      toast.success("Customer created successfully.");
    } catch (error) {
      console.error("CREATE CUSTOMER ERROR:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to create customer.",
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  // ===================================================
  // LINE ITEMS
  // ===================================================

  const addLineItem = () => {
    const usedCategories = new Set(lineItems.map((item) => item.category));

    const nextCategory = EGG_CATEGORIES.find(
      (category) => !usedCategories.has(category.value),
    )?.value;

    if (!nextCategory) {
      toast.info("All egg categories have already been added.");
      return;
    }

    setLineItems((previous) => [
      ...previous,
      {
        category: nextCategory,
        cratesSold: "",
        looseEggs: "",
      },
    ]);
  };

  const removeLineItem = (index) => {
    setLineItems((previous) => {
      if (previous.length === 1) return previous;

      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const updateLineItem = (index, field, value) => {
    setLineItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  // ===================================================
  // LINE ITEM CALCULATIONS
  // ===================================================

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
        subtotal,
      };
    });
  }, [lineItems]);

  const itemsTotal = useMemo(
    () =>
      lineItemsWithSubtotal.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0,
      ),
    [lineItemsWithSubtotal],
  );

  const grandTotal = useMemo(() => {
    const transportCharge = Number(formData.transportCharge || 0);
    const discount = Number(formData.discount || 0);

    return Math.max(0, itemsTotal + transportCharge - discount);
  }, [itemsTotal, formData.transportCharge, formData.discount]);

  // ===================================================
  // PAYMENT SEGMENTS
  // ===================================================

  const handlePaymentChange = (index, field, value) => {
    setPayments((previous) =>
      previous.map((payment, paymentIndex) =>
        paymentIndex === index ? { ...payment, [field]: value } : payment,
      ),
    );
  };

  const addPaymentRow = () => {
    setPayments((previous) => [...previous, emptyPayment()]);
  };

  const removePaymentRow = (index) => {
    setPayments((previous) => {
      if (previous.length === 1) return [emptyPayment()];

      return previous.filter((_, paymentIndex) => paymentIndex !== index);
    });
  };

  const normalizedPayments = useMemo(
    () =>
      payments
        .map((payment) => ({
          method: payment.method || "Cash",
          amount: Number(payment.amount || 0),
        }))
        .filter((payment) => payment.amount > 0),
    [payments],
  );

  const totalPayments = useMemo(
    () => normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0),
    [normalizedPayments],
  );

  const paymentBreakdown = useMemo(
    () =>
      PAYMENT_METHODS.map((method) => ({
        method,
        amount: normalizedPayments
          .filter((payment) => payment.method === method)
          .reduce((sum, payment) => sum + payment.amount, 0),
      })),
    [normalizedPayments],
  );

  const balance = Math.max(0, grandTotal - totalPayments);

  const paymentStatus =
    totalPayments >= grandTotal && grandTotal > 0
      ? "Paid"
      : totalPayments > 0
        ? "Part Paid"
        : "Unpaid";

  // ===================================================
  // START EDIT
  // ===================================================

  const startEdit = async (sale) => {
    setEditingId(sale._id);

    const customerRecord = getCustomerFromSale(sale);

    setSelectedCustomer(customerRecord);
    setCustomerSearch(customerRecord?.name || sale.customer || "");

    setFormData({
      customerId:
        sale.customerId && typeof sale.customerId === "object"
          ? sale.customerId._id || ""
          : sale.customerId || "",
      customer: sale.customer || customerRecord?.name || "",
      phone: sale.phone || customerRecord?.phone || "",
      date: sale.date
        ? new Date(sale.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      discount: sale.discount ?? "",
      transportCharge: sale.transportCharge ?? "",
      amountPaid: sale.amountPaid ?? "",
      paymentMethod: sale.paymentMethod || "Cash",
      remarks: sale.remarks || "",
    });

    if (Array.isArray(sale.lineItems) && sale.lineItems.length > 0) {
      setLineItems(
        sale.lineItems.map((item) => ({
          category: item.category || "big",
          cratesSold: item.cratesSold ?? "",
          looseEggs: item.looseEggs ?? "",
        })),
      );
    } else {
      setLineItems([
        {
          category: "big",
          cratesSold: sale.cratesSold ?? "",
          looseEggs: sale.looseEggs ?? "",
        },
      ]);
    }

    if (Array.isArray(sale.payments) && sale.payments.length > 0) {
      setPayments(
        sale.payments.map((payment) => ({
          method: PAYMENT_METHODS.includes(payment.method)
            ? payment.method
            : "Cash",
          amount: payment.amount ?? "",
        })),
      );
    } else if (Number(sale.amountPaid || 0) > 0) {
      const legacyMethod = PAYMENT_METHODS.includes(sale.paymentMethod)
        ? sale.paymentMethod
        : "Cash";

      setPayments([
        {
          method: legacyMethod,
          amount: sale.amountPaid,
        },
      ]);
    } else {
      setPayments([emptyPayment()]);
    }

    if (sale.customerId && typeof sale.customerId === "object") {
      await loadCustomerHistory(sale.customerId._id);
    } else if (sale.customerId) {
      await loadCustomerHistory(sale.customerId);
    } else {
      setCustomerHistory(null);
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ===================================================
  // CANCEL EDIT
  // ===================================================

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setLineItems([emptyLineItem()]);
    setPayments([emptyPayment()]);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerHistory(null);
  };

  // ===================================================
  // SUBMIT SALE
  // ===================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.customer.trim()) {
      toast.error("Please select or enter a customer.");
      return;
    }

    if (!lineItems.length) {
      toast.error("Add at least one egg category.");
      return;
    }

    for (const item of lineItems) {
      const crates = Number(item.cratesSold || 0);
      const loose = Number(item.looseEggs || 0);

      if (
        !Number.isFinite(crates) ||
        !Number.isFinite(loose) ||
        crates < 0 ||
        loose < 0
      ) {
        toast.error("Egg quantities must be valid non-negative numbers.");
        return;
      }

      if (crates === 0 && loose === 0) {
        toast.error(
          "Each selected egg category must contain at least one crate or loose egg.",
        );
        return;
      }
    }

    const categorySet = new Set();

    for (const item of lineItems) {
      if (categorySet.has(item.category)) {
        toast.error(
          `The ${item.category} egg category has been added more than once.`,
        );
        return;
      }

      categorySet.add(item.category);
    }

    if (totalPayments > grandTotal) {
      toast.error("Payment total cannot be greater than the sale total.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        customerId: formData.customerId || undefined,
        customer: formData.customer.trim(),
        phone: formData.phone.trim(),
        date: formData.date,
        lineItems: lineItems.map((item) => ({
          category: item.category,
          cratesSold: Number(item.cratesSold || 0),
          looseEggs: Number(item.looseEggs || 0),
        })),
        discount: Number(formData.discount || 0),
        transportCharge: Number(formData.transportCharge || 0),
        payments: normalizedPayments,
        amountPaid: totalPayments,
        remarks: formData.remarks || "",
      };

      if (editingId) {
        await updateSale(editingId, payload);
        toast.success("Egg sale updated successfully.");
      } else {
        await createSale(payload);
        toast.success("Egg sale recorded successfully.");
      }

      const customerId = formData.customerId;

      cancelEdit();
      await loadSales();

      if (customerId) {
        await loadCustomerHistory(customerId);
      }
    } catch (error) {
      console.error("SAVE EGG SALE ERROR:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to save egg sale.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ===================================================
  // DELETE
  // ===================================================

  const handleDelete = async (sale) => {
    const confirmed = window.confirm(
      `Delete invoice ${sale.invoiceNumber || ""}?`,
    );

    if (!confirmed) return;

    try {
      await deleteSale(sale._id);

      toast.success("Egg sale deleted successfully.");
      await loadSales();
    } catch (error) {
      console.error("DELETE EGG SALE ERROR:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to delete sale.",
      );
    }
  };

  // ===================================================
  // RESTORE
  // ===================================================

  const handleRestore = async (sale) => {
    const confirmed = window.confirm(
      `Restore invoice ${sale.invoiceNumber || ""}?`,
    );

    if (!confirmed) return;

    try {
      await restoreSale(sale._id);

      toast.success("Egg sale restored successfully.");
      await loadSales();
    } catch (error) {
      console.error("RESTORE EGG SALE ERROR:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to restore sale.",
      );
    }
  };

  // ===================================================
  // INVOICE
  // ===================================================

  const handleInvoice = (sale) => {
    setSelectedSale(sale);
    setShowInvoice(true);
  };

  // ===================================================
  // FILTER SALES
  // ===================================================

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sales.filter((sale) => {
      if (!showDeleted && sale.isDeleted) return false;
      if (showDeleted && !sale.isDeleted) return false;

      if (statusFilter !== "All" && sale.status !== statusFilter) {
        return false;
      }

      if (!query) return true;

      const invoice = String(sale.invoiceNumber || "").toLowerCase();
      const customer = String(sale.customer || "").toLowerCase();
      const phone = String(sale.phone || "").toLowerCase();

      return (
        invoice.includes(query) ||
        customer.includes(query) ||
        phone.includes(query)
      );
    });
  }, [sales, search, statusFilter, showDeleted]);

  // ===================================================
  // PAGINATION
  // ===================================================

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, showDeleted]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredSales.slice(start, start + PAGE_SIZE);
  }, [filteredSales, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ===================================================
  // KPI DATA
  // ===================================================

  const activeSales = sales.filter((sale) => !sale.isDeleted);

  const totalRevenue = activeSales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount || 0),
    0,
  );

  const amountReceived = activeSales.reduce(
    (sum, sale) => sum + Number(sale.amountPaid || 0),
    0,
  );

  const outstandingBalance = activeSales.reduce(
    (sum, sale) => sum + Number(sale.balance || 0),
    0,
  );

  const totalTransactions = activeSales.length;

  const paidCount = activeSales.filter((sale) => sale.status === "Paid").length;

  const partPaidCount = activeSales.filter(
    (sale) => sale.status === "Part Paid",
  ).length;

  const unpaidCount = activeSales.filter(
    (sale) => sale.status === "Unpaid",
  ).length;

  // ===================================================
  // PAYMENT STATUS CHART
  // ===================================================

  const paymentStatusData = [
    {
      name: "Paid",
      value: paidCount,
      color: PAYMENT_STATUS_COLORS.Paid,
    },
    {
      name: "Part Paid",
      value: partPaidCount,
      color: PAYMENT_STATUS_COLORS["Part Paid"],
    },
    {
      name: "Unpaid",
      value: unpaidCount,
      color: PAYMENT_STATUS_COLORS.Unpaid,
    },
  ];

  const paymentStatusTotal = paidCount + partPaidCount + unpaidCount;

  // ===================================================
  // REVENUE CHART
  // ===================================================

  const revenueChartData = useMemo(() => {
    const grouped = {};

    activeSales.forEach((sale) => {
      const date = new Date(sale.date || sale.createdAt);

      if (Number.isNaN(date.getTime())) return;

      const key = date.toISOString().split("T")[0];

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          revenue: 0,
          paid: 0,
        };
      }

      grouped[key].revenue += Number(sale.totalAmount || 0);
      grouped[key].paid += Number(sale.amountPaid || 0);
    });

    return Object.values(grouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((item) => ({
        ...item,
        label: new Date(`${item.date}T12:00:00`).toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
        }),
      }));
  }, [activeSales]);

  // ===================================================
  // CATEGORY TOTALS
  // ===================================================

  const categoryTotals = useMemo(() => {
    const totals = {
      big: 0,
      jumbo: 0,
      turkey: 0,
      normal: 0,
      small: 0,
    };

    activeSales.forEach((sale) => {
      if (Array.isArray(sale.lineItems)) {
        sale.lineItems.forEach((item) => {
          if (totals[item.category] !== undefined) {
            totals[item.category] += Number(item.cratesSold || 0);
          }
        });
      }
    });

    return totals;
  }, [activeSales]);

  // ===================================================
  // SELECTED CUSTOMER SUMMARY
  // ===================================================

  const historySummary = customerHistory?.summary || {};

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* HEADER */}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Egg Sales</h1>
          <p className="mt-1 text-sm text-gray-500">
            Record egg sales, customer payments and outstanding balances.
          </p>
        </div>

        {editingId && (
          <div className="rounded-lg bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800">
            Editing sale
          </div>
        )}
      </div>

      {/* KPI CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {totalTransactions.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Sales Revenue</p>
          <p className="mt-1 text-2xl font-bold text-green-700">
            {formatCurrency(totalRevenue)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Amount Received</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {formatCurrency(amountReceived)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatCurrency(outstandingBalance)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Paid Sales</p>
          <p className="mt-1 text-2xl font-bold text-green-700">
            {paidCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* SALES FORM */}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border bg-gray-50 p-4 shadow-sm md:p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {editingId ? "Edit Egg Sale" : "Record Egg Sale"}
            </h2>
            <p className="text-sm text-gray-500">
              Select a customer and enter the egg quantities.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {/* CUSTOMER */}

        <div className="rounded-xl border bg-white p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Customer</h3>
              <p className="text-xs text-gray-500">
                Search an existing customer or create a new one.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowQuickAddCustomer(true)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              + New Customer
            </button>
          </div>

          <div className="relative">
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value);
                    setShowCustomerDropdown(true);

                    if (selectedCustomer) {
                      setSelectedCustomer(null);

                      setFormData((previous) => ({
                        ...previous,
                        customerId: "",
                        customer: event.target.value,
                        phone: "",
                      }));
                    }
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Search customer by name, phone or email..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-500"
                />

                {showCustomerDropdown && (
                  <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-white shadow-lg">
                    {customerLoading ? (
                      <div className="p-4 text-sm text-gray-500">
                        Loading customers...
                      </div>
                    ) : filteredCustomers.length > 0 ? (
                      filteredCustomers.map((customer) => (
                        <button
                          type="button"
                          key={customer._id}
                          onClick={() => selectCustomer(customer)}
                          className="block w-full border-b px-4 py-3 text-left last:border-b-0 hover:bg-green-50"
                        >
                          <div className="font-medium text-gray-800">
                            {customer.name}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {customer.phone || "No phone"}
                            {customer.email ? ` • ${customer.email}` : ""}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-gray-500">
                        No matching customer found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <button
                  type="button"
                  onClick={clearSelectedCustomer}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Customer Name
              </label>
              <input
                name="customer"
                value={formData.customer}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Phone
              </label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Sale Date
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>
          </div>

          {selectedCustomer && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <span className="font-semibold">Selected customer:</span>{" "}
              {selectedCustomer.name}
              {selectedCustomer.phone ? ` • ${selectedCustomer.phone}` : ""}
              {selectedCustomer.customerType
                ? ` • ${selectedCustomer.customerType}`
                : ""}
            </div>
          )}
        </div>

        {/* CUSTOMER HISTORY */}

        {selectedCustomer && (
          <div className="rounded-xl border bg-white p-4">
            <h3 className="font-semibold text-gray-800">
              Customer Purchase History
            </h3>

            {historyLoading ? (
              <p className="mt-3 text-sm text-gray-500">
                Loading customer history...
              </p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Transactions</p>
                    <p className="mt-1 font-bold">
                      {Number(
                        historySummary.transactionCount || 0,
                      ).toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Purchases</p>
                    <p className="mt-1 font-bold">
                      {formatCurrency(historySummary.totalPurchases || 0)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Total Paid</p>
                    <p className="mt-1 font-bold text-green-700">
                      {formatCurrency(historySummary.totalPaid || 0)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Outstanding</p>
                    <p className="mt-1 font-bold text-red-600">
                      {formatCurrency(historySummary.totalOutstanding || 0)}
                    </p>
                  </div>
                </div>

                {Array.isArray(customerHistory?.sales) &&
                  customerHistory.sales.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase text-gray-500">
                            <th className="px-3 py-2">Invoice</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Total</th>
                            <th className="px-3 py-2">Payments</th>
                            <th className="px-3 py-2">Balance</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {customerHistory.sales
                            .slice(0, 5)
                            .map((historySale) => (
                              <tr
                                key={historySale._id}
                                className="border-b last:border-0"
                              >
                                <td className="px-3 py-3 font-medium">
                                  {historySale.invoiceNumber}
                                </td>
                                <td className="px-3 py-3">
                                  {formatDate(historySale.date)}
                                </td>
                                <td className="px-3 py-3">
                                  {formatCurrency(historySale.totalAmount)}
                                </td>
                                <td className="px-3 py-3">
                                  {Array.isArray(historySale.payments) &&
                                  historySale.payments.length > 0 ? (
                                    <div className="space-y-1">
                                      {historySale.payments.map(
                                        (payment, index) => (
                                          <div
                                            key={payment._id || index}
                                            className="text-xs"
                                          >
                                            <span className="font-semibold">
                                              {payment.method}:
                                            </span>{" "}
                                            {formatCurrency(payment.amount)}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs">
                                      {historySale.paymentMethod || "-"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3 font-medium text-red-600">
                                  {formatCurrency(historySale.balance)}
                                </td>
                                <td className="px-3 py-3">
                                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">
                                    {historySale.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {/* EGG CATEGORIES */}

        <div className="rounded-xl border bg-white p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Egg Categories</h3>
              <p className="text-xs text-gray-500">
                Enter crates and loose eggs for each category.
              </p>
            </div>

            <button
              type="button"
              onClick={addLineItem}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              + Add Category
            </button>
          </div>

          <div className="space-y-3">
            {lineItemsWithSubtotal.map((item, index) => (
              <div key={index} className="rounded-xl border bg-gray-50 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Egg Category
                    </label>
                    <select
                      value={item.category}
                      onChange={(event) =>
                        updateLineItem(index, "category", event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
                    >
                      {EGG_CATEGORIES.map((category) => {
                        const alreadyUsed = lineItems.some(
                          (line, lineIndex) =>
                            lineIndex !== index &&
                            line.category === category.value,
                        );

                        return (
                          <option
                            key={category.value}
                            value={category.value}
                            disabled={alreadyUsed}
                          >
                            {category.label} —{" "}
                            {formatCurrency(
                              EGG_CATEGORY_PRICES[category.value],
                            )}{" "}
                            / crate
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Crates
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.cratesSold}
                      onChange={(event) =>
                        updateLineItem(index, "cratesSold", event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Loose Eggs
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.looseEggs}
                      onChange={(event) =>
                        updateLineItem(index, "looseEggs", event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1 rounded-lg bg-white px-3 py-2">
                      <p className="text-xs text-gray-500">Subtotal</p>
                      <p className="font-bold text-gray-800">
                        {formatCurrency(item.subtotal)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* EXTRA CHARGES */}

        <div className="rounded-xl border bg-white p-4">
          <h3 className="mb-4 font-semibold text-gray-800">
            Charges & Adjustments
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Discount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                name="discount"
                value={formData.discount}
                onChange={handleChange}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Transport Charge
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                name="transportCharge"
                value={formData.transportCharge}
                onChange={handleChange}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Remarks
              </label>
              <input
                type="text"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                placeholder="Optional remarks"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>
          </div>
        </div>

        {/* SEGMENTED PAYMENTS */}

        <div className="rounded-xl border bg-white p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Payment Breakdown</h3>
              <p className="mt-1 text-xs text-gray-500">
                Customers can pay using Cash, Transfer, POS, or a combination of
                methods.
              </p>
            </div>

            <button
              type="button"
              onClick={addPaymentRow}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add Payment
            </button>
          </div>

          <div className="space-y-3">
            {payments.map((payment, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 rounded-xl border bg-gray-50 p-3 md:grid-cols-[1fr_1fr_auto]"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Payment Method
                  </label>
                  <select
                    value={payment.method}
                    onChange={(event) =>
                      handlePaymentChange(index, "method", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.amount}
                    onChange={(event) =>
                      handlePaymentChange(index, "amount", event.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removePaymentRow(index)}
                    disabled={payments.length === 1}
                    className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {paymentBreakdown.map((item) => (
              <div key={item.method} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{item.method}</p>
                <p className="mt-1 font-bold text-gray-800">
                  {formatCurrency(item.amount)}
                </p>
              </div>
            ))}

            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-xs text-green-700">Total Paid</p>
              <p className="mt-1 font-bold text-green-800">
                {formatCurrency(totalPayments)}
              </p>
            </div>
          </div>

          {totalPayments > grandTotal && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              Payment total of {formatCurrency(totalPayments)} cannot exceed the
              sale total of {formatCurrency(grandTotal)}.
            </div>
          )}
        </div>

        {/* TOTALS */}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-4 font-semibold text-gray-800">Sale Summary</h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Eggs Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(itemsTotal)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Transport</span>
                <span className="font-medium">
                  {formatCurrency(formData.transportCharge)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(formData.discount)}
                </span>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-800">Grand Total</span>
                  <span className="text-xl font-bold text-gray-900">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-4 font-semibold text-gray-800">
              Payment Summary
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Paid</span>
                <span className="font-bold text-green-700">
                  {formatCurrency(totalPayments)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Balance</span>
                <span
                  className={`font-bold ${
                    balance > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {formatCurrency(balance)}
                </span>
              </div>

              <div className="flex justify-between border-t pt-3">
                <span className="font-semibold">Status</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    paymentStatus === "Paid"
                      ? "bg-green-100 text-green-700"
                      : paymentStatus === "Part Paid"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {paymentStatus}
                </span>
              </div>

              {normalizedPayments.length > 1 && (
                <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                  Multiple payment methods will be saved as{" "}
                  <strong>Mixed</strong> by the server.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FORM BUTTONS */}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={saving || totalPayments > grandTotal}
            className="rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Egg Sale"
                : "Save Egg Sale"}
          </button>
        </div>
      </form>

      {/* CHARTS */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* PAYMENT STATUS DONUT */}

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-800">Payment Status</h2>

          {paymentStatusTotal > 0 ? (
            <div className="relative h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {paymentStatusData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        stroke={entry.color}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value, name) => [
                      Number(value).toLocaleString(),
                      name,
                    ]}
                  />

                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => (
                      <span className="text-sm text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-500">
                    {paymentStatusTotal.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-400">
                    Total
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center text-sm text-gray-500">
              No payment data yet.
            </div>
          )}
        </div>

        {/* REVENUE CHART */}

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-800">Recent Revenue</h2>

          {revenueChartData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={revenueChartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />

                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                    axisLine={{ stroke: "#D1D5DB" }}
                    tickLine={false}
                  />

                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      borderRadius: "10px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />

                  <Legend />

                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#16A34A"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={45}
                  />

                  <Bar
                    dataKey="paid"
                    name="Paid"
                    fill="#2563EB"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={45}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center text-sm text-gray-500">
              No revenue data yet.
            </div>
          )}
        </div>
      </div>

      {/* EGG CATEGORY SUMMARY */}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">
          Crates Sold by Category
        </h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {EGG_CATEGORIES.map((category) => (
            <div key={category.value} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{category.label}</p>
              <p className="mt-1 text-lg font-bold">
                {Number(categoryTotals[category.value] || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">crates</p>
            </div>
          ))}
        </div>
      </div>

      {/* SALES LIST */}

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Egg Sales Records</h2>
              <p className="text-xs text-gray-500">
                {filteredSales.length.toLocaleString()} record
                {filteredSales.length === 1 ? "" : "s"} found
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoice, customer or phone..."
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-green-500 md:w-72"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Part Paid">Part Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>

              {isSuperadmin && (
                <button
                  type="button"
                  onClick={() => setShowDeleted((previous) => !previous)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    showDeleted
                      ? "bg-red-600 text-white"
                      : "border border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  {showDeleted ? "Showing Deleted" : "Show Deleted"}
                </button>
              )}

              <button
                type="button"
                onClick={loadSales}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading egg sales...
          </div>
        ) : paginatedSales.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            No egg sales found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1300px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Categories</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Payment Breakdown</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedSales.map((sale) => (
                    <tr
                      key={sale._id}
                      className="border-t align-top hover:bg-gray-50"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        {formatDate(sale.date)}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap font-semibold">
                        {sale.invoiceNumber}
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium">{sale.customer}</div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        {sale.phone || "-"}
                      </td>

                      <td className="px-4 py-4">
                        {Array.isArray(sale.lineItems) &&
                        sale.lineItems.length > 0 ? (
                          <div className="space-y-1">
                            {sale.lineItems.map((item, index) => (
                              <div key={item._id || index} className="text-xs">
                                <span className="font-semibold">
                                  {EGG_CATEGORIES.find(
                                    (category) =>
                                      category.value === item.category,
                                  )?.label || item.category}
                                </span>
                                :{" "}
                                {Number(item.cratesSold || 0).toLocaleString()}{" "}
                                crates
                                {Number(item.looseEggs || 0) > 0
                                  ? ` + ${Number(
                                      item.looseEggs,
                                    ).toLocaleString()} loose`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">
                            Legacy sale
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap font-semibold">
                        {formatCurrency(sale.totalAmount)}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-green-700">
                        {formatCurrency(sale.amountPaid)}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-red-600">
                        {formatCurrency(sale.balance)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
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

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            sale.paymentMethod === "Mixed"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {sale.paymentMethod || "-"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {Array.isArray(sale.payments) &&
                        sale.payments.length > 0 ? (
                          <div className="min-w-[150px] space-y-1">
                            {sale.payments.map((payment, index) => (
                              <div
                                key={payment._id || index}
                                className="whitespace-nowrap text-xs"
                              >
                                <span className="font-semibold">
                                  {payment.method}:
                                </span>{" "}
                                {formatCurrency(payment.amount)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {sale.paymentMethod || "-"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleInvoice(sale)}
                            className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            Invoice
                          </button>

                          {!sale.isDeleted && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(sale)}
                                className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(sale)}
                                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </>
                          )}

                          {isSuperadmin && sale.isDeleted && (
                            <button
                              type="button"
                              onClick={() => handleRestore(sale)}
                              className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing{" "}
                {filteredSales.length === 0
                  ? 0
                  : (currentPage - 1) * PAGE_SIZE + 1}{" "}
                to {Math.min(currentPage * PAGE_SIZE, filteredSales.length)} of{" "}
                {filteredSales.length}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((previous) => Math.max(1, previous - 1))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="px-2 text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((previous) =>
                      Math.min(totalPages, previous + 1),
                    )
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SUPERADMIN SUMMARY */}

      {isSuperadmin && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-800">Sales Summary</h2>

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-xs text-green-700">Paid</p>
              <p className="mt-1 text-2xl font-bold text-green-800">
                {paidCount}
              </p>
            </div>

            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-xs text-yellow-700">Part Paid</p>
              <p className="mt-1 text-2xl font-bold text-yellow-800">
                {partPaidCount}
              </p>
            </div>

            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-xs text-red-700">Unpaid</p>
              <p className="mt-1 text-2xl font-bold text-red-800">
                {unpaidCount}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-600">Deleted Records</p>
              <p className="mt-1 text-2xl font-bold text-gray-800">
                {sales.filter((sale) => sale.isDeleted).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL */}

      {showQuickAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Add New Customer
                </h2>
                <p className="text-sm text-gray-500">
                  The new customer will be automatically selected for this sale.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQuickAddCustomer(false)}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Name
                </label>
                <input
                  name="name"
                  value={newCustomer.name}
                  onChange={handleNewCustomerChange}
                  required
                  autoFocus
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Phone
                  </label>
                  <input
                    name="phone"
                    value={newCustomer.phone}
                    onChange={handleNewCustomerChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={newCustomer.email}
                    onChange={handleNewCustomerChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Address
                </label>
                <textarea
                  name="address"
                  value={newCustomer.address}
                  onChange={handleNewCustomerChange}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Customer Type
                </label>
                <select
                  name="customerType"
                  value={newCustomer.customerType}
                  onChange={handleNewCustomerChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
                >
                  <option value="Individual">Individual</option>
                  <option value="Supermarket">Supermarket</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Wholesaler">Wholesaler</option>
                  <option value="Retailer">Retailer</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={newCustomer.notes}
                  onChange={handleNewCustomerChange}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddCustomer(false)}
                  disabled={savingCustomer}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {savingCustomer ? "Creating..." : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}

      {showInvoice && selectedSale && (
        <InvoiceModal
          sale={selectedSale}
          onClose={() => {
            setShowInvoice(false);
            setSelectedSale(null);
          }}
        />
      )}
    </div>
  );
}
