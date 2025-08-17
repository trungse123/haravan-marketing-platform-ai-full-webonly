
const crypto = require('crypto');
const cfg = require('../config');

function verifyHaravanHmac(rawBody, headerSig) {
  if (!cfg.hrv.clientSecret) return false;
  try {
    const digest = crypto.createHmac('sha256', cfg.hrv.clientSecret).update(rawBody).digest('base64');
    const a = Buffer.from(digest);
    const b = Buffer.from(headerSig || '', 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

module.exports = { verifyHaravanHmac };
