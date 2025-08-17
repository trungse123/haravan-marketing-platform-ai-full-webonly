
const Coupon = require('../models/Coupon');
const { createFixedAmountDiscount, createPercentDiscount } = require('./haravan');

function todayRange() { const s = new Date(); s.setHours(0,0,0,0); const e = new Date(); e.setHours(23,59,59,999); return { start: s, end: e }; }
function isDoubleDay(d) { const day = d.getDate(); const m = d.getMonth()+1; return (m===8) && (day===8 || day===15 || day===25); }

async function planCouponsForToday() {
  const now = new Date(); const { start, end } = todayRange();
  const daily = [];
  if (isDoubleDay(now)) {
    daily.push({ code: 'NEKO7P', type: 'percent', value: 0.07, cap: 70000, min_spend: 399000, segment: 'double-day', starts_at: start, ends_at: end });
    daily.push({ code: 'NEKO50K', type: 'amount', value: 50000, min_spend: 699000, segment: 'double-day', starts_at: start, ends_at: end });
  } else {
    daily.push({ code: 'NEKO5K', type: 'amount', value: 5000, min_spend: 99000, segment: 'daily', starts_at: start, ends_at: end });
    daily.push({ code: 'NEKO10K', type: 'amount', value: 10000, min_spend: 199000, segment: 'daily', starts_at: start, ends_at: end });
    daily.push({ code: 'NEKO3P', type: 'percent', value: 0.03, cap: 30000, min_spend: 150000, segment: 'daily', starts_at: start, ends_at: end });
  }
  return daily;
}

async function createCouponsOnHaravan(plans) {
  const results = [];
  for (const p of plans) {
    let resp;
    if (p.type === 'amount') {
      resp = await createFixedAmountDiscount({ code: p.code, amount: p.value, minSpend: p.min_spend, startsAt: p.starts_at.toISOString(), endsAt: p.ends_at.toISOString() });
    } else {
      resp = await createPercentDiscount({ code: p.code, percent: p.value, minSpend: p.min_spend, startsAt: p.starts_at.toISOString(), endsAt: p.ends_at.toISOString() });
    }
    await Coupon.findOneAndUpdate({ code: p.code }, { $set: { ...p, hrv_id: resp?.discount?.id || null, status: 'active' } }, { upsert: true, new: true });
    results.push({ code: p.code, hrv_id: resp?.discount?.id || null });
  }
  return results;
}

module.exports = { planCouponsForToday, createCouponsOnHaravan };
