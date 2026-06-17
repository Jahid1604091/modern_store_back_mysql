const ExcelJS = require('exceljs');
const dayjs = require('dayjs');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F4F4F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const THIN_BORDER = {
  top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
};

function styleHeaderRow(row) {
  row.height = 22;
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  row.eachCell((cell) => { cell.border = THIN_BORDER; });
}

function borderRow(row) {
  row.eachCell((cell) => {
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle' };
  });
}

class ExcelExportService {
  // Sheet 1 — report period, KPI summary, payment method & top product breakdowns.
  static createSummarySheet(workbook, options) {
    const worksheet = workbook.addWorksheet('Summary');
    const summary = options.summaryStats || {};

    worksheet.mergeCells('A1:C1');
    const title = worksheet.getCell('A1');
    title.value = 'SALES REPORT SUMMARY';
    title.font = { size: 16, bold: true };
    title.alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell('A3').value = 'Report Period:';
    worksheet.getCell('B3').value = `${options.formattedStart} to ${options.formattedEnd}`;
    worksheet.getCell('A4').value = 'Generated On:';
    worksheet.getCell('B4').value = dayjs().format('YYYY-MM-DD HH:mm:ss');
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('A4').font = { bold: true };

    const kpiRows = [
      ['Total Orders', summary.total_orders || 0],
      ['Pending Orders', summary.pending_orders || 0],
      ['Completed Orders', summary.completed_orders || 0],
      ['Cancelled Orders', summary.cancelled_orders || 0],
      ['Total Sales', summary.total_sales || 0],
      ['Total Discount', summary.total_discount || 0],
      ['Net Sales', summary.net_sales || 0],
      ['Average Order Value', summary.average_order_value || 0],
      ['Total Items Sold', summary.total_items_sold || 0],
      ['Unique Products Sold', summary.unique_products_sold || 0],
    ];

    worksheet.getCell('A6').value = 'KEY METRICS';
    worksheet.getCell('A6').font = { bold: true, size: 12 };
    let row = 7;
    kpiRows.forEach(([label, value]) => {
      worksheet.getCell(`A${row}`).value = label;
      worksheet.getCell(`B${row}`).value = value;
      worksheet.getCell(`A${row}`).font = { bold: true };
      row++;
    });

    row += 1;
    if (options.paymentBreakdown?.length) {
      worksheet.getCell(`A${row}`).value = 'PAYMENT METHOD BREAKDOWN';
      worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
      row++;
      worksheet.getCell(`A${row}`).value = 'Payment Method';
      worksheet.getCell(`B${row}`).value = 'Orders';
      worksheet.getCell(`C${row}`).value = 'Total';
      worksheet.getRow(row).font = { bold: true };
      row++;
      options.paymentBreakdown.forEach((p) => {
        worksheet.getCell(`A${row}`).value = p.payment_method || 'unknown';
        worksheet.getCell(`B${row}`).value = Number(p.count) || 0;
        worksheet.getCell(`C${row}`).value = Number(p.total) || 0;
        row++;
      });
      row += 1;
    }

    if (options.topProducts?.length) {
      worksheet.getCell(`A${row}`).value = 'TOP PRODUCTS BY UNITS SOLD';
      worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
      row++;
      worksheet.getCell(`A${row}`).value = 'Product';
      worksheet.getCell(`B${row}`).value = 'Units Sold';
      worksheet.getRow(row).font = { bold: true };
      row++;
      options.topProducts.forEach((p) => {
        worksheet.getCell(`A${row}`).value = p.name || `Product #${p.product_id}`;
        worksheet.getCell(`B${row}`).value = Number(p.qty_sold) || 0;
        row++;
      });
    }

    worksheet.getColumn('A').width = 28;
    worksheet.getColumn('B').width = 18;
    worksheet.getColumn('C').width = 18;
  }

  // Sheet 2 — one row per order (not per day — previous version duplicated every
  // order once per calendar day in the range, which was a bug).
  static createOrdersSheet(workbook, orders) {
    const worksheet = workbook.addWorksheet('Orders');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Order Number', key: 'order_number', width: 24 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Shipping Cost', key: 'shipping_cost', width: 14 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Payment Status', key: 'payment_status', width: 16 },
      { header: 'Payment Method', key: 'payment_method', width: 16 },
    ];

    styleHeaderRow(worksheet.getRow(1));

    orders.forEach((order) => {
      const row = worksheet.addRow({
        date: dayjs(order.createdAt).format('YYYY-MM-DD HH:mm'),
        order_number: order.order_number || 'N/A',
        customer: order.user?.name || 'N/A',
        shipping_cost: Number(order.shipping_cost) || 0,
        discount: Number(order.discount) || 0,
        total: Number(order.total) || 0,
        status: order.status || 'N/A',
        payment_status: order.payment_status || 'N/A',
        payment_method: order.payment_method || 'N/A',
      });
      borderRow(row);
    });

    const totalRows = worksheet.rowCount;
    worksheet.autoFilter = { from: 'A1', to: `I${totalRows}` };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  static async generateOrderReport(orders, options = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ModernStore';
    workbook.created = new Date();
    workbook.modified = new Date();

    this.createSummarySheet(workbook, options);
    this.createOrdersSheet(workbook, orders);

    return workbook;
  }

  // Kept for the call site's existing signature: generateExcel(data, options)
  static async generateExcel(data, options = {}) {
    return this.generateOrderReport(data, options);
  }
}

module.exports = ExcelExportService;
