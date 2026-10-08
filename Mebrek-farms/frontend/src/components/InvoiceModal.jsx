import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { generateInvoice } from "../utils/invoiceGenerator";

const EGG_CATEGORY_LABELS = {
  big: "Big Eggs",
  jumbo: "Jumbo Eggs",
  turkey: "Turkey Eggs",
  normal: "Normal Eggs",
  small: "Small Eggs",
};

const PAYMENT_METHODS = ["Cash", "Transfer", "POS"];

const formatCurrency = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG")}`;

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

const formatTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

export default function InvoiceModal({ onClose, sale }) {
  const [qrCode, setQrCode] = useState("");

  /*
   * ============================================================
   * PAYMENT DATA
   * ============================================================
   */

  const payments =
    Array.isArray(sale?.payments) && sale.payments.length > 0
      ? sale.payments
          .map((payment) => ({
            method: PAYMENT_METHODS.includes(payment?.method)
              ? payment.method
              : "Cash",
            amount: Number(payment?.amount || 0),
          }))
          .filter((payment) => payment.amount > 0)
      : Number(sale?.amountPaid || 0) > 0
        ? [
            {
              method: PAYMENT_METHODS.includes(sale?.paymentMethod)
                ? sale.paymentMethod
                : "Cash",
              amount: Number(sale.amountPaid || 0),
            },
          ]
        : [];

  const totalPaid = payments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0,
  );

  const totalAmount = Number(sale?.totalAmount || 0);
  const discount = Number(sale?.discount || 0);
  const transportCharge = Number(sale?.transportCharge || 0);

  const calculatedBalance = Math.max(totalAmount - totalPaid, 0);

  const balance =
    sale?.balance !== undefined && sale?.balance !== null
      ? Number(sale.balance)
      : calculatedBalance;

  const paymentMethod =
    payments.length === 0
      ? sale?.paymentMethod || "Unpaid"
      : payments.length === 1
        ? payments[0].method
        : "Mixed";

  const status =
    sale?.status ||
    (totalPaid >= totalAmount && totalAmount > 0
      ? "Paid"
      : totalPaid > 0
        ? "Part Paid"
        : "Unpaid");

  const lineItems = Array.isArray(sale?.lineItems) ? sale.lineItems : [];

  /*
   * ============================================================
   * PAYMENT BREAKDOWN
   * ============================================================
   */

  const paymentBreakdown = payments.reduce((result, payment) => {
    if (!result[payment.method]) {
      result[payment.method] = 0;
    }

    result[payment.method] += Number(payment.amount || 0);

    return result;
  }, {});

  /*
   * ============================================================
   * QR CODE
   * ============================================================
   *
   * Kept small because thermal paper is limited.
   */

  useEffect(() => {
    if (!sale) {
      setQrCode("");
      return;
    }

    const value = [
      "MEBREK FARMS",
      `Invoice: ${sale.invoiceNumber || "N/A"}`,
      `Customer: ${sale.customer || "N/A"}`,
      `Date: ${formatDate(sale.date)}`,
      `Time: ${formatTime(sale.createdAt || sale.date)}`,
      `Total: ${formatCurrency(totalAmount)}`,
      `Paid: ${formatCurrency(totalPaid)}`,
      `Balance: ${formatCurrency(balance)}`,
    ].join("\n");

    QRCode.toDataURL(value, {
      width: 180,
      margin: 1,
    })
      .then((dataUrl) => setQrCode(dataUrl))
      .catch(() => setQrCode(""));
  }, [sale, totalAmount, totalPaid, balance]);

  /*
   * ============================================================
   * PRINT RECEIPT
   * ============================================================
   *
   * Uses a separate print window.
   *
   * This is intentionally independent of react-to-print so it
   * works reliably with 58mm/80mm thermal receipt printers.
   */

  const handlePrint = () => {
    if (!sale) return;

    const receiptElement = document.getElementById("mebrek-thermal-receipt");

    if (!receiptElement) {
      console.error("Receipt element not found.");
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=420,height=700,left=100,top=100",
    );

    if (!printWindow) {
      alert(
        "The print window was blocked by your browser. Please allow pop-ups for this site and try again.",
      );
      return;
    }

    const receiptHTML = receiptElement.outerHTML;

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />

          <title>
            ${sale.invoiceNumber || "Mebrek Farms Receipt"}
          </title>

          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              width: 80mm;
              background: #ffffff;
            }

            body {
              font-family:
                Arial,
                Helvetica,
                sans-serif;

              color: #000000;

              font-size: 11px;
              line-height: 1.35;
            }

            #mebrek-thermal-receipt {
              width: 80mm;
              padding: 4mm 4mm 6mm 4mm;
              margin: 0;
              background: #ffffff;
            }

            .receipt-header {
              text-align: center;
            }

            .farm-name {
              font-size: 20px;
              font-weight: 900;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }

            .farm-subtitle {
              font-size: 10px;
              font-weight: 600;
              margin-bottom: 3px;
            }

            .farm-contact {
              font-size: 9px;
              line-height: 1.4;
            }

            .divider {
              border-top: 1px dashed #000;
              margin: 7px 0;
            }

            .double-divider {
              border-top: 2px solid #000;
              margin: 7px 0;
            }

            .invoice-title {
              text-align: center;
              font-size: 16px;
              font-weight: 900;
              margin: 4px 0;
            }

            .invoice-number {
              text-align: center;
              font-size: 12px;
              font-weight: 800;
            }

            .info-row {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              margin: 2px 0;
            }

            .info-label {
              font-weight: 700;
            }

            .customer-box {
              margin-top: 5px;
            }

            .customer-name {
              font-size: 13px;
              font-weight: 800;
              word-break: break-word;
            }

            .items-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            .items-table th {
              border-bottom: 1px solid #000;
              padding: 4px 1px;
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
            }

            .items-table td {
              padding: 4px 1px;
              vertical-align: top;
              font-size: 10px;
              border-bottom: 1px dotted #999;
            }

            .item-name {
              width: 31%;
              font-weight: 700;
              word-break: break-word;
            }

            .qty-col {
              width: 12%;
              text-align: center;
            }

            .price-col {
              width: 25%;
              text-align: right;
            }

            .amount-col {
              width: 32%;
              text-align: right;
              font-weight: 700;
            }

            .totals {
              margin-top: 5px;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 3px 0;
            }

            .total-row.grand-total {
              border-top: 2px solid #000;
              border-bottom: 2px solid #000;
              margin-top: 3px;
              padding: 6px 0;
              font-size: 15px;
              font-weight: 900;
            }

            .total-row.paid {
              font-weight: 800;
            }

            .total-row.balance {
              font-size: 14px;
              font-weight: 900;
            }

            .payment-title {
              text-align: center;
              font-weight: 900;
              font-size: 12px;
              margin-bottom: 4px;
            }

            .payment-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
            }

            .status {
              text-align: center;
              font-size: 13px;
              font-weight: 900;
              margin: 6px 0;
              text-transform: uppercase;
            }

            .remarks {
              font-size: 9px;
              margin-top: 5px;
            }

            .qr-section {
              text-align: center;
              margin-top: 8px;
            }

            .qr-section img {
              width: 24mm;
              height: 24mm;
              display: block;
              margin: 0 auto 3px auto;
            }

            .qr-text {
              font-size: 8px;
            }

            .footer {
              text-align: center;
              margin-top: 8px;
              font-size: 9px;
              line-height: 1.5;
            }

            .footer-thanks {
              font-size: 11px;
              font-weight: 800;
            }

            .no-print {
              display: none !important;
            }
          </style>
        </head>

        <body>
          ${receiptHTML}

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.focus();
                window.print();

                setTimeout(function () {
                  window.close();
                }, 800);
              }, 300);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  /*
   * ============================================================
   * MODAL
   * ============================================================
   */

  if (!sale) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
    >
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* ====================================================
            MODAL HEADER
        ===================================================== */}

        <div className="flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h2
              id="invoice-modal-title"
              className="text-xl font-bold text-gray-800"
            >
              Sales Receipt
            </h2>

            <p className="text-sm text-gray-500">Thermal printer preview</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xl font-bold text-gray-500 hover:bg-gray-100 hover:text-red-600"
            aria-label="Close receipt"
          >
            ✕
          </button>
        </div>

        {/* ====================================================
            RECEIPT PREVIEW
        ===================================================== */}

        <div className="overflow-y-auto bg-gray-200 p-5">
          <div className="mx-auto w-[302px] bg-white shadow-lg">
            <div
              id="mebrek-thermal-receipt"
              className="px-4 py-5 text-gray-900"
            >
              {/* ================================================
                  HEADER
              ================================================= */}

              <div className="receipt-header text-center">
                <div className="farm-name text-xl font-black">MEBREK FARMS</div>

                <div className="farm-subtitle text-xs font-semibold">
                  POULTRY & AGRICULTURAL PRODUCTS
                </div>

                <div className="farm-contact text-[10px] leading-4 text-gray-600">
                  <div>Eket, Akwa Ibom, Nigeria</div>
                  <div>Tel: +234 903 372 3103</div>
                  <div>info@mebrekfarms.com</div>
                </div>
              </div>

              <div className="divider my-2 border-t border-dashed border-gray-700"></div>

              {/* ================================================
                  INVOICE TITLE
              ================================================= */}

              <div className="invoice-title text-center text-lg font-black">
                SALES RECEIPT
              </div>

              <div className="invoice-number text-center text-sm font-bold">
                {sale.invoiceNumber ? `#${sale.invoiceNumber}` : "SALE"}
              </div>

              <div className="divider my-2 border-t border-dashed border-gray-700"></div>

              {/* ================================================
                  TRANSACTION INFORMATION
              ================================================= */}

              <div className="info-row flex justify-between text-[10px]">
                <span className="info-label font-bold">Date:</span>

                <span>{formatDate(sale.date)}</span>
              </div>

              <div className="info-row flex justify-between text-[10px]">
                <span className="info-label font-bold">Time:</span>

                <span>{formatTime(sale.createdAt || sale.date)}</span>
              </div>

              {/* ================================================
                  CUSTOMER
              ================================================= */}

              <div className="customer-box mt-2">
                <div className="text-[9px] font-bold uppercase text-gray-500">
                  Customer
                </div>

                <div className="customer-name text-sm font-bold">
                  {sale.customer || "Walk-in Customer"}
                </div>

                {sale.phone && <div className="text-[10px]">{sale.phone}</div>}
              </div>

              <div className="divider my-2 border-t border-dashed border-gray-700"></div>

              {/* ================================================
                  ITEMS
              ================================================= */}

              <table className="items-table w-full text-[10px]">
                <thead>
                  <tr>
                    <th className="item-name text-left">ITEM</th>

                    <th className="qty-col text-center">QTY</th>

                    <th className="price-col text-right">PRICE</th>

                    <th className="amount-col text-right">AMOUNT</th>
                  </tr>
                </thead>

                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-3 text-center text-gray-500"
                      >
                        No items recorded
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item, index) => {
                      const crates = Number(item.cratesSold || 0);

                      const loose = Number(item.looseEggs || 0);

                      return (
                        <tr key={item._id || index}>
                          <td className="item-name font-semibold">
                            {EGG_CATEGORY_LABELS[item.category] ||
                              item.category ||
                              "Eggs"}
                          </td>

                          <td className="qty-col text-center">
                            {crates > 0 && <div>{crates}C</div>}

                            {loose > 0 && <div>{loose}L</div>}

                            {crates === 0 && loose === 0 && "0"}
                          </td>

                          <td className="price-col text-right">
                            {crates > 0 && (
                              <div>{formatCurrency(item.cratePrice)}</div>
                            )}

                            {loose > 0 && (
                              <div>{formatCurrency(item.eggPrice)}</div>
                            )}
                          </td>

                          <td className="amount-col text-right font-bold">
                            {formatCurrency(item.subtotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="divider my-2 border-t border-dashed border-gray-700"></div>

              {/* ================================================
                  TOTALS
              ================================================= */}

              <div className="totals">
                <div className="total-row flex justify-between text-[10px]">
                  <span>Subtotal</span>

                  <span>{formatCurrency(totalAmount)}</span>
                </div>

                {discount > 0 && (
                  <div className="total-row flex justify-between text-[10px]">
                    <span>Discount</span>

                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}

                {transportCharge > 0 && (
                  <div className="total-row flex justify-between text-[10px]">
                    <span>Transport</span>

                    <span>{formatCurrency(transportCharge)}</span>
                  </div>
                )}

                <div className="total-row grand-total my-1 flex justify-between border-y-2 border-black py-2 text-sm font-black">
                  <span>TOTAL</span>

                  <span>{formatCurrency(totalAmount)}</span>
                </div>

                <div className="total-row paid flex justify-between text-[11px] font-bold">
                  <span>PAID</span>

                  <span>{formatCurrency(totalPaid)}</span>
                </div>

                <div className="total-row balance mt-1 flex justify-between text-sm font-black">
                  <span>BALANCE</span>

                  <span>{formatCurrency(balance)}</span>
                </div>
              </div>

              <div className="divider my-2 border-t border-dashed border-gray-700"></div>

              {/* ================================================
                  PAYMENT BREAKDOWN
              ================================================= */}

              <div>
                <div className="payment-title text-center text-xs font-black">
                  PAYMENT
                </div>

                {Object.keys(paymentBreakdown).length === 0 ? (
                  <div className="text-center text-[10px]">
                    No payment recorded
                  </div>
                ) : (
                  Object.entries(paymentBreakdown).map(([method, amount]) => (
                    <div
                      key={method}
                      className="payment-row flex justify-between text-[10px]"
                    >
                      <span>{method}</span>

                      <span className="font-bold">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))
                )}

                <div className="payment-row mt-1 flex justify-between border-t border-black pt-1 text-[10px] font-black">
                  <span>METHOD</span>

                  <span>{paymentMethod}</span>
                </div>
              </div>

              <div className="divider my-2 border-t border-dashed border-gray-700"></div>

              {/* ================================================
                  STATUS
              ================================================= */}

              <div className="status text-center text-sm font-black uppercase">
                {status}
              </div>

              {/* ================================================
                  REMARKS
              ================================================= */}

              {sale.remarks && (
                <>
                  <div className="divider my-2 border-t border-dashed border-gray-700"></div>

                  <div className="remarks text-[9px]">
                    <strong>Note:</strong> {sale.remarks}
                  </div>
                </>
              )}

              {/* ================================================
                  QR
              ================================================= */}

              {qrCode && (
                <>
                  <div className="divider my-2 border-t border-dashed border-gray-700"></div>

                  <div className="qr-section text-center">
                    <img
                      src={qrCode}
                      alt="Receipt QR Code"
                      className="mx-auto h-24 w-24"
                    />

                    <div className="qr-text text-[8px] text-gray-500">
                      Scan to verify transaction
                    </div>
                  </div>
                </>
              )}

              {/* ================================================
                  FOOTER
              ================================================= */}

              <div className="footer mt-3 text-center">
                <div className="footer-thanks text-[11px] font-bold">
                  THANK YOU FOR YOUR BUSINESS
                </div>

                <div className="mt-1 text-[9px]">Mebrek Farms</div>

                <div className="text-[9px]">Quality Eggs • Trusted Service</div>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================
            ACTION BUTTONS
        ===================================================== */}

        <div className="no-print flex flex-wrap justify-end gap-3 border-t bg-white p-5">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            🖨 Print Receipt
          </button>

          <button
            type="button"
            onClick={() => generateInvoice(sale)}
            className="rounded-lg bg-green-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-green-700"
          >
            Download PDF
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-6 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
