const db = require('./config/db')

async function checkFoods() {
  try {
    const [rows] = await db.query(
      'SELECT id, title, category_id FROM foods'
    )
    console.log(rows)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

checkFoods()