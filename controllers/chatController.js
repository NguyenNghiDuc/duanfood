const chatIndex = require('../lib/chatIndex')
const foodModel = require('../models/foodModels')
const orderModel = require('../models/orderModels')
const userModel = require('../models/userModels')

const SUPPORT_TICKETS = new Map()

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
  'roi', 'thoi', 'có', 'nhu', 'như', 'theo', 'hay', 'dang', 'là', 'thế', 'thì', 'nên', 'yen', 'thay', 'qua', 'rat'
])

const INGREDIENT_ALIASES = {
  bo: ['bo', 'thit bo', 'bò', 'beef'],
  ga: ['ga', 'gà', 'thit ga', 'chicken'],
  ca: ['ca', 'cá', 'fish'],
  tom: ['tom', 'tôm', 'shrimp'],
  hai_san: ['hai san', 'hải sản', 'seafood'],
  rau: ['rau', 'vegetable', 'salad', 'xanh'],
  pho_mai: ['pho mai', 'phô mai', 'cheese'],
  trung: ['trung', 'trứng', 'egg'],
  mi: ['mi', 'mì', 'noodle'],
  bun: ['bun', 'bún'],
  com: ['com', 'cơm', 'rice'],
  han: ['han', 'hàn', 'korean'],
  nhat: ['nhat', 'nhật', 'japan', 'japanese'],
  thai: ['thai', 'thái'],
  viet: ['viet', 'việt'],
  pizza: ['pizza'],
  sushi: ['sushi'],
  curry: ['curry', 'cà ri', 'ca ri'],
  cay: ['cay', 'cà ri', 'spicy', 'hot'],
  it_dau: ['it dau', 'ít dầu', 'low fat', 'không dầu', 'khong dau'],
  nhieu_protein: ['nhieu protein', 'nhiều protein', 'protein'],
  nhe_bung: ['nhe bung', 'nhẹ bụng', 'light']
}

const TASTE_KEYWORDS = ['cay', 'ngot', 'mặn', 'chua', 'beo', 'dai', 'man', 'chua', 'ngọt', 'béo', 'dai', 'thom']
const DIET_KEYWORDS = ['it dau', 'ít dầu', 'nhe bung', 'nhẹ bụng', 'thap calo', 'it calo', 'nhiều protein', 'nhieu protein', 'rau', 'giảm cân', 'giam can']
const CUISINE_KEYWORDS = {
  han: ['han', 'hàn', 'korean'],
  nhat: ['nhat', 'nhật', 'japan', 'japanese'],
  thai: ['thai', 'thái'],
  viet: ['viet', 'việt', 'vietnam', 'vietnamese'],
  italy: ['italy', 'italian', 'pizza'],
  my: ['my', 'mỹ', 'american'],
  trung: ['trung', 'trung quoc', 'china', 'chinese']
}

function normalizePriceNumber(value, unit) {
  let amount = Number(String(value).replace(',', '.'))
  if (Number.isNaN(amount)) return null
  if (/(k|nghìn|ngàn|ngan|đ|d)$/i.test(unit || '')) {
    if (/k|ngh[ií]n|ngàn|ngan/i.test(unit)) amount *= 1000
  }
  if (!unit && amount < 1000) return amount
  return Math.round(amount)
}

function formatCurrency(value) {
  const num = Number(value || 0)
  return num.toLocaleString('vi-VN') + 'đ'
}

function parsePriceQuery(text) {
  const norm = normalize(text)
  const patterns = [
    /từ\s+(\d+[.,]?\d*)\s*(k|nghìn|ngàn|ngan|đ|d)?\s*(?:đến|den|to|-|\–|\~)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|ngan|đ|d)?/i,
    /(?:khoảng|khoang)\s+(\d+[.,]?\d*)\s*(k|nghìn|ngàn|ngan|đ|d)?\s*(?:đến|den|to|-|\–|\~)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|ngan|đ|d)?/i,
    /(?:dưới|duoi|thấp hơn|thap hon|không quá|khong qua|<)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|ngan|đ|d)?/i,
    /(?:trên|tren|lớn hơn|lon hon|cao hơn|>)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|ngan|đ|d)?/i,
    /(\d+[.,]?\d*)\s*(k|nghìn|ngàn|ngan|đ|d)\b/i,
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
  if ((match = norm.match(/(?:khoảng|khoang)\s*(\d+[.,]?\d*)\s*(k|nghìn|ngàn|ngan|đ|d)?/i))) {
    const value = normalizePriceNumber(match[1], match[2])
    if (value !== null) return { min: Math.max(0, value - 15000), max: value + 15000 }
  }

  return { min: null, max: null }
}

function isPronounReference(text) {
  return /\b(nó|đó|cái đó|cái này|chúng|này|đấy|đay)\b/.test(normalize(text))
}

function getQuickActions() {
  return [
    { label: 'Gợi ý món', value: 'Gợi ý món' },
    { label: 'Món cay', value: 'Món cay' },
    { label: 'Dưới 50k', value: 'Món dưới 50k' },
    { label: 'Kiểm tra đơn', value: 'Đơn của tôi đâu' },
    { label: 'Ví của tôi', value: 'Ví của tôi còn bao nhiêu' },
    { label: 'CSKH', value: 'Tôi muốn gặp nhân viên' }
  ]
}

