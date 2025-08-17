
const mongoose = require('mongoose');
const cfg = require('./config');

async function connect() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(cfg.mongoUri, { autoIndex: true });
  console.log('[DB] connected');
}

module.exports = { connect };
