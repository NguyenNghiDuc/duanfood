const fs = require('fs').promises
const path = require('path')
const foodModel = require('../models/foodModels')

const DATA_DIR = path.join(__dirname, '..', 'data')
const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data')
const INDEX_PATH = path.join(DATA_DIR, 'chat-index.json')
const PUBLIC_INDEX_PATH = path.join(PUBLIC_DATA_DIR, 'chat-index.json')

function normalize(text) {
  return String(text || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

async function buildIndex() {
  console.log('🤖 Đang huấn luyện chatbot...')

  const foods = await foodModel.getFoods({})
  const orderCounts = await foodModel.getFoodOrderCounts()

  const items = (foods || []).map((f) => {
    const title = f.title || ''
    const description = f.description || ''
    const category = f.category_name || f.category || ''
    const price = Number(f.price || 0)

    const rawText = [
      title,
      description,
      category,
      price
    ].join(' ')

    return {
      id: f.id,
      title,
      description,
      category_id: f.category_id || null,
      category,
      price,
      image: f.image || '',
      url: `/foods/${f.id}`,
      order_count: orderCounts[f.id] || 0,
      text: normalize(rawText)
    }
  })

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true })

  await fs.writeFile(INDEX_PATH, JSON.stringify(items, null, 2), 'utf8')
  await fs.writeFile(PUBLIC_INDEX_PATH, JSON.stringify(items, null, 2), 'utf8')

  console.log(`✅ Huấn luyện xong: ${items.length} món ăn`)

  return items
}

async function loadIndex() {
  try {
    const raw = await fs.readFile(
      INDEX_PATH,
      'utf8'
    )

    const data = JSON.parse(raw)

    console.log(
      `🤖 Đã tải ${data.length} món ăn từ chatbot`
    )

    return data
  } catch (error) {
    console.log(
      '⚠️ Chưa có chat-index.json'
    )

    return []
  }
}

module.exports = {
  buildIndex,
  loadIndex
}