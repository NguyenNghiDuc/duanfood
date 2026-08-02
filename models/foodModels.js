const db = require('../config/db')

async function initFoodSchema() {
  const [existingCategories] = await db.query('SELECT COUNT(*) AS total FROM categories')
  if (existingCategories[0].total === 0) {
    await db.query("INSERT INTO categories (name) VALUES ('Đồ tươi sống'), ('Rau củ'), ('Trái cây'), ('Hải sản'), ('Gạo - Mì'), ('Sữa và sản phẩm từ sữa'), ('Thực phẩm đông lạnh'), ('Thực phẩm khô'), ('Gia vị'), ('Đồ uống'), ('Bánh kẹo'), ('Bánh mì'), ('Đồ gia dụng')")
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

function normalizeText(text) {
  return String(text || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

async function getFoods({ keyword = '', categoryId = '', sort = 'new' } = {}) {
  let sql = `SELECT f.*, c.name AS category_name FROM foods f LEFT JOIN categories c ON c.id = f.category_id WHERE 1=1`
  const params = []

  if (categoryId) {
    sql += ' AND f.category_id = ?'
    params.push(categoryId)
  }

  switch (sort) {
    case 'priceLow':
      sql += ' ORDER BY f.price ASC'
      break
    case 'priceHigh':
      sql += ' ORDER BY f.price DESC'
      break
    default:
      sql += ' ORDER BY f.id DESC'
  }

  const [rows] = await db.query(sql, params)

  const normalizedKeyword = normalizeText(keyword)
  if (!normalizedKeyword) {
    return rows
  }

  return rows.filter((food) => {
    return (
      normalizeText(food.title).includes(normalizedKeyword) ||
      normalizeText(food.description).includes(normalizedKeyword)
    )
  })
}

async function getFoodById(id) {
  const [rows] = await db.query(`SELECT f.*, c.name AS category_name FROM foods f LEFT JOIN categories c ON c.id = f.category_id WHERE f.id = ?`, [id])
  return rows[0] || null
}

async function getFoodOrderCounts() {
  const [rows] = await db.query('SELECT food_id, SUM(quantity) AS order_count FROM order_items GROUP BY food_id')
  return rows.reduce((map, row) => {
    map[row.food_id] = Number(row.order_count || 0)
    return map
  }, {})
}

async function searchFoods({ keyword = '', categoryId = '', minPrice = null, maxPrice = null, excludeId = null } = {}) {
  const foods = await getFoods({})
  const normalizedKeyword = normalizeText(keyword)
  return foods.filter(food => {
    if (excludeId && Number(food.id) === Number(excludeId)) return false
    if (categoryId && String(food.category_id) !== String(categoryId)) return false
    if (minPrice !== null && Number(food.price || 0) < Number(minPrice)) return false
    if (maxPrice !== null && Number(food.price || 0) > Number(maxPrice)) return false
    if (!normalizedKeyword) return true
    const haystack = normalizeText([food.title, food.description, food.category_name].join(' '))
    return haystack.includes(normalizedKeyword)
  })
}

async function createFood({ title, description, price, category_id, image, gram }) {
  const [result] = await db.query(`INSERT INTO foods (title, description, price, category_id, image, gram) VALUES (?, ?, ?, ?, ?, ?)`, [title, description, price, category_id || null, image || '', gram || 0])
  return result.insertId
}

async function updateFood({ id, title, description, price, category_id, image, gram }) {
  await db.query('UPDATE foods SET title = ?, description = ?, price = ?, category_id = ?, image = ?, gram = ? WHERE id = ?', [title, description, price, category_id || null, image || '', gram || 0, id])
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
  getFoodOrderCounts,
  searchFoods,
  createFood,
  updateFood,
  deleteFood,
  addCategory,
  deleteCategory,
  getReviewsByFoodId,
  addReview,
  getFoodRatingSummary
}
