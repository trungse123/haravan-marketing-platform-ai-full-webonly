
const { Schema, model } = require('mongoose');
const CouponSchema = new Schema({
  code: { type: String, unique: true },
  type: { type: String, enum: ['amount','percent'] },
  value: Number,
  cap: Number,
  min_spend: Number,
  segment: String,
  starts_at: Date,
  ends_at: Date,
  hrv_id: Number,
  status: { type: String, default: 'active' }
}, { timestamps: true });
module.exports = model('Coupon', CouponSchema);
