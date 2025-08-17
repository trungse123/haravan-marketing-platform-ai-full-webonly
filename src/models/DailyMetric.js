
const { Schema, model } = require('mongoose');
const DailyMetricSchema = new Schema({
  date: { type: String, unique: true }, // yyyy-mm-dd
  revenue_net: Number,
  cogs: Number,
  gross_margin: Number,
  fixed_cost_alloc: Number,
  variable_costs: Number,
  net_profit: Number,
  cash_in_est: Number,
  opening_cash: Number,
  closing_cash: Number,
  notes: String
}, { timestamps: true });
module.exports = model('DailyMetric', DailyMetricSchema);
