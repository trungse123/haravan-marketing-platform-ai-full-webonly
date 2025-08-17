
const express = require('express');
const { buildPromptFiles, analyzeWithAI } = require('../services/ai');

const router = express.Router();

router.post('/export', async (req, res) => {
  const days = parseInt(req.body?.days || '14', 10);
  const out = await buildPromptFiles({ days });
  res.json(out);
});

router.post('/analyze', async (req, res) => {
  const days = parseInt(req.body?.days || '14', 10);
  const goals = req.body?.goals || {};
  const out = await analyzeWithAI({ days, goals });
  res.json(out);
});

module.exports = router;
