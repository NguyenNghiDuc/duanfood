const chatIndex = require('../lib/chatIndex')
const foodModel = require('../models/foodModels')
const orderModel = require('../models/orderModels')
const userModel = require('../models/userModels')

function normalize(text) {
  return String(text || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function tokenize(text) {
  return normalize(text)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
}

const STOP_WORDS = new Set([
  'toi', 'mình', 'ban', 'cho', 'mot', 'mon', 'an', 'muon', 'can', 'tim', 'co', 'khong', 'nao', 'gi', 'voi',
  'duoc', 'nhe', 'nha', 'di', 'la', 'cua', 'choi', 'xin', 'chao', 'đi', 'đó', 'do', 'giai', 'hop', 'chưa', 'chu',
  'roi', 'thoi', 'có', 'như', 'như', 'theo', 'hay', 'dang', 'dang', 'là', 'có', 'thế', 'thì', 'nên'
])

function normalizePriceNumber(value, unit) {
  let amount = Number(String(value).replace(',', '.'))
  if (Number.isNaN(amount)) return null
  if (/(k|nghìn|ngàn|ngan|đ|d)$/i.test(unit || '')) {
    if (/k|ngh[ií]n|ngàn|ngan/i.test(unit)) amount *= 1000
  }
  if (!unit && amount < 1000) {
    return amount
  }
  return Math.round(amount)
}

function formatCurrency(value) {
  const num = Number(value || 0)
  return num.toLocaleString('vi-VN') + 'đ'
}

function parsePriceQuery(text) {
  const norm = normalize(text)
  const patterns = [
    /từ\s+(\d+[.,]?\d*)\s*(k|nghìn|ngàn|đ|d)?\s*(?:đến|den|to|-|\–|\~)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|đ|d)?/i,
    /(?:khoảng|khoang)\s+(\d+[.,]?\d*)\s*(k|nghìn|ngàn|đ|d)?\s*(?:đến|den|to|-|\–|\~)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|đ|d)?/i,
    /(?:dưới|duoi|thấp hơn|thap hon|không quá|khong qua|<)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|đ|d)?/i,
    /(?:trên|tren|lớn hơn|lon hon|cao hơn|>)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|đ|d)?/i,
    /(\d+[.,]?\d*)\s*(k|nghìn|ngàn|đ|d)\b/i,
    /(\d{4,7})\b/
  ]
  let min = null
  let max = null
  let match

  if ((match = norm.match(patterns[0])) || (match = norm.match(patterns[1]))) {
    min = normalizePriceNumber(match[1], match[2])
    max = normalizePriceNumber(match[3], match[4])
    if (min !== null && max !== null && min > max) [min, max] = [max, min]
    return { min, max }
  }

  if ((match = norm.match(patterns[2]))) {
    max = normalizePriceNumber(match[1], match[2])
    return { min: null, max }
  }

  if ((match = norm.match(patterns[3]))) {
    min = normalizePriceNumber(match[1], match[2])
    return { min, max: null }
  }

  if ((match = norm.match(/(?:khoảng|khoang|khoang|khoảng)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|đ|d)?/i))) {
    const value = normalizePriceNumber(match[1], match[2])
    if (value !== null) {
      return { min: Math.max(0, value - 15000), max: value + 15000 }
    }
  }

  return { min: null, max: null }
}

function isPronounReference(text) {
  return /\b(nó|đó|cái đó|cái này|chúng|này|đấy|đay)\b/.test(normalize(text))
}

function getQuickActions() {
  return [
    { label: 'Gợi ý món', value: 'Gợi ý món' },
    { label: 'Dưới 50k', value: 'Món dưới 50k' },
    { label: 'Món bò', value: 'Món bò' },
    { label: 'Món gà', value: 'Món gà' },
    { label: 'Phổ biến', value: 'Món phổ biến' },
    { label: 'Giỏ hàng', value: 'Giỏ hàng' }
  ]
}

