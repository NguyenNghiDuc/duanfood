const db = require('../config/db')

const foodToCategory = (title, description) => {
  const t = (title || '') + ' ' + (description || '')
  const s = t.toLowerCase()

  const drinkKeywords = [
    'trà', 'nước', 'juice', 'milk', 'latte',
    'cà phê', 'coffee', 'sữa', 'matcha',
    'trà sữa', 'soda', 'nước ép', 'smoothie'
  ]

  const dessertKeywords = [
    'tráng miệng', 'chè', 'bánh',
    'dessert', 'kem', 'pudding'
  ]

  const homeKeywords = [
    'bát', 'đĩa', 'ly', 'cốc',
    'dao', 'muỗng', 'nĩa'
  ]

  const cookingKeywords = [
    'nồi', 'chảo', 'bếp',
    'thớt', 'nồi cơm', 'lò nướng'
  ]

  for (const k of homeKeywords) {
    if (s.includes(k)) return 'Đồ dùng trong nhà'
  }

  for (const k of cookingKeywords) {
    if (s.includes(k)) return 'Đồ dùng nấu ăn'
  }

  for (const k of dessertKeywords) {
    if (s.includes(k)) return 'Tráng miệng'
  }

  for (const k of drinkKeywords) {
    if (s.includes(k)) return 'Đồ uống'
  }

  return 'Đồ ăn'
}