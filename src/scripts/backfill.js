
const { connect } = require('../db');
const { fetchOrders, fetchProducts } = require('../services/haravan');
const Order = require('../models/Order');
const Product = require('../models/Product');

async function run() {
  await connect();
  const since = new Date(Date.now() - 30*24*3600*1000).toISOString();
  const until = new Date().toISOString();

  let page = 1;
  while (true) {
    const data = await fetchOrders({ created_at_min: since, created_at_max: until, limit: 50, page });
    const list = data.orders || data?.data || [];
    if (!list.length) break;
    for (const o of list) {
      const items = (o.line_items || []).map(li => ({
        product_id_hrv: li.product_id, variant_id_hrv: li.variant_id, sku: li.sku, title: li.title,
        fandom: li.vendor || '', qty: li.quantity, price: parseFloat(li.price || 0), discount_allocation: 0, cogs: 0
      }));
      await Order.findOneAndUpdate(
        { id_hrv: o.id },
        { $set: { name: o.name, created_at: o.created_at ? new Date(o.created_at) : new Date(),
          processed_at: o.processed_at ? new Date(o.processed_at) : null, financial_status: o.financial_status || '', gateway: o.gateway || '',
          total_price: parseFloat(o.total_price || 0), subtotal_price: parseFloat(o.subtotal_price || 0), total_discounts: parseFloat(o.total_discounts || 0),
          currency: o.currency || 'VND', source_name: o.source_name || '', items } },
        { upsert: true, new: true }
      );
    }
    console.log('Imported orders page', page, 'count', list.length);
    page++;
  }

  const prod = await fetchProducts({ limit: 250 });
  const plist = prod.products || prod?.data || [];
  for (const p of plist) {
    await Product.findOneAndUpdate(
      { id_hrv: p.id },
      { $set: { title: p.title, sku: (p.variants && p.variants[0]?.sku) || '', cogs: 0,
        price: (p.variants && parseFloat(p.variants[0]?.price || 0)) || 0, status: p.status || 'active',
        updated_at: p.updated_at ? new Date(p.updated_at) : new Date() } },
      { upsert: true, new: true }
    );
  }

  console.log('Backfill done');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
