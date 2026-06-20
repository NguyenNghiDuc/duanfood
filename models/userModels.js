const db = require('../config/db')

async function findByUsername(username) {
  const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username])
  return rows[0] || null
}

async function createUser({ username, password }) {
  const [result] = await db.query('INSERT INTO users(username, password, balance) VALUES (?, ?, 0)', [username, password])
  return result.insertId
}

async function updateBalance(username, amount) {
  await db.query('UPDATE users SET balance = balance + ? WHERE username = ?', [amount, username])
}

module.exports = {
  findByUsername,
  createUser,
  updateBalance
}
