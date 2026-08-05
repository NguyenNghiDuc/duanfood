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
async function getOrderById(id) {
  const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [id])
  return rows[0] || null
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

async function getRevenueByDay(days = 7) {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (days - 1))

  const from = startDate.toISOString().slice(0, 10)
  const to = endDate.toISOString().slice(0, 10)

  const [rows] = await db.query(
    `SELECT substr(created_at, 1, 10) AS date,
            SUM(total + shipping_fee) AS revenue
     FROM orders
     WHERE status = 'Hoàn thành'
       AND substr(created_at, 1, 10) BETWEEN ? AND ?
     GROUP BY date
     ORDER BY date ASC`,
    [from, to]
  )

  const revenueMap = new Map(rows.map((row) => [row.date, Number(row.revenue || 0)]))
  const result = []

  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const key = date.toISOString().slice(0, 10)
    result.push({
      date: key,
      revenue: revenueMap.get(key) || 0
    })
  }

  return result
}

async function getRevenueByMonth(months = 12) {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setMonth(startDate.getMonth() - (months - 1))

  const monthsList = []
  for (let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    const year = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    monthsList.push(`${year}-${m}`)
  }

  const from = new Date(startDate.getFullYear(), startDate.getMonth(), 1).toISOString().slice(0,10)
  const to = endDate.toISOString().slice(0,10)

  const [rows] = await db.query(
    `SELECT substr(created_at, 1, 7) AS month, SUM(total + shipping_fee) AS revenue
     FROM orders
     WHERE status = 'Hoàn thành'
       AND substr(created_at, 1, 10) BETWEEN ? AND ?
     GROUP BY month
     ORDER BY month ASC`,
    [from, to]
  )

  const revenueMap = new Map(rows.map(r => [r.month, Number(r.revenue || 0)]))
  return monthsList.map(m => ({ month: m, revenue: revenueMap.get(m) || 0 }))
}

module.exports = {
  createOrder,
  createOrderItems,
  getOrdersByUsername,
  getAllOrders,
  updateOrderStatus,
  updateOrderStatusForUser,
  getStats,
  getRevenueByDay,
  getRevenueByMonth
}
