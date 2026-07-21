import React, { useRef, useEffect, useState, forwardRef } from "react";

import { useReactToPrint } from "react-to-print";

import {
  fetchInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  restoreInvoice,
  fetchDeletedInvoices,
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

  const [editingId, setEditingId] = useState(null);

  const [showDeleted, setShowDeleted] = useState(false);

  const [deletedInvoices, setDeletedInvoices] = useState([]);

  const role = localStorage.getItem("role");

  const [viewInvoice, setViewInvoice] = useState(null);

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

    if (role === "superadmin") {
      loadDeletedInvoices();
    }
  }, []);

  const loadInvoices = async () => {
    try {
      const data = await fetchInvoices();

      setInvoices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDeletedInvoices = async () => {
    try {
      const data = await fetchDeletedInvoices();

      setDeletedInvoices(data);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= CREATE INVOICE =================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        quantity: Number(formData.quantity),
        unitPrice: Number(formData.unitPrice),
        amountPaid: Number(formData.amountPaid || 0),
        transportCost: Number(formData.transportCost || 0),
      };

      if (editingId) {
        await updateInvoice(editingId, payload);
      } else {
        await createInvoice(payload);
      }

      setEditingId(null);

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

      if (role === "superadmin") {
        loadDeletedInvoices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ================= DELETE INVOICE =================

  const handleDelete = async (id) => {
    try {
      await deleteInvoice(id);

      loadInvoices();

      if (role === "superadmin") {
        loadDeletedInvoices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ================= EDIT INVOICE =================

  const handleEdit = (invoice) => {
    setEditingId(invoice._id);

    setFormData({
      supplier: invoice.supplier,
      feedName: invoice.feedName,
      quantity: invoice.quantity,
      unit: invoice.unit,
      unitPrice: invoice.unitPrice,
      purchaseDate: invoice.purchaseDate?.slice(0, 10),
      receivedDate: invoice.receivedDate?.slice(0, 10),
      paymentStatus: invoice.paymentStatus,
      paymentMethod: invoice.paymentMethod,
      amountPaid: invoice.amountPaid,
      transportCost: invoice.transportCost,
      vehicleNumber: invoice.vehicleNumber,
      driverName: invoice.driverName,
      receivedBy: invoice.receivedBy,
      warehouseLocation: invoice.warehouseLocation,
      remarks: invoice.remarks,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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
          {editingId ? "Save Changes" : "Create Invoice"}
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
                  {invoice.isDeleted && (
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded mr-2">
                      Deleted
                    </span>
                  )}

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
                    onClick={() => setViewInvoice(invoice)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded"
                  >
                    View
                  </button>

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
                    onClick={() => handleEdit(invoice)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                  >
                    Edit
                  </button>

                  {invoice.isDeleted ? (
                    <button
                      onClick={() =>
                        restoreInvoice(invoice._id).then(loadInvoices)
                      }
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(invoice._id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  )}
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

      {/* ================= VIEW INVOICE MODAL ================= */}

      {viewInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 relative">
            <button
              onClick={() => setViewInvoice(null)}
              className="absolute right-4 top-4 text-gray-500 text-xl"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-green-700 mb-6">
              Feed Invoice Details
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Invoice Number</strong>
                <p>{viewInvoice.invoiceNumber}</p>
              </div>

              <div>
                <strong>Supplier</strong>
                <p>{viewInvoice.supplier}</p>
              </div>

              <div>
                <strong>Feed</strong>
                <p>{viewInvoice.feedName}</p>
              </div>

              <div>
                <strong>Quantity</strong>
                <p>
                  {viewInvoice.quantity} {viewInvoice.unit}
                </p>
              </div>

              <div>
                <strong>Unit Price</strong>
                <p>₦{Number(viewInvoice.unitPrice).toLocaleString()}</p>
              </div>

              <div>
                <strong>Total Cost</strong>
                <p>₦{Number(viewInvoice.totalCost).toLocaleString()}</p>
              </div>

              <div>
                <strong>Amount Paid</strong>
                <p>₦{Number(viewInvoice.amountPaid).toLocaleString()}</p>
              </div>

              <div>
                <strong>Payment Method</strong>
                <p>{viewInvoice.paymentMethod}</p>
              </div>

              <div>
                <strong>Status</strong>
                <p>{viewInvoice.paymentStatus}</p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm mb-1">
                <span>Payment Progress</span>

                <span>
                  {Math.round(
                    ((viewInvoice.amountPaid || 0) /
                      (viewInvoice.totalCost || 1)) *
                      100,
                  )}
                  %
                </span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full"
                  style={{
                    width: `${
                      ((viewInvoice.amountPaid || 0) /
                        (viewInvoice.totalCost || 1)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            {role === "superadmin" && (
              <>
                <hr className="my-6" />

                <h3 className="text-lg font-semibold text-red-700 mb-4">
                  Audit Trail
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Created By</strong>
                    <p>{viewInvoice.createdBy || "-"}</p>
                  </div>

                  <div>
                    <strong>Created At</strong>
                    <p>
                      {viewInvoice.createdAt
                        ? new Date(viewInvoice.createdAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <strong>Updated By</strong>
                    <p>{viewInvoice.updatedBy || "-"}</p>
                  </div>

                  <div>
                    <strong>Updated At</strong>
                    <p>
                      {viewInvoice.updatedAt
                        ? new Date(viewInvoice.updatedAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <strong>Deleted By</strong>
                    <p>{viewInvoice.deletedBy || "-"}</p>
                  </div>

                  <div>
                    <strong>Deleted At</strong>
                    <p>
                      {viewInvoice.deletedAt
                        ? new Date(viewInvoice.deletedAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <strong>Restored By</strong>
                    <p>{viewInvoice.restoredBy || "-"}</p>
                  </div>

                  <div>
                    <strong>Restored At</strong>
                    <p>
                      {viewInvoice.restoredAt
                        ? new Date(viewInvoice.restoredAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
