const express = require('express');
const DailyMetric = require('../models/DailyMetric');
const router = express.Router();

/**
 * POST /admin/manual-net-profit
 * body: { date: "YYYY-MM-DD", net_profit: number, notes?: string }
 */
router.post('/manual-net-profit', async (req, res) => {
  try {
    const { date, net_profit, notes } = req.body || {};
    if (!date || typeof net_profit !== 'number') {
      return res.status(400).json({ ok: false, error: 'date & net_profit required' });
    }
    const doc = await DailyMetric.findOneAndUpdate(
      { date },
      { $set: { manual_net_profit: net_profit, use_manual: true, notes: notes || '' } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, metric: doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
