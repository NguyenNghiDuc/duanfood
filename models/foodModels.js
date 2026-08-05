const db = require("../config/db");

async function initFoodSchema() {
  await db.ready();

  // SQLite đã tạo schema trong db.js.
  // Các lệnh này chỉ đảm bảo bảng tồn tại nếu dùng MySQL.

  await db.query(`
    CREATE TABLE IF NOT EXISTS delivery_companies (
      id INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      fee DECIMAL(10,2) NOT NULL DEFAULT 0
    )
  `).catch(() => {});

  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `).catch(() => {});

  await db.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      category_id INTEGER,
      image VARCHAR(255) DEFAULT '',
      gram INTEGER DEFAULT 0,
      ingredients TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  await db.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY,
      food_id INTEGER NOT NULL,
      username VARCHAR(255) NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

    // Seed default categories and sample drinks/desserts if missing
    const [catRows] = await db.query(`SELECT COUNT(*) AS total FROM categories`);
    const catCount = catRows[0] ? catRows[0].total : 0;

    if (catCount === 0) {
      await db.query(`INSERT INTO categories (name) VALUES (?), (?), (?), (?)`, [
        'Đồ uống', 'Bánh kẹo', 'Đồ ăn', 'Trái cây'
      ]).catch(() => {});
    }

    const [foodRows] = await db.query(`SELECT COUNT(*) AS total FROM foods`);
    const foodCount = foodRows[0] ? foodRows[0].total : 0;

    if (foodCount === 0) {
      // find category ids
      const [cats] = await db.query(`SELECT id, name FROM categories`);
      const map = {};
      for (const c of cats) map[c.name] = c.id;

      const samples = [
        ['Trà sữa trân châu', 'Trà sữa thơm béo, topping trân châu', 35000, map['Đồ uống'] || null, ''],
        ['Nước cam tươi', 'Nước cam ép tươi', 30000, map['Đồ uống'] || null, ''],
        ['Kem vani', 'Kem mát lạnh vị vani', 25000, map['Bánh kẹo'] || null, ''],
        ['Bánh flan', 'Bánh flan caramel mềm mịn', 20000, map['Bánh kẹo'] || null, ''],
        ['Bánh quy socola', 'Bánh quy giòn vị socola', 15000, map['Bánh kẹo'] || null, '']
      ];

      for (const s of samples) {
        await db.query(`INSERT INTO foods (title, description, price, category_id, image, gram, ingredients) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
          s[0], s[1], s[2], s[3], s[4], 0, ''
        ]).catch(() => {});
      }
    }
}

/* ================================
   CHUẨN HÓA TIẾNG VIỆT
================================ */

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================================
   LẤY CATEGORY
================================ */

async function getAllCategories() {
  await db.ready();

  const [rows] = await db.query(`
    SELECT *
    FROM categories
    ORDER BY id ASC
  `);

  return rows;
}

/* ================================
   LẤY FOOD
================================ */

async function getFoods({
  keyword = "",
  categoryId = "",
  minPrice = null,
  maxPrice = null,
  sort = "newest",
  limit = 50
} = {}) {

  await db.ready();

  let sql = `
    SELECT
      f.*,
      c.name AS category_name,
      COALESCE(
        (SELECT AVG(r.rating)
         FROM reviews r
         WHERE r.food_id = f.id),
        0
      ) AS avg_rating,
      COALESCE(
        (SELECT COUNT(*)
         FROM reviews r
         WHERE r.food_id = f.id),
        0
      ) AS review_count
    FROM foods f
    LEFT JOIN categories c
      ON c.id = f.category_id
    WHERE 1 = 1
  `;

  const params = [];

  if (keyword) {
    const key = `%${normalizeText(keyword)}%`;

    sql += `
      AND (
        LOWER(f.title) LIKE ?
        OR LOWER(f.description) LIKE ?
        OR LOWER(COALESCE(f.ingredients, '')) LIKE ?
        OR LOWER(c.name) LIKE ?
      )
    `;

    params.push(key, key, key, key);
  }

  if (categoryId) {
    sql += ` AND f.category_id = ?`;
    params.push(categoryId);
  }

  if (minPrice !== null) {
    sql += ` AND f.price >= ?`;
    params.push(minPrice);
  }

  if (maxPrice !== null) {
    sql += ` AND f.price <= ?`;
    params.push(maxPrice);
  }

  switch (sort) {
    case "price_asc":
      sql += ` ORDER BY f.price ASC`;
      break;

    case "price_desc":
      sql += ` ORDER BY f.price DESC`;
      break;

    case "rating":
      sql += ` ORDER BY avg_rating DESC, review_count DESC`;
      break;

    case "popular":
      sql += ` ORDER BY review_count DESC, avg_rating DESC`;
      break;

    default:
      sql += ` ORDER BY f.id DESC`;
  }

  sql += ` LIMIT ${Math.min(Number(limit) || 50, 100)}`;

  const [rows] = await db.query(sql, params);

  return rows;
}

/* ================================
   LẤY FOOD ID
================================ */

async function getFoodById(id) {
  await db.ready();

  const [rows] = await db.query(`
    SELECT
      f.*,
      c.name AS category_name,
      COALESCE(
        (SELECT AVG(r.rating)
         FROM reviews r
         WHERE r.food_id = f.id),
        0
      ) AS avg_rating,
      COALESCE(
        (SELECT COUNT(*)
         FROM reviews r
         WHERE r.food_id = f.id),
        0
      ) AS review_count
    FROM foods f
    LEFT JOIN categories c
      ON c.id = f.category_id
    WHERE f.id = ?
  `, [id]);

  return rows[0] || null;
}

/* ================================
   TÌM FOOD THÔNG MINH
================================ */

