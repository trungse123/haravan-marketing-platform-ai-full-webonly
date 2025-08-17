// src/services/ai.js
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const cfg = require('../config');
const DailyMetric = require('../models/DailyMetric');
const Order = require('../models/Order');

const USE_OPENAI = process.env.USE_OPENAI !== 'false' && !!process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const client = USE_OPENAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function ensureExportsDir() {
  const exportsDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);
  return exportsDir;
}

function stampName() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// ===== Local fallback plan (không dùng AI) =====
function makeLocalPlan(summary, goals = {}) {
  const gm = summary.business_params.gmPercent || 0.3;
  const targetMonth = (summary.business_params.fixedCostsMonth + summary.business_params.desiredProfitMonth) / (gm || 0.3);
  const targetDay = targetMonth / (summary.business_params.sellingDays || 26);

  // trung bình 7 ngày gần nhất
  const last7 = summary.daily_metrics.slice(0, 7);
  const avg7 = last7.length ? last7.reduce((s, m) => s + (m.revenue_net || 0), 0) / last7.length : 0;
  const pressure = avg7 < targetDay * 0.8 ? 'high' : 'normal';

  const base = [
    { code: 'NEKO5K',  type: 'amount',  value: 5000,  cap: null,   min_spend: 99000,  reason: 'mồi chuyển đổi nhỏ' },
    { code: 'NEKO10K', type: 'amount',  value: 10000, cap: null,   min_spend: 199000, reason: 'đẩy AOV >199k' },
    { code: 'NEKO3P',  type: 'percent', value: 0.03,  cap: 30000,  min_spend: 150000, reason: 'ưu đãi nhẹ, có CAP' },
  ];
  if (pressure === 'high') {
    base.push({ code: 'NEKO5P', type: 'percent', value: 0.05, cap: 70000, min_spend: 399000, reason: 'thiếu doanh thu, kích cầu có CAP' });
  }

  return {
    insights: [
      `Target/ngày ≈ ${Math.round(targetDay).toLocaleString()}đ; 7 ngày gần nhất đạt ≈ ${Math.round(avg7).toLocaleString()}đ (${pressure}).`,
      `GM giả định ${Math.round(gm * 100)}% ⇒ tránh mã >5% và luôn đặt min_spend, CAP.`,
      `Ưu tiên nhóm bán chạy theo SmartCollection (top_groups) khi làm nội dung/ads.`,
    ],
    coupon_plan_today: base,
    content: {
      facebook_caption:
        `🔥 Deal nhẹ tay – giá vẫn mềm!\n` +
        `• NEKO5K: -5k cho đơn >99k\n` +
        `• NEKO10K: -10k cho đơn >199k\n` +
        `• NEKO3P: -3% (tối đa 30k) cho đơn >150k\n` +
        `Chốt đơn hôm nay để kịp ưu đãi nha!`,
      tiktok_script:
        `Hook: "Đồ anime sale nhẹ mà lời vẫn giữ, nghe lạ không?"\n` +
        `Scene 1: Show 3 sản phẩm bán chạy theo nhóm\n` +
        `Scene 2: Chèn text NEKO5K / NEKO10K / NEKO3P\n` +
        `CTA: "Comment 'MÃ' để nhận code – chốt đơn trước 24h!"`
    },
    ads: {
      budget_shift: [{ from: 'interest rộng', to: 'retarget view-content 7d', reason: 'tập trung chuyển đổi nhanh' }],
      notes: 'Ưu tiên bài có nhóm bán chạy tuần rồi; đặt cap ngân sách theo CPA.'
    },
    inventory: { restock: [], hold: [] }
  };
}

