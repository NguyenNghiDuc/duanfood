const db = require('../config/db')
const { ensureCommerceSchema } = require('./commerceSchema')

async function getBalance(username, client = db) {
  await ensureCommerceSchema()
  const [rows] = await client.query('SELECT balance FROM users WHERE username = ?', [username])
  return Number(rows[0]?.balance || 0)
}

async function recordTransaction({ username, type, amount, referenceType = '', referenceId = '', note = '' }, client = db) {
  await ensureCommerceSchema()
  const before = await getBalance(username, client)
  const delta = Number(amount || 0)
  if (!Number.isFinite(delta)) throw new Error('Số tiền giao dịch không hợp lệ')
  const after = before + delta
  if (after < 0) throw new Error('Số dư ví không đủ')
  const [balanceResult] = await client.query('UPDATE users SET balance=? WHERE username=?', [after, username])
  if (!balanceResult.affectedRows) throw new Error('Không tìm thấy tài khoản')
  const [result] = await client.query('INSERT INTO wallet_transactions(username,type,amount,balance_before,balance_after,reference_type,reference_id,note) VALUES(?,?,?,?,?,?,?,?)', [username, type, delta, before, after, referenceType, String(referenceId || ''), String(note || '').slice(0, 500)])
  return { id: result.insertId, before, after }
}

async function listTransactions(username, limit = 100, offset = 0) {
  await ensureCommerceSchema()
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const safeOffset = Math.max(Number(offset) || 0, 0)
  const [rows] = await db.query(`SELECT * FROM wallet_transactions WHERE username=? ORDER BY id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`, [username])
  return rows
}

async function refundOrder(order, actor = 'system') {
  await ensureCommerceSchema()
  if (!order || Number(order.refunded || 0) === 1) return false
  const paid = String(order.payment_method).toLowerCase() === 'wallet' || String(order.status).toLowerCase().includes('thanh toán')
  if (!paid) return false
  return db.transaction(async tx => {
    const [claim] = await tx.query('UPDATE orders SET refunded=1 WHERE id=? AND COALESCE(refunded,0)=0', [order.id])
    if (!claim.affectedRows) return false
    const amount = Math.max(0, Number(order.total || 0) + Number(order.shipping_fee || 0) - Number(order.discount_amount || 0))
    await recordTransaction({ username: order.username, type: 'refund', amount, referenceType: 'order', referenceId: order.id, note: `Hoàn tiền đơn #${order.id}` }, tx)
    await tx.query('INSERT INTO audit_logs(actor,action,target_type,target_id,detail) VALUES(?,?,?,?,?)', [actor, 'refund_order', 'order', String(order.id), `Refund ${amount}`])
    return true
  })
}

module.exports = { getBalance, recordTransaction, listTransactions, refundOrder }
