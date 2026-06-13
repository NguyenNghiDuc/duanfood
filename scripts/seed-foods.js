const db = require('../config/db')

const foods = [
  {
    title: 'Phở bò tái',
    description: 'Phở bò tái thơm ngon, nước dùng đậm đà.',
    price: 60000,
    category_id: null,
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80'
  },
  {
    title: 'Bún chả',
    description: 'Bún chả Hà Nội, thịt nướng thơm, nước chấm đậm vị.',
    price: 70000,
    category_id: null,
    image: 'https://ibb.co/mVPb08gN'
  },
  {
    title: 'Gà rán cay',
    description: 'Gà rán giòn rụm, ướp sốt cay hấp dẫn.',
    price: 90000,
    category_id: null,
    image: 'https://images.unsplash.com/photo-1604948277987-57f5f8c6b8d4?auto=format&fit=crop&w=600&q=80'
  },
  {
    title: 'Pizza hải sản',
    description: 'Pizza nóng hổi với hải sản tươi sống.',
    price: 120000,
    category_id: null,
    image: 'https://images.unsplash.com/photo-1548365328-9b7f6b1f7f3b?auto=format&fit=crop&w=600&q=80'
  },
  {
    title: 'Trà sữa trân châu',
    description: 'Trà sữa thơm béo, trân châu dai ngon.',
    price: 35000,
    category_id: null,
    image: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=600&q=80'
  },
  {
    title: 'Cơm tấm',
    description: 'Cơm tấm sườn nướng, thịt bò nướng, rau sống.',
    price: 80000,
    category_id: null,
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80'
  },
  {
    title: 'Thịt Heo',
    description: 'Thịt heo ngon, Đậm đà',
    price: 80000,
    category_id: null,
    image: 'https://ibb.co/mVPb08gN'
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
