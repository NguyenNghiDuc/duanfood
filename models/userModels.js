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

async function updateProfile(username, { fullname, password }) {
  const fields = ['fullname = ?']
  const params = [fullname || '']

  if (password) {
    fields.push('password = ?')
    params.push(password)
  }

  params.push(username)
  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE username = ?`, params)
}

module.exports = {
  findByUsername,
  createUser,
  updateBalance,
  updateProfile
}