// ===== Export dữ liệu cho prompt =====
async function buildPromptFiles({ days = 14 }) {
  const exportsDir = ensureExportsDir();

  // range ngày
  const to = endOfDay(new Date());
  const from = startOfDay(new Date(Date.now() - (days - 1) * 24 * 3600 * 1000));

  // Orders đủ điều kiện (eligible=true)
  const orders = await Order.find({
    eligible: true,
    created_at: { $gte: from, $lte: to }
  }).lean();

  let revenue = 0, cogs = 0, qty = 0;
  const bySku = new Map();
  const byGroup = new Map();

  for (const o of orders) {
    const lineRevenue = (Number(o.subtotal_price) || Number(o.total_price) || 0) - (Number(o.total_discounts) || 0);
    revenue += lineRevenue;

    for (const it of (o.items || [])) {
      const q = Number(it.qty) || 0;
      const p = Number(it.price) || 0;
      const cg = Number(it.cogs) || 0;

      qty += q;
      cogs += cg * q;

      // SKU
      const keySku = it.sku || it.title || 'unknown';
      const vSku = bySku.get(keySku) || { sku: keySku, title: it.title, revenue: 0, qty: 0 };
      vSku.revenue += p * q;
      vSku.qty += q;
      bySku.set(keySku, vSku);

      // GROUP theo SmartCollection
      const keyGrp = it.group || 'unknown';
      const vGrp = byGroup.get(keyGrp) || { group: keyGrp, revenue: 0, qty: 0 };
      vGrp.revenue += p * q;
      vGrp.qty += q;
      byGroup.set(keyGrp, vGrp);
    }
  }

  const skuTop = Array.from(bySku.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 15);
  const groupTop = Array.from(byGroup.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 15);

  // Daily metrics trong range; ưu tiên net_profit nhập tay
  const allMetrics = await DailyMetric.find({}).sort({ date: -1 }).lean();
  const daily_metrics = allMetrics
    .filter(m => {
      // m.date là yyyy-mm-dd (local), convert sang Date để so sánh
      const d = startOfDay(new Date(m.date + 'T00:00:00'));
      return d >= from && d <= to;
    })
    .sort((a, b) => (b.date > a.date ? 1 : -1)) // mới -> cũ
    .slice(0, days)
    .map(m => ({
      date: m.date,
      revenue_net: Number(m.revenue_net) || 0,
      cogs: Number(m.cogs) || 0,
      net_profit: m.use_manual
        ? Number(m.manual_net_profit) || 0
        : ((Number(m.gross_margin) || 0) - (Number(m.fixed_cost_alloc) || 0) - (Number(m.variable_costs) || 0)),
      closing_cash: Number(m.closing_cash) || 0,
      notes: m.notes || ''
    }));

  const gm = revenue - cogs;
  const AOV = orders.length ? (revenue / orders.length) : 0;

  const data = {
    timeframe_days: days,
    business_params: cfg.biz,
    kpis: {
      orders_count: orders.length,
      qty,
      revenue,
      cogs,
      gross_margin: gm,
      aov: AOV
    },
    top_skus: skuTop,
    top_groups: groupTop,
    daily_metrics
  };

  const stamp = stampName();
  const jsonPath = path.join(exportsDir, `prompt-data-${stamp}.json`);
  const mdPath = path.join(exportsDir, `prompt-data-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

  const md = [
    `# Prompt Data (last ${days} days)`,
    `- Orders: ${data.kpis.orders_count}`,
    `- Qty: ${data.kpis.qty}`,
    `- Revenue: ${Math.round(data.kpis.revenue).toLocaleString()}đ`,
    `- COGS: ${Math.round(data.kpis.cogs).toLocaleString()}đ`,
    `- GM: ${Math.round(data.kpis.gross_margin).toLocaleString()}đ`,
    `- AOV: ${Math.round(data.kpis.aov).toLocaleString()}đ`,
    ``,
    `## Top Groups (SmartCollections)`,
    ...data.top_groups.map(x => `- ${x.group}: ${Math.round(x.revenue).toLocaleString()}đ / ${x.qty} items`),
    ``,
    `## Top SKUs`,
    ...data.top_skus.map(x => `- ${x.sku} - ${x.title || ''}: ${Math.round(x.revenue).toLocaleString()}đ / ${x.qty} items`)
  ].join('\n');
  fs.writeFileSync(mdPath, md, 'utf8');

  return { jsonPath, mdPath, summary: data };
}

// ===== Phân tích bằng OpenAI (hoặc fallback) =====
async function analyzeWithAI({ days = 14, goals = {} }) {
  const { jsonPath, mdPath, summary } = await buildPromptFiles({ days });

  // Fallback nếu không dùng/bị lỗi OpenAI
  if (!USE_OPENAI) {
    return { file_json: jsonPath, file_md: mdPath, ai_raw: null, ai: makeLocalPlan(summary, goals), used: 'local' };
  }

  const jsonText = fs.readFileSync(jsonPath, 'utf8');

  const system =
`Bạn là chiến lược gia tăng trưởng cho shop anime nhỏ tại Việt Nam.
Phân tích dữ liệu ${days} ngày (JSON đính kèm). Nhóm theo SmartCollection (top_groups), chỉ dùng đơn eligible.
Ràng buộc lợi nhuận: GM ~ ${Math.round((cfg.biz.gmPercent || 0.3) * 100)}%. Tránh mã làm GM ròng < 15%.
Ưu tiên mã nhỏ, có min_spend và CAP. Đầu ra là JSON đúng schema: 
{
 "insights": [..3-7 bullet..],
 "coupon_plan_today": [{"code","type":"amount|percent","value","cap","min_spend","reason"}],
 "content": {"facebook_caption": "...", "tiktok_script": "..."},
 "ads": {"budget_shift": [{"from","to","reason"}], "notes": "..."},
 "inventory": {"restock": ["..."], "hold": ["..."]}
}`;

  const user = `Dữ liệu JSON:\n${jsonText}\n\nMục tiêu thêm (nếu có): ${JSON.stringify(goals)}`;

  try {
    const resp = await client.responses.create({
      model: MODEL,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    });

    let text = '';
    try { text = resp.output[0].content[0].text; }
    catch { text = JSON.stringify(resp, null, 2); }

    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    return { file_json: jsonPath, file_md: mdPath, ai_raw: text, ai: parsed, used: 'openai' };
  } catch (e) {
    // fallback nếu lỗi/quota
    const plan = makeLocalPlan(summary, goals);
    return { file_json: jsonPath, file_md: mdPath, ai_raw: null, ai: plan, error: e.message, used: 'local-fallback' };
  }
}

module.exports = { buildPromptFiles, analyzeWithAI };
