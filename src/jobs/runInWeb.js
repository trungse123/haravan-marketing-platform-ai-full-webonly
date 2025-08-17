
const Agenda = require('agenda');
const { log } = require('../utils/logger');

module.exports = async () => {
  const agenda = new Agenda({
    db: { address: process.env.MONGODB_URI, collection: 'jobs' }
  });

  // Define jobs
  require('./nightly')(agenda);

  agenda.on('ready', async () => {
    log('[Jobs] Agenda (in-web) ready');
    // hourly compute
    await agenda.every('1 hour', 'compute-today-metric');
    // 17:05 UTC ≈ 00:05 Asia/Ho_Chi_Minh
    await agenda.every('5 17 * * *', 'nightly-run', null, { timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh' });
    await agenda.start();
  });

  return agenda;
};
