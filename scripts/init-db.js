const db = require('../config/db')
const foodModel = require('../controllers/foodModel')
const bcrypt = require('bcrypt')

async function init() {
  try {
    console.log('Initializing database schema...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          fullname VARCHAR(255) DEFAULT '',
          balance DECIMAL(10,2) NOT NULL DEFAULT 0
      )
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS posts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS addresses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          label VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          phone VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS delivery_companies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          fee DECIMAL(10,2) NOT NULL DEFAULT 0
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

   
    try {
      await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) NOT NULL DEFAULT 0")
    } catch (e) {
    
    }

    const adminPlain = '27032006'
    const adminHash = await bcrypt.hash(adminPlain, 10)
    await db.query("INSERT IGNORE INTO users (username, password, balance) VALUES (?, ?, 0)", ["admin", adminHash])

    
    await foodModel.initFoodSchema()

    console.log('Database initialization complete.')
    process.exit(0)
  } catch (err) {
    console.error('Database init failed', err)
    process.exit(1)
  }
}

init()
