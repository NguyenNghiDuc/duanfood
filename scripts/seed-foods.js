const db = require('../config/db')

const foods = [
  {
    title: 'Thịt heo tươi',
    description: 'Thịt heo tươi ngon, đậm vị',
    price: 80000,
    category: 'Đồ tươi sống',
    image: '/images/thitheo.png'
  },
  {
    title: 'Trà sữa',
    description: 'Trà sữa thơm ngon',
    price: 30000,
    category: 'Đồ uống',
    image: '/images/trasua.png'
  },
  {
    title: 'Bánh kem',
    description: 'Bánh kem ngọt mềm',
    price: 120000,
    category: 'Bánh kẹo',
    image: '/images/banhkem.png'
  },
  {
    title: 'Bát ăn',
    description: 'Bát sứ cao cấp',
    price: 50000,
    category: 'Đồ gia dụng',
    image: '/images/bat.png'
  },
  {
    title: 'Nồi chiên không dầu',
    description: 'Nồi chiên tiện lợi',
    price: 350000,
    category: 'Đồ gia dụng',
    image: '/images/noichien.png'
  }
]

async function seed() {
  try {
    const [categories] = await db.query('SELECT * FROM categories')
    const categoryMap = {}

    for (const c of categories) {
      categoryMap[c.name] = c.id
    }

    for (const f of foods) {
      const [rows] = await db.query(
        'SELECT COUNT(*) AS c FROM foods WHERE title = ?',
        [f.title]
      )

      const count = rows[0]?.c || 0

      if (Number(count) === 0) {
        const categoryId = categoryMap[f.category] || null

        await db.query(
          'INSERT INTO foods (title, description, price, category_id, image) VALUES (?, ?, ?, ?, ?)',
          [f.title, f.description, f.price, categoryId, f.image]
        )

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