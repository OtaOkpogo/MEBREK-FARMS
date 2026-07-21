import React, { useRef, useEffect, useState, forwardRef } from "react";

import { useReactToPrint } from "react-to-print";

import {
  fetchInvoices,
  createInvoice,
  deleteInvoice,
} from "../services/feedInvoiceService";

// ================= PRINTABLE COMPONENT =================

const PrintableInvoice = forwardRef(({ invoice }, ref) => {
  return (
    <div ref={ref} className="p-10 bg-white text-black min-h-screen">
      <div className="border-b pb-6 mb-6">
        <h1 className="text-4xl font-bold text-green-700">MEBREK FARMS</h1>

        <p className="text-gray-600">Premium Poultry & Feed Management</p>
      </div>

      <h2 className="text-2xl font-bold mb-8">🧾 Feed Purchase Invoice</h2>

      <div className="space-y-4 text-lg">
        <p>
          <strong>Supplier:</strong> {invoice.supplier}
        </p>

        <p>
          <strong>Feed Name:</strong> {invoice.feedName}
        </p>

        <p>
          <strong>Quantity:</strong> {invoice.quantity}
        </p>

        <p>
          <strong>Unit Price:</strong> ₦{invoice.unitPrice}
        </p>

        <p>
          <strong>Total Cost:</strong> ₦{invoice.totalCost}
        </p>

        <p>
          <strong>Payment Status:</strong> {invoice.paymentStatus}
        </p>

        <p>
          <strong>Date:</strong> {new Date(invoice.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="mt-20">
        <p className="mb-10">Authorized Signature</p>

        <div className="border-b border-black w-64"></div>
      </div>
    </div>
  );
});

// ================= MAIN COMPONENT =================

export default function FeedInvoices() {
  const [invoices, setInvoices] = useState([]);

  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const componentRef = useRef();

  const [formData, setFormData] = useState({
    supplier: "",

    feedName: "",

    quantity: "",

    unit: "bags",

    unitPrice: "",

    purchaseDate: new Date().toISOString().slice(0, 10),

    receivedDate: new Date().toISOString().slice(0, 10),

    paymentStatus: "Pending",

    paymentMethod: "Cash",

    amountPaid: "",

    transportCost: "",

    vehicleNumber: "",

    driverName: "",

    receivedBy: "",

    warehouseLocation: "",

    remarks: "",
  });

  // ================= PRINT FUNCTION =================

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  // ================= LOAD INVOICES =================

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const data = await fetchInvoices();

      setInvoices(data);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= CREATE INVOICE =================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await createInvoice({
        ...formData,
        quantity: Number(formData.quantity),
        unitPrice: Number(formData.unitPrice),
        amountPaid: Number(formData.amountPaid || 0),
        transportCost: Number(formData.transportCost || 0),
      });

      setFormData({
        supplier: "",
        feedName: "",
        quantity: "",
        unit: "bags",
        unitPrice: "",
        purchaseDate: new Date().toISOString().slice(0, 10),
        receivedDate: new Date().toISOString().slice(0, 10),
        paymentStatus: "Pending",
        paymentMethod: "Cash",
        amountPaid: "",
        transportCost: "",
        vehicleNumber: "",
        driverName: "",
        receivedBy: "",
        warehouseLocation: "",
        remarks: "",
      });

      loadInvoices();
    } catch (err) {
      console.error(err);
    }
  };

  // ================= DELETE INVOICE =================

  const handleDelete = async (id) => {
    try {
      await deleteInvoice(id);

      loadInvoices();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      {/* HEADER */}

      <h1 className="text-3xl font-bold mb-6">🧾 Feed Purchase Invoices</h1>

      {/* ================= FORM ================= */}

      <form
        onSubmit={handleSubmit}
        className="grid md:grid-cols-2 gap-4 mb-8 bg-white p-6 rounded-lg shadow"
      >
        <input
          type="text"
          placeholder="Supplier"
          value={formData.supplier}
          onChange={(e) =>
            setFormData({ ...formData, supplier: e.target.value })
          }
          className="border p-3 rounded-lg"
          required
        />

        <input
          type="text"
          placeholder="Feed Name"
          value={formData.feedName}
          onChange={(e) =>
            setFormData({ ...formData, feedName: e.target.value })
          }
          className="border p-3 rounded-lg"
          required
        />

        <input
          type="number"
          placeholder="Quantity"
          value={formData.quantity}
          onChange={(e) =>
            setFormData({ ...formData, quantity: e.target.value })
          }
          className="border p-3 rounded-lg"
          required
        />

        <select
          value={formData.unit}
          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
          className="border p-3 rounded-lg"
        >
          <option>bags</option>
          <option>kg</option>
          <option>tons</option>
        </select>

        <input
          type="number"
          placeholder="Unit Price"
          value={formData.unitPrice}
          onChange={(e) =>
            setFormData({ ...formData, unitPrice: e.target.value })
          }
          className="border p-3 rounded-lg"
          required
        />

        <input
          type="date"
          value={formData.purchaseDate}
          onChange={(e) =>
            setFormData({ ...formData, purchaseDate: e.target.value })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="date"
          value={formData.receivedDate}
          onChange={(e) =>
            setFormData({ ...formData, receivedDate: e.target.value })
          }
          className="border p-3 rounded-lg"
        />

        <select
          value={formData.paymentStatus}
          onChange={(e) =>
            setFormData({ ...formData, paymentStatus: e.target.value })
          }
          className="border p-3 rounded-lg"
        >
          <option>Pending</option>
          <option>Paid</option>
        </select>

        <select
          value={formData.paymentMethod}
          onChange={(e) =>
            setFormData({ ...formData, paymentMethod: e.target.value })
          }
          className="border p-3 rounded-lg"
        >
          <option>Cash</option>
          <option>Bank Transfer</option>
          <option>POS</option>
          <option>Cheque</option>
          <option>Credit</option>
        </select>

        <input
          type="number"
          placeholder="Amount Paid"
          value={formData.amountPaid}
          onChange={(e) =>
            setFormData({ ...formData, amountPaid: e.target.value })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="number"
          placeholder="Transport Cost"
          value={formData.transportCost}
          onChange={(e) =>
            setFormData({ ...formData, transportCost: e.target.value })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Vehicle Number"
          value={formData.vehicleNumber}
          onChange={(e) =>
            setFormData({ ...formData, vehicleNumber: e.target.value })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Driver Name"
          value={formData.driverName}
          onChange={(e) =>
            setFormData({ ...formData, driverName: e.target.value })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Received By"
          value={formData.receivedBy}
          onChange={(e) =>
            setFormData({ ...formData, receivedBy: e.target.value })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Warehouse Location"
          value={formData.warehouseLocation}
          onChange={(e) =>
            setFormData({
              ...formData,
              warehouseLocation: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
        />

        <textarea
          placeholder="Remarks"
          value={formData.remarks}
          onChange={(e) =>
            setFormData({ ...formData, remarks: e.target.value })
          }
          className="border p-3 rounded-lg md:col-span-2"
          rows={3}
        />

        <button className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-3 font-semibold md:col-span-2">
          Create Invoice
        </button>
      </form>

      {/* ================= TABLE ================= */}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-green-700 text-white">
            <tr>
              <th className="p-3 whitespace-nowrap">Invoice No.</th>
              <th className="whitespace-nowrap">Purchase Date</th>
              <th className="whitespace-nowrap">Supplier</th>
              <th className="whitespace-nowrap">Feed</th>
              <th className="whitespace-nowrap">Qty</th>
              <th className="whitespace-nowrap">Unit</th>
              <th className="whitespace-nowrap">Unit Price</th>
              <th className="whitespace-nowrap">Total Cost</th>
              <th className="whitespace-nowrap">Paid</th>
              <th className="whitespace-nowrap">Balance</th>
              <th className="whitespace-nowrap">Payment</th>
              <th className="whitespace-nowrap">Vehicle</th>
              <th className="whitespace-nowrap">Driver</th>
              <th className="whitespace-nowrap">Warehouse</th>
              <th className="whitespace-nowrap">Received By</th>
              <th className="whitespace-nowrap">Status</th>
              <th className="whitespace-nowrap">Actions</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice._id} className="border-b hover:bg-green-50">
                <td className="p-3 font-semibold text-green-700">
                  {invoice.invoiceNumber}
                </td>

                <td>
                  {invoice.purchaseDate
                    ? new Date(invoice.purchaseDate).toLocaleDateString()
                    : "-"}
                </td>

                <td>{invoice.supplier}</td>

                <td>{invoice.feedName}</td>

                <td>{invoice.quantity}</td>

                <td>{invoice.unit}</td>

                <td>₦{Number(invoice.unitPrice).toLocaleString()}</td>

                <td className="font-semibold text-green-700">
                  ₦{Number(invoice.totalCost).toLocaleString()}
                </td>

                <td className="text-blue-700 font-medium">
                  ₦{Number(invoice.amountPaid || 0).toLocaleString()}
                </td>

                <td
                  className={`font-semibold ${
                    invoice.balance > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  ₦{Number(invoice.balance || 0).toLocaleString()}
                </td>

                <td>{invoice.paymentMethod}</td>

                <td>{invoice.vehicleNumber || "-"}</td>

                <td>{invoice.driverName || "-"}</td>

                <td>{invoice.warehouseLocation || "-"}</td>

                <td>{invoice.receivedBy || "-"}</td>

                <td>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold
          ${
            invoice.paymentStatus === "Paid"
              ? "bg-green-100 text-green-700"
              : invoice.paymentStatus === "Partially Paid"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
          }`}
                  >
                    {invoice.paymentStatus}
                  </span>
                </td>

                <td className="flex gap-2 p-3">
                  <button
                    onClick={() => {
                      setSelectedInvoice(invoice);

                      setTimeout(() => {
                        handlePrint();
                      }, 100);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                  >
                    Print
                  </button>

                  <button
                    onClick={() => handleDelete(invoice._id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= HIDDEN PRINT AREA ================= */}

      <div className="hidden">
        {selectedInvoice && (
          <PrintableInvoice ref={componentRef} invoice={selectedInvoice} />
        )}
      </div>
    </div>
  );
}
