const db = require('../config/db')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

async function findByUsername(username) {
  await ensureCommerceSchema()
  const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username])
  return rows[0] || null
}

async function createUser({ username, password, fullname = '', phone = '', email = '' }) {
  await ensureCommerceSchema()
  const [result] = await db.query('INSERT INTO users(username,password,balance,fullname,phone,email,role,locked) VALUES(?,?,0,?,?,?,?,0)', [username,password,fullname,phone,email,'user'])
  return result.insertId
}

async function updateBalance(username, amount) {
  await db.query('UPDATE users SET balance = balance + ? WHERE username = ?', [amount, username])
}

async function updateProfile(username, { fullname, password, phone, email }) {
  await ensureCommerceSchema()
  const fields = ['fullname = ?']
  const params = [fullname || '']
  if (password) { fields.push('password = ?'); params.push(password) }
  if (phone !== undefined) { fields.push('phone = ?'); params.push(phone || '') }
  if (email !== undefined) { fields.push('email = ?'); params.push(email || '') }
  params.push(username)
  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE username = ?`, params)
}

module.exports = { findByUsername, createUser, updateBalance, updateProfile }
