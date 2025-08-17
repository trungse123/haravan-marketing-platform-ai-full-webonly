
const express = require('express');
const { computeDaily, targetRevenueDay, targetRevenueMonth } = require('../services/metrics');
const DailyMetric = require('../models/DailyMetric');
const Coupon = require('../models/Coupon');
const { planCouponsForToday, createCouponsOnHaravan } = require('../services/discounts');

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));

router.post('/nightly-run', async (req, res) => {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const metric = await computeDaily(yesterday);
  const plan = await planCouponsForToday();
  const created = await createCouponsOnHaravan(plan);
  res.json({ metric, plan, created });
});

router.get('/metrics/daily', async (req, res) => {
  const docs = await DailyMetric.find().sort({ date: -1 }).limit(31);
  res.json(docs);
});

router.get('/targets', (req, res) => {
  res.json({ targetRevenueMonth: targetRevenueMonth(), targetRevenueDay: targetRevenueDay() });
});

router.get('/coupons', async (req, res) => {
  const docs = await Coupon.find().sort({ createdAt: -1 }).limit(100);
  res.json(docs);
});

module.exports = router;
