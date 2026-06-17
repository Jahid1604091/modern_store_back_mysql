const PDFDocument = require("pdfkit");
const fs = require("fs");

const invoiceGenerate = (order, filePath, dataCallback, endCallback) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    bufferPages: true,
  });

  doc.on("data", dataCallback);
  doc.on("end", endCallback);
  doc.pipe(fs.createWriteStream(filePath));

  const company = order.company || {};
  const contact = company.contact || {};
  const supportEmail = contact.support_email || contact.contact_email || "";
  const supportMobile = contact.support_mobile || contact.contact_mobile || "";
  const currency = order.currency || company.currency || "BDT";

  /* =========================
     HEADER
  ========================== */
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("INVOICE", { align: "right" });

  doc
    .moveDown(0.5)
    .fontSize(12)
    .font("Helvetica")
    .text(company.company_name || "", 50, 50);
  if (company.address) doc.text(company.address);
  if (supportEmail) doc.text(`Email: ${supportEmail}`);
  if (supportMobile) doc.text(`Phone: ${supportMobile}`);

  doc.moveDown(2);

  /* =========================
     INVOICE & CUSTOMER INFO
  ========================== */
  const leftX = 50;
  const rightX = 330;

  doc
    .font("Helvetica-Bold")
    .text("Invoice Details", leftX)
    .text("Customer Details", rightX);

  doc
    .font("Helvetica")
    .moveDown(0.5)
    // .text(`Invoice No: ${order.order_number}`, leftX)
    .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, leftX)
    .text(`Name: ${order.user.name}`, rightX)
    .text(`Email: ${order.user.email || ''}`, rightX);

  doc.moveDown(1);

  doc
    .font("Helvetica-Bold")
    .text("Shipping Address:", leftX);

  doc
    .font("Helvetica")
    .text(order.shipping_address.address || '', leftX)
    .text(
      `${order.shipping_address.city|| ''}, ${order.shipping_address.postalCode|| ''}`,
      leftX
    )
    .text(order.shipping_address.country|| '', leftX);

  doc.moveDown(2);

  /* =========================
     ORDER ITEMS TABLE
  ========================== */
  const tableTop = doc.y;
  const itemX = 50;
  const qtyX = 280;
  const priceX = 330;
  const totalX = 430;

  doc.font("Helvetica-Bold");
  doc.text("Item", itemX, tableTop);
  doc.text("Qty", qtyX, tableTop);
  doc.text("Price", priceX, tableTop);
  doc.text("Total", totalX, tableTop);

  doc
    .moveTo(itemX, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .stroke();

  doc.font("Helvetica");

  let positionY = tableTop + 25;

  order.items.forEach((item) => {
    const total = item.order_quantity * item.unit_price;
    const itemLabel = item.selected_size
      ? `${item.product.name} (Size: ${item.selected_size})`
      : item.product.name;

    doc.text(itemLabel, itemX, positionY, { width: 220 });
    doc.text(item.order_quantity, qtyX, positionY);
    doc.text(`${currency} ${item.unit_price}`, priceX, positionY);
    doc.text(`${currency} ${total}`, totalX, positionY);

    positionY += 20;
  });

  doc.moveDown(2);

  /* =========================
     TOTALS
  ========================== */
  doc
    .font("Helvetica")
    .text(`Sub Total: ${currency} ${order.subtotal}`, totalX - 80, positionY + 10, {
      align: "right",
    })
    .text(`Shipping: ${currency} ${order.shipping_cost}`, totalX - 80, positionY + 30, {
      align: "right",
    })
    .text(`Discount: ${currency} ${order.discount}`, totalX - 80, positionY + 50, {
      align: "right",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(`Grand Total: ${currency} ${order.total}`, totalX - 80, positionY + 80, {
      align: "right",
    });

  doc.moveDown(4);

  /* =========================
     FOOTER
  ========================== */
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(
      "Thank you for your purchase!\nIf you have any questions, contact our support team.",
      { align: "center" }
    );

  doc.end();
};

module.exports = { invoiceGenerate };
