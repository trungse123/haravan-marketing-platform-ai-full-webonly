const { Schema, model } = require('mongoose');

const SmartCollectionSchema = new Schema({
  id_hrv: { type: Number, unique: true, index: true },
  title: String,
  handle: String,
  rules: Array,
  published_at: Date,
  updated_at: Date
}, { timestamps: true });

module.exports = model('SmartCollection', SmartCollectionSchema);