function buildResponse(intent, type, reply, payload = {}) {
  return {
    ok: true,
    intent,
    type,
    reply,
    cards: payload.cards || [],
    data: payload.data || [],
    quickActions: payload.quickActions || getQuickActions()
  }
}

function parseVietnameseNumber(value) {
  if (value == null) return null
  const text = String(value).trim().toLowerCase().replace(/\s+/g, '')
  if (!text) return null
  const withUnit = text.match(/(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|nghìn|ngàn|đ|d)?/i)
  if (withUnit) {
    const num = Number(String(withUnit[1]).replace(',', '.'))
    const unit = withUnit[2] || ''
    if (/k|nghin|ngan|nghìn|ngàn/i.test(unit)) return Math.round(num * 1000)
    return Math.round(num)
  }

  const plain = Number(String(text).replace(/[^0-9]/g, ''))
  return Number.isFinite(plain) ? plain : null
}

function extractPriceFromText(text) {
  const candidates = [
    /(?:giá|gia|giá thành|gia thanh)\s*(?:là|la)?\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|nghìn|ngàn|đ|d)?/i,
    /(?:giá|gia|giá thành|gia thanh)\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|nghìn|ngàn|đ|d)?/i,
    /(?:\b)(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|nghìn|ngàn|đ|d)\b/i,
    /(?:\b)(\d{4,7})(?:\b)/i
  ]
  for (const pattern of candidates) {
    const match = String(text || '').match(pattern)
    if (match) {
      const value = Number(String(match[1]).replace(',', '.'))
      const unit = match[2] || ''
      const withK = /k|nghin|ngan|nghìn|ngàn/i.test(unit)
      return withK ? Math.round(value * 1000) : Math.round(value)
    }
  }
  return null
}

function extractTitleFromText(text) {
  const cleaned = String(text || '').trim()
  if (!cleaned) return null
  const patterns = [
    /(?:thêm|them)\s*(?:món|mon)?\s*(?:này|nay)?\s*(?:là\s*)?(.+?)(?:\s+giá\s+|\s+gia\s+|\s+mô tả|\s+mo ta|\s+danh mục|\s+danhmuc|$)/i,
    /(?:thêm|them)\s*(?:món|mon)\s*(.+)/i,
    /(?:món|mon)\s*(?:này|nay)?\s*(?:là\s*)?(.+?)(?:\s+giá\s+|\s+gia\s+|\s+mô tả|\s+mo ta|\s+danh mục|\s+danhmuc|$)/i
  ]
  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match && match[1]) {
      const title = match[1].trim().replace(/^(?:đây là|day la|là|la)\s+/i, '').trim()
      if (title) return title
    }
  }
  return null
}

async function resolveCategoryIdFromText(text) {
  const categories = await foodModel.getAllCategories()
  const normalized = normalize(text)
  const direct = categories.find(category => normalize(category.name).includes(normalized) || normalized.includes(normalize(category.name)))
  if (direct) return Number(direct.id)

  const aliases = {
    'món bò': 'bò',
    'mon bo': 'bò',
    'món gà': 'gà',
    'mon ga': 'gà',
    'món cá': 'cá',
    'mon ca': 'cá',
    'món hải sản': 'hải sản',
    'mon hai san': 'hải sản',
    'món rau': 'rau củ',
    'mon rau': 'rau củ',
    'món ăn nhanh': 'đồ uống',
    'mon an nhanh': 'đồ uống'
  }

  const aliasKey = Object.keys(aliases).find(key => normalize(key) === normalize(text))
  if (aliasKey) {
    const match = categories.find(category => normalize(category.name).includes(normalize(aliases[aliasKey])))
    if (match) return Number(match.id)
  }

  return null
}

function sanitizeImageUrl(filePath) {
  if (!filePath) return ''
  return String(filePath).replace(/\\/g, '/').replace(/^.*?public/, '')
}

async function finalizeAdminFoodDraft(req, res, draft) {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return buildResponse('ADD_FOOD', 'admin_reject', 'Bạn không có quyền thêm món qua chatbot. Chỉ Admin mới được thao tác này.')
    }

    const name = String(draft.title || '').trim()
    const price = Number(draft.price)
    const categoryId = draft.categoryId || await resolveCategoryIdFromText(draft.category || '')

    if (!name) {
      return buildResponse('ADD_FOOD', 'admin_food', 'Mình nhận được ảnh nhưng chưa xác định chắc chắn tên món. Bạn cho mình biết tên món nhé.')
    }

    if (!Number.isFinite(price) || price <= 0) {
      return buildResponse('ADD_FOOD', 'admin_food', `${name} - bạn muốn đặt giá bao nhiêu?`)
    }

    if (!categoryId) {
      const categories = await foodModel.getAllCategories()
      return buildResponse('ADD_FOOD', 'admin_food', `Tên món: ${name}\nẢnh: đã nhận\nGiá: ${formatCurrency(price)}\nBạn muốn đặt món này vào danh mục nào?`, { data: [{ title: name, price, image: draft.image || '', categories }] })
    }

    const imageValue = draft.image || ''
    const description = String(draft.description || '').trim()
    await foodModel.createFood({
      title: name,
      description: description || null,
      price,
      category_id: categoryId,
      image: imageValue,
      gram: 0
    })

    req.session.aiFoodDraft = null
    await chatIndex.buildIndex()
    return buildResponse('ADD_FOOD', 'admin_food_success', `✅ Đã thêm món ${name} thành công.\n💰 Giá: ${formatCurrency(price)}\n📂 Danh mục: ${draft.category || 'Chưa xác định'}\n🖼️ Ảnh: ${imageValue ? 'Đã thêm' : 'Không có ảnh'}`)
  } catch (error) {
    console.error('finalizeAdminFoodDraft error', error)
    return buildResponse('ADD_FOOD', 'admin_food_error', '❌ Không thể thêm món. Món chưa được lưu vào database.')
  }
}

