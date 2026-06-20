const db = require('../config/db')

async function initFoodSchema() {
  const [existingCategories] = await db.query('SELECT COUNT(*) AS total FROM categories')
  if (existingCategories[0].total === 0) {
    await db.query("INSERT INTO categories (name) VALUES ('Đồ ăn'), ('Đồ uống'), ('Tráng miệng')")
  }

  const [existingDelivery] = await db.query('SELECT COUNT(*) AS total FROM delivery_companies')
  if (existingDelivery[0].total === 0) {
    await db.query(`INSERT INTO delivery_companies (name, fee) VALUES ('Giao hàng tiêu chuẩn', 15000), ('Giao hàng nhanh', 25000), ('Giao hàng tiết kiệm', 10000)`) }
}

async function getDeliveryCompanies() {
  const [rows] = await db.query('SELECT * FROM delivery_companies ORDER BY fee ASC')
  return rows
}

async function getAllCategories() {
  const [rows] = await db.query('SELECT * FROM categories ORDER BY id ASC')
  return rows
}

async function getFoods({ keyword = '', categoryId = '' } = {}) {
  let sql = `SELECT f.*, c.name AS category_name FROM foods f LEFT JOIN categories c ON c.id = f.category_id WHERE 1=1`
  const params = []

  if (keyword) {
    sql += ' AND (f.title LIKE ? OR f.description LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  if (categoryId) {
    sql += ' AND f.category_id = ?'
    params.push(categoryId)
  }

  sql += ' ORDER BY f.id DESC'
  const [rows] = await db.query(sql, params)
  return rows
}

async function getFoodById(id) {
  const [rows] = await db.query(`SELECT f.*, c.name AS category_name FROM foods f LEFT JOIN categories c ON c.id = f.category_id WHERE f.id = ?`, [id])
  return rows[0] || null
}

async function createFood({ title, description, price, category_id, image }) {
  const [result] = await db.query(`INSERT INTO foods (title, description, price, category_id, image) VALUES (?, ?, ?, ?, ?)`, [title, description, price, category_id || null, image || ''])
  return result.insertId
}

async function updateFood({ id, title, description, price, category_id, image }) {
  await db.query('UPDATE foods SET title = ?, description = ?, price = ?, category_id = ?, image = ? WHERE id = ?', [title, description, price, category_id || null, image || '', id])
}

async function deleteFood(id) {
  await db.query('DELETE FROM foods WHERE id = ?', [id])
}

async function addCategory(name) {
  await db.query('INSERT INTO categories(name) VALUES (?)', [name])
}

async function deleteCategory(id) {
  await db.query('DELETE FROM categories WHERE id = ?', [id])
}

async function getReviewsByFoodId(foodId) {
  const [rows] = await db.query('SELECT * FROM reviews WHERE food_id = ? ORDER BY created_at DESC', [foodId])
  return rows
}

async function addReview(foodId, username, rating, comment) {
  await db.query('INSERT INTO reviews (food_id, username, rating, comment) VALUES (?, ?, ?, ?)', [foodId, username, rating, comment])
}

async function getFoodRatingSummary(foodId) {
  const [[summary]] = await db.query('SELECT COUNT(*) AS reviewCount, AVG(rating) AS avgRating FROM reviews WHERE food_id = ?', [foodId])
  return {
    reviewCount: Number(summary.reviewCount || 0),
    avgRating: Number(summary.avgRating || 0)
  }
}

module.exports = {
  initFoodSchema,
  getDeliveryCompanies,
  getAllCategories,
  getFoods,
  getFoodById,
  createFood,
  updateFood,
  deleteFood,
  addCategory,
  deleteCategory,
  getReviewsByFoodId,
  addReview,
  getFoodRatingSummary
}
