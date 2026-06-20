const db = require('./config/db')

async function fix() {
  try {
    await db.query(
      'UPDATE foods SET category_id = ? WHERE id = ?',
      [1, 1]
    )

    await db.query(
      'UPDATE foods SET category_id = ? WHERE id = ?',
      [1, 2]
    )

    console.log('Updated categories')
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

fix()