async function searchFoodsSmart({
  keyword = "",
  category = "",
  ingredient = "",
  minPrice = null,
  maxPrice = null,
  minRating = null,
  sort = "newest",
  limit = 10
} = {}) {

  await db.ready();

  let sql = `
    SELECT
      f.*,
      c.name AS category_name,
      COALESCE(
        (SELECT AVG(r.rating)
         FROM reviews r
         WHERE r.food_id = f.id),
        0
      ) AS avg_rating,
      COALESCE(
        (SELECT COUNT(*)
         FROM reviews r
         WHERE r.food_id = f.id),
        0
      ) AS review_count
    FROM foods f
    LEFT JOIN categories c
      ON c.id = f.category_id
    WHERE 1=1
  `;

  const params = [];

  if (keyword) {
    const k = `%${normalizeText(keyword)}%`;

    sql += `
      AND (
        LOWER(f.title) LIKE ?
        OR LOWER(f.description) LIKE ?
        OR LOWER(COALESCE(f.ingredients,'')) LIKE ?
        OR LOWER(c.name) LIKE ?
      )
    `;

    params.push(k, k, k, k);
  }

  if (category) {
    const k = `%${normalizeText(category)}%`;

    sql += `
      AND LOWER(c.name) LIKE ?
    `;

    params.push(k);
  }

  if (ingredient) {
    const k = `%${normalizeText(ingredient)}%`;

    sql += `
      AND (
        LOWER(f.title) LIKE ?
        OR LOWER(f.description) LIKE ?
        OR LOWER(COALESCE(f.ingredients,'')) LIKE ?
      )
    `;

    params.push(k, k, k);
  }

  if (minPrice !== null) {
    sql += ` AND f.price >= ?`;
    params.push(minPrice);
  }

  if (maxPrice !== null) {
    sql += ` AND f.price <= ?`;
    params.push(maxPrice);
  }

  if (minRating !== null) {
    sql += `
      AND COALESCE(
        (SELECT AVG(r.rating)
         FROM reviews r
         WHERE r.food_id = f.id),
        0
      ) >= ?
    `;

    params.push(minRating);
  }

  if (sort === "price_asc") {
    sql += ` ORDER BY f.price ASC`;
  } else if (sort === "price_desc") {
    sql += ` ORDER BY f.price DESC`;
  } else if (sort === "rating") {
    sql += ` ORDER BY avg_rating DESC, review_count DESC`;
  } else if (sort === "popular") {
    sql += ` ORDER BY review_count DESC, avg_rating DESC`;
  } else {
    sql += ` ORDER BY f.id DESC`;
  }

  sql += ` LIMIT ${Math.min(Number(limit) || 10, 30)}`;

  const [rows] = await db.query(sql, params);

  return rows;
}

/* ================================
   REVIEW
================================ */

async function getReviewsByFoodId(foodId) {
  await db.ready();

  const [rows] = await db.query(`
    SELECT *
    FROM reviews
    WHERE food_id = ?
    ORDER BY created_at DESC
  `, [foodId]);

  return rows;
}

async function addReview(foodId, username, rating, comment) {
  await db.ready();

  await db.query(`
    INSERT INTO reviews
    (food_id, username, rating, comment)
    VALUES (?, ?, ?, ?)
  `, [
    foodId,
    username,
    rating,
    comment
  ]);
}

async function getFoodRatingSummary(foodId) {
  await db.ready();

  const [rows] = await db.query(`
    SELECT
      COUNT(*) AS reviewCount,
      AVG(rating) AS avgRating
    FROM reviews
    WHERE food_id = ?
  `, [foodId]);

  const summary = rows[0] || {};

  return {
    reviewCount: Number(summary.reviewCount || 0),
    avgRating: Number(summary.avgRating || 0)
  };
}

/* ================================
   DELIVERY
================================ */

async function getDeliveryCompanies() {
  await db.ready();

  const [rows] = await db.query(`
    SELECT *
    FROM delivery_companies
    ORDER BY fee ASC
  `);

  return rows;
}

async function getFoodOrderCounts() {
  await db.ready();

  const [rows] = await db.query(`
    SELECT food_id, SUM(quantity) AS count
    FROM order_items
    GROUP BY food_id
  `);

  const counts = {}
  for (const row of rows) {
    counts[row.food_id] = Number(row.count || 0)
  }

  return counts;
}

async function getFoodCount() {
  await db.ready();

  const [rows] = await db.query(`
    SELECT COUNT(*) AS total
    FROM foods
  `);

  return Number(rows[0]?.total || 0);
}

/* ================================
   CREATE FOOD
================================ */

async function createFood({
  title,
  description,
  price,
  category_id,
  image,
  gram = 0,
  ingredients = ""
}) {

  await db.ready();

  const [result] = await db.query(`
    INSERT INTO foods
    (
      title,
      description,
      price,
      category_id,
      image,
      gram,
      ingredients
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    title,
    description || "",
    Number(price || 0),
    category_id || null,
    image || "",
    Number(gram || 0),
    ingredients || ""
  ]);

  return result.insertId;
}

async function deleteFood(id) {
  await db.ready();
  await db.query(`DELETE FROM foods WHERE id = ?`, [Number(id)]);
}

async function deleteCategory(id) {
  await db.ready();
  await db.query(`DELETE FROM categories WHERE id = ?`, [Number(id)]);
}

module.exports = {
  initFoodSchema,
  normalizeText,
  getAllCategories,
  getFoods,
  getFoodById,
  searchFoodsSmart,
  createFood,
  deleteFood,
  deleteCategory,
  getReviewsByFoodId,
  addReview,
  getFoodRatingSummary,
  getDeliveryCompanies,
  getFoodOrderCounts,
  getFoodCount
};