function scoreTextMatch(item, queryTokens) {
  const title = normalize(item.title || '')
  const description = normalize(item.description || '')
  const category = normalize(item.category || '')
  const text = normalize(item.text || '')

  const titleTokens = new Set(tokenize(title))
  const descTokens = new Set(tokenize(description))
  const categoryTokens = new Set(tokenize(category))
  const textTokens = new Set(tokenize(text))

  let score = 0
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 12
    if (descTokens.has(token)) score += 5
    if (categoryTokens.has(token)) score += 6
    if (textTokens.has(token) && !titleTokens.has(token) && !descTokens.has(token) && !categoryTokens.has(token)) score += 1
    if (title.includes(token)) score += 2
  }

  if (queryTokens.every(token => title.includes(token))) score += 15
  if (categoryTokens.size && queryTokens.some(token => categoryTokens.has(token))) score += 7
  if (item.order_count) score += Math.min(item.order_count, 20)

  return score
}

function getBestFoodEntity(text, indexItems, context) {
  const normalized = normalize(text)
  const tokens = tokenize(text).filter(token => !STOP_WORDS.has(token))
  if (!tokens.length && !context?.lastFoodId) return null

  const candidates = indexItems.map(item => {
    const title = normalize(item.title)
    const description = normalize(item.description || '')
    const category = normalize(item.category || '')
    let score = 0
    for (const token of tokens) {
      if (title.includes(token)) score += 20
      if (description.includes(token)) score += 5
      if (category.includes(token)) score += 4
      if (title === token) score += 25
      if (title.startsWith(token)) score += 10
    }
    if (normalized === title) score += 30
    if (title.includes(normalized)) score += 20
    return { item, score }
  })
  candidates.sort((a, b) => b.score - a.score)
  if (candidates.length && candidates[0].score > 10) return candidates[0].item
  if (isPronounReference(text) && context?.lastFoodId) {
    return indexItems.find(item => Number(item.id) === Number(context.lastFoodId)) || null
  }
  return null
}

function detectIntent(text, context) {
  const norm = normalize(text)

  const greetings = /\b(xin chao|xin chào|chào|hello|hi|hey)\b/
  const thanks = /\b(cám ơn|cam on|cảm ơn|thank you|thanks|tks)\b/
  const goodbyes = /\b(bye|tạm biệt|tam biet|hẹn gặp|hen gap|tạm|tam)\b/
  const help = /\b(giúp|giup|help|hỗ trợ|ho tro|hỗtrợ)\b/
  const viewCart = /\b(giỏ hàng|gio hang|xem giỏ|xem gio|cart)\b/
  const addCart = /\b(thêm|them|mua|cho|bỏ|bo)\b.*\b(giỏ hàng|gio hang|giỏ|gio|vào giỏ|vao gio|cart)\b|\b(cho|them|mua|bỏ|bo)\b.*\b(giỏ|gio|cart)\b/
  const removeCart = /\b(xóa|xoa|bỏ|bo|remove|gỡ)\b.*\b(giỏ|gio|cart|hàng)\b/
  const orderStatus = /\b(đơn hàng|don hang|trạng thái|trang thai|giao|van don|vận đơn|vận don|kiểm tra)\b/
  const wallet = /\b(ví|vi|balance|số dư|so du|tiền|tien|tien trong ví|so du trong vi|ví của tôi|vi cua toi)\b/
  const cheap = /\b(rẻ nhất|re nhat|mon re|món rẻ|món re|món rẻ nhất|gia re|giá rẻ|gia re|món rẻ)\b/
  const expensive = /\b(đắt nhất|dat nhat|món đắt|mon dat|giá cao|gia cao|đắt|dat)\b/
  const popular = /\b(phổ biến|pho bien|popular|được đặt nhiều|duoc dat nhieu|hot)\b/
  const random = /\b(món nào cũng được|mon nao cung duoc|ăn gì|an gi|hôm nay ăn gì|hom nay an gi|gợi ý đại|goi y dai|random|ngẫu nhiên|ngau nhien)\b/
  const similar = /\b(giống|tuong tu|giong|gợi ý giống|goi y giong|tương tự)\b/
  const detail = /\b(bao nhiêu|là gì|la gi|có gì|thông tin|thong tin|xem thông tin|xem thong tin|giá bao nhiêu|gia bao nhieu|gia bao nhieu)\b/
  const priceQuery = /\b(dưới|duoi|trên|tren|từ|tu|đến|den|khoảng|khoang|rẻ nhất|re nhat|đắt nhất|dat nhat|giá|gia)\b.*\d/ 
  const searchFood = /\b(tìm|tim|có món|co mon|món nào|mon nao|món|mon|mình muốn|toi muon|muon|cần|can)\b/
  const categoryQuery = /\b(khai vị|khai vi|món chính|mon chinh|đồ uống|do uong|món tráng miệng|mon trang mieng|món ăn nhanh|mon an nhanh|món Việt|mon Viet|đồ ăn nhanh|do an nhanh)\b/
  const ingredientQuery = /\b(bò|ga|gà|hải sản|hai san|phô mai|pho mai|trứng|trung|cá|ca|tôm|tom|nấm|nam|mì|mi|bún|bun|cơm|com|rau|thịt|thit)\b/

  if (greetings.test(norm)) return 'GREETING'
  if (thanks.test(norm)) return 'THANKS'
  if (goodbyes.test(norm)) return 'GOODBYE'
  if (help.test(norm)) return 'HELP'
  if (wallet.test(norm) && /\b(tôi|toi|của tôi|cua toi|mình|minh)\b/.test(norm)) return 'WALLET'
  if (orderStatus.test(norm) && !/\b(món|mon|đồ|do)\b/.test(norm)) return 'ORDER_STATUS'
  if (viewCart.test(norm) && !addCart.test(norm)) return 'VIEW_CART'
  if (addCart.test(norm)) return 'ADD_TO_CART'
  if (removeCart.test(norm)) return 'REMOVE_FROM_CART'
  if (random.test(norm)) return 'RANDOM_FOOD'
  if (similar.test(norm)) return 'SIMILAR_FOOD'
  if (detail.test(norm)) return 'FOOD_DETAIL'
  if (cheap.test(norm)) return 'CHEAP_FOOD'
  if (expensive.test(norm)) return 'EXPENSIVE_FOOD'
  if (popular.test(norm)) return 'POPULAR_FOOD'
  if (priceQuery.test(norm)) return 'SEARCH_BY_PRICE'
  if (categoryQuery.test(norm)) return 'SEARCH_BY_CATEGORY'
  if (ingredientQuery.test(norm)) return 'SEARCH_BY_INGREDIENT'
  if (searchFood.test(norm)) return 'SEARCH_FOOD'
  return 'UNKNOWN'
}

