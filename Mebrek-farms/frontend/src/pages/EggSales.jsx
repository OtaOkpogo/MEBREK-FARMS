import { useEffect, useMemo, useState } from "react";
import InvoiceModal from "../components/InvoiceModal";

import {
  fetchSales,
  createSale,
  deleteSale,
} from "../services/eggSalesService";

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

export default function EggSales() {
  // ==========================================
  // STATE
  // ==========================================

  const [sales, setSales] = useState([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [selectedSale, setSelectedSale] = useState(null);

  const [showInvoice, setShowInvoice] = useState(false);

  const [statusFilter, setStatusFilter] = useState("All");

  const [formData, setFormData] = useState({
    customer: "",
    phone: "",
    date: "",

    cratesSold: "",

    looseEggs: "",

    cratePrice: "",

    eggPrice: "",

    discount: "",

    transportCharge: "",

    amountPaid: "",

    paymentMethod: "Cash",

    remarks: "",
  });

  // ==========================================
  // LOAD SALES
  // ==========================================

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setLoading(true);

      const data = await fetchSales();

      setSales(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FORM CHANGE
  // ==========================================

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // ==========================================
  // LIVE CALCULATIONS
  // ==========================================

  const cratesTotal =
    Number(formData.cratesSold || 0) * Number(formData.cratePrice || 0);

  const looseEggTotal =
    Number(formData.looseEggs || 0) * Number(formData.eggPrice || 0);

  const grandTotal =
    cratesTotal +
    looseEggTotal +
    Number(formData.transportCharge || 0) -
    Number(formData.discount || 0);

  const balance = grandTotal - Number(formData.amountPaid || 0);

  const paymentStatus =
    balance <= 0
      ? "Paid"
      : Number(formData.amountPaid) > 0
        ? "Part Paid"
        : "Unpaid";

  // ==========================================
  // SAVE SALE
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await createSale({
        ...formData,

        cratesSold: Number(formData.cratesSold),

        looseEggs: Number(formData.looseEggs),

        cratePrice: Number(formData.cratePrice),

        eggPrice: Number(formData.eggPrice),

        discount: Number(formData.discount),

        transportCharge: Number(formData.transportCharge),

        amountPaid: Number(formData.amountPaid),
      });

      alert("Sale recorded successfully.");

      setFormData({
        customer: "",
        phone: "",
        date: "",

        cratesSold: "",

        looseEggs: "",

        cratePrice: "",

        eggPrice: "",

        discount: "",

        transportCharge: "",

        amountPaid: "",

        paymentMethod: "Cash",

        remarks: "",
      });

      loadSales();
    } catch (err) {
      console.error(err);

      alert(err.response?.data?.message || "Unable to save sale.");
    }
  };

  // ==========================================
  // DELETE
  // ==========================================

  const handleDelete = async (id) => {
    if (!window.confirm("Delete sale?")) return;

    try {
      await deleteSale(id);

      loadSales();
    } catch (err) {
      console.error(err);
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

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const customer = sale.customer
        ?.toLowerCase()
        .includes(search.toLowerCase());

      const invoice = sale.invoiceNumber
        ?.toLowerCase()
        .includes(search.toLowerCase());

      const matchesSearch = customer || invoice;

      const matchesStatus =
        statusFilter === "All" ? true : sale.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sales, search, statusFilter]);

  // ==========================================
  // KPI CARDS
  // ==========================================

  const totalRevenue = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount || 0),
    0,
  );

  const amountReceived = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.amountPaid || 0),
    0,
  );

  const outstanding = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.balance || 0),
    0,
  );

  const totalCrates = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.cratesSold || 0),
    0,
  );

  const paymentChart = [
    {
      name: "Paid",
      value: filteredSales.filter((x) => x.status === "Paid").length,
    },
    {
      name: "Part Paid",
      value: filteredSales.filter((x) => x.status === "Part Paid").length,
    },
    {
      name: "Unpaid",
      value: filteredSales.filter((x) => x.status === "Unpaid").length,
    },
  ];

  const COLORS = ["#16a34a", "#f59e0b", "#dc2626"];

  // ==========================================
  // DAILY / WEEKLY / MONTHLY SALES
  // ==========================================

  const today = new Date();

  const dailySales = filteredSales
    .filter((sale) => {
      if (!sale.date) return false;
      return new Date(sale.date).toDateString() === today.toDateString();
    })
    .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);

  const weeklySales = filteredSales
    .filter((sale) => {
      if (!sale.date) return false;

      const diff = (today - new Date(sale.date)) / (1000 * 60 * 60 * 24);

      return diff <= 7;
    })
    .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);

  const monthlySales = filteredSales
    .filter((sale) => {
      if (!sale.date) return false;

      const d = new Date(sale.date);

      return (
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    })
    .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  if (loading) {
    return <div className="p-8">Loading Sales...</div>;
  }
  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* ================= HEADER ================= */}

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

      {/* ================= KPI CARDS ================= */}

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
            {sales.length}
          </p>
        </div>
      </div>

      {/* ================= SEARCH ================= */}

      <div className="bg-white rounded-xl shadow p-5 mb-8">
        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search customer..."
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
      {/* ================= QUICK SUMMARY ================= */}

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
      {/* ================= CHARTS ================= */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Payment Status */}

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
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>

                <Tooltip />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue */}

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-6">Revenue Overview</h2>

          <div style={{ width: "100%", height: 350 }}>
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

      {/* ================= SALES ENTRY FORM ================= */}

      <div className="bg-white rounded-xl shadow p-6 mb-10">
        <h2 className="text-2xl font-bold mb-6">Record Egg Sale</h2>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <input
            type="text"
            name="customer"
            placeholder="Customer Name"
            value={formData.customer}
            onChange={handleChange}
            className="border rounded-lg p-3"
            required
          />

          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            className="border rounded-lg p-3"
          />

          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className="border rounded-lg p-3"
            required
          />

          <input
            type="number"
            name="cratesSold"
            placeholder="Crates Sold"
            value={formData.cratesSold}
            onChange={handleChange}
            className="border rounded-lg p-3"
          />

          <input
            type="number"
            name="cratePrice"
            placeholder="Price Per Crate"
            value={formData.cratePrice}
            onChange={handleChange}
            className="border rounded-lg p-3"
          />

          <input
            type="number"
            name="looseEggs"
            placeholder="Loose Eggs"
            value={formData.looseEggs}
            onChange={handleChange}
            className="border rounded-lg p-3"
          />

          <input
            type="number"
            name="eggPrice"
            placeholder="Price Per Egg"
            value={formData.eggPrice}
            onChange={handleChange}
            className="border rounded-lg p-3"
          />

          <input
            type="number"
            name="discount"
            placeholder="Discount"
            value={formData.discount}
            onChange={handleChange}
            className="border rounded-lg p-3"
          />

          <input
            type="number"
            name="transportCharge"
            placeholder="Transport Charge"
            value={formData.transportCharge}
            onChange={handleChange}
            className="border rounded-lg p-3"
          />

          <input
            type="number"
            name="amountPaid"
            placeholder="Amount Paid"
            value={formData.amountPaid}
            onChange={handleChange}
            className="border rounded-lg p-3"
          />

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

          <textarea
            name="remarks"
            placeholder="Remarks"
            value={formData.remarks}
            onChange={handleChange}
            className="border rounded-lg p-3 md:col-span-2"
          />

          {/* Live Totals */}

          <div className="md:col-span-4 bg-gray-50 rounded-xl p-5 mt-2">
            <div className="grid md:grid-cols-5 gap-4">
              <div>
                <p className="text-gray-500">Crates Total</p>

                <p className="font-bold text-lg">
                  ₦{cratesTotal.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Loose Eggs</p>

                <p className="font-bold text-lg">
                  ₦{looseEggTotal.toLocaleString()}
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
                  ₦{balance.toLocaleString()}
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

          <div className="md:col-span-4">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold"
            >
              Save Sale
            </button>
          </div>
        </form>
      </div>

      {/* ================= SALES TABLE ================= */}

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

                <th className="p-3 text-center">Crates</th>

                <th className="p-3 text-center">Loose Eggs</th>

                <th className="p-3 text-right">Total</th>

                <th className="p-3 text-right">Paid</th>

                <th className="p-3 text-right">Balance</th>

                <th className="p-3 text-center">Status</th>

                <th className="p-3 text-center">Method</th>

                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center py-12 text-gray-500">
                    No sales found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale._id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      {sale.date
                        ? new Date(sale.date).toLocaleDateString()
                        : "-"}
                    </td>

                    <td className="p-3 font-medium">{sale.customer}</td>

                    <td className="p-3">{sale.phone || "-"}</td>

                    <td className="p-3 text-center">{sale.cratesSold}</td>

                    <td className="p-3 text-center">{sale.looseEggs}</td>

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

                    <td className="p-3 space-x-2">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= SALES SUMMARY ================= */}

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

      {/* ================= FOOTER ================= */}

      <div className="text-center text-gray-500 text-sm py-6 border-t">
        <p>Egg Sales Management System</p>

        <p className="mt-1">Built for efficient poultry farm sales tracking.</p>
      </div>
      <InvoiceModal
        open={showInvoice}
        sale={selectedSale}
        onClose={closeInvoice}
      />
    </div>
  );
}
