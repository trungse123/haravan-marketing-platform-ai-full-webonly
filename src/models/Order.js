
const { Schema, model } = require('mongoose');

const OrderItemSchema = new Schema({
  product_id_hrv: Number,
  variant_id_hrv: Number,
  sku: String,
  title: String,
  // nhóm chính theo smart collection
  group: String,
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
  fulfillment_status: String,
  status: String, // open/closed/cancelled
  cancelled_at: Date,
  refunds: Array,
  gateway: String,
  total_price: Number,
  subtotal_price: Number,
  total_discounts: Number,
  currency: String,
  source_name: String,
  items: [OrderItemSchema],
  eligible: { type: Boolean, default: true } // dùng để lọc khi phân tích
}, { timestamps: true });

module.exports = model('Order', OrderSchema);