function formatFoodCard(item) {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    price: formatCurrency(item.price),
    image: item.image || '',
    url: item.url,
    subtitle: item.description ? item.description.substring(0, 80) + '...' : ''
  }
}

function buildReplyList(items, lead) {
  if (!items || !items.length) return lead || ''
  const lines = items.slice(0, 5).map(item => `• ${item.title} — ${formatCurrency(item.price)}`)
  return `${lead}\n${lines.join('\n')}`
}

function addToSessionCart(req, item, quantity = 1) {
  if (!req.session.cart) req.session.cart = []
  const cart = req.session.cart
  const existing = cart.find(entry => Number(entry.foodId) === Number(item.id))
  if (existing) {
    existing.quantity += quantity
  } else {
    cart.push({ foodId: item.id, title: item.title, price: item.price, quantity, image: item.image })
  }
  req.session.cart = cart
}

function cartSummary(req) {
  const cart = req.session.cart || []
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  return { items: cart, count: cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0), total }
}

async function train(req, res, next) {
  try {
    const items = await chatIndex.buildIndex()
    INDEX = items
    res.json({ ok: true, items: items.length })
  } catch (error) {
    next(error)
  }
}

let INDEX = []

async function ensureIndex() {
  if (!INDEX.length) {
    INDEX = await chatIndex.loadIndex()
    if (!INDEX.length) INDEX = await chatIndex.buildIndex()
  }
}

