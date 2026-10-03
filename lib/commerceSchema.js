const db = require('../config/db')
let readyPromise=null
async function safe(sql){try{await db.query(sql)}catch(_){}}
async function ensureCommerceSchema(){
  if(readyPromise)return readyPromise
  readyPromise=(async()=>{
    await db.ready()
    const tables=[
      `CREATE TABLE IF NOT EXISTS wallet_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT,username VARCHAR(255) NOT NULL,type VARCHAR(64) NOT NULL,amount REAL NOT NULL,balance_before REAL NOT NULL DEFAULT 0,balance_after REAL NOT NULL DEFAULT 0,reference_type VARCHAR(64) DEFAULT '',reference_id VARCHAR(255) DEFAULT '',note TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT,code VARCHAR(64) NOT NULL UNIQUE,discount_type VARCHAR(32) NOT NULL DEFAULT 'percent',discount_value REAL NOT NULL DEFAULT 0,min_order REAL NOT NULL DEFAULT 0,max_discount REAL NOT NULL DEFAULT 0,usage_limit INTEGER NOT NULL DEFAULT 0,used_count INTEGER NOT NULL DEFAULT 0,starts_at DATETIME NULL,expires_at DATETIME NULL,active INTEGER NOT NULL DEFAULT 1,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS voucher_usages (id INTEGER PRIMARY KEY AUTOINCREMENT,voucher_id INTEGER NOT NULL,username VARCHAR(255) NOT NULL,order_id INTEGER,discount_amount REAL NOT NULL DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,UNIQUE(voucher_id,username,order_id))`,
      `CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY AUTOINCREMENT,username VARCHAR(255) NOT NULL,food_id INTEGER NOT NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,UNIQUE(username,food_id))`,
      `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,username VARCHAR(255) NOT NULL,title VARCHAR(255) NOT NULL,message TEXT NOT NULL,link VARCHAR(500) DEFAULT '',is_read INTEGER NOT NULL DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS flash_sales (id INTEGER PRIMARY KEY AUTOINCREMENT,food_id INTEGER NOT NULL,sale_price REAL NOT NULL,starts_at DATETIME NOT NULL,ends_at DATETIME NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT,username VARCHAR(255) NOT NULL,subject VARCHAR(255) NOT NULL,message TEXT NOT NULL,status VARCHAR(32) NOT NULL DEFAULT 'open',priority VARCHAR(32) NOT NULL DEFAULT 'normal',assigned_to VARCHAR(255) DEFAULT '',created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS ticket_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,ticket_id INTEGER NOT NULL,sender VARCHAR(255) NOT NULL,sender_role VARCHAR(32) NOT NULL DEFAULT 'user',message TEXT NOT NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,actor VARCHAR(255) NOT NULL,action VARCHAR(100) NOT NULL,target_type VARCHAR(100) DEFAULT '',target_id VARCHAR(255) DEFAULT '',detail TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS password_reset_codes (id INTEGER PRIMARY KEY AUTOINCREMENT,username VARCHAR(255) NOT NULL,code_hash VARCHAR(128) NOT NULL,expires_at DATETIME NOT NULL,used INTEGER NOT NULL DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
    ]
    for(const sql of tables){try{await db.query(sql)}catch(sqliteError){const mysql=sql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g,'INT AUTO_INCREMENT PRIMARY KEY').replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g,'TIMESTAMP DEFAULT CURRENT_TIMESTAMP').replace(/REAL/g,'DECIMAL(14,2)');try{await db.query(mysql)}catch(_){throw sqliteError}}}
    const alters=[
      `ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'user'`,
      `ALTER TABLE users ADD COLUMN locked INTEGER DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN email VARCHAR(255) DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT ''`,
      `ALTER TABLE foods ADD COLUMN stock INTEGER DEFAULT 50`,
      `ALTER TABLE foods ADD COLUMN low_stock_threshold INTEGER DEFAULT 5`,
      `ALTER TABLE reviews ADD COLUMN image VARCHAR(500) DEFAULT ''`,
      `ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(14,2) DEFAULT 0`,
      `ALTER TABLE orders ADD COLUMN voucher_code VARCHAR(64) DEFAULT ''`,
      `ALTER TABLE orders ADD COLUMN refunded INTEGER DEFAULT 0`,
      `ALTER TABLE orders ADD COLUMN status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    ]
    for(const sql of alters)await safe(sql)
  })()
  return readyPromise
}
module.exports={ensureCommerceSchema}
