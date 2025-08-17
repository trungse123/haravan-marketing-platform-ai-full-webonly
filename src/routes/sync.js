const express = require('express');
const axios = require('axios');

const SmartCollection = require('../models/SmartCollection');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { computeDaily } = require('../services/metrics');

const router = express.Router();

const hrv = axios.create({
  baseURL: 'https://apis.haravan.com',
  timeout: 30000,
  headers: {
    'Authorization': `Bearer ${process.env.HRV_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// --- 1) Đồng bộ SmartCollections ---
router.post('/sync/smart-collections', async (req, res) => {
  try {
    let page = 1, total = 0, upserts = 0;
    for (;;) {
      const { data } = await hrv.get('/com/smart_collections.json', {
        params: { page, limit: 50, fields: 'id,title,handle,rules,published_at,updated_at' }
      });
      const list = data.smart_collections || [];
      if (!list.length) break;

      for (const sc of list) {
        await SmartCollection.findOneAndUpdate(
          { id_hrv: sc.id },
          { $set: {
              title: sc.title,
              handle: sc.handle,
              rules: sc.rules,
              published_at: sc.published_at ? new Date(sc.published_at) : null,
              updated_at: sc.updated_at ? new Date(sc.updated_at) : null
            } },
          { upsert: true }
        );
        upserts++;
      }
      total += list.length;
      page++;
    }
    res.json({ ok: true, total, upserts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// helper: lấy danh sách SmartCollections của một product
async function fetchProductSmartGroups(productId) {
  const { data } = await hrv.get('/com/smart_collections.json', {
    params: { product_id: productId, fields: 'id,title,handle', limit: 50 }
  });
  const arr = data.smart_collections || [];
  return arr.map(x => ({ id: x.id, title: x.title, handle: x.handle }));
}

// --- 2) Đồng bộ Products + gắn SmartGroups ---
router.post('/sync/products', async (req, res) => {
  try {
    const { pageStart = 1, limit = 50, updated_at_min, updated_at_max } = req.body || {};
    let page = pageStart, total = 0, upserts = 0;

    for (;;) {
      const params = { page, limit, fields: 'id,title,variants,handle,updated_at,status' };
      if (updated_at_min) params.updated_at_min = updated_at_min;
      if (updated_at_max) params.updated_at_max = updated_at_max;

      const { data } = await hrv.get('/com/products.json', { params });
      const list = data.products || [];
      if (!list.length) break;

      for (const p of list) {
        const sku = (p.variants && p.variants[0]?.sku) || '';
        const price = (p.variants && parseFloat(p.variants[0]?.price || 0)) || 0;

        let groups = [];
        try { groups = await fetchProductSmartGroups(p.id); } catch {}

        await Product.findOneAndUpdate(
          { id_hrv: p.id },
          { $set: {
              title: p.title,
              sku,
              price,
              status: p.status || 'active',
              updated_at: p.updated_at ? new Date(p.updated_at) : new Date(),
              smart_groups: groups,
              primary_group: (groups[0]?.title) || ''
            } },
          { upsert: true }
        );
        upserts++;
      }
      total += list.length;
      page++;
    }

    res.json({ ok: true, total, upserts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- 3) Đồng bộ Orders (lọc huỷ/hoàn ra khỏi phân tích) ---
router.post('/sync/orders', async (req, res) => {
  try {
    const { created_at_min, created_at_max, pageStart = 1, limit = 50 } = req.body || {};
    let page = pageStart, total = 0, upserts = 0;

    for (;;) {
      const params = { page, limit, order: 'created_at asc' };
      if (created_at_min) params.created_at_min = created_at_min;
      if (created_at_max) params.created_at_max = created_at_max;

      const { data } = await hrv.get('/com/orders.json', { params });
      const list = data.orders || [];
      if (!list.length) break;

      const ProductModel = require('../models/Product');

      for (const o of list) {
        const isCancelled = o.status === 'cancelled' || !!o.cancelled_at;
        const isRefunded  = ['refunded','partially_refunded','voided'].includes(o.financial_status);
        const hasRefunds  = Array.isArray(o.refunds) && o.refunds.length > 0;
        const eligible = !(isCancelled || isRefunded || hasRefunds);

        const items = (o.line_items || []);
        const prodIds = items.map(li => li.product_id).filter(Boolean);
        const prodList = await ProductModel.find({ id_hrv: { $in: prodIds } })
                            .select('id_hrv primary_group').lean();
        const groupById = new Map(prodList.map(p => [p.id_hrv, p.primary_group]));

        const itemsMapped = items.map(li => ({
          product_id_hrv: li.product_id,
          variant_id_hrv: li.variant_id,
          sku: li.sku,
          title: li.title,
          group: groupById.get(li.product_id) || '',
          qty: li.quantity,
          price: parseFloat(li.price || 0),
          discount_allocation: 0,
          cogs: 0
        }));

        const doc = await Order.findOneAndUpdate(
          { id_hrv: o.id },
          { $set: {
              name: o.name,
              created_at: o.created_at ? new Date(o.created_at) : new Date(),
              processed_at: o.processed_at ? new Date(o.processed_at) : null,
              financial_status: o.financial_status || '',
              fulfillment_status: o.fulfillment_status || '',
              status: o.status || 'open',
              cancelled_at: o.cancelled_at ? new Date(o.cancelled_at) : null,
              refunds: o.refunds || [],
              gateway: o.gateway || '',
              total_price: parseFloat(o.total_price || 0),
              subtotal_price: parseFloat(o.subtotal_price || 0),
              total_discounts: parseFloat(o.total_discounts || 0),
              currency: o.currency || 'VND',
              source_name: o.source_name || '',
              items: itemsMapped,
              eligible
            } },
          { upsert: true, new: true }
        );

        if (doc.eligible) {
          await computeDaily(doc.created_at ? new Date(doc.created_at) : new Date());
        }
        upserts++;
      }

      total += list.length;
      page++;
    }

    res.json({ ok: true, total, upserts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
