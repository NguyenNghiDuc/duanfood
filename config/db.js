require('dotenv').config();
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function createMySQLPool() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'news_db',
    waitForConnections: true,
    connectionLimit: 10
  });
  const conn = await pool.getConnection();
  conn.release();
  return pool;
}

function createSqliteDb(filePath) {
  const dbFile = filePath || path.join(__dirname, '..', 'data', 'fallback.db');
  const dir = path.dirname(dbFile);
  // ensure data dir exists
  try { require('fs').mkdirSync(dir, { recursive: true }) } catch (e) {}
  const db = new sqlite3.Database(dbFile);
  return db;
}

function sqliteQuery(db, sql, params) {
  params = params || [];
  return new Promise((resolve, reject) => {
    const s = sql.trim().toUpperCase();
    if (s.startsWith('SELECT') || s.startsWith('PRAGMA')) {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve([rows, []]);
      });
    } else {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve([{ insertId: this.lastID, affectedRows: this.changes }, []]);
      });
    }
  });
}

async function initFallbackSqlite(db) {
  const exec = (sql) => new Promise((res, rej) => db.run(sql, (e) => e ? rej(e) : res()));
 
  await exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    fullname TEXT DEFAULT '',
    balance REAL NOT NULL DEFAULT 0
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    label TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS delivery_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    fee REAL NOT NULL DEFAULT 0
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    category_id INTEGER,
    image TEXT
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    total REAL,
    payment_method TEXT,
    status TEXT,
    delivery_company TEXT,
    delivery_address TEXT,
    shipping_fee REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    food_id INTEGER,
    title TEXT,
    price REAL,
    quantity INTEGER
  )`);
}

let mysqlPool = null;
let sqliteDb = null;
// export a stable interface immediately so other modules can require it
const dbInterface = {
  query: async (sql, params) => {
    params = params || [];
    if (mysqlPool) return mysqlPool.query(sql, params);
    if (sqliteDb) return sqliteQuery(sqliteDb, sql, params);
    
    return new Promise((resolve, reject) => {
      let waited = 0;
      const iv = setInterval(() => {
        if (mysqlPool) {
          clearInterval(iv);
          return mysqlPool.query(sql, params).then(resolve).catch(reject);
        }
        if (sqliteDb) {
          clearInterval(iv);
          return sqliteQuery(sqliteDb, sql, params).then(resolve).catch(reject);
        }
        waited += 100;
        if (waited > 5000) {
          clearInterval(iv);
          reject(new Error('Database not initialized'));
        }
      }, 100);
    });
  }
};

module.exports = dbInterface;

(async function init() {
  // Only try MySQL when explicitly enabled to avoid accidental remote MySQL usage
  const useMySQL = process.env.USE_MYSQL === '1';

  if (useMySQL) {
    try {
      mysqlPool = await createMySQLPool();
      console.log('Database engine: MySQL');
      return;
    } catch (err) {
      console.warn('MySQL connection failed, falling back to SQLite. Error:', err.message);
    }
  }

  sqliteDb = createSqliteDb();
  try {
    await initFallbackSqlite(sqliteDb);
    console.log('Database engine: SQLite (fallback)');
    
    const bcrypt = require('bcrypt');
    const adminHash = await bcrypt.hash('27032006', 10);
    await sqliteQuery(sqliteDb, 'INSERT OR IGNORE INTO users (username, password, balance) VALUES (?, ?, 0)', ['admin', adminHash]);
  } catch (e) {
    console.error('Failed to initialize SQLite fallback DB:', e.message);
  }
})();