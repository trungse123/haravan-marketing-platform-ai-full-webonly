
const { Schema, model } = require('mongoose');
const ShopSchema = new Schema({
  domain: String,
  accessToken: String,
  scopes: [String],
  installedAt: Date,
  active: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = model('Shop', ShopSchema);
