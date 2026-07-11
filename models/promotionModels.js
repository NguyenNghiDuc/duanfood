const db = require('../config/db')

async function getAllPromotions() {
  const [rows] = await db.query('SELECT * FROM promotions ORDER BY id DESC')
  return rows
}

async function createPromotion(title, description) {
  const [result] = await db.query(
    'INSERT INTO promotions (title, description) VALUES (?, ?)',
    [title, description]
  )
  return result.insertId
}

async function deletePromotion(id) {
  await db.query('DELETE FROM promotions WHERE id = ?', [id])
}

module.exports = {
  getAllPromotions,
  createPromotion,
  deletePromotion
}
