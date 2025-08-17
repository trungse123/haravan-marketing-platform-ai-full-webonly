
const { computeDaily } = require('../services/metrics');
const { planCouponsForToday, createCouponsOnHaravan } = require('../services/discounts');

module.exports = (agenda) => {
  // compute metric for "now" (hourly)
  agenda.define('compute-today-metric', async () => {
    const now = new Date();
    await computeDaily(now);
  });

  // nightly plan at 00:05 VN (triggered by schedule configured in runInWeb)
  agenda.define('nightly-run', async () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    await computeDaily(y);
    const plan = await planCouponsForToday();
    await createCouponsOnHaravan(plan);
    console.log('[Jobs] nightly-run done');
  });
};
