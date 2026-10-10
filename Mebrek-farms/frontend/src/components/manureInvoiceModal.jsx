import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { generateManureInvoice } from "../utils/manureInvoiceGenerator";

const MANURE_CATEGORY_LABELS = {
  dry: "Dry Manure",
  wet: "Wet Manure",
};

const money = (value) =>
  `₦${Number(value ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const safeNumber = (value) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString("en-NG", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const getPaymentBreakdown = (sale) => {
  const possibleArrays = [
    sale?.payments,
    sale?.paymentBreakdown,
    sale?.paymentDetails,
  ];
  const array = possibleArrays.find(Array.isArray);
  if (array?.length) {
    return array
      .map((payment) => ({
        method:
          payment.method || payment.paymentMethod || payment.type || "Payment",
        amount: safeNumber(
          payment.amount ?? payment.amountPaid ?? payment.value,
        ),
      }))
      .filter((payment) => payment.amount > 0);
  }

  const method = sale?.paymentMethod || sale?.paymentType;
  if (method && safeNumber(sale?.amountPaid) > 0) {
    return [{ method, amount: safeNumber(sale.amountPaid) }];
  }

  return [];
};

export default function ManureInvoiceModal({ open, onClose, sale }) {
  const [qrCode, setQrCode] = useState("");

  // createdAt records the actual transaction timestamp. sale.date may be a
  // date-only business date, so never present midnight as a fabricated sale time.
  const createdDate = useMemo(
    () => sale?.createdAt || sale?.created_at || null,
    [sale],
  );
  const receiptDate = createdDate || sale?.date || null;
  const receiptTime = createdDate ? formatTime(createdDate) : "—";

  const lineItems = Array.isArray(sale?.lineItems) ? sale.lineItems : [];
  const totalAmount = safeNumber(sale?.totalAmount ?? sale?.grandTotal);
  const discount = safeNumber(sale?.discount);
  const transportCharge = safeNumber(sale?.transportCharge);
  const amountPaid = safeNumber(sale?.amountPaid ?? sale?.paidAmount);
  const balance = safeNumber(
    sale?.balance ?? Math.max(totalAmount - amountPaid, 0),
  );
  const subtotal = safeNumber(
    sale?.subtotal ??
      lineItems.reduce(
        (sum, item) =>
          sum +
          safeNumber(
            item.subtotal ??
              safeNumber(item.bags) * safeNumber(item.pricePerBag),
          ),
        0,
      ),
  );
  const paymentBreakdown = getPaymentBreakdown(sale);
  const paymentMethod =
    sale?.paymentMethod ||
    sale?.paymentType ||
    (paymentBreakdown.length > 1 ? "Mixed" : paymentBreakdown[0]?.method) ||
    "—";
  const paymentStatus =
    sale?.paymentStatus ||
    sale?.status ||
    (balance <= 0 ? "PAID" : amountPaid > 0 ? "PART PAYMENT" : "UNPAID");

  useEffect(() => {
    if (!sale) {
      setQrCode("");
      return;
    }

    const receiptData = [
      "MEBREK FARMS — MANURE SALES RECEIPT",
      `Invoice: ${sale.invoiceNumber || "—"}`,
      `Customer: ${sale.customer || sale.customerName || "Walk-in Customer"}`,
      `Date: ${formatDate(receiptDate)}`,
      `Time: ${receiptTime}`,
      `Total: ${money(totalAmount)}`,
      `Paid: ${money(amountPaid)}`,
      `Balance: ${money(balance)}`,
      `Payment method: ${paymentMethod}`,
    ].join("\n");

    let cancelled = false;
    QRCode.toDataURL(receiptData, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
    })
      .then((dataUrl) => {
        if (!cancelled) setQrCode(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrCode("");
      });

    return () => {
      cancelled = true;
    };
  }, [
    sale,
    createdDate,
    receiptDate,
    receiptTime,
    totalAmount,
    amountPaid,
    balance,
    paymentMethod,
  ]);

  if (!open || !sale) return null;

  const receiptRows = lineItems.length
    ? lineItems
        .map((item) => {
          const category =
            MANURE_CATEGORY_LABELS[item.category] || item.category || "Manure";
          const quantity = safeNumber(item.bags ?? item.quantity);
          const price = safeNumber(item.pricePerBag ?? item.price);
          const amount = safeNumber(item.subtotal ?? quantity * price);
          return `
            <tr>
              <td class="item-name">${escapeHtml(category)}</td>
              <td class="qty">${escapeHtml(quantity)}B</td>
              <td class="num">${escapeHtml(money(price))}</td>
              <td class="num strong">${escapeHtml(money(amount))}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="empty">No item details recorded for this sale.</td></tr>`;

  const paymentsHtml = paymentBreakdown.length
    ? paymentBreakdown
        .map(
          (payment) =>
            `<div class="row"><span>${escapeHtml(payment.method)}</span><strong>${escapeHtml(money(payment.amount))}</strong></div>`,
        )
        .join("")
    : `<div class="row"><span>${escapeHtml(paymentMethod)}</span><strong>${escapeHtml(money(amountPaid))}</strong></div>`;

  const printReceipt = () => {
    const printWindow = window.open("", "_blank", "width=420,height=800");
    if (!printWindow) {
      window.alert(
        "The print window was blocked. Please allow pop-ups for this site, then try again.",
      );
      return;
    }

    const qrHtml = qrCode
      ? `<div class="qr"><img src="${qrCode}" alt="Receipt verification QR code"><div>Scan to verify transaction</div></div>`
      : "";

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html><head><meta charset="utf-8"><title>${escapeHtml(sale.invoiceNumber || "Manure Receipt")}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        html, body { width: 80mm; margin: 0; padding: 0; background: #fff; color: #000; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.35; }
        .receipt { width: 80mm; max-width: 80mm; padding: 3mm 3.5mm 4mm; margin: 0 auto; overflow-wrap: anywhere; }
        .center { text-align: center; }
        .brand { font-size: 20px; line-height: 1.1; font-weight: 900; letter-spacing: .4px; margin: 0 0 3px; }
        .subtitle { font-size: 10px; font-weight: 700; margin: 0 0 2px; }
        .muted { font-size: 9px; }
        .rule { border: 0; border-top: 1px dashed #222; margin: 8px 0; }
        .receipt-title { font-size: 14px; font-weight: 900; margin: 7px 0 2px; }
        .invoice { font-size: 12px; font-weight: 800; margin: 2px 0 7px; }
        .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
        .row > :first-child { min-width: 0; }
        .row > :last-child { text-align: right; }
        .strong { font-weight: 800; }
        .section-label { font-size: 10px; font-weight: 900; text-transform: uppercase; margin: 7px 0 3px; }
        .customer { font-size: 12px; font-weight: 800; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5px; }
        th { text-align: left; font-size: 8px; border-bottom: 1px dashed #222; padding: 4px 1px; }
        td { padding: 5px 1px; border-bottom: 1px dashed #bbb; vertical-align: top; }
        th:nth-child(1), td:nth-child(1) { width: 34%; }
        th:nth-child(2), td:nth-child(2) { width: 10%; text-align: center; }
        th:nth-child(3), td:nth-child(3) { width: 26%; text-align: right; }
        th:nth-child(4), td:nth-child(4) { width: 30%; text-align: right; }
        .num { text-align: right; white-space: normal; }
        .item-name { font-weight: 700; }
        .qty { text-align: center; }
        .empty { text-align: center; padding: 8px 2px; }
        .grand-total { font-size: 14px; font-weight: 900; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 7px 0; margin-top: 5px; }
        .status { display: inline-block; border: 1px solid #000; padding: 3px 10px; font-size: 11px; font-weight: 900; margin: 7px 0 2px; }
        .qr { text-align: center; margin: 10px 0 6px; font-size: 8px; }
        .qr img { width: 24mm; height: 24mm; object-fit: contain; display: block; margin: 0 auto 3px; }
        .thanks { font-weight: 900; font-size: 11px; margin-top: 8px; }
        .footer { font-size: 8px; margin-top: 3px; }
        @media screen { body { margin: 0 auto; box-shadow: 0 0 4px #aaa; } }
      </style></head><body>
      <main class="receipt">
        <header class="center">
          <h1 class="brand">MEBREK FARMS</h1>
          <p class="subtitle">POULTRY &amp; AGRICULTURAL PRODUCTS</p>
          <div>Eket, Akwa Ibom, Nigeria</div>
          <div>Tel: +234 903 372 3103</div>
          <div>info@mebrekfarms.com</div>
          <div class="receipt-title">SALES RECEIPT</div>
          <div class="invoice">#${escapeHtml(sale.invoiceNumber || "—")}</div>
        </header>
        <hr class="rule">
        <div class="row"><span><b>Date</b></span><span>${escapeHtml(formatDate(receiptDate))}</span></div>
        <div class="row"><span><b>Time</b></span><span>${escapeHtml(receiptTime)}</span></div>
        <div class="section-label">Customer</div>
        <div class="customer">${escapeHtml(sale.customer || sale.customerName || "Walk-in Customer")}</div>
        ${sale.customerPhone || sale.phone ? `<div>Tel: ${escapeHtml(sale.customerPhone || sale.phone)}</div>` : ""}
        <hr class="rule">
        <table><thead><tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>AMOUNT</th></tr></thead><tbody>${receiptRows}</tbody></table>
        <div style="margin-top:7px">
          <div class="row"><span>Subtotal</span><strong>${escapeHtml(money(subtotal || totalAmount + discount - transportCharge))}</strong></div>
          ${discount > 0 ? `<div class="row"><span>Discount</span><span>−${escapeHtml(money(discount))}</span></div>` : ""}
          ${transportCharge > 0 ? `<div class="row"><span>Transport</span><span>${escapeHtml(money(transportCharge))}</span></div>` : ""}
          <div class="row grand-total"><span>TOTAL</span><span>${escapeHtml(money(totalAmount))}</span></div>
          <div class="row"><span class="strong">PAID</span><strong>${escapeHtml(money(amountPaid))}</strong></div>
          <div class="row"><span class="strong">BALANCE</span><strong>${escapeHtml(money(balance))}</strong></div>
        </div>
        <hr class="rule">
        <div class="section-label">Payment</div>
        ${paymentsHtml}
        <div class="row"><span>METHOD</span><strong>${escapeHtml(paymentMethod)}</strong></div>
        <div class="center"><span class="status">${escapeHtml(String(paymentStatus).toUpperCase())}</span></div>
        ${qrHtml}
        <hr class="rule">
        <div class="center thanks">THANK YOU FOR YOUR BUSINESS</div>
        <div class="center footer">Mebrek Farms</div>
        <div class="center footer">Quality Manure • Trusted Service</div>
      </main>
      <script>
        window.onload = function () {
          const images = Array.from(document.images);
          Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; })))
            .then(() => setTimeout(() => { window.focus(); window.print(); }, 250));
        };
        window.onafterprint = function () { window.close(); };
      </script>
      </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4 sm:p-5">
          <div>
            <h2 className="text-xl font-bold">Receipt Preview</h2>
            <p className="text-sm text-gray-500">
              Reprint a saved sale · 80 mm POS thermal receipt
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="text-2xl font-bold text-red-600"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto bg-gray-100 p-3 sm:p-5">
          <div className="mx-auto w-full max-w-[302px] bg-white px-4 py-5 text-[11px] leading-snug text-black shadow-sm">
            <div className="text-center">
              <h1 className="text-xl font-black tracking-wide">MEBREK FARMS</h1>
              <p className="mt-1 font-bold">
                POULTRY &amp; AGRICULTURAL PRODUCTS
              </p>
              <p>Eket, Akwa Ibom, Nigeria</p>
              <p>Tel: +234 903 372 3103</p>
              <p>info@mebrekfarms.com</p>
              <h3 className="mt-3 text-sm font-black">SALES RECEIPT</h3>
              <p className="mt-1 text-xs font-extrabold">
                #{sale.invoiceNumber || "—"}
              </p>
            </div>

            <div className="my-3 border-t border-dashed border-black" />
            <div className="flex justify-between gap-2">
              <b>Date</b>
              <span>{formatDate(receiptDate)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <b>Time</b>
              <span>{receiptTime}</span>
            </div>
            <p className="mt-3 font-black uppercase">Customer</p>
            <p className="text-sm font-bold">
              {sale.customer || sale.customerName || "Walk-in Customer"}
            </p>
            {(sale.customerPhone || sale.phone) && (
              <p>Tel: {sale.customerPhone || sale.phone}</p>
            )}

            <div className="my-3 border-t border-dashed border-black" />
            <table className="w-full table-fixed text-[9px]">
              <thead>
                <tr className="border-b border-dashed border-black">
                  <th className="w-[34%] py-1 text-left">ITEM</th>
                  <th className="w-[10%] py-1 text-center">QTY</th>
                  <th className="w-[26%] py-1 text-right">PRICE</th>
                  <th className="w-[30%] py-1 text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-center">
                      No item details recorded.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item, index) => {
                    const quantity = safeNumber(item.bags ?? item.quantity);
                    const price = safeNumber(item.pricePerBag ?? item.price);
                    const amount = safeNumber(
                      item.subtotal ?? quantity * price,
                    );
                    return (
                      <tr
                        key={`${item.category || "item"}-${index}`}
                        className="border-b border-dashed border-gray-300"
                      >
                        <td className="break-words py-2 pr-1 font-bold">
                          {MANURE_CATEGORY_LABELS[item.category] ||
                            item.category ||
                            "Manure"}
                        </td>
                        <td className="py-2 text-center">{quantity}B</td>
                        <td className="break-words py-2 text-right">
                          {money(price)}
                        </td>
                        <td className="break-words py-2 text-right font-bold">
                          {money(amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="mt-3 space-y-1">
              <div className="flex justify-between gap-2">
                <span>Subtotal</span>
                <b>
                  {money(subtotal || totalAmount + discount - transportCharge)}
                </b>
              </div>
              {discount > 0 && (
                <div className="flex justify-between gap-2">
                  <span>Discount</span>
                  <span>−{money(discount)}</span>
                </div>
              )}
              {transportCharge > 0 && (
                <div className="flex justify-between gap-2">
                  <span>Transport</span>
                  <span>{money(transportCharge)}</span>
                </div>
              )}
              <div className="my-2 flex justify-between gap-2 border-y border-black py-2 text-sm font-black">
                <span>TOTAL</span>
                <span>{money(totalAmount)}</span>
              </div>
              <div className="flex justify-between gap-2 font-bold">
                <span>PAID</span>
                <span>{money(amountPaid)}</span>
              </div>
              <div className="flex justify-between gap-2 font-bold">
                <span>BALANCE</span>
                <span>{money(balance)}</span>
              </div>
            </div>

            <div className="my-3 border-t border-dashed border-black" />
            <p className="mb-2 font-black uppercase">Payment</p>
            {paymentBreakdown.length ? (
              paymentBreakdown.map((payment, index) => (
                <div
                  key={`${payment.method}-${index}`}
                  className="flex justify-between gap-2"
                >
                  <span>{payment.method}</span>
                  <b>{money(payment.amount)}</b>
                </div>
              ))
            ) : (
              <div className="flex justify-between gap-2">
                <span>{paymentMethod}</span>
                <b>{money(amountPaid)}</b>
              </div>
            )}
            <div className="mt-1 flex justify-between gap-2">
              <span>METHOD</span>
              <b>{paymentMethod}</b>
            </div>
            <div className="my-2 text-center">
              <span className="inline-block border border-black px-3 py-1 font-black">
                {String(paymentStatus).toUpperCase()}
              </span>
            </div>
            {qrCode && (
              <div className="mt-3 text-center">
                <img
                  src={qrCode}
                  alt="Receipt verification QR code"
                  className="mx-auto h-24 w-24"
                />
                <p className="mt-1 text-[9px]">Scan to verify transaction</p>
              </div>
            )}
            <div className="my-3 border-t border-dashed border-black" />
            <p className="text-center text-xs font-black">
              THANK YOU FOR YOUR BUSINESS
            </p>
            <p className="mt-1 text-center text-[9px]">Mebrek Farms</p>
            <p className="text-center text-[9px]">
              Quality Manure • Trusted Service
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t p-4 sm:p-5">
          <button
            type="button"
            onClick={printReceipt}
            className="rounded bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Print Receipt
          </button>
          <button
            type="button"
            onClick={() => generateManureInvoice(sale)}
            className="rounded bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
