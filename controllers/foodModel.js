const db = require("../config/db")

async function initFoodSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS delivery_companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      fee DECIMAL(10,2) NOT NULL DEFAULT 0
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      username VARCHAR(255) NOT NULL,
      label VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      city VARCHAR(255) NOT NULL,
      district VARCHAR(255) NOT NULL,
      ward VARCHAR(255) NOT NULL,
      street VARCHAR(255) NOT NULL,
      detail_address TEXT NOT NULL,
      note TEXT,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      category_id INT NULL,
      image VARCHAR(255) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      delivery_company VARCHAR(255) DEFAULT 'Giao hàng tiêu chuẩn',
      delivery_address TEXT DEFAULT '',
      shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(50) NOT NULL DEFAULT 'COD',
      status VARCHAR(30) NOT NULL DEFAULT 'Chờ xác nhận',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      food_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      quantity INT NOT NULL DEFAULT 1,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      food_id INT NOT NULL,
      username VARCHAR(255) NOT NULL,
      rating INT NOT NULL DEFAULT 5,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
    )
  `)

  const [existingCategories] = await db.query("SELECT COUNT(*) AS total FROM categories")
  if (existingCategories[0].total === 0) {
    await db.query("INSERT INTO categories (name) VALUES ('Đồ ăn'), ('Đồ uống'), ('Tráng miệng')")
  }

  const [existingDelivery] = await db.query("SELECT COUNT(*) AS total FROM delivery_companies")
  if (existingDelivery[0].total === 0) {
    await db.query(`
      INSERT INTO delivery_companies (name, fee)
      VALUES
      ('Giao hàng tiêu chuẩn', 15000),
      ('Giao hàng nhanh', 25000),
      ('Giao hàng tiết kiệm', 10000)
    `)
  }

  const [existingFoods] = await db.query("SELECT COUNT(*) AS total FROM foods")
  if (existingFoods[0].total === 0) {
    await db.query(`
      INSERT INTO foods (title, description, price, category_id, image) VALUES
      ('Bánh mì thịt nướng', 'Bánh mì giòn với thịt nướng thơm lừng.', 25000, 1, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80'),
      ('Trà sữa matcha', 'Trà sữa matcha thơm béo, topping trân châu.', 35000, 2, 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=600&q=80'),
      ('Chè đậu xanh', 'Món tráng miệng mát lạnh, ngọt dịu.', 20000, 3, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=600&q=80')
    `)
  }
}


async function getReviewsByFoodId(foodId) {
  const [rows] = await db.query(
    `SELECT * FROM reviews WHERE food_id = ? ORDER BY created_at DESC`,
    [foodId]
  )
  return rows
}

async function addReview(foodId, username, rating, comment) {
  await db.query(
    `INSERT INTO reviews (food_id, username, rating, comment) VALUES (?, ?, ?, ?)`,
    [foodId, username, rating, comment]
  )
}

async function getFoodRatingSummary(foodId) {
  const [[summary]] = await db.query(
    `SELECT COUNT(*) AS reviewCount, AVG(rating) AS avgRating FROM reviews WHERE food_id = ?`,
    [foodId]
  )
  return {
    reviewCount: Number(summary.reviewCount || 0),
    avgRating: Number(summary.avgRating || 0)
  }
}

async function getDeliveryCompanies() {
  const [rows] = await db.query("SELECT * FROM delivery_companies ORDER BY fee ASC")
  return rows
}

async function getAllCategories() {
  const [rows] = await db.query("SELECT * FROM categories ORDER BY id ASC")
  return rows
}

async function getFoods({ keyword = "", categoryId = "" } = {}) {
  let sql = `
    SELECT f.*, c.name AS category_name
    FROM foods f
    LEFT JOIN categories c ON c.id = f.category_id
    WHERE 1=1
  `
  const params = []

  if (keyword) {
    sql += " AND (f.title LIKE ? OR f.description LIKE ?)"
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  if (categoryId) {
    sql += " AND f.category_id = ?"
    params.push(categoryId)
  }

  sql += " ORDER BY f.id DESC"

  const [rows] = await db.query(sql, params)
  return rows
}

async function getFoodById(id) {
  const [rows] = await db.query(
    `
      SELECT f.*, c.name AS category_name
      FROM foods f
      LEFT JOIN categories c ON c.id = f.category_id
      WHERE f.id = ?
    `,
    [id]
  )
  return rows[0] || null
}

async function createFood({ title, description, price, category_id, image }) {
  const [result] = await db.query(
    `
      INSERT INTO foods (title, description, price, category_id, image)
      VALUES (?, ?, ?, ?, ?)
    `,
    [title, description, price, category_id || null, image || '']
  )
  return result.insertId
}

module.exports = {
  initFoodSchema,
  getAllCategories,
  getFoods,
  getFoodById,
  createFood
  ,getReviewsByFoodId
  ,addReview
  ,getFoodRatingSummary
  ,getDeliveryCompanies
}
