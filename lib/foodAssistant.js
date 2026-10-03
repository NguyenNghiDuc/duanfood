const foodModel = require('../models/foodModels')

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function tokens(value) {
  return norm(value).split(/[^a-z0-9]+/).filter(word => word.length > 1)
}

function parseBudget(text) {
  const s = norm(text)
  const m = s.match(/(?:duoi|khong qua|toi da|tam|khoang)?\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|000|d|đ)?/i)
  if (!m) return null
  let value = Number(String(m[1]).replace(',', '.'))
  if (/k|nghin|ngan/i.test(m[2] || '') || value < 1000) value *= 1000
  return Math.round(value)
}

function isFoodQuestion(message) {
  const s = norm(message)
  return /(goi y|mon gi|an gi|tim mon|mon nao|do an|thuc an|menu|gia bao nhieu|duoi \d|nguyen lieu|cay|it dau|giam can|protein|hai san|bo|ga|com|bun|mi|pizza|sushi)/.test(s)
}

function scoreFood(food, message, budget) {
  const haystack = norm([food.title, food.description, food.ingredients, food.category_name].filter(Boolean).join(' '))
  const words = tokens(message).filter(w => !['mon','goi','tim','cho','toi','minh','an','duoc','khong','nhieu','mot'].includes(w))
  let score = 0
  for (const word of words) if (haystack.includes(word)) score += word.length >= 5 ? 4 : 2
  if (budget && Number(food.price) <= budget) score += 5
  if (budget && Number(food.price) > budget) score -= 8
  const s = norm(message)
  if (/giam can|it calo|it dau|nhe bung/.test(s) && /rau|salad|uc ga|ca|it dau|healthy/.test(haystack)) score += 5
  if (/protein|tap gym/.test(s) && /bo|ga|ca|trung|hai san|protein/.test(haystack)) score += 5
  if (/cay/.test(s) && /cay|sa te|ot|spicy/.test(haystack)) score += 4
  return score
}

async function recommend(message) {
  if (!isFoodQuestion(message)) return null
  const foods = await foodModel.getFoods({})
  if (!Array.isArray(foods) || !foods.length) return null
  const budget = parseBudget(message)
  const ranked = foods.map(food => ({ food, score: scoreFood(food, message, budget) }))
    .filter(item => item.score > 0 || (!budget && tokens(message).length <= 4))
    .sort((a, b) => b.score - a.score || Number(a.food.price) - Number(b.food.price))
    .slice(0, 5)
    .map(item => item.food)
  if (!ranked.length) return {
    ok: true,
    intent: 'food_recommendation',
    type: 'text',
    reply: budget ? `Mình chưa thấy món phù hợp rõ ràng trong mức ${budget.toLocaleString('vi-VN')}đ. Bạn thử nói thêm nguyên liệu hoặc khẩu vị nhé.` : 'Mình chưa xác định được món phù hợp. Bạn có thể nói ngân sách, nguyên liệu hoặc khẩu vị muốn ăn.',
    cards: [], data: [], quickActions: []
  }
  const names = ranked.map((f, i) => `${i + 1}. ${f.title} — ${Number(f.price || 0).toLocaleString('vi-VN')}đ`).join('\n')
  return {
    ok: true,
    intent: 'food_recommendation',
    type: 'foods',
    reply: `Mình gợi ý ${ranked.length} món phù hợp nhất:\n${names}`,
    cards: ranked.map(f => ({ id: f.id, title: f.title, price: Number(f.price || 0), image: f.image || '', description: f.description || '' })),
    data: ranked,
    quickActions: [{ label: 'Dưới 50k', value: 'Gợi ý món dưới 50k' }, { label: 'Ít dầu', value: 'Gợi ý món ít dầu' }, { label: 'Nhiều protein', value: 'Gợi ý món nhiều protein' }]
  }
}

async function middleware(req, res, next) {
  try {
    const message = req.body && (req.body.message || req.body.text || req.body.question)
    if (!message) return next()
    const response = await recommend(message)
    if (!response) return next()
    return res.json(response)
  } catch (_) { return next() }
}

module.exports = { norm, parseBudget, isFoodQuestion, recommend, middleware }
