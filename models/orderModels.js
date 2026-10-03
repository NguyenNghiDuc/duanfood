const db = require('../config/db')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

async function createOrder({ username, total, paymentMethod, status, deliveryCompany, deliveryAddress, shippingFee, discountAmount = 0, voucherCode = '' }) {
  await ensureCommerceSchema()
  const [result] = await db.query(
    'INSERT INTO orders (username,total,payment_method,status,delivery_company,delivery_address,shipping_fee,discount_amount,voucher_code,status_updated_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)',
    [username,total,paymentMethod,status,deliveryCompany,deliveryAddress,shippingFee,discountAmount,voucherCode]
  )
  return result.insertId
}

async function createOrderItems(orderId, items) {
  for (const item of items) {
    await db.query('INSERT INTO order_items (order_id,food_id,title,price,quantity) VALUES (?,?,?,?,?)', [orderId,item.foodId,item.title,item.price,item.quantity])
  }
}

async function getOrdersByUsername(username) {
  await ensureCommerceSchema()
  const [rows] = await db.query('SELECT * FROM orders WHERE username=? ORDER BY id DESC', [username])
  return rows
}
async function getOrderById(id) {
  await ensureCommerceSchema()
  const [rows] = await db.query('SELECT * FROM orders WHERE id=?', [id])
  return rows[0] || null
}
async function getAllOrders() {
  await ensureCommerceSchema()
  const [rows] = await db.query('SELECT * FROM orders ORDER BY id DESC')
  return rows
}
async function getOrderItems(id) {
  const [rows] = await db.query('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [id])
  return rows
}

async function updateOrderStatus(id, status) {
  await ensureCommerceSchema()
  await db.query('UPDATE orders SET status=?,status_updated_at=CURRENT_TIMESTAMP WHERE id=?', [status,id])
}
async function updateOrderStatusForUser(id, username, status) {
  await ensureCommerceSchema()
  await db.query('UPDATE orders SET status=?,status_updated_at=CURRENT_TIMESTAMP WHERE id=? AND username=?', [status,id,username])
}

async function getStats() {
  await ensureCommerceSchema()
  const [[{ totalRevenue }]] = await db.query("SELECT COALESCE(SUM(total+shipping_fee-discount_amount),0) AS totalRevenue FROM orders WHERE status<>'Đã hủy'")
  const [[{ totalOrders }]] = await db.query('SELECT COUNT(*) AS totalOrders FROM orders')
  const [recentOrders] = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5')
  return { totalRevenue: totalRevenue || 0, totalOrders, recentOrders }
}

async function getRevenueByDay(days = 7) {
  const endDate = new Date(); const startDate = new Date(endDate); startDate.setDate(startDate.getDate()-(days-1))
  const from=startDate.toISOString().slice(0,10),to=endDate.toISOString().slice(0,10)
  const [rows]=await db.query(`SELECT substr(created_at,1,10) AS date,SUM(total+shipping_fee-COALESCE(discount_amount,0)) AS revenue FROM orders WHERE status<>'Đã hủy' AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY date ORDER BY date ASC`,[from,to])
  const map=new Map(rows.map(r=>[r.date,Number(r.revenue||0)])); const result=[]
  for(let date=new Date(startDate);date<=endDate;date.setDate(date.getDate()+1)){const key=date.toISOString().slice(0,10);result.push({date:key,revenue:map.get(key)||0})}
  return result
}
async function getRevenueByMonth(months=12){
  const endDate=new Date(),startDate=new Date(endDate);startDate.setMonth(startDate.getMonth()-(months-1));const list=[]
  for(let d=new Date(startDate.getFullYear(),startDate.getMonth(),1);d<=endDate;d.setMonth(d.getMonth()+1)) list.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  const from=new Date(startDate.getFullYear(),startDate.getMonth(),1).toISOString().slice(0,10),to=endDate.toISOString().slice(0,10)
  const [rows]=await db.query(`SELECT substr(created_at,1,7) AS month,SUM(total+shipping_fee-COALESCE(discount_amount,0)) AS revenue FROM orders WHERE status<>'Đã hủy' AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY month ORDER BY month ASC`,[from,to])
  const map=new Map(rows.map(r=>[r.month,Number(r.revenue||0)]));return list.map(month=>({month,revenue:map.get(month)||0}))
}

module.exports={createOrder,createOrderItems,getOrdersByUsername,getOrderById,getOrderItems,getAllOrders,updateOrderStatus,updateOrderStatusForUser,getStats,getRevenueByDay,getRevenueByMonth}
