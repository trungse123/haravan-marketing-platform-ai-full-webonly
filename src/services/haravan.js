
const axios = require('axios');
const cfg = require('../config');

const api = axios.create({
  baseURL: cfg.hrv.base,
  timeout: 15000,
  headers: { Authorization: `Bearer ${cfg.hrv.accessToken}` }
});

async function fetchOrders(params = {}) {
  const res = await api.get('/com/orders.json', { params });
  return res.data;
}
async function fetchProducts(params = {}) {
  const res = await api.get('/com/products.json', { params });
  return res.data;
}
async function createFixedAmountDiscount({ code, amount, minSpend, startsAt, endsAt }) {
  const payload = { discount: { code, value_type: 'fixed_amount', value: amount, minimum_order_amount: minSpend, starts_at: startsAt, ends_at: endsAt } };
  const res = await api.post('/com/discounts.json', payload);
  return res.data;
}
async function createPercentDiscount({ code, percent, minSpend, startsAt, endsAt }) {
  const payload = { discount: { code, value_type: 'percentage', value: Math.round(percent*10000)/100, minimum_order_amount: minSpend, starts_at: startsAt, ends_at: endsAt } };
  const res = await api.post('/com/discounts.json', payload);
  return res.data;
}
module.exports = { fetchOrders, fetchProducts, createFixedAmountDiscount, createPercentDiscount };
