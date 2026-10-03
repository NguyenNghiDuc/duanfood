require('dotenv').config()
const mysql = require('mysql2/promise')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const path = require('path')

let mysqlPool = null
let sqliteDb = null
let initPromise = null
let isClosing = false
let sqliteTxQueue = Promise.resolve()

function sqliteQuery(conn, sql, params = []) {
  return new Promise((resolve, reject) => {
    const command = String(sql).trim().toUpperCase()
    if (command.startsWith('SELECT') || command.startsWith('PRAGMA') || command.startsWith('WITH')) {
      conn.all(sql, params, (err, rows) => err ? reject(err) : resolve([rows, []]))
    } else {
      conn.run(sql, params, function (err) {
        if (err) return reject(err)
        resolve([{ insertId: this.lastID, affectedRows: this.changes }, []])
      })
    }
  })
}

async function createMySQLPool() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'news_db',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
    charset: 'utf8mb4'
  })
  const conn = await pool.getConnection(); await conn.ping(); conn.release(); return pool
}

async function initSQLite() {
  const file = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'fallback.db')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  sqliteDb = new sqlite3.Database(file)
  await sqliteQuery(sqliteDb, 'PRAGMA journal_mode=WAL')
  await sqliteQuery(sqliteDb, 'PRAGMA foreign_keys=ON')
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,password TEXT NOT NULL,fullname TEXT DEFAULT '',balance REAL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE)`,
    `CREATE TABLE IF NOT EXISTS foods (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT DEFAULT '',price REAL NOT NULL DEFAULT 0,category_id INTEGER,image TEXT DEFAULT '',gram INTEGER DEFAULT 0,ingredients TEXT DEFAULT '',created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT,food_id INTEGER NOT NULL,username TEXT NOT NULL,rating INTEGER NOT NULL DEFAULT 5,comment TEXT DEFAULT '',created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT,total REAL DEFAULT 0,payment_method TEXT DEFAULT 'COD',status TEXT DEFAULT 'Chờ xác nhận',delivery_company TEXT DEFAULT 'Giao hàng tiêu chuẩn',delivery_address TEXT DEFAULT '',shipping_fee REAL DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,food_id INTEGER,title TEXT,price REAL DEFAULT 0,quantity INTEGER DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS addresses (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,username TEXT NOT NULL,label TEXT NOT NULL,full_name TEXT NOT NULL,phone TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL,ward TEXT NOT NULL,street TEXT NOT NULL,detail_address TEXT NOT NULL,note TEXT DEFAULT '',is_default INTEGER DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS delivery_companies (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,fee REAL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS promotions (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT NOT NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ai_memory (id INTEGER PRIMARY KEY AUTOINCREMENT,key_text TEXT NOT NULL UNIQUE,intent TEXT,entity TEXT,value_text TEXT,source TEXT DEFAULT 'conversation',confidence REAL DEFAULT .5,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ai_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT,conversation_key TEXT,intent TEXT,feedback TEXT,reason TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ai_corrections (id INTEGER PRIMARY KEY AUTOINCREMENT,question TEXT,ai_answer TEXT,admin_correction TEXT,intent TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ai_training_examples (id INTEGER PRIMARY KEY AUTOINCREMENT,input_text TEXT NOT NULL,intent TEXT NOT NULL,entities TEXT,confidence REAL DEFAULT .8,source TEXT DEFAULT 'conversation',created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ai_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT,session_key TEXT,input_text TEXT,intent TEXT,entity TEXT,response_text TEXT,feedback TEXT,confidence REAL DEFAULT .5,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
  ]
  for (const sql of statements) await sqliteQuery(sqliteDb, sql)
  const [cat] = await sqliteQuery(sqliteDb, 'SELECT COUNT(*) total FROM categories')
  if (!Number(cat[0]?.total)) await sqliteQuery(sqliteDb, `INSERT INTO categories(name) VALUES ('Đồ tươi sống'),('Rau củ'),('Trái cây'),('Hải sản'),('Gạo - Mì'),('Sữa và sản phẩm từ sữa'),('Thực phẩm đông lạnh'),('Thực phẩm khô'),('Gia vị'),('Đồ uống'),('Bánh kẹo'),('Bánh mì'),('Đồ gia dụng')`)
  const [del] = await sqliteQuery(sqliteDb, 'SELECT COUNT(*) total FROM delivery_companies')
  if (!Number(del[0]?.total)) await sqliteQuery(sqliteDb, `INSERT INTO delivery_companies(name,fee) VALUES ('Giao hàng tiết kiệm',10000),('Giao hàng tiêu chuẩn',15000),('Giao hàng nhanh',25000)`)
}

async function initMySQL() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(255) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,fullname VARCHAR(255) DEFAULT '',balance DECIMAL(14,2) DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) NOT NULL UNIQUE)`,
    `CREATE TABLE IF NOT EXISTS foods (id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,description TEXT,price DECIMAL(14,2) NOT NULL DEFAULT 0,category_id INT NULL,image VARCHAR(1000) DEFAULT '',gram INT DEFAULT 0,ingredients TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS reviews (id INT AUTO_INCREMENT PRIMARY KEY,food_id INT NOT NULL,username VARCHAR(255) NOT NULL,rating INT NOT NULL DEFAULT 5,comment TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS orders (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(255),total DECIMAL(14,2) DEFAULT 0,payment_method VARCHAR(50) DEFAULT 'COD',status VARCHAR(100) DEFAULT 'Chờ xác nhận',delivery_company VARCHAR(255),delivery_address TEXT,shipping_fee DECIMAL(14,2) DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS order_items (id INT AUTO_INCREMENT PRIMARY KEY,order_id INT,food_id INT,title VARCHAR(255),price DECIMAL(14,2) DEFAULT 0,quantity INT DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS delivery_companies (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) NOT NULL,fee DECIMAL(14,2) DEFAULT 0)`
  ]
  for (const sql of stmts) await mysqlPool.query(sql)
}

const db = {
  query: async (sql, params = []) => {
    await initPromise
    if (mysqlPool) return mysqlPool.query(sql, params)
    if (sqliteDb) return sqliteQuery(sqliteDb, sql, params)
    throw new Error('Database chưa được khởi tạo')
  },
  transaction: async (work) => {
    await initPromise
    if (mysqlPool) {
      const conn = await mysqlPool.getConnection()
      try {
        await conn.beginTransaction()
        const tx = { query: (sql, params = []) => conn.query(sql, params) }
        const result = await work(tx)
        await conn.commit(); return result
      } catch (e) { await conn.rollback().catch(() => {}); throw e } finally { conn.release() }
    }
    const run = async () => {
      await sqliteQuery(sqliteDb, 'BEGIN IMMEDIATE')
      try {
        const tx = { query: (sql, params = []) => sqliteQuery(sqliteDb, sql, params) }
        const result = await work(tx)
        await sqliteQuery(sqliteDb, 'COMMIT'); return result
      } catch (e) { await sqliteQuery(sqliteDb, 'ROLLBACK').catch(() => {}); throw e }
    }
    const queued = sqliteTxQueue.then(run, run)
    sqliteTxQueue = queued.catch(() => {})
    return queued
  },
  engine: () => mysqlPool ? 'mysql' : 'sqlite',
  close: async () => {
    if (isClosing) return; isClosing = true
    if (mysqlPool) { await mysqlPool.end(); mysqlPool = null }
    if (sqliteDb) { await new Promise((resolve, reject) => sqliteDb.close(err => err ? reject(err) : resolve())); sqliteDb = null }
  }
}

initPromise = (async () => {
  if (process.env.USE_MYSQL === '1') {
    try { mysqlPool = await createMySQLPool(); await initMySQL(); console.log('✅ Database engine: MySQL'); return }
    catch (e) { console.warn('⚠️ MySQL lỗi → chuyển SQLite:', e.message); mysqlPool = null }
  }
  await initSQLite(); console.log('✅ Database engine: SQLite')
})()

db.ready = () => initPromise
module.exports = db
