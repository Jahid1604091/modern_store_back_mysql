const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorresponse');
const db = require('../models/index');
const { PurchaseOrder, PurchaseOrderItem, Product } = db;
const { resolveCompanyId, companyScopeWhere } = require('../utils/companyScope');
const { Op } = require('sequelize');

const PO_INCLUDE = [
  {
    model: PurchaseOrderItem,
    as: 'items',
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'unit', 'stock_quantity'] }],
  },
];

// @route  GET /api/purchase-orders
// @access Admin
exports.getAllPOs = asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const where = companyScopeWhere(req, {});
  if (status) where.status = status;
  if (q) where.po_number = { [Op.like]: `%${q}%` };

  const pos = await PurchaseOrder.findAll({
    where,
    include: PO_INCLUDE,
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  res.json({ success: true, data: pos });
});

// @route  POST /api/purchase-orders
// @access Admin
exports.createPO = asyncHandler(async (req, res) => {
  const company_id = resolveCompanyId(req);
  const { supplier_name, supplier_phone, notes, items = [] } = req.body;

  if (!items.length) return res.status(400).json({ success: false, msg: 'At least one item is required.' });

  const poCount = await PurchaseOrder.count({ where: { company_id } });
  const po_number = `PO-${String(poCount + 1).padStart(5, '0')}`;

  const totalAmount = items.reduce((s, i) => s + (Number(i.unit_cost) * Number(i.ordered_qty)), 0);

  const po = await PurchaseOrder.create({
    company_id,
    po_number,
    supplier_name,
    supplier_phone,
    notes,
    status: 'ordered',
    ordered_at: new Date(),
    total_amount: totalAmount,
    created_by: req.user.id,
  });

  await PurchaseOrderItem.bulkCreate(
    items.map((i) => ({
      purchase_order_id: po.id,
      product_id: i.product_id,
      ordered_qty: Number(i.ordered_qty),
      received_qty: 0,
      unit_cost: Number(i.unit_cost),
    }))
  );

  const full = await PurchaseOrder.findByPk(po.id, { include: PO_INCLUDE });
  res.status(201).json({ success: true, msg: 'Purchase order created.', data: full });
});

// @route  GET /api/purchase-orders/:id
// @access Admin
exports.getPO = asyncHandler(async (req, res, next) => {
  const po = await PurchaseOrder.findOne({
    where: companyScopeWhere(req, { id: req.params.id }),
    include: PO_INCLUDE,
  });
  if (!po) return next(new ErrorResponse('Purchase order not found', 404));
  res.json({ success: true, data: po });
});

// @route  POST /api/purchase-orders/:id/receive
// @desc   Mark items as received, update stock
// @access Admin
exports.receivePO = asyncHandler(async (req, res, next) => {
  const po = await PurchaseOrder.findOne({
    where: companyScopeWhere(req, { id: req.params.id }),
    include: PO_INCLUDE,
  });
  if (!po) return next(new ErrorResponse('Purchase order not found', 404));
  if (['received', 'cancelled'].includes(po.status)) {
    return res.status(400).json({ success: false, msg: `Cannot receive a ${po.status} PO.` });
  }

  const { received_items = [] } = req.body; // [{ item_id, received_qty }]

  const transaction = await PurchaseOrder.sequelize.transaction();
  try {
    let allReceived = true;

    for (const recv of received_items) {
      const item = po.items.find((i) => i.id === recv.item_id);
      if (!item) continue;

      const qty = Number(recv.received_qty) || 0;
      const newReceivedQty = Number(item.received_qty) + qty;

      await item.update({ received_qty: newReceivedQty }, { transaction });

      if (newReceivedQty < Number(item.ordered_qty)) allReceived = false;

      // Update product stock
      const product = await Product.findByPk(item.product_id, { transaction });
      if (product) {
        await product.increment('stock_quantity', { by: qty, transaction });
      }
    }

    const newStatus = allReceived ? 'received' : 'partial';
    await po.update(
      { status: newStatus, received_at: allReceived ? new Date() : po.received_at },
      { transaction }
    );

    await transaction.commit();
    const updated = await PurchaseOrder.findByPk(po.id, { include: PO_INCLUDE });
    res.json({ success: true, msg: 'Stock updated.', data: updated });
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
});

// @route  PATCH /api/purchase-orders/:id/cancel
// @access Admin
exports.cancelPO = asyncHandler(async (req, res, next) => {
  const po = await PurchaseOrder.findOne({
    where: companyScopeWhere(req, { id: req.params.id }),
  });
  if (!po) return next(new ErrorResponse('Purchase order not found', 404));
  if (po.status === 'received') {
    return res.status(400).json({ success: false, msg: 'Cannot cancel a received PO.' });
  }
  await po.update({ status: 'cancelled' });
  res.json({ success: true, msg: 'PO cancelled.', data: po });
});
