
const DailyMetric = require('../models/DailyMetric');
const Order = require('../models/Order');
const Payable = require('../models/Payable');
const cfg = require('../config');
const { formatISODate } = require('../utils/time');

function targetRevenueMonth() { return (cfg.biz.fixedCostsMonth + cfg.biz.desiredProfitMonth) / cfg.biz.gmPercent; }
function targetRevenueDay() { return targetRevenueMonth() / cfg.biz.sellingDays; }

async function computeDaily(dateObj) {
  const dateStr = formatISODate(dateObj);
  const next = new Date(dateObj.getTime() + 24*3600*1000);
  const nextStr = formatISODate(next);
  const q = { created_at: { $gte: new Date(dateStr + 'T00:00:00.000Z'), $lt: new Date(nextStr + 'T00:00:00.000Z') } };
  const orders = await Order.find(q);
  let revenue_net = 0, cogs = 0;
  for (const o of orders) {
    revenue_net += (o.subtotal_price || 0) - (o.total_discounts || 0);
    cogs += (o.items || []).reduce((s, it) => s + (it.cogs || 0) * (it.qty || 0), 0);
  }
  const gross_margin = revenue_net - cogs;
  const fixed_cost_alloc = cfg.biz.fixedCostsMonth / cfg.biz.sellingDays;
  const variable_costs = 0;
  const net_profit = gross_margin - fixed_cost_alloc - variable_costs;
  const cash_in_est = revenue_net * cfg.biz.cashConversionRatio;

  const prev = await DailyMetric.findOne({ date: formatISODate(new Date(dateObj.getTime() - 24*3600*1000)) });
  const opening_cash = prev ? (prev.closing_cash || 0) : cfg.biz.openingCashBalance;

  const payInDate = await Payable.aggregate([ { $match: { due_date: { $gte: new Date(dateStr), $lt: new Date(nextStr) } } }, { $group: { _id: null, sum: { $sum: "$amount" } } } ]);
  const dueAmount = (payInDate[0]?.sum) || 0;

  const closing_cash = opening_cash + cash_in_est - dueAmount;
  const notes = closing_cash < 0 ? 'Cảnh báo: Thiếu tiền' : '';

  const doc = await DailyMetric.findOneAndUpdate(
    { date: dateStr },
    { $set: { revenue_net, cogs, gross_margin, fixed_cost_alloc, variable_costs, net_profit, cash_in_est, opening_cash, closing_cash, notes } },
    { upsert: true, new: true }
  );
  return doc;
}
module.exports = { computeDaily, targetRevenueDay, targetRevenueMonth };
