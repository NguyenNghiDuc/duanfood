const db = require('../config/db')

const foods = [
  
  {
    title: 'Thịt Heo',
    description: 'Thịt heo ngon, Đậm đà',
    price: 80000,
    category_id: null,
    image: "/images/thitheo.png"
  }
  
]

async function seed() {
  try {
    for (const f of foods) {
      const [rows] = await db.query('SELECT COUNT(*) AS c FROM foods WHERE title = ?', [f.title])
      const count = rows[0] ? (rows[0].c || rows[0].total || 0) : 0
      if (Number(count) === 0) {
        await db.query('INSERT INTO foods (title, description, price, category_id, image) VALUES (?, ?, ?, ?, ?)', [f.title, f.description, f.price, f.category_id, f.image])
        console.log('Inserted:', f.title)
      } else {
        console.log('Skipped (exists):', f.title)
      }
    }
    console.log('Seeding complete')
    process.exit(0)
  } catch (err) {
    console.error('Seeding failed:', err)
    process.exit(1)
  }
}

seed()
