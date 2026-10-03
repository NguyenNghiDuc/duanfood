const db = require('../config/db')

let readyPromise = null

async function safe(sql) {
  try { await db.query(sql) } catch (_) {}
}

async function ensureCommerceSchema() {
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    await db.ready()

    const tables = [
      `CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        balance_before REAL NOT NULL DEFAULT 0,
        balance_after REAL NOT NULL DEFAULT 0,
        reference_type TEXT DEFAULT '',
        reference_id TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        discount_type TEXT NOT NULL DEFAULT 'percent',
        discount_value REAL NOT NULL DEFAULT 0,
        min_order REAL NOT NULL DEFAULT 0,
        max_discount REAL NOT NULL DEFAULT 0,
        usage_limit INTEGER NOT NULL DEFAULT 0,
        used_count INTEGER NOT NULL DEFAULT 0,
        starts_at DATETIME NULL,
        expires_at DATETIME NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS voucher_usages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        order_id INTEGER,
        discount_amount REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(voucher_id, username, order_id)
      )`,
      `CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        food_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, food_id)
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT DEFAULT '',
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS flash_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        food_id INTEGER NOT NULL,
        sale_price REAL NOT NULL,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'normal',
        assigned_to TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        sender TEXT NOT NULL,
        sender_role TEXT NOT NULL DEFAULT 'user',
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT DEFAULT '',
        target_id TEXT DEFAULT '',
        detail TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS password_reset_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ]

    for (const sql of tables) {
      try { await db.query(sql) } catch (sqliteError) {
        const mysql = sql
          .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INT AUTO_INCREMENT PRIMARY KEY')
          .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
          .replace(/REAL/g, 'DECIMAL(14,2)')
          .replace(/TEXT NOT NULL UNIQUE/g, 'VARCHAR(255) NOT NULL UNIQUE')
        try { await db.query(mysql) } catch (_) { throw sqliteError }
      }
    }

    const alters = [
      `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`,
      `ALTER TABLE users ADD COLUMN locked INTEGER DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''`,
      `ALTER TABLE foods ADD COLUMN stock INTEGER DEFAULT 50`,
      `ALTER TABLE foods ADD COLUMN low_stock_threshold INTEGER DEFAULT 5`,
      `ALTER TABLE reviews ADD COLUMN image TEXT DEFAULT ''`,
      `ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0`,
      `ALTER TABLE orders ADD COLUMN voucher_code TEXT DEFAULT ''`,
      `ALTER TABLE orders ADD COLUMN refunded INTEGER DEFAULT 0`,
      `ALTER TABLE orders ADD COLUMN status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    ]
    for (const sql of alters) await safe(sql)
  })()
  return readyPromise
}

module.exports = { ensureCommerceSchema }
