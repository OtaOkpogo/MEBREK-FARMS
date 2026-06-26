import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useReactToPrint } from "react-to-print";
import { generateInvoice } from "../utils/invoiceGenerator";

export default function InvoiceModal({
  open,
  onClose,
  sale,
}) {
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
    documentTitle: `Invoice-${sale?.customer}`,
  });

  if (!open || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">

      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl">

        {/* HEADER */}

        <div className="flex justify-between items-center border-b p-5">

          <h2 className="text-2xl font-bold">
            Invoice Preview
          </h2>

          <button
            onClick={onClose}
            className="text-red-600 font-bold text-xl"
          >
            ✕
          </button>

        </div>

        {/* BODY */}

        <div
          ref={printRef}
          className="p-8 bg-white"
        >

          {/* COMPANY */}

          <div className="flex justify-between">

            <div>

              <h1 className="text-4xl font-bold text-green-700">
                MEBREK FARMS
              </h1>

              <p>Egg Production & Livestock</p>

              <p>Lagos, Nigeria</p>

              <p>Phone: +234 XXX XXX XXXX</p>

              <p>Email: info@mebrekfarms.com</p>

            </div>

            <div className="text-right">

              <h2 className="text-3xl font-bold">
                INVOICE
              </h2>

              <p>
                {new Date(sale.date).toLocaleDateString()}
              </p>

            </div>

          </div>

          {/* CUSTOMER */}

          <div className="mt-10">

            <h3 className="font-bold text-xl mb-2">
              Customer Details
            </h3>

            <p>
              <strong>Name:</strong>{" "}
              {sale.customer}
            </p>

          </div>

          {/* TABLE */}

          <table className="w-full mt-8 border">

            <thead className="bg-gray-100">

              <tr>

                <th className="border p-3">
                  Item
                </th>

                <th className="border p-3">
                  Quantity
                </th>

                <th className="border p-3">
                  Unit Price
                </th>

                <th className="border p-3">
                  Total
                </th>

              </tr>

            </thead>

            <tbody>

              <tr>

                <td className="border p-3">
                  Egg Crates
                </td>

                <td className="border p-3">
                  {sale.cratesSold}
                </td>

                <td className="border p-3">
                  ₦{sale.pricePerCrate}
                </td>

                <td className="border p-3">
                  ₦
                  {(
                    sale.cratesSold *
                    sale.pricePerCrate
                  ).toLocaleString()}
                </td>

              </tr>

              <tr>

                <td className="border p-3">
                  Loose Eggs
                </td>

                <td className="border p-3">
                  {sale.looseEggs}
                </td>

                <td className="border p-3">
                  ₦{sale.pricePerEgg}
                </td>

                <td className="border p-3">
                  ₦
                  {(
                    sale.looseEggs *
                    sale.pricePerEgg
                  ).toLocaleString()}
                </td>

              </tr>

            </tbody>

          </table>

          {/* TOTALS */}

          <div className="mt-8 flex justify-end">

            <div className="w-72">

              <div className="flex justify-between py-2">

                <span>Subtotal</span>

                <span>
                  ₦
                  {sale.totalAmount.toLocaleString()}
                </span>

              </div>

              <div className="flex justify-between py-2">

                <span>Discount</span>

                <span>
                  ₦
                  {sale.discount.toLocaleString()}
                </span>

              </div>

              <div className="flex justify-between py-2">

                <span>Paid</span>

                <span>
                  ₦
                  {sale.amountPaid.toLocaleString()}
                </span>

              </div>

              <div className="flex justify-between py-2 text-xl font-bold border-t">

                <span>Balance</span>

                <span>
                  ₦
                  {sale.balance.toLocaleString()}
                </span>

              </div>

            </div>

          </div>

          {/* QR */}

          <div className="mt-12 flex justify-between items-end">

            <div>

              <p className="font-bold">
                Authorized Signature
              </p>

              <div className="border-b w-52 mt-10"></div>

            </div>

            {qrCode && (
              <img
                src={qrCode}
                alt="QR Code"
                className="w-32 h-32"
              />
            )}

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
            onClick={() => generateInvoice(sale)}
            className="bg-green-600 text-white px-6 py-2 rounded"
          >
            Download PDF
          </button>

        </div>

      </div>

    </div>
  );
}
