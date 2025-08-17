
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const cfg = require('../config');
const DailyMetric = require('../models/DailyMetric');
const Order = require('../models/Order');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

async function buildPromptFiles({ days = 14 }) {
  const since = new Date(Date.now() - days*24*3600*1000);
  const orders = await Order.find({ created_at: { $gte: since }}).lean();
  const metrics = await DailyMetric.find({}).sort({ date: -1 }).limit(days).lean();

  let revenue = 0, cogs = 0, qty = 0;
  const bySku = new Map(), byFandom = new Map();
  for (const o of orders) {
    const lineRevenue = (o.subtotal_price || 0) - (o.total_discounts || 0);
    revenue += lineRevenue;
    for (const it of (o.items || [])) {
      qty += (it.qty || 0);
      cogs += (it.cogs || 0) * (it.qty || 0);
      const keySku = it.sku || it.title || 'unknown';
      const keyFan = it.fandom || 'unknown';
      const vSku = bySku.get(keySku) || { sku: keySku, title: it.title, revenue: 0, qty: 0 };
      vSku.revenue += (it.price || 0) * (it.qty || 0);
      vSku.qty += (it.qty || 0);
      bySku.set(keySku, vSku);
      const vFan = byFandom.get(keyFan) || { fandom: keyFan, revenue: 0, qty: 0 };
      vFan.revenue += (it.price || 0) * (it.qty || 0);
      vFan.qty += (it.qty || 0);
      byFandom.set(keyFan, vFan);
    }
  }
  const skuTop = Array.from(bySku.values()).sort((a,b)=>b.revenue-a.revenue).slice(0,15);
  const fandomTop = Array.from(byFandom.values()).sort((a,b)=>b.revenue-a.revenue).slice(0,15);

  const gm = revenue - cogs;
  const AOV = orders.length ? (revenue / orders.length) : 0;

  const data = {
    timeframe_days: days,
    business_params: cfg.biz,
    kpis: { orders_count: orders.length, qty, revenue, cogs, gross_margin: gm, aov: AOV },
    top_skus: skuTop,
    top_fandoms: fandomTop,
    daily_metrics: metrics.map(m => ({ date: m.date, revenue_net: m.revenue_net, cogs: m.cogs, net_profit: m.net_profit, closing_cash: m.closing_cash, notes: m.notes }))
  };

  const exportsDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
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
    `## Top Fandoms`,
    ...data.top_fandoms.map(x => `- ${x.fandom}: ${Math.round(x.revenue).toLocaleString()}đ / ${x.qty} items`),
    ``,
    `## Top SKUs`,
    ...data.top_skus.map(x => `- ${x.sku} - ${x.title||''}: ${Math.round(x.revenue).toLocaleString()}đ / ${x.qty} items`),
  ].join('\n');
  fs.writeFileSync(mdPath, md, 'utf8');

  return { jsonPath, mdPath, summary: data };
}

async function analyzeWithAI({ days = 14, goals = {} }) {
  const { jsonPath, mdPath } = await buildPromptFiles({ days });
  const jsonText = fs.readFileSync(jsonPath, 'utf8');

  const system = `Bạn là chiến lược gia tăng trưởng cho shop anime nhỏ tại Việt Nam. 
Yêu cầu: phân tích dữ liệu bán ${days} ngày (đính kèm JSON ở dưới) và xuất **kế hoạch hành động** ngắn gọn, có thể triển khai ngay hôm nay.
Ràng buộc lợi nhuận: GM ~ ${Math.round((cfg.biz.gmPercent||0)*100)}%. 
Tránh đề xuất mã làm GM ròng < 15%. Ưu tiên bậc -VND nhỏ & % thấp có CAP.
Đầu ra định dạng JSON với các trường:
{
 "insights": [..3-7 bullet..],
 "coupon_plan_today": [{"code","type","value","cap","min_spend","reason"}],
 "content": {"facebook_caption": "...", "tiktok_script": "..."},
 "ads": {"budget_shift": [{"from","to","reason"}], "notes": "..."},
 "inventory": {"restock": ["sku/fandom..."], "hold": ["sku/fandom..."]}
}`;

  const user = `Dữ liệu JSON:\n${jsonText}\n\nMục tiêu thêm (nếu có): ${JSON.stringify(goals)}`;

  const resp = await client.responses.create({
    model: MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2
  });

  let text = "";
  try { text = resp.output[0].content[0].text; } catch { text = JSON.stringify(resp, null, 2); }
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}

  return { file_json: jsonPath, file_md: mdPath, ai_raw: text, ai: parsed };
}

module.exports = { buildPromptFiles, analyzeWithAI };