function determineIngredient(text) {
  const norm = normalize(text)
  for (const [key, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    if (aliases.some(alias => norm.includes(alias))) return key
  }
  return null
}

function determineTaste(text) {
  const norm = normalize(text)
  for (const keyword of TASTE_KEYWORDS) {
    if (norm.includes(keyword)) return keyword
  }
  return null
}

function determineCuisine(text) {
  const norm = normalize(text)
  for (const [key, arr] of Object.entries(CUISINE_KEYWORDS)) {
    if (arr.some(alias => norm.includes(alias))) return key
  }
  return null
}

function determineDiet(text) {
  const norm = normalize(text)
  for (const keyword of DIET_KEYWORDS) {
    if (norm.includes(keyword)) return keyword
  }
  return null
}

function getFoodMatchScore(item, query) {
  let score = 0
  const title = normalize(item.title || '')
  const description = normalize(item.description || '')
  const category = normalize(item.category_name || item.category || '')
  const full = `${title} ${description} ${category}`

  if (query.ingredient && (title.includes(query.ingredient) || description.includes(query.ingredient) || category.includes(query.ingredient))) score += 30
  if (query.taste && (title.includes(query.taste) || description.includes(query.taste))) score += 18
  if (query.cuisine && (category.includes(query.cuisine) || title.includes(query.cuisine))) score += 16
  if (query.diet && (description.includes(query.diet) || title.includes(query.diet) || category.includes(query.diet))) score += 12

  if (query.maxPrice !== null && Number(item.price || 0) <= Number(query.maxPrice)) score += 18
  if (query.minPrice !== null && Number(item.price || 0) >= Number(query.minPrice)) score += 10
  if (query.maxPrice !== null && Number(item.price || 0) > Number(query.maxPrice)) score -= 35
  if (query.minPrice !== null && Number(item.price || 0) < Number(query.minPrice)) score -= 20

  if (query.keyword) {
    const tokens = tokenize(query.keyword).filter(token => !STOP_WORDS.has(token))
    for (const token of tokens) {
      if (title.includes(token)) score += 18
      else if (description.includes(token)) score += 8
      else if (category.includes(token)) score += 6
    }
  }

  if (query.excludedIngredient && !full.includes(query.excludedIngredient)) score += 12
  if (item.order_count) score += Math.min(Number(item.order_count || 0), 12)
  if (item.avgRating) score += Number(item.avgRating) * 4

  return score
}

async function findFoodCandidates(originalText, query = {}) {
  const allFoods = await foodModel.getFoods({})
  const candidates = []

  for (const food of allFoods) {
    const summary = await foodModel.getFoodRatingSummary(food.id)
    const combined = {
      ...food,
      order_count: Number(food.order_count || 0),
      avgRating: Number(summary.avgRating || 0)
    }
    const score = getFoodMatchScore(combined, query)
    if (score > 0 || !query.keyword) {
      candidates.push({ ...combined, score })
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 10)
}

function formatFoodCard(item) {
  return {
    id: item.id,
    title: item.title,
    category: item.category_name || item.category || '',
    price: formatCurrency(item.price),
    image: item.image || '',
    url: `/foods/${item.id}`,
    subtitle: item.description ? item.description.substring(0, 80) + '...' : ''
  }
}

function getBestFoodEntity(text, indexItems, context) {
  const normalized = normalize(text)
  const tokens = tokenize(text).filter(token => !STOP_WORDS.has(token))
  if (!tokens.length && !context?.lastFoodId) return null

  const candidates = indexItems
    .map(item => {
      const title = normalize(item.title)
      const description = normalize(item.description || '')
      const category = normalize(item.category || '')
      let score = 0
      for (const token of tokens) {
        if (title.includes(token)) score += 20
        if (description.includes(token)) score += 6
        if (category.includes(token)) score += 5
      }
      if (normalized === title) score += 30
      if (title.includes(normalized)) score += 18
      return { item, score }
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  if (candidates.length) return candidates[0].item
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

  const orderTerms = /\b(đơn hàng|don hang|đơn|don|giao|trễ|tre|chưa giao|chua giao|thiếu món|thieu mon|sai món|sai mon|trả hàng|tra hang|khiếu nại|khiu nai|hủy|huy|đã thanh toán|da thanh toan|tôi nhận sai|toi nhan sai)\b/
  const walletTerms = /\b(ví|vi|số dư|so du|balance|nạp tiền|nap tien|top up|wallet|ví của tôi|vi cua toi)\b/
  const cartTerms = /\b(giỏ hàng|gio hang|giỏ|gio|xem giỏ|xem gio|cart)\b/
  const loginTerms = /\b(đăng nhập|dang nhap|đăng ký|dang ky|register|login|quên mật khẩu|quen mat khau|forgot password|đổi mật khẩu|doi mat khau)\b/
  const complaintTerms = /\b(khiếu nại|khiu nai|không hài lòng|khong hai long|đồ ăn có vấn đề|do an co van de|đơn có vấn đề|don co van de|tôi muốn gặp nhân viên|toi muon gap nhan vien)\b/

  const random = /\b(ăn gì cũng được|an gi cung duoc|chọn đại|chon dai|ngẫu nhiên|ngau nhien|không biết ăn gì|khong biet an gi|gợi ý đại|goi y dai|bạn chọn giúp|ban chon giup|random)\b/
  const similar = /\b(giống|giong|tương tự|tuong tu|món tương tự|mon tuong tu|như món|nhu mon)\b/
  const detail = /\b(là gì|la gi|chi tiết|chi tiet|thông tin|thong tin|giá bao nhiêu|gia bao nhieu|bao nhiêu|bao nhieu)\b/
  const priceQuery = /\b(dưới|duoi|trên|tren|từ|tu|đến|den|khoảng|khoang|rẻ nhất|re nhat|đắt nhất|dat nhat|giá|gia)\b.*\d/
  const recommend = /\b(ăn gì|an gi|tối nay ăn gì|toi nay an gi|đói quá|doi qua|thèm|them|gợi ý món|goi y mon|mình muốn món|minh muon mon|ngon|món nào|mon nao|món ăn|mon an|đồ ăn|do an|đồ uống|do uong)\b/
  const ingredientQuery = /\b(bò|bo|gà|ga|hải sản|hai san|cá|ca|tôm|tom|thuỷ hải sản|thuy hai san|pho mai|phô mai|trứng|trung|rau|thịt|thit|mì|mi|bún|bun|cơm|com|cay|spicy)\b/
  const foodGeneralQuery = /\b(món|mon|đồ ăn|do an|đồ uống|do uong|ăn|an|mì|mi|bún|bun|cơm|com|gà|ga|bò|bo|hải sản|hai san)\b/
  const cuisineQuery = /\b(hàn|han|nhật|nhat|thai|thái|viet|việt|pizza|sushi|italy|my|mỹ|korean|japan)\b/
  const dietQuery = /\b(it dau|ít dầu|nhẹ bụng|nhe bung|nhiều protein|nhieu protein|nhiều rau|nhieu rau|món ít dầu|mon it dau|món nhẹ|mon nhe)\b/
  const categoryQuery = /\b(khai vị|khai vi|món chính|mon chinh|đồ uống|do uong|món tráng miệng|mon trang mieng|món ăn nhanh|mon an nhanh|món Việt|mon Viet)\b/
  const timeQuery = /\b(sáng|sang|trưa|trua|tối|toi|buổi tối|buoi toi|đêm|dem|trời nóng|troi nong)\b/

  if (greetings.test(norm)) return 'GREETING'
  if (thanks.test(norm)) return 'THANKS'
  if (goodbyes.test(norm)) return 'GOODBYE'
  if (help.test(norm)) return 'HELP'

  if (complaintTerms.test(norm)) return 'COMPLAINT'
  if (loginTerms.test(norm)) return 'LOGIN_SUPPORT'
  if (walletTerms.test(norm) && /\b(tôi|toi|của tôi|cua toi|mình|minh)\b/.test(norm)) return 'WALLET_BALANCE'
  if (orderTerms.test(norm)) return 'ORDER_STATUS'
  if (cartTerms.test(norm)) return 'CART_SUPPORT'
  if (random.test(norm)) return 'FOOD_RANDOM'
  if (similar.test(norm)) return 'FOOD_SIMILAR'
  if (dietQuery.test(norm)) return 'FOOD_BY_DIET'
  if (cuisineQuery.test(norm)) return 'FOOD_BY_CUISINE'
  if (priceQuery.test(norm)) return 'FOOD_BY_PRICE'
  if (categoryQuery.test(norm)) return 'FOOD_BY_CATEGORY'
  if (ingredientQuery.test(norm)) return 'FOOD_BY_INGREDIENT'
  if (timeQuery.test(norm)) return 'FOOD_BY_TIME'
  if (detail.test(norm)) return 'FOOD_DETAIL'
  if (foodGeneralQuery.test(norm) && !/đăng nhập|dang nhap|đơn hàng|don hang|ví|vi|số dư|so du|giỏ hàng|gio hang|hỗ trợ|ho tro|khiếu nại|khiu nai/.test(norm)) return 'FOOD_RECOMMENDATION'
  if (recommend.test(norm)) return 'FOOD_RECOMMENDATION'
  return 'UNKNOWN'
}

function createSupportTicket({ username, issue, message }) {
  const id = `CS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const ticket = { id, username: username || 'guest', issue: issue || 'customer_support', message: message || '', createdAt: new Date().toISOString() }
  SUPPORT_TICKETS.set(id, ticket)
  return ticket
}

async function handleSupportRequest(req, res, intent, originalText, context) {
  const user = req.session.user || null

  switch (intent) {
    case 'WALLET_BALANCE': {
      if (!user) return buildResponse(intent, 'customer_support', 'Bạn cần đăng nhập để xem số dư ví của mình trước khi tôi kiểm tra nhé.')
      const currentUser = await userModel.findByUsername(user.username)
      const balance = Number(currentUser?.balance || user.balance || 0)
      return buildResponse(intent, 'customer_support', `Số dư ví hiện tại của bạn là ${formatCurrency(balance)}.`, { data: [{ balance }] })
    }
    case 'ORDER_STATUS': {
      if (!user) return buildResponse(intent, 'customer_support', 'Bạn cần đăng nhập để tôi kiểm tra đơn hàng của bạn.')
      const orders = await orderModel.getOrdersByUsername(user.username)
      if (!orders.length) return buildResponse(intent, 'customer_support', 'Mình chưa tìm thấy đơn hàng nào của bạn trong hệ thống hiện tại.')
      const latest = orders[0]
      return buildResponse(intent, 'customer_support', `Đơn gần nhất của bạn (#${latest.id}) hiện đang ở trạng thái: ${latest.status}. Tổng tiền là ${formatCurrency(Number(latest.total || 0) + Number(latest.shipping_fee || 0))}.`, { data: orders.slice(0, 5) })
    }
    case 'CART_SUPPORT': {
      const cart = req.session.cart || []
      if (!cart.length) return buildResponse(intent, 'customer_support', 'Giỏ hàng của bạn hiện đang trống. Nếu muốn, tôi có thể gợi ý món phù hợp cho bạn.')
      const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
      return buildResponse(intent, 'customer_support', `Giỏ hàng của bạn có ${cart.length} món, tổng ${formatCurrency(total)}.`, { data: cart })
    }
    case 'LOGIN_SUPPORT': {
      if (user) return buildResponse(intent, 'customer_support', `Bạn đang đăng nhập với tài khoản ${user.username}. Nếu cần hỗ trợ khác, mình có thể giúp tiếp.`)
      return buildResponse(intent, 'customer_support', 'Bạn có thể đăng nhập từ trang Đăng nhập. Nếu bạn quên mật khẩu hoặc không đăng nhập được, hãy cho mình biết thêm chi tiết để hỗ trợ.')
    }
    case 'COMPLAINT': {
      const username = user ? user.username : 'guest'
      const ticket = createSupportTicket({ username, issue: 'complaint', message: originalText })
      return buildResponse(intent, 'customer_support', `Mình xin lỗi vì trải nghiệm chưa tốt. Tôi đã ghi nhận khiếu nại của bạn với mã ${ticket.id}. Bộ phận chăm sóc khách hàng sẽ xem xét và hỗ trợ sớm nhất.`, { data: [ticket] })
    }
    case 'CONTACT_SUPPORT':
    case 'HUMAN_HANDOFF': {
      const username = user ? user.username : 'guest'
      const ticket = createSupportTicket({ username, issue: 'human_handoff', message: originalText })
      return buildResponse(intent, 'customer_support', `Mình đã chuyển yêu cầu của bạn sang bộ phận chăm sóc khách hàng. Mã hỗ trợ: ${ticket.id}. Bạn có thể tiếp tục mô tả vấn đề rõ hơn nếu muốn.`, { data: [ticket] })
    }
    default:
      return null
  }
}

async function handleFoodQuery(req, res, intent, originalText, context) {
  const priceInfo = parsePriceQuery(originalText)
  const ingredient = determineIngredient(originalText)
  const taste = determineTaste(originalText)
  const cuisine = determineCuisine(originalText)
  const diet = determineDiet(originalText)
  const isRandom = /\b(ăn gì cũng được|an gi cung duoc|chọn đại|chon dai|random|ngẫu nhiên|ngau nhien|không biết ăn gì|khong biet an gi)\b/.test(normalize(originalText))
  const budget = Number((originalText.match(/(\d+)\s*(k|nghìn|ngàn|ngan|đ|d)?/i) || [])[1] || 0) * (/[k]|nghìn|ngàn|ngan/i.test((originalText.match(/(\d+)\s*(k|nghìn|ngàn|ngan|đ|d)?/i) || [''])[0] || '') ? 1000 : 1)

  const query = {
    keyword: normalize(originalText),
    ingredient: ingredient ? ingredient.toString() : null,
    taste: taste || null,
    cuisine: cuisine || null,
    diet: diet || null,
    minPrice: priceInfo.min,
    maxPrice: priceInfo.max,
    excludedIngredient: null,
    budget: budget || null,
    isRandom
  }

  const candidates = await findFoodCandidates(originalText, query)
  const results = candidates.slice(0, 5)

  if (!results.length) {
    return buildResponse(intent, 'food', 'Mình chưa tìm thấy món phù hợp ở Mini Food với yêu cầu của bạn. Bạn có thể thử mô tả rõ hơn như “món bò dưới 70k”, “món cay”, hoặc “món Hàn” nhé.', { cards: [] })
  }

  const leadMap = {
    FOOD_RECOMMENDATION: 'Mình gợi ý cho bạn những món phù hợp nhất:',
    FOOD_SEARCH: 'Mình tìm được những món phù hợp với yêu cầu của bạn:',
    FOOD_BY_PRICE: priceInfo.max ? `Mình tìm được món dưới ${formatCurrency(priceInfo.max)} cho bạn:` : priceInfo.min ? `Mình tìm món giá trên ${formatCurrency(priceInfo.min)} cho bạn:` : 'Mình tìm được món theo mức giá bạn cần:',
    FOOD_BY_INGREDIENT: ingredient ? `Mình gợi ý món có nguyên liệu ${ingredient} cho bạn:` : 'Mình tìm được món theo nguyên liệu bạn thích:',
    FOOD_BY_TASTE: taste ? `Mình có những món ${taste} phù hợp với khẩu vị của bạn:` : 'Mình tìm được món theo khẩu vị bạn thích:',
    FOOD_BY_CATEGORY: 'Mình tìm được món theo nhóm bạn cần:',
    FOOD_BY_CUISINE: cuisine ? `Mình gợi ý bạn một số món ${cuisine} phù hợp:` : 'Mình tìm được món theo phong cách ẩm thực bạn thích:',
    FOOD_BY_DIET: diet ? `Mình chọn những món phù hợp với yêu cầu ${diet}:` : 'Mình gợi ý món dễ ăn và phù hợp hơn với chế độ của bạn:',
    FOOD_BY_TIME: 'Mình đề xuất theo thời điểm bạn đang cần:',
    FOOD_SIMILAR: 'Mình tìm món tương tự cho bạn:',
    FOOD_RANDOM: 'Mình chọn ngẫu nhiên cho bạn:',
    FOOD_BY_BUDGET: 'Mình chọn món theo ngân sách bạn đang có:',
    FOOD_COMPARE: 'So sánh các lựa chọn phù hợp nhất cho bạn:',
    FOOD_DETAIL: 'Mình xem thông tin món bạn đang hỏi:',
    default: 'Mình gợi ý cho bạn:'
  }

  return buildResponse(intent, 'food', `${leadMap[intent] || leadMap.default}\n${results.map(item => `• ${item.title} — ${formatCurrency(item.price)}`).join('\n')}`, { cards: results.map(formatFoodCard), data: results })
}

async function handleAdminFoodDraft(req, res, text, uploadedFile) {
  const user = req.session.user
  const normalized = normalize(text || '')
  const adminActionIntent = uploadedFile || /(?:thêm|them|đổi|doi|xóa|xoa).*món|.*anh/i.test(String(text || ''))

  if (!user || user.role !== 'admin') {
    if (adminActionIntent) {
      return buildResponse('ADMIN_RESTRICTED', 'admin_reject', 'Bạn không có quyền gửi ảnh để thêm món. Chỉ Admin mới được thao tác này.')
    }
    return null
  }

  const message = String(text || '').trim()
  const draft = req.session.aiFoodDraft || null

  if (message && /^(thêm đi|them di|xác nhận|xac nhan|confirm|đồng ý|dong y|yes)$/i.test(message)) {
    if (draft && draft.action) {
      return finalizeAdminFoodDraft(req, res, draft)
    }
    return buildResponse('ADD_FOOD', 'admin_food', 'Không có dữ liệu món đang chờ xác nhận để thêm.')
  }

  if (message && /^(hủy|huy|cancel|thoát|thoat)$/i.test(message)) {
    req.session.aiFoodDraft = null
    return buildResponse('ADD_FOOD', 'admin_cancel', 'Đã hủy thao tác thêm món.')
  }

  if (!message && !uploadedFile) {
    return buildResponse('ADD_FOOD', 'admin_food', 'Mình đã nhận được ảnh món ăn. Bạn cho mình biết tên và giá món này nhé.')
  }

  const cleanText = message || ''
  const fileImage = uploadedFile ? `/uploads/${uploadedFile.filename}` : draft?.image || ''
  const addMatch = /(?:thêm|them)\s*(?:món|mon)?/i.test(cleanText)
  const updateImageMatch = /(?:đổi|doi)\s*ảnh|(?:đổi|doi)\s*(?:món|mon).*ảnh|image/i.test(cleanText)
  const deleteImageMatch = /(?:xóa|xoa)\s*ảnh|(?:delete|remove)\s*image/i.test(cleanText)

  if (updateImageMatch) {
    const title = extractTitleFromText(cleanText) || draft?.title || null
    const targetFood = title ? (await foodModel.searchFoods({ keyword: title })).find(item => item.title) : null
    if (!title) {
      return buildResponse('UPDATE_FOOD_IMAGE', 'admin_food', 'Bạn muốn đổi ảnh của món nào? Hãy cho mình tên món nhé.')
    }
    if (!targetFood) {
      return buildResponse('UPDATE_FOOD_IMAGE', 'admin_food', `Mình chưa tìm thấy món ${title} trong danh sách hiện tại. Bạn kiểm tra lại tên món nhé.`)
    }

    req.session.aiFoodDraft = { action: 'UPDATE_FOOD_IMAGE', title: targetFood.title, foodId: targetFood.id, image: fileImage || '' }
    return buildResponse('UPDATE_FOOD_IMAGE', 'admin_food_preview', `📷 Bạn muốn đổi ảnh cho món ${targetFood.title}?\nHình mới đã nhận.\nXác nhận để cập nhật ảnh.`, { cards: [{ id: targetFood.id, title: targetFood.title, price: formatCurrency(targetFood.price), image: fileImage || targetFood.image || '', url: `/foods/${targetFood.id}`, subtitle: 'Cập nhật ảnh món' }], data: [{ foodId: targetFood.id, title: targetFood.title, image: fileImage || '' }] })
  }

  if (deleteImageMatch) {
    const title = extractTitleFromText(cleanText) || draft?.title || null
    const targetFood = title ? (await foodModel.searchFoods({ keyword: title })).find(item => item.title) : null
    if (!title) {
      return buildResponse('DELETE_FOOD_IMAGE', 'admin_food', 'Bạn muốn xóa ảnh của món nào? Hãy cho mình tên món nhé.')
    }
    if (!targetFood) {
      return buildResponse('DELETE_FOOD_IMAGE', 'admin_food', `Mình chưa tìm thấy món ${title} để xóa ảnh.`)
    }

    req.session.aiFoodDraft = { action: 'DELETE_FOOD_IMAGE', title: targetFood.title, foodId: targetFood.id }
    return buildResponse('DELETE_FOOD_IMAGE', 'admin_food', `Bạn chắc chắn muốn xóa ảnh của ${targetFood.title}?`, { data: [{ foodId: targetFood.id, title: targetFood.title }] })
  }

  if (addMatch || uploadedFile) {
    const title = extractTitleFromText(cleanText) || draft?.title || null
    const price = extractPriceFromText(cleanText) || draft?.price || null
    let category = draft?.category || ''
    const categoryCandidate = await resolveCategoryIdFromText(cleanText)
    if (categoryCandidate) {
      const cats = await foodModel.getAllCategories()
      const cat = cats.find(item => Number(item.id) === Number(categoryCandidate))
      category = cat ? cat.name : category
    }

    const parsedDraft = {
      action: 'ADD_FOOD',
      title: title || draft?.title || '',
      price: price || draft?.price || null,
      image: fileImage || draft?.image || '',
      category: category || draft?.category || '',
      categoryId: categoryCandidate || draft?.categoryId || null,
      description: cleanText.replace(/(?:thêm|them|món|mon|giá|gia|danh mục|danhmuc|mô tả|mo ta)/gi, '').trim() || draft?.description || ''
    }

    req.session.aiFoodDraft = parsedDraft

    if (!parsedDraft.title) {
      return buildResponse('ADD_FOOD', 'admin_food', 'Mình nhận được ảnh nhưng chưa xác định chắc chắn tên món. Bạn cho mình biết tên món nhé.', { data: [{ image: parsedDraft.image }] })
    }

    if (!parsedDraft.price) {
      return buildResponse('ADD_FOOD', 'admin_food', `Tên món: ${parsedDraft.title}\nẢnh: đã nhận\nGiá: chưa có\nBạn muốn đặt giá bao nhiêu?`, { data: [{ title: parsedDraft.title, image: parsedDraft.image }] })
    }

    if (!parsedDraft.categoryId && !parsedDraft.category) {
      const categories = await foodModel.getAllCategories()
      return buildResponse('ADD_FOOD', 'admin_food', `🍽️ Món mới\n\n📷 [Ảnh món]\nTên: ${parsedDraft.title}\nGiá: ${formatCurrency(parsedDraft.price)}\nDanh mục: chưa xác định\n\nBạn cho mình biết danh mục món này nhé.`, { cards: [{ id: 'draft-preview', title: parsedDraft.title, price: formatCurrency(parsedDraft.price), image: parsedDraft.image || '', url: '#', subtitle: 'Preview chờ xác nhận' }], data: [{ ...parsedDraft, categories }] })
    }

    return buildResponse('ADD_FOOD', 'admin_food_preview', `🍽️ Món mới\n\n📷 [Ảnh món]\nTên: ${parsedDraft.title}\nGiá: ${formatCurrency(parsedDraft.price)}\nDanh mục: ${parsedDraft.category || 'Chưa xác định'}\n\nBạn có muốn thêm món này vào Mini Food không?`, { cards: [{ id: 'draft-preview', title: parsedDraft.title, price: formatCurrency(parsedDraft.price), image: parsedDraft.image || '', url: '#', subtitle: parsedDraft.category || 'Chưa xác định' }], data: [parsedDraft] })
  }

  return null
}

async function chat(req, res, next) {
  try {
    await ensureIndex()
    const uploadedFile = req.file || null
    const { message, foodId } = req.body || {}
    const originalText = String(message || '').trim()
    const text = normalize(originalText)

    if (!text && !uploadedFile) {
      return res.json(buildResponse('UNKNOWN', 'general', 'Bạn muốn hỏi gì? Ví dụ: “Tối nay ăn gì?”, “Món bò dưới 70k”, “Đơn của tôi đâu?”', { quickActions: getQuickActions() }))
    }

    const adminIntent = uploadedFile || /(?:thêm|them|đổi|doi|xóa|xoa).*món|.*anh/i.test(originalText)
    if (adminIntent && (!req.session.user || req.session.user.role !== 'admin')) {
      return res.status(403).json(buildResponse('ADMIN_RESTRICTED', 'admin_reject', 'Chỉ Admin mới được upload ảnh để thêm món qua chatbot.'))
    }

    const adminDraftResponse = await handleAdminFoodDraft(req, res, originalText, uploadedFile)
    if (adminDraftResponse) {
      return res.json(adminDraftResponse)
    }

    const context = req.session.chatContext || {}
    const intent = detectIntent(text, context)
    const currentFood = getBestFoodEntity(text, INDEX, context) || (
      foodId ? INDEX.find(item => Number(item.id) === Number(foodId)) : null
    )

    let response = null

    if (intent === 'FOOD_RECOMMENDATION' || intent === 'FOOD_SEARCH' || intent === 'FOOD_BY_PRICE' || intent === 'FOOD_BY_INGREDIENT' || intent === 'FOOD_BY_TASTE' || intent === 'FOOD_BY_CATEGORY' || intent === 'FOOD_BY_CUISINE' || intent === 'FOOD_BY_DIET' || intent === 'FOOD_BY_TIME' || intent === 'FOOD_SIMILAR' || intent === 'FOOD_RANDOM' || intent === 'FOOD_COMPARE' || intent === 'FOOD_DETAIL') {
      response = await handleFoodQuery(req, res, intent, originalText, context)
    } else if (intent === 'ORDER_STATUS' || intent === 'WALLET_BALANCE' || intent === 'CART_SUPPORT' || intent === 'LOGIN_SUPPORT' || intent === 'COMPLAINT' || intent === 'CONTACT_SUPPORT' || intent === 'HUMAN_HANDOFF') {
      response = await handleSupportRequest(req, res, intent, originalText, context)
    } else {
      const supportResponse = await handleSupportRequest(req, res, intent, originalText, context)
      if (supportResponse) {
        response = supportResponse
      } else {
        const knowledge = await generalFoodKnowledge(originalText)
        if (knowledge) response = buildResponse('FOOD_KNOWLEDGE', 'food', knowledge)
        else response = buildResponse('UNKNOWN', 'general', 'Mình có thể giúp bạn tìm món, kiểm tra đơn hàng, ví hoặc hỗ trợ khiếu nại. Bạn thử hỏi theo cách tự nhiên như “Tối nay ăn gì?”, “Món bò dưới 70k”, hoặc “Đơn của tôi đâu?”')
      }
    }

    if (currentFood) {
      req.session.chatContext = { ...(req.session.chatContext || {}), lastFoodId: currentFood.id }
    }
    req.session.chatContext = { ...(req.session.chatContext || {}), lastIntent: intent }

    if (!response.quickActions) response.quickActions = getQuickActions()
    return res.json(response)
  } catch (error) {
    console.error('chat error', error)
    return res.status(500).json({ ok: false, reply: 'Xin lỗi, hiện tại mình chưa thể xử lý yêu cầu này. Bạn thử lại sau hoặc liên hệ bộ phận chăm sóc khách hàng.' })
  }
}

async function generalFoodKnowledge(text) {
  const norm = normalize(text)

  if (norm.includes('pizza') && norm.includes('la gi')) {
    return 'Pizza là một món ăn nổi tiếng có nguồn gốc từ Ý, thường là bánh mỏng phủ sốt cà chua, phô mai và các nguyên liệu như xúc xích, nấm, rau, hải sản. Nó rất đa dạng và phù hợp cho nhiều sở thích.'
  }

  if (norm.includes('sushi') && norm.includes('la gi')) {
    return 'Sushi là món ăn Nhật Bản làm từ cơm trộn giấm kết hợp với cá, hải sản hoặc rau. Nó là món ăn rất phổ biến với hương vị thanh và tươi.'
  }

  if (norm.includes('bulgogi') && norm.includes('la gi')) {
    return 'Bulgogi là món thịt bò nướng kiểu Hàn Quốc, thường được ướp với sốt gia vị, có vị ngọt, mặn và thơm. Đây là món ăn nổi tiếng và rất được yêu thích.'
  }

  if (norm.includes('tokbokki') && norm.includes('la gi')) {
    return 'Tokbokki là món bánh gạo cay kiểu Hàn Quốc, thường ăn với sốt cay và có texture dai, thơm. Nó rất phù hợp cho những ai thích món có vị cay.'
  }

  if (norm.includes('pho') && norm.includes('nguon goc')) {
    return 'Phở là món ăn truyền thống của Việt Nam, nổi tiếng là món nước dùng thơm và bánh phở mềm. Nó có nguồn gốc từ miền Bắc Việt Nam và được ưa chuộng trên toàn quốc.'
  }

  if ((norm.includes('han') || norm.includes('hàn')) && norm.includes('cay')) {
    return 'Món Hàn cay thường rất phổ biến như bibimbap có thể thêm cay, kimchi, tokbokki, hoặc các món nướng có gia vị cay. Nếu bạn thích vị cay, có thể tìm món có sốt cay hoặc kimchi.'
  }

  if (norm.includes('trời nong') || norm.includes('troi nong') || norm.includes('nóng')) {
    return 'Khi trời nóng, bạn nên chọn món mát, thanh đạm và dễ tiêu như gỏi, salad, rau xanh, đồ uống mát, hoặc món có nhiều rau và ít dầu.'
  }

  if (norm.includes('nhiều protein') || norm.includes('nhieu protein')) {
    return 'Nếu muốn nhiều protein, các món có thịt, hải sản, trứng, đậu hoặc các món nướng thường phù hợp hơn. Bạn nên ưu tiên thực phẩm giàu đạm nhưng vẫn kết hợp với rau củ.'
  }

  if (norm.includes('it dau') || norm.includes('ít dầu') || norm.includes('nhe bung')) {
    return 'Nếu muốn món nhẹ bụng, hãy ưu tiên món nướng, hấp, salad, rau củ, hoặc món vừa có protein vừa ít dầu. Đa phần thực phẩm tươi sống sẽ phù hợp hơn.'
  }

  return null
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

module.exports = {
  chat,
  train,
  createSupportTicket
}
