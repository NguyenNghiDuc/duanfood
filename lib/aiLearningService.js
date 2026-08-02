const db = require('../config/db')

function normalizeLearningText(text) {
  return String(text || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function buildLearningKey(text) {
  return normalizeLearningText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function shouldStoreLearningRecord(text) {
  const value = normalizeLearningText(text || '')
  if (!value) return false
  if (/(^|\s)(password|api key|token|secret|otp|apikey)(\s|$)/.test(value)) return false
  if (/(^|\s)(mat khau|mật khẩu|token|otp|thanh toan|thanh toán|card|credit|bank|stk|so tai khoan|số tài khoản)(\s|$)/.test(value)) return false
  return true
}

async function ensureLearningSchema() {
  await db.query(`CREATE TABLE IF NOT EXISTS ai_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_text TEXT NOT NULL UNIQUE,
    intent TEXT,
    entity TEXT,
    value_text TEXT,
    source TEXT DEFAULT 'conversation',
    confidence REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await db.query(`CREATE TABLE IF NOT EXISTS ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_key TEXT,
    intent TEXT,
    feedback TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await db.query(`CREATE TABLE IF NOT EXISTS ai_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT,
    ai_answer TEXT,
    admin_correction TEXT,
    intent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await db.query(`CREATE TABLE IF NOT EXISTS ai_training_examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input_text TEXT NOT NULL,
    intent TEXT NOT NULL,
    entities TEXT,
    confidence REAL DEFAULT 0.8,
    source TEXT DEFAULT 'conversation',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  await db.query(`CREATE TABLE IF NOT EXISTS ai_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    session_key TEXT,
    input_text TEXT,
    intent TEXT,
    entity TEXT,
    response_text TEXT,
    feedback TEXT,
    confidence REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)
}

async function learnFromConversation({ username, sessionKey, inputText, intent, entity, responseText, confidence = 0.5 }) {
  if (!shouldStoreLearningRecord(inputText) && !shouldStoreLearningRecord(responseText)) return null
  await ensureLearningSchema()

  const key = buildLearningKey(inputText || responseText || '')
  if (!key) return null

  await db.query(`INSERT OR IGNORE INTO ai_memory (key_text, intent, entity, value_text, source, confidence) VALUES (?, ?, ?, ?, ?, ?)`, [
    key,
    intent || 'UNKNOWN',
    entity || null,
    String(inputText || '').trim(),
    'conversation',
    Number(confidence || 0.5)
  ])

  await db.query(`INSERT INTO ai_conversations (username, session_key, input_text, intent, entity, response_text, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    username || null,
    sessionKey || null,
    String(inputText || '').trim(),
    intent || 'UNKNOWN',
    entity || null,
    String(responseText || '').trim(),
    Number(confidence || 0.5)
  ])

  return { key }
}

async function learnFromFeedback({ conversationKey, intent, feedback, reason }) {
  if (!shouldStoreLearningRecord(conversationKey || '')) return null
  await ensureLearningSchema()
  await db.query(`INSERT INTO ai_feedback (conversation_key, intent, feedback, reason) VALUES (?, ?, ?, ?)`, [
    conversationKey || null,
    intent || 'UNKNOWN',
    feedback || 'neutral',
    reason || null
  ])

  if (feedback === 'positive') {
    await db.query(`INSERT OR IGNORE INTO ai_training_examples (input_text, intent, entities, confidence, source) VALUES (?, ?, ?, ?, ?)`, [
      conversationKey || '',
      intent || 'UNKNOWN',
      JSON.stringify({ feedback: 'positive' }),
      0.9,
      'feedback'
    ])
  }

  return true
}

async function learnFromCorrection({ question, aiAnswer, adminCorrection, intent }) {
  if (!shouldStoreLearningRecord(question) || !shouldStoreLearningRecord(aiAnswer) || !shouldStoreLearningRecord(adminCorrection)) return null
  await ensureLearningSchema()
  await db.query(`INSERT INTO ai_corrections (question, ai_answer, admin_correction, intent) VALUES (?, ?, ?, ?)`, [
    String(question || '').trim(),
    String(aiAnswer || '').trim(),
    String(adminCorrection || '').trim(),
    intent || 'UNKNOWN'
  ])

  await db.query(`INSERT OR IGNORE INTO ai_memory (key_text, intent, entity, value_text, source, confidence) VALUES (?, ?, ?, ?, ?, ?)`, [
    buildLearningKey(question || aiAnswer || ''),
    intent || 'UNKNOWN',
    'correction',
    String(adminCorrection || '').trim(),
    'admin_correction',
    0.95
  ])

  return true
}

async function learnFromFood({ title, description, category, price, ingredients }) {
  if (!shouldStoreLearningRecord(title) && !shouldStoreLearningRecord(description)) return null
  await ensureLearningSchema()
  const record = {
    title: String(title || '').trim(),
    description: String(description || '').trim(),
    category: String(category || '').trim(),
    price: Number(price || 0),
    ingredients: String(ingredients || '').trim()
  }
  const key = buildLearningKey(record.title || record.description || '')
  if (!key) return null

  await db.query(`INSERT OR IGNORE INTO ai_memory (key_text, intent, entity, value_text, source, confidence) VALUES (?, ?, ?, ?, ?, ?)`, [
    key,
    'FOOD_KNOWLEDGE',
    JSON.stringify({ category: record.category, ingredients: record.ingredients, price: record.price }),
    `${record.title} | ${record.description}`,
    'food_update',
    0.9
  ])

  return { key, record }
}

async function getRelevantKnowledge(text) {
  await ensureLearningSchema()
  const normalized = normalizeLearningText(text || '')
  if (!normalized) return []

  const [rows] = await db.query('SELECT * FROM ai_memory WHERE key_text LIKE ? OR value_text LIKE ? ORDER BY confidence DESC, id DESC LIMIT 10', [`%${normalized}%`, `%${normalized}%`])
  return rows
}

async function getCorrectionsFor(text) {
  await ensureLearningSchema()
  const [rows] = await db.query('SELECT * FROM ai_corrections WHERE question LIKE ? OR ai_answer LIKE ? ORDER BY id DESC LIMIT 10', [`%${String(text || '').trim()}%`, `%${String(text || '').trim()}%`])
  return rows
}

async function getFeedbackStats() {
  await ensureLearningSchema()
  const [rows] = await db.query('SELECT feedback, COUNT(*) AS total FROM ai_feedback GROUP BY feedback')
  return rows
}

module.exports = {
  buildLearningKey,
  shouldStoreLearningRecord,
  ensureLearningSchema,
  learnFromConversation,
  learnFromFeedback,
  learnFromCorrection,
  learnFromFood,
  getRelevantKnowledge,
  getCorrectionsFor,
  getFeedbackStats
}
