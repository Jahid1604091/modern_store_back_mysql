import PDFDocument from 'pdfkit';
import fs from 'fs';

// Function to create the invoice
export const invoiceGenerate = (order, filePath,dataCallback, endCallback) => {
  const doc = new PDFDocument({bufferPages: true, font: 'Courier' , margin: 50 });
  doc.on('data', dataCallback);
  doc.on('end', endCallback);
  // Pipe the PDF into a writable stream
  doc.pipe(fs.createWriteStream(filePath));

  // Header
  doc
    .fontSize(20)
    .text('Invoice', { align: 'center' });

  // Order Details
  doc
    .fontSize(12)
    .text(`Order ID: ${order._id}`, { align: 'left' })
    .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'left' })
    .moveDown();

  // User Details
  doc
    .text(`Customer Name: ${order.user.name}`, { align: 'left' })
    .text(`Email: ${order.user.email}`, { align: 'left' })
    .moveDown();

  // Shipping Details
  doc
    .text(`Shipping Address:`, { align: 'left' })
    .text(`${order.shippingAddress.address}`, { align: 'left' })
    .text(`${order.shippingAddress.city}, ${order.shippingAddress.postalCode}`, { align: 'left' })
    .text(`${order.shippingAddress.country}`, { align: 'left' })
    .moveDown();

  // Order Items
  doc
    .fontSize(14)
    .text(`Order Items:`, { align: 'left' })
    .moveDown();

  order.orderItems.forEach(item => {
    doc
      .fontSize(12)
      .text(`${item.name} - ${item.qty} x $${item.price} = $${item.qty * item.price}`, { align: 'left' })
      .moveDown(0.5);
  });

  // Total Price
  doc
    .fontSize(12)
    .text(`Tax: $${order.taxPrice}`, { align: 'left' })
    .text(`Shipping: $${order.shippingPrice}`, { align: 'left' })
    .text(`Total: $${order.totalPrice}`, { align: 'left' })
    .moveDown();

  // Footer
  doc
    .fontSize(12)
    .text('Thank you for your purchase!', { align: 'center' });

  // Finalize PDF file
  doc.end();
};
