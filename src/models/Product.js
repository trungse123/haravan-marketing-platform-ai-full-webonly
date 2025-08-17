
const { Schema, model } = require('mongoose');
const ProductSchema = new Schema({
  id_hrv: { type: Number, index: true },
  title: String,
  sku: String,
  // NHÓM THEO SMART COLLECTION
  smart_groups: [{ id: Number, handle: String, title: String }],
  primary_group: String,   // dùng để quy chiếu nhanh
  // cũ: cogs/price/status...
  cogs: Number,
  price: Number,
  status: String,
  updated_at: Date,
}, { timestamps: true });
module.exports = model('Product', ProductSchema);
