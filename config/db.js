require("dotenv").config();

const mysql = require("mysql2/promise");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

let mysqlPool = null;
let sqliteDb = null;
let initPromise = null;
let isClosing = false;

function createSqliteDb() {
  const file = path.join(__dirname, "..", "data", "fallback.db");

  fs.mkdirSync(path.dirname(file), {
    recursive: true
  });

  return new sqlite3.Database(file);
}

function sqliteQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    const command = sql.trim().toUpperCase();

    if (
      command.startsWith("SELECT") ||
      command.startsWith("PRAGMA") ||
      command.startsWith("WITH")
    ) {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve([rows, []]);
      });
    } else {
      db.run(sql, params, function (err) {
        if (err) return reject(err);

        resolve([
          {
            insertId: this.lastID,
            affectedRows: this.changes
          },
          []
        ]);
      });
    }
  });
}

async function createMySQLPool() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "news_db",
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4"
  });

  const conn = await pool.getConnection();
  conn.release();

  return pool;
}

async function initSQLite() {
  const exec = (sql) => {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  // USERS
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      fullname TEXT DEFAULT '',
      balance REAL DEFAULT 0
    )
  `);

  // CATEGORIES
  await exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // FOODS
  await exec(`
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      category_id INTEGER,
      image TEXT DEFAULT '',
      gram INTEGER DEFAULT 0,
      ingredients TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // REVIEW
  await exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      comment TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ORDERS
  await exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'COD',
      status TEXT DEFAULT 'Chờ xác nhận',
      delivery_company TEXT DEFAULT 'Giao hàng tiêu chuẩn',
      delivery_address TEXT DEFAULT '',
      shipping_fee REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ORDER ITEMS
  await exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      food_id INTEGER,
      title TEXT,
      price REAL DEFAULT 0,
      quantity INTEGER DEFAULT 1
    )
  `);

  // ADDRESS
  await exec(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      label TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      district TEXT NOT NULL,
      ward TEXT NOT NULL,
      street TEXT NOT NULL,
      detail_address TEXT NOT NULL,
      note TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // DELIVERY
  await exec(`
    CREATE TABLE IF NOT EXISTS delivery_companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      fee REAL DEFAULT 0
    )
  `);

  // PROMOTIONS
  await exec(`
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI MEMORY
  await exec(`
    CREATE TABLE IF NOT EXISTS ai_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_text TEXT NOT NULL UNIQUE,
      intent TEXT,
      entity TEXT,
      value_text TEXT,
      source TEXT DEFAULT 'conversation',
      confidence REAL DEFAULT 0.5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI FEEDBACK
  await exec(`
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_key TEXT,
      intent TEXT,
      feedback TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI CORRECTION
  await exec(`
    CREATE TABLE IF NOT EXISTS ai_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT,
      ai_answer TEXT,
      admin_correction TEXT,
      intent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI TRAINING
  await exec(`
    CREATE TABLE IF NOT EXISTS ai_training_examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_text TEXT NOT NULL,
      intent TEXT NOT NULL,
      entities TEXT,
      confidence REAL DEFAULT 0.8,
      source TEXT DEFAULT 'conversation',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI CONVERSATION
  await exec(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      session_key TEXT,
      input_text TEXT,
      intent TEXT,
      entity TEXT,
      response_text TEXT,
      feedback TEXT,
      confidence REAL DEFAULT 0.5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // THÊM CATEGORIES
  const [categories] = await sqliteQuery(
    sqliteDb,
    `SELECT COUNT(*) AS total FROM categories`
  );

  if (Number(categories[0].total) === 0) {
    await sqliteQuery(
      sqliteDb,
      `
      INSERT INTO categories (name)
      VALUES
      ('Đồ tươi sống'),
      ('Rau củ'),
      ('Trái cây'),
      ('Hải sản'),
      ('Gạo - Mì'),
      ('Sữa và sản phẩm từ sữa'),
      ('Thực phẩm đông lạnh'),
      ('Thực phẩm khô'),
      ('Gia vị'),
      ('Đồ uống'),
      ('Bánh kẹo'),
      ('Bánh mì'),
      ('Đồ gia dụng')
      `
    );
  }

  // DELIVERY
  const [delivery] = await sqliteQuery(
    sqliteDb,
    `SELECT COUNT(*) AS total FROM delivery_companies`
  );

  if (Number(delivery[0].total) === 0) {
    await sqliteQuery(
      sqliteDb,
      `
      INSERT INTO delivery_companies(name, fee)
      VALUES
      ('Giao hàng tiết kiệm', 10000),
      ('Giao hàng tiêu chuẩn', 15000),
      ('Giao hàng nhanh', 25000)
      `
    );
  }
}

async function initMySQL() {
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      category_id INT NULL,
      image VARCHAR(255) DEFAULT '',
      gram INT DEFAULT 0,
      ingredients TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id)
      REFERENCES categories(id)
      ON DELETE SET NULL
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      food_id INT NOT NULL,
      username VARCHAR(255) NOT NULL,
      rating INT NOT NULL DEFAULT 5,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS ai_memory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_text VARCHAR(500) NOT NULL UNIQUE,
      intent VARCHAR(100),
      entity TEXT,
      value_text TEXT,
      source VARCHAR(100) DEFAULT 'conversation',
      confidence DECIMAL(5,2) DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_key TEXT,
      intent VARCHAR(100),
      feedback VARCHAR(50),
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS ai_corrections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      question TEXT,
      ai_answer TEXT,
      admin_correction TEXT,
      intent VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS ai_training_examples (
      id INT AUTO_INCREMENT PRIMARY KEY,
      input_text TEXT NOT NULL,
      intent VARCHAR(100) NOT NULL,
      entities TEXT,
      confidence DECIMAL(5,2) DEFAULT 0.8,
      source VARCHAR(100) DEFAULT 'conversation',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255),
      session_key VARCHAR(255),
      input_text TEXT,
      intent VARCHAR(100),
      entity TEXT,
      response_text TEXT,
      feedback VARCHAR(50),
      confidence DECIMAL(5,2) DEFAULT 0.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

const db = {
  query: async (sql, params = []) => {
    if (mysqlPool) {
      return mysqlPool.query(sql, params);
    }

    if (sqliteDb) {
      return sqliteQuery(sqliteDb, sql, params);
    }

    throw new Error("Database chưa được khởi tạo");
  },

  close: async () => {
    if (isClosing) return;

    isClosing = true;

    if (mysqlPool) {
      await mysqlPool.end();
      mysqlPool = null;
    }

    if (sqliteDb) {
      await new Promise((resolve, reject) => {
        sqliteDb.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      sqliteDb = null;
    }
  }
};

initPromise = (async () => {
  const useMySQL = process.env.USE_MYSQL === "1";

  if (useMySQL) {
    try {
      mysqlPool = await createMySQLPool();
      await initMySQL();

      console.log("✅ Database engine: MySQL");
      return;
    } catch (error) {
      console.log(
        "⚠️ MySQL lỗi → chuyển SQLite:",
        error.message
      );

      mysqlPool = null;
    }
  }

  sqliteDb = createSqliteDb();

  await initSQLite();

  console.log("✅ Database engine: SQLite");
})();

db.ready = () => initPromise;

module.exports = db;