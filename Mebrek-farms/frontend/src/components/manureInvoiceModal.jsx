import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useReactToPrint } from "react-to-print";
import { generateManureInvoice } from "../utils/manureInvoiceGenerator";

const MANURE_CATEGORY_LABELS = {
  dry: "Dry Manure",
  wet: "Wet Manure",
};

export default function ManureInvoiceModal({ open, onClose, sale }) {
  const printRef = useRef();

  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    if (!sale) return;

    const value = `
MEBREK FARMS
Customer: ${sale.customer}
Invoice Date: ${new Date(sale.date).toLocaleDateString()}
Amount Paid: ₦${sale.amountPaid}
Balance: ₦${sale.balance}
`;

    QRCode.toDataURL(value).then(setQrCode);
  }, [sale]);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Manure-Invoice-${sale?.customer}`,
  });

  if (!open || !sale) return null;

  const lineItems = sale.lineItems || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl">
        {/* HEADER */}

        <div className="flex justify-between items-center border-b p-5">
          <h2 className="text-2xl font-bold">Invoice Preview</h2>

          <button onClick={onClose} className="text-red-600 font-bold text-xl">
            ✕
          </button>
        </div>

        {/* BODY */}

        <div ref={printRef} className="p-8 bg-white">
          {/* COMPANY */}

          <div className="flex justify-between">
            <div>
              <h1 className="text-4xl font-bold text-amber-800">
                MEBREK FARMS
              </h1>

              <p>Egg Production & Livestock</p>

              <p>Eket, Akwa Ibom. Nigeria</p>

              <p>Phone: +234 903 372 3103</p>

              <p>Email: info@mebrekfarms.com</p>
            </div>

            <div className="text-right">
              <h2 className="text-3xl font-bold">MANURE INVOICE</h2>

              <p>{new Date(sale.date).toLocaleDateString()}</p>

              <p className="text-sm text-gray-500">{sale.invoiceNumber}</p>
            </div>
          </div>

          {/* CUSTOMER */}

          <div className="mt-10">
            <h3 className="font-bold text-xl mb-2">Customer Details</h3>

            <p>
              <strong>Name:</strong> {sale.customer}
            </p>
          </div>

          {/* TABLE */}

          <table className="w-full mt-8 border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-3 text-left">Item</th>

                <th className="border p-3">Bags</th>

                <th className="border p-3">Price / Bag</th>

                <th className="border p-3">Total</th>
              </tr>
            </thead>

            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border p-3 text-center text-gray-500">
                    No item details recorded for this sale.
                  </td>
                </tr>
              ) : (
                lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="border p-3">
                      {MANURE_CATEGORY_LABELS[item.category] || item.category}
                    </td>

                    <td className="border p-3 text-center">
                      {item.bags || 0}
                    </td>

                    <td className="border p-3 text-center">
                      ₦{Number(item.pricePerBag || 0).toLocaleString()}
                    </td>

                    <td className="border p-3 text-right">
                      ₦{Number(item.subtotal || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* TOTALS */}

          <div className="mt-8 flex justify-end">
            <div className="w-72">
              <div className="flex justify-between py-2">
                <span>Subtotal</span>

                <span>₦{sale.totalAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-2">
                <span>Discount</span>

                <span>₦{sale.discount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-2">
                <span>Paid</span>

                <span>₦{sale.amountPaid.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-2 text-xl font-bold border-t">
                <span>Balance</span>

                <span>₦{sale.balance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* QR */}

          <div className="mt-12 flex justify-between items-end">
            <div>
              <p className="font-bold">Authorized Signature</p>

              <div className="border-b w-52 mt-10"></div>
            </div>

            {qrCode && <img src={qrCode} alt="QR Code" className="w-32 h-32" />}
          </div>
        </div>

        {/* FOOTER */}

        <div className="border-t p-5 flex justify-end gap-4">
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-6 py-2 rounded"
          >
            Print
          </button>

          <button
            onClick={() => generateManureInvoice(sale)}
            className="bg-amber-700 text-white px-6 py-2 rounded"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
