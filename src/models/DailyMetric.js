
const { Schema, model } = require('mongoose');
const DailyMetricSchema = new Schema({
  date: { type: String, unique: true },
  revenue_net: Number,
  cogs: Number,
  gross_margin: Number,
  fixed_cost_alloc: Number,
  variable_costs: Number,
  // tiền mặt
  opening_cash: Number,
  cash_in_est: Number,
  closing_cash: Number,
  notes: String,
  // NEW:
  manual_net_profit: Number,
  use_manual: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = model('DailyMetric', DailyMetricSchema);
