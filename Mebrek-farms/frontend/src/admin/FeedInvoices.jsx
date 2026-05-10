import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useEffect, useState } from "react";

import {
  fetchInvoices,
  createInvoice,
  deleteInvoice,
} from "../services/feedInvoiceService";

export default function FeedInvoices() {

  const [invoices, setInvoices] = useState([]);

  const [formData, setFormData] = useState({
    supplier: "",
    feedName: "",
    quantity: "",
    unitPrice: "",
    paymentStatus: "Pending",
  });

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

      <h1 className="text-3xl font-bold mb-6">
        🧾 Feed Purchase Invoices
      </h1>

      {/* FORM */}

      <form
        onSubmit={handleSubmit}
        className="grid md:grid-cols-2 gap-4 mb-8"
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

        <button className="bg-green-600 text-white rounded-lg">
          Create Invoice
        </button>

      </form>

      {/* TABLE */}

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
              <th>Action</th>
            </tr>

          </thead>

          <tbody>

            {invoices.map((invoice) => (

              <tr
                key={invoice._id}
                className="border-b"
              >

                <td className="p-3">
                  {invoice.supplier}
                </td>

                <td>
                  {invoice.feedName}
                </td>

                <td>
                  {invoice.quantity}
                </td>

                <td>
                  ₦{invoice.unitPrice}
                </td>

                <td className="font-bold text-green-700">
                  ₦{invoice.totalCost}
                </td>

                <td>
                  {invoice.paymentStatus}
                </td>

                <td>
                  <button
                    onClick={() =>
                      handleDelete(invoice._id)
                    }
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
