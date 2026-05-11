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
    unitPrice: "",
    paymentStatus: "Pending",
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
      await createInvoice(formData);

      setFormData({
        supplier: "",
        feedName: "",
        quantity: "",
        unitPrice: "",
        paymentStatus: "Pending",
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
            setFormData({
              ...formData,
              supplier: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
          required
        />

        <input
          type="text"
          placeholder="Feed Name"
          value={formData.feedName}
          onChange={(e) =>
            setFormData({
              ...formData,
              feedName: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
          required
        />

        <input
          type="number"
          placeholder="Quantity"
          value={formData.quantity}
          onChange={(e) =>
            setFormData({
              ...formData,
              quantity: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
          required
        />

        <input
          type="number"
          placeholder="Unit Price"
          value={formData.unitPrice}
          onChange={(e) =>
            setFormData({
              ...formData,
              unitPrice: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
          required
        />

        <select
          value={formData.paymentStatus}
          onChange={(e) =>
            setFormData({
              ...formData,
              paymentStatus: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
        >
          <option>Pending</option>
          <option>Paid</option>
        </select>

        <button className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-3 font-semibold transition">
          Create Invoice
        </button>
      </form>

      {/* ================= TABLE ================= */}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-green-700 text-white">
            <tr>
              <th className="p-3">Supplier</th>
              <th>Feed</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice._id} className="border-b hover:bg-gray-50">
                <td className="p-3">{invoice.supplier}</td>

                <td>{invoice.feedName}</td>

                <td>{invoice.quantity}</td>

                <td>₦{invoice.unitPrice}</td>

                <td className="font-bold text-green-700">
                  ₦{invoice.totalCost}
                </td>

                <td>{invoice.paymentStatus}</td>

                <td className="flex gap-2 p-3">
                  {/* PRINT BUTTON */}

                  <button
                    onClick={() => {
                      setSelectedInvoice(invoice);

                      setTimeout(() => {
                        handlePrint();
                      }, 100);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Print
                  </button>

                  {/* DELETE BUTTON */}

                  <button
                    onClick={() => handleDelete(invoice._id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
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
