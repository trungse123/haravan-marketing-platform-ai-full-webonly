
const { Schema, model } = require('mongoose');
const ProductSchema = new Schema({
  id_hrv: { type: Number, index: true },
  title: String,
  sku: String,
  fandom: String,
  cogs: Number,
  price: Number,
  status: String,
  updated_at: Date,
}, { timestamps: true });
module.exports = model('Product', ProductSchema);