async function chat(req, res, next) {
  try {
    await ensureIndex()
    const { message, foodId } = req.body || {}
    const originalMessage = String(message || '').trim()
    const text = normalize(originalMessage)
    if (!text) {
      return res.json({ reply: 'Bạn muốn hỏi gì? Ví dụ: "Tìm món bò", "Gợi ý món", "Ví của tôi còn bao nhiêu"', quickActions: getQuickActions() })
    }

    const context = req.session.chatContext || {}
    const intent = detectIntent(text, context)
    const priceQuery = parsePriceQuery(text)
    const foodEntity = getBestFoodEntity(text, INDEX, context)
    const referFood = isPronounReference(text) && context.lastFoodId ? INDEX.find(item => Number(item.id) === Number(context.lastFoodId)) : null
    const currentFood = foodEntity || referFood || (foodId ? INDEX.find(item => Number(item.id) === Number(foodId)) : null)

    const replyBase = { intent, quickActions: getQuickActions() }
    const setContext = (update) => {
      req.session.chatContext = { ...(req.session.chatContext || {}), ...update }
    }

    const searchByIds = async (ids) => {
      const items = INDEX.filter(item => ids.includes(Number(item.id)))
      const results = items.sort((a, b) => b.order_count - a.order_count).slice(0, 5)
      return results
    }

    const findSimilarFoods = (base) => {
      if (!base) return []
      const baseTitle = normalize(base.title || '')
      const baseTokens = tokenize(base.title + ' ' + base.description + ' ' + base.category)
      const candidates = INDEX.filter(item => Number(item.id) !== Number(base.id)).map(item => {
        let score = 0
        if (item.category_id && base.category_id && Number(item.category_id) === Number(base.category_id)) score += 10
        const itemText = normalize(item.title + ' ' + item.description + ' ' + item.category)
        for (const token of baseTokens) {
          if (itemText.includes(token)) score += 4
        }
        const priceDiff = Math.abs(Number(item.price || 0) - Number(base.price || 0))
        score += Math.max(0, 6 - Math.floor(priceDiff / 20000))
        return { item, score }
      }).filter(c => c.score > 0)
      return candidates.sort((a, b) => b.score - a.score).slice(0, 5).map(c => c.item)
    }

    const getSearchResults = async ({ queryText, minPrice, maxPrice, categoryName, ingredientTerm, exactFood }) => {
      const keyword = queryText || ''
      const foods = await foodModel.searchFoods({ keyword, categoryId: categoryName || '', minPrice, maxPrice })
      let results = foods.map(food => ({
        ...food,
        category: food.category_name || food.category || ''
      }))
      if (ingredientTerm) {
        const normalizedIngredient = normalize(ingredientTerm)
        results = results.filter(item => normalize(item.title + ' ' + item.description + ' ' + item.category).includes(normalizedIngredient))
      }
      if (exactFood) {
        results = results.filter(item => normalize(item.title) === normalize(exactFood.title))
      }
      return results.slice(0, 10)
    }

    const formatResults = (results, lead) => {
      if (!results || !results.length) {
        return { reply: `Mình chưa tìm thấy kết quả phù hợp với "${originalMessage}". Bạn thử câu khác nhé.`, cards: [] }
      }
      const cards = results.slice(0, 5).map(formatFoodCard)
      const reply = `${lead}\n${results.slice(0, 5).map(item => `• ${item.title} — ${formatCurrency(item.price)}`).join('\n')}`
      return { reply, cards }
    }

    let response
    switch (intent) {
      case 'GREETING':
        response = {
          reply: 'Chào bạn! Mình là AI Food Assistant của Mini Food. Bạn muốn tìm món gì hôm nay?',
          ...replyBase
        }
        break
      case 'THANKS':
        response = {
          reply: 'Rất vui được giúp bạn! Nếu cần, bạn cứ hỏi nhé 😊',
          ...replyBase
        }
        break
      case 'GOODBYE':
        response = {
          reply: 'Hẹn gặp lại bạn sau nhé! Chúc bạn có bữa ăn ngon miệng.',
          ...replyBase
        }
        break
      case 'HELP':
        response = {
          reply: 'Mình có thể giúp bạn tìm món theo tên, nguyên liệu, giá, category, xem giỏ hàng, đơn hàng hoặc ví. Ví dụ: "Tìm món bò", "Món dưới 50k", "Giỏ hàng", "Ví của tôi".',
          ...replyBase
        }
        break
      case 'VIEW_CART': {
        const cart = cartSummary(req)
        if (!cart.count) {
          response = { reply: 'Giỏ hàng hiện đang trống. Bạn có thể hỏi mình thêm món vào giỏ, ví dụ: "Thêm bò lúc lắc vào giỏ".', ...replyBase }
        } else {
          response = {
            reply: `Giỏ hàng hiện có ${cart.count} món, tổng ${formatCurrency(cart.total)}.`, 
            cards: cart.items.map(item => ({ title: item.title, price: formatCurrency(item.price), subtitle: `Số lượng: ${item.quantity}`, image: item.image || '', url: `/foods/${item.foodId}` })),
            ...replyBase
          }
        }
        break
      }
      case 'ADD_TO_CART': {
        const quantityMatch = /([0-9]+)\s*(phần|phan|suất|suất|cái|caí)?/i.exec(text)
        const quantity = quantityMatch ? Number(quantityMatch[1]) : 1
        if (!currentFood) {
          response = { reply: 'Mình chưa rõ bạn muốn thêm món nào. Bạn nói rõ tên món giúp mình nhé.', ...replyBase }
        } else {
          addToSessionCart(req, currentFood, quantity)
          setContext({ lastFoodId: currentFood.id })
          response = {
            reply: `Đã thêm ${quantity} ${currentFood.title} vào giỏ hàng.`, 
            cards: [formatFoodCard(currentFood)],
            ...replyBase
          }
        }
        break
      }
      case 'REMOVE_FROM_CART': {
        const cart = req.session.cart || []
        if (!cart.length) {
          response = { reply: 'Giỏ hàng đang trống nên không có gì để xóa.', ...replyBase }
        } else if (!currentFood) {
          req.session.cart = []
          response = { reply: 'Mình đã xóa toàn bộ giỏ hàng giúp bạn.', ...replyBase }
        } else {
          req.session.cart = cart.filter(item => Number(item.foodId) !== Number(currentFood.id))
          response = { reply: `Đã xóa ${currentFood.title} khỏi giỏ hàng.`, ...replyBase }
        }
        break
      }
      case 'WALLET': {
        if (!req.session.user) {
          response = { reply: 'Bạn cần đăng nhập để xem số dư ví. Vui lòng đăng nhập hoặc tạo tài khoản.', ...replyBase }
        } else {
          const balance = Number(req.session.user.balance || 0)
          response = { reply: `Số dư ví của bạn hiện tại là ${formatCurrency(balance)}.`, ...replyBase }
        }
        break
      }
      case 'ORDER_STATUS': {
        if (!req.session.user) {
          response = { reply: 'Bạn cần đăng nhập để xem trạng thái đơn hàng.', ...replyBase }
        } else {
          const orders = await orderModel.getOrdersByUsername(req.session.user.username)
          if (!orders.length) {
            response = { reply: 'Bạn chưa có đơn hàng nào. Bạn có thể đặt món trước rồi kiểm tra lại sau.', ...replyBase }
          } else {
            const latest = orders[0]
            response = {
              reply: `Đơn gần nhất của bạn (#${latest.id}) hiện ở trạng thái: ${latest.status}. Tổng ${formatCurrency(latest.total + (Number(latest.shipping_fee) || 0))}.`, 
              ...replyBase
            }
          }
        }
        break
      }
      case 'SEARCH_BY_PRICE': {
        const min = priceQuery.min
        const max = priceQuery.max
        const results = await getSearchResults({ queryText: text, minPrice: min, maxPrice: max })
        response = formatResults(results, min && max ? `Mình tìm món giá từ ${formatCurrency(min)} đến ${formatCurrency(max)}:` : min ? `Mình tìm món giá trên ${formatCurrency(min)}:` : max ? `Mình tìm món giá dưới ${formatCurrency(max)}:` : 'Mình tìm được:')
        if (results.length) setContext({ lastSearchIds: results.map(item => Number(item.id)), lastIntent: intent })
        break
      }
      case 'SEARCH_BY_CATEGORY': {
        const categoryName = normalize(text)
        const results = await getSearchResults({ queryText: categoryName })
        response = formatResults(results, `Mình tìm được món thuộc nhóm này:`)
        if (results.length) setContext({ lastSearchIds: results.map(item => Number(item.id)), lastIntent: intent })
        break
      }
      case 'SEARCH_BY_INGREDIENT': {
        const ingredient = normalize(text)
        const results = await getSearchResults({ queryText: ingredient, ingredientTerm: ingredient })
        response = formatResults(results, `Mình tìm được món có ${ingredient}:`)
        if (results.length) setContext({ lastSearchIds: results.map(item => Number(item.id)), lastIntent: intent })
        break
      }
      case 'FOOD_DETAIL': {
        if (!currentFood) {
          response = { reply: 'Mình chưa rõ món bạn đang hỏi. Bạn nói rõ tên món giúp mình nhé.', ...replyBase }
        } else {
          setContext({ lastFoodId: currentFood.id, lastIntent: intent })
          const details = `Tên: ${currentFood.title}\nGiá: ${formatCurrency(currentFood.price)}\nDanh mục: ${currentFood.category || 'Chưa có'}\n${currentFood.description ? `Mô tả: ${currentFood.description}` : ''}`
          response = { reply: details, cards: [formatFoodCard(currentFood)], ...replyBase }
        }
        break
      }
      case 'SIMILAR_FOOD': {
        const base = currentFood || (context.lastFoodId ? INDEX.find(item => Number(item.id) === Number(context.lastFoodId)) : null)
        if (!base) {
          response = { reply: 'Bạn có thể nói rõ tên món để mình tìm món giống nó.', ...replyBase }
        } else {
          const results = findSimilarFoods(base)
          response = formatResults(results, `Mình tìm được món tương tự ${base.title}:`)
          if (results.length) setContext({ lastSearchIds: results.map(item => Number(item.id)), lastFoodId: base.id, lastIntent: intent })
        }
        break
      }
      case 'POPULAR_FOOD': {
        const results = INDEX.slice().sort((a, b) => (b.order_count || 0) - (a.order_count || 0)).slice(0, 5)
        response = formatResults(results, 'Mình gợi ý những món phổ biến:')
        if (results.length) setContext({ lastSearchIds: results.map(item => Number(item.id)), lastIntent: intent })
        break
      }
      case 'CHEAP_FOOD': {
        const results = INDEX.slice().sort((a, b) => Number(a.price || 0) - Number(b.price || 0)).slice(0, 5)
        response = formatResults(results, 'Những món rẻ nhất mình tìm được:')
        if (results.length) setContext({ lastSearchIds: results.map(item => Number(item.id)), lastIntent: intent })
        break
      }
      case 'EXPENSIVE_FOOD': {
        const results = INDEX.slice().sort((a, b) => Number(b.price || 0) - Number(a.price || 0)).slice(0, 5)
        response = formatResults(results, 'Những món đắt nhất hiện tại:')
        if (results.length) setContext({ lastSearchIds: results.map(item => Number(item.id)), lastIntent: intent })
        break
      }
      case 'RANDOM_FOOD': {
        const weighted = []
        for (const item of INDEX) {
          const weight = 1 + Math.min(item.order_count || 0, 10)
          for (let i = 0; i < weight; i += 1) weighted.push(item)
        }
        const randomItems = []
        const set = new Set()
        while (randomItems.length < 3 && weighted.length) {
          const choice = weighted[Math.floor(Math.random() * weighted.length)]
          if (!set.has(choice.id)) {
            set.add(choice.id)
            randomItems.push(choice)
          }
        }
        response = formatResults(randomItems, 'Mình chọn ngẫu nhiên cho bạn:')
        if (randomItems.length) setContext({ lastSearchIds: randomItems.map(item => Number(item.id)), lastIntent: intent })
        break
      }
      case 'SEARCH_FOOD': {
        const results = await getSearchResults({ queryText: text, minPrice: priceQuery.min, maxPrice: priceQuery.max })
        response = formatResults(results, 'Mình tìm được những món sau:')
        if (results.length) setContext({ lastSearchIds: results.map(item => Number(item.id)), lastIntent: intent })
        break
      }
      default: {
        const results = await getSearchResults({ queryText: text })
        if (results.length) {
          response = formatResults(results, 'Mình tìm được những món phù hợp:')
          setContext({ lastSearchIds: results.map(item => Number(item.id)), lastIntent: intent })
        } else {
          response = { reply: `Mình chưa tìm thấy món phù hợp với "${originalMessage}". Bạn thử câu khác với tên món, nguyên liệu hoặc giá nhé.`, ...replyBase }
        }
        break
      }
    }

    if (!req.session.chatContext) req.session.chatContext = {}
    setContext({ lastIntent: intent })
    if (!response.quickActions) response.quickActions = getQuickActions()
    res.json(response)
  } catch (error) {
    console.error('chat error', error)
    res.status(500).json({ reply: 'Xin lỗi, hiện tại mình chưa thể trả lời. Bạn thử lại sau nhé.' })
  }
}

module.exports = {
  chat,
  train
}
