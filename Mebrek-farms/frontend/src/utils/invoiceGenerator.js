import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateInvoice = (sale) => {
  const doc = new jsPDF();

  // ================= HEADER =================

  doc.setFontSize(22);
  doc.text("MEBREK FARMS", 14, 18);

  doc.setFontSize(11);
  doc.text("Egg Production & Livestock", 14, 25);
  doc.text("Phone: +234 XXX XXX XXXX", 14, 31);
  doc.text("Email: info@mebrekfarms.com", 14, 37);

  doc.setFontSize(18);
  doc.text("INVOICE", 150, 18);

  // ================= CUSTOMER =================

  doc.setFontSize(11);

  doc.text(`Customer: ${sale.customer}`, 14, 55);

  doc.text(
    `Date: ${new Date(sale.date).toLocaleDateString()}`,
    14,
    62
  );

  // ================= TABLE =================

  autoTable(doc, {
    startY: 75,

    head: [[
      "Item",
      "Quantity",
      "Unit Price",
      "Total"
    ]],

    body: [
      [
        "Egg Crates",
        sale.cratesSold,
        `₦${sale.pricePerCrate}`,
        `₦${sale.cratesSold * sale.pricePerCrate}`
      ],

      [
        "Loose Eggs",
        sale.looseEggs,
        `₦${sale.pricePerEgg}`,
        `₦${sale.looseEggs * sale.pricePerEgg}`
      ]
    ]
  });

  let finalY = doc.lastAutoTable.finalY + 15;

  doc.setFontSize(12);

  doc.text(
    `Subtotal: ₦${sale.totalAmount.toLocaleString()}`,
    140,
    finalY
  );

  finalY += 8;

  doc.text(
    `Discount: ₦${sale.discount.toLocaleString()}`,
    140,
    finalY
  );

  finalY += 8;

  doc.text(
    `Paid: ₦${sale.amountPaid.toLocaleString()}`,
    140,
    finalY
  );

  finalY += 8;

  doc.setFontSize(15);

  doc.text(
    `Balance: ₦${sale.balance.toLocaleString()}`,
    140,
    finalY
  );

  finalY += 25;

  doc.setFontSize(10);

  doc.text(
    "Thank you for doing business with Mebrek Farms.",
    14,
    finalY
  );

  doc.save(`Invoice-${sale.customer}.pdf`);
};
