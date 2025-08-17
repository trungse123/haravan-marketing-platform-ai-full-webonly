
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connect } = require('./db');
const cfg = require('./config');

const app = express();

// Mount webhook FIRST to preserve raw body for HMAC verification
app.use('/webhooks', require('./routes/webhook'));

app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

app.use('/admin', require('./routes/admin'));
app.use('/ai', require('./routes/ai'));
app.use('/exports', require('express').static('exports'));
app.get('/', (req, res) => res.send('OK'));
app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/admin', require('./routes/sync'));   // thêm dòng này
app.use('/admin', require('./routes/admin-metrics'));

connect().then(async () => {
  if (process.env.START_JOBS === 'true') {
    try { await require('./jobs/runInWeb')(); } catch (e) { console.error('Jobs init in web failed', e); }
  }
  app.listen(cfg.port, () => console.log(`Web up on :${cfg.port}`));
});
