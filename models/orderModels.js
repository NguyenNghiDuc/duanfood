const db = require('../config/db')

async function createOrder({ username, total, paymentMethod, status, deliveryCompany, deliveryAddress, shippingFee }) {
  const [result] = await db.query('INSERT INTO orders (username, total, payment_method, status, delivery_company, delivery_address, shipping_fee) VALUES (?, ?, ?, ?, ?, ?, ?)', [username, total, paymentMethod, status, deliveryCompany, deliveryAddress, shippingFee])
  return result.insertId
}

async function createOrderItems(orderId, items) {
  await Promise.all(items.map(item => db.query('INSERT INTO order_items (order_id, food_id, title, price, quantity) VALUES (?, ?, ?, ?, ?)', [orderId, item.foodId, item.title, item.price, item.quantity])))
}

async function getOrdersByUsername(username) {
  const [rows] = await db.query('SELECT * FROM orders WHERE username = ? ORDER BY id DESC', [username])
  return rows
}

async function getAllOrders() {
  const [rows] = await db.query('SELECT * FROM orders ORDER BY id DESC')
  return rows
}

async function updateOrderStatus(id, status) {
  await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id])
}

async function updateOrderStatusForUser(id, username, status) {
  await db.query('UPDATE orders SET status = ? WHERE id = ? AND username = ?', [status, id, username])
}

async function getStats() {
  const [[{ totalRevenue }]] = await db.query('SELECT SUM(total + shipping_fee) AS totalRevenue FROM orders')
  const [[{ totalOrders }]] = await db.query('SELECT COUNT(*) AS totalOrders FROM orders')
  const [recentOrders] = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5')
  return {
    totalRevenue: totalRevenue || 0,
    totalOrders,
    recentOrders
  }
}

module.exports = {
  createOrder,
  createOrderItems,
  getOrdersByUsername,
  getAllOrders,
  updateOrderStatus,
  updateOrderStatusForUser,
  getStats
}
