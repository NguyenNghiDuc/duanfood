const db = require('../config/db')


const foodToCategory = (title, description) => {
  const t = (title || '') + ' ' + (description || '')
  const s = t.toLowerCase()

  const drinkKeywords = [
    'trà', 'nước', 'juice', 'mứt', 'milk', 'latte',
    'cà phê', 'coffee', 'sữa', 'matcha',
    'trà sữa', 'soda', 'nước ép', 'smoothie'
  ]

  const dessertKeywords = [
    'tráng miệng', 'chè', 'bánh',
    'dessert', 'kem', 'pudding'
  ]

  const vegetableKeywords = [
    'rau', 'rau củ', 'rau muống', 'rau cải',
    'xà lách', 'bắp cải', 'cà chua', 'cà rốt',
    'củ cải', 'khoai', 'khoai tây',
    'khoai lang', 'su su', 'bí', 'mướp'
  ]

  for (const k of vegetableKeywords) {
    if (s.includes(k)) return 'Rau củ'
  }

  for (const k of dessertKeywords) {
    if (s.includes(k)) return 'Tráng miệng'
  }

  for (const k of drinkKeywords) {
    if (s.includes(k)) return 'Đồ uống'
  }

  return 'Đồ ăn'
}

async function classify() {
  try {
    const [cats] = await db.query('SELECT * FROM categories')
    const mapping = {}
    for (const c of cats) mapping[c.name] = c.id

    // ensure categories exist
    if (!mapping['Đồ ăn'] || !mapping['Đồ uống'] || !mapping['Tráng miệng'] || !mapping['Rau củ']) {
      console.log('Categories missing, creating defaults...')
      await db.query("INSERT OR IGNORE INTO categories (name) VALUES ('Đồ ăn'), ('Đồ uống'), ('Tráng miệng') ,('Rau củ')")
      const [cats2] = await db.query('SELECT * FROM categories')
      for (const c of cats2) mapping[c.name] = c.id
    }

    const [foods] = await db.query('SELECT id, title, description FROM foods')
    let updated = 0
    for (const f of foods) {
      const catName = foodToCategory(f.title, f.description)
      const catId = mapping[catName]
      if (!catId) continue
      await db.query('UPDATE foods SET category_id = ? WHERE id = ?', [catId, f.id])
      updated++
      console.log(`Updated ${f.title} -> ${catName}`)
    }
    console.log('Classification complete. Updated', updated, 'rows')
    process.exit(0)
  } catch (err) {
    console.error('Classification failed:', err)
    process.exit(1)
  }
}

classify()
