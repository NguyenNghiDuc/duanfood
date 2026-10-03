const db = require('../config/db')
const { ensureCommerceSchema } = require('./commerceSchema')

async function getBalance(username) {
  const [rows] = await db.query('SELECT balance FROM users WHERE username = ?', [username])
  return Number(rows[0]?.balance || 0)
}

async function recordTransaction({ username, type, amount, referenceType = '', referenceId = '', note = '' }) {
  await ensureCommerceSchema()
  const before = await getBalance(username)
  const delta = Number(amount || 0)
  const after = before + delta
  if (after < 0) throw new Error('Số dư ví không đủ')
  await db.query('UPDATE users SET balance = ? WHERE username = ?', [after, username])
  const [result] = await db.query(
    'INSERT INTO wallet_transactions(username,type,amount,balance_before,balance_after,reference_type,reference_id,note) VALUES(?,?,?,?,?,?,?,?)',
    [username, type, delta, before, after, referenceType, String(referenceId || ''), String(note || '').slice(0, 500)]
  )
  return { id: result.insertId, before, after }
}

async function listTransactions(username, limit = 100) {
  await ensureCommerceSchema()
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const [rows] = await db.query(`SELECT * FROM wallet_transactions WHERE username = ? ORDER BY id DESC LIMIT ${safeLimit}`, [username])
  return rows
}

async function refundOrder(order, actor = 'system') {
  await ensureCommerceSchema()
  if (!order || Number(order.refunded || 0) === 1) return false
  if (String(order.payment_method).toLowerCase() !== 'wallet' && !String(order.status).toLowerCase().includes('thanh toán')) return false
  const amount = Number(order.total || 0) + Number(order.shipping_fee || 0) - Number(order.discount_amount || 0)
  await recordTransaction({ username: order.username, type: 'refund', amount, referenceType: 'order', referenceId: order.id, note: `Hoàn tiền đơn #${order.id}` })
  await db.query('UPDATE orders SET refunded = 1 WHERE id = ? AND refunded = 0', [order.id])
  await db.query('INSERT INTO audit_logs(actor,action,target_type,target_id,detail) VALUES(?,?,?,?,?)', [actor, 'refund_order', 'order', String(order.id), `Refund ${amount}`])
  return true
}

module.exports = { getBalance, recordTransaction, listTransactions, refundOrder }
