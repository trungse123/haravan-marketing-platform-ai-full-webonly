
const { Schema, model } = require('mongoose');
const PayableSchema = new Schema({
  supplier: String,
  due_date: Date,
  amount: Number,
  note: String,
  status: { type: String, default: 'pending' }
}, { timestamps: true });
module.exports = model('Payable', PayableSchema);
