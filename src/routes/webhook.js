// src/routes/webhook.js
const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { computeDaily } = require('../services/metrics');

const router = express.Router();

// GIỮ raw body để lấy đúng JSON gốc
router.use('/haravan', express.raw({ type: 'application/json' }));

// KHÔNG HMAC, KHÔNG TOKEN — trả 200 ngay cho nhanh
router.post('/haravan', async (req, res) => {
  try {
    res.status(200).send('OK'); // phản hồi ngay, xử lý ngầm dưới

    const text = req.body?.toString('utf8') || '{}';
    const payload = JSON.parse(text);

    // Tự suy topic (ưu tiên header, rồi query, rồi fallback)
    const topic =
      req.header('X-Haravan-Topic') ||
      req.query.topic ||
      payload?.topic ||
      (payload?.line_items ? 'orders/create' : 'products/update');

    console.log('[Webhook] hit', new Date().toISOString(), 'topic=', topic);

    if (topic.includes('orders'))      await handleOrder(payload);
    else if (topic.includes('products')) await handleProduct(payload);
    else console.log('[Webhook] unknown topic, ignored');
  } catch (e) {
    console.error('[Webhook] error', e);
  }
});

async function handleOrder(payload) {
  const o = payload.order || payload;
  if (!o || !o.id) return;

  const items = (o.line_items || []).map(li => ({
    product_id_hrv: li.product_id,
    variant_id_hrv: li.variant_id,
    sku: li.sku,
    title: li.title,
    fandom: li.vendor || '',
    qty: li.quantity,
    price: parseFloat(li.price || 0),
    discount_allocation: 0,
    cogs: 0
  }));

  // QUAN TRỌNG: setOnInsert id_hrv để tránh id=null gây trùng
  const doc = await Order.findOneAndUpdate(
    { id_hrv: o.id },
    {
      $set: {
        name: o.name,
        created_at: o.created_at ? new Date(o.created_at) : new Date(),
        processed_at: o.processed_at ? new Date(o.processed_at) : null,
        financial_status: o.financial_status || '',
        gateway: o.gateway || '',
        total_price: parseFloat(o.total_price || 0),
        subtotal_price: parseFloat(o.subtotal_price || 0),
        total_discounts: parseFloat(o.total_discounts || 0),
        currency: o.currency || 'VND',
        source_name: o.source_name || '',
        utm_source: o.source_name || '',
        utm_medium: '',
        utm_campaign: '',
        items
      },
      $setOnInsert: { id_hrv: o.id }
    },
    { upsert: true, new: true }
  );

  await computeDaily(doc.created_at ? new Date(doc.created_at) : new Date());
  console.log('[Webhook] order upserted', o.id);
}

async function handleProduct(payload) {
  const p = payload.product || payload;
  if (!p || !p.id) return;

  await Product.findOneAndUpdate(
    { id_hrv: p.id },
    {
      $set: {
        title: p.title,
        sku: (p.variants && p.variants[0]?.sku) || '',
        cogs: 0,
        price: (p.variants && parseFloat(p.variants[0]?.price || 0)) || 0,
        status: p.status || 'active',
        updated_at: p.updated_at ? new Date(p.updated_at) : new Date()
      }
    },
    { upsert: true, new: true }
  );

  console.log('[Webhook] product upserted', p.id);
}

module.exports = router;
