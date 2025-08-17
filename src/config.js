
require('dotenv').config();

const cfg = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI,
  appBaseUrl: process.env.APP_BASE_URL,
  hrv: {
    accessToken: process.env.HRV_ACCESS_TOKEN,
    clientSecret: process.env.HRV_CLIENT_SECRET,
    base: process.env.HRV_API_BASE || 'https://apis.haravan.com'
  },
  biz: {
    gmPercent: parseFloat(process.env.GM_PERCENT || '0.30'),
    fixedCostsMonth: parseInt(process.env.FIXED_COSTS_MONTH || '30000000', 10),
    desiredProfitMonth: parseInt(process.env.DESIRED_PROFIT_MONTH || '10000000', 10),
    sellingDays: parseInt(process.env.SELLING_DAYS || '26', 10),
    cashConversionRatio: parseFloat(process.env.CASH_CONVERSION_RATIO || '0.8'),
    openingCashBalance: parseInt(process.env.OPENING_CASH_BALANCE || '20000000', 10),
    timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh'
  }
};

if (!cfg.mongoUri) { console.error('Missing MONGODB_URI'); process.exit(1); }
if (!cfg.hrv.accessToken) { console.error('Missing HRV_ACCESS_TOKEN'); process.exit(1); }
if (!cfg.hrv.clientSecret) { console.warn('WARN: HRV_CLIENT_SECRET missing. Webhook verification will fail.'); }

module.exports = cfg;
