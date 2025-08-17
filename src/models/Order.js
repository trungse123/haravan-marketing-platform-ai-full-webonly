
const { Schema, model } = require('mongoose');

const OrderItemSchema = new Schema({
  product_id_hrv: Number,
  variant_id_hrv: Number,
  sku: String,
  title: String,
  fandom: String,
  qty: Number,
  price: Number,
  discount_allocation: Number,
  cogs: Number
}, { _id: false });

const OrderSchema = new Schema({
  id_hrv: { type: Number, unique: true },
  name: String,
  created_at: Date,
  processed_at: Date,
  financial_status: String,
  gateway: String,
  total_price: Number,
  subtotal_price: Number,
  total_discounts: Number,
  currency: String,
  source_name: String,
  utm_source: String,
  utm_medium: String,
  utm_campaign: String,
  items: [OrderItemSchema],
}, { timestamps: true });

module.exports = model('Order', OrderSchema);
