const db = require("../config/db")

// =====================================================
// NORMALIZE
// =====================================================

function normalizeLearningText(text) {
  return String(text || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

// =====================================================
// KEY
// =====================================================

function buildLearningKey(text) {
  return normalizeLearningText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

// =====================================================
// TOKEN
// =====================================================

function tokenize(text) {

  const normalized = normalizeLearningText(text)

  return normalized
    .split(/[^a-z0-9]+/)
    .map(x => x.trim())
    .filter(x => x.length >= 2)
}

// =====================================================
// STOP WORD
// =====================================================

const STOP_WORDS = new Set([
  "toi",
  "minh",
  "ban",
  "cho",
  "hoi",
  "la",
  "gi",
  "co",
  "khong",
  "nao",
  "mot",
  "mon",
  "an",
  "nay",
  "kia",
  "voi",
  "va",
  "hay",
  "the",
  "thi",
  "duoc",
  "khong",
  "muon",
  "can",
  "tim",
  "goi",
  "cho",
  "toi",
  "nhe",
  "a",
  "o",
  "nha"
])

function usefulTokens(text) {

  return tokenize(text)
    .filter(token => !STOP_WORDS.has(token))
}

// =====================================================
// SENSITIVE DATA
// =====================================================

function shouldStoreLearningRecord(text) {

  const value = normalizeLearningText(text)

  if (!value) return false

  const sensitivePatterns = [
    /\bpassword\b/,
    /\bapi\s*key\b/,
    /\bapikey\b/,
    /\bsecret\b/,
    /\btoken\b/,
    /\botp\b/,
    /\bmat\s*khau\b/,
    /\bthe\s*ngan\s*hang\b/,
    /\bso\s*tai\s*khoan\b/,
    /\bstk\b/,
    /\bcredit\s*card\b/,
    /\bcard\s*number\b/
  ]

  return !sensitivePatterns.some(regex =>
    regex.test(value)
  )
}

// =====================================================
// AI TABLES
// =====================================================

async function ensureLearningSchema() {

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_text TEXT NOT NULL UNIQUE,
      intent TEXT,
      entity TEXT,
      value_text TEXT,
      source TEXT DEFAULT 'conversation',
      confidence REAL DEFAULT 0.5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_key TEXT,
      intent TEXT,
      feedback TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT,
      ai_answer TEXT,
      admin_correction TEXT,
      intent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_training_examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_text TEXT NOT NULL,
      intent TEXT NOT NULL,
      entities TEXT,
      confidence REAL DEFAULT 0.8,
      source TEXT DEFAULT 'conversation',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
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
    )
  `)
}

// =====================================================
// LEARN CONVERSATION
// =====================================================

async function learnFromConversation({
  username,
  sessionKey,
  inputText,
  intent,
  entity,
  responseText,
  confidence = 0.5
}) {

  if (
    !shouldStoreLearningRecord(inputText) &&
    !shouldStoreLearningRecord(responseText)
  ) {
    return null
  }

  await ensureLearningSchema()

  const key = buildLearningKey(
    inputText || responseText || ""
  )

  if (!key) return null

  await db.query(
    `
    INSERT OR IGNORE INTO ai_memory
    (
      key_text,
      intent,
      entity,
      value_text,
      source,
      confidence
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      key,
      intent || "UNKNOWN",
      entity || null,
      String(inputText || "").trim(),
      "conversation",
      Number(confidence || 0.5)
    ]
  )

  await db.query(
    `
    INSERT INTO ai_conversations
    (
      username,
      session_key,
      input_text,
      intent,
      entity,
      response_text,
      confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      username || null,
      sessionKey || null,
      String(inputText || "").trim(),
      intent || "UNKNOWN",
      entity || null,
      String(responseText || "").trim(),
      Number(confidence || 0.5)
    ]
  )

  return { key }
}

// =====================================================
// FEEDBACK
// =====================================================

async function learnFromFeedback({
  conversationKey,
  intent,
  feedback,
  reason
}) {

  if (!shouldStoreLearningRecord(conversationKey)) {
    return null
  }

  await ensureLearningSchema()

  await db.query(
    `
    INSERT INTO ai_feedback
    (
      conversation_key,
      intent,
      feedback,
      reason
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      conversationKey || null,
      intent || "UNKNOWN",
      feedback || "neutral",
      reason || null
    ]
  )

  if (feedback === "positive") {

    await db.query(
      `
      INSERT OR IGNORE INTO ai_training_examples
      (
        input_text,
        intent,
        entities,
        confidence,
        source
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        conversationKey || "",
        intent || "UNKNOWN",
        JSON.stringify({
          feedback: "positive"
        }),
        0.95,
        "feedback"
      ]
    )
  }

  return true
}

// =====================================================
// ADMIN CORRECTION
// =====================================================

async function learnFromCorrection({
  question,
  aiAnswer,
  adminCorrection,
  intent
}) {

  if (
    !shouldStoreLearningRecord(question) ||
    !shouldStoreLearningRecord(aiAnswer) ||
    !shouldStoreLearningRecord(adminCorrection)
  ) {
    return null
  }

  await ensureLearningSchema()

  await db.query(
    `
    INSERT INTO ai_corrections
    (
      question,
      ai_answer,
      admin_correction,
      intent
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      String(question || "").trim(),
      String(aiAnswer || "").trim(),
      String(adminCorrection || "").trim(),
      intent || "UNKNOWN"
    ]
  )

  const key = buildLearningKey(
    question || aiAnswer || ""
  )

  if (key) {

    await db.query(
      `
      INSERT OR IGNORE INTO ai_memory
      (
        key_text,
        intent,
        entity,
        value_text,
        source,
        confidence
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        key,
        intent || "UNKNOWN",
        "correction",
        String(adminCorrection || "").trim(),
        "admin_correction",
        0.99
      ]
    )
  }

  return true
}

// =====================================================
// FOOD LEARNING
// =====================================================

async function learnFromFood({
  title,
  description,
  category,
  price,
  ingredients
}) {

  if (
    !shouldStoreLearningRecord(title) &&
    !shouldStoreLearningRecord(description)
  ) {
    return null
  }

  await ensureLearningSchema()

  const record = {
    title: String(title || "").trim(),
    description: String(description || "").trim(),
    category: String(category || "").trim(),
    price: Number(price || 0),
    ingredients: String(ingredients || "").trim()
  }

  const key = buildLearningKey(
    record.title ||
    record.description ||
    ""
  )

  if (!key) return null

  const foodData = JSON.stringify({
    title: record.title,
    description: record.description,
    category: record.category,
    price: record.price,
    ingredients: record.ingredients
  })

  await db.query(
    `
    INSERT OR IGNORE INTO ai_memory
    (
      key_text,
      intent,
      entity,
      value_text,
      source,
      confidence
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      key,
      "FOOD_KNOWLEDGE",
      record.category,
      foodData,
      "food_update",
      0.98
    ]
  )

  return {
    key,
    record
  }
}

// =====================================================
// FOOD SEARCH
// =====================================================

async function searchFoodsForAI(text) {

  const input = String(text || "").trim()

  if (!input) return []

  const tokens = usefulTokens(input)

  const normalized = normalizeLearningText(input)

  const conditions = []
  const params = []

  // Exact phrase
  conditions.push(`
    LOWER(f.title) LIKE ?
    OR LOWER(f.description) LIKE ?
    OR LOWER(COALESCE(f.ingredients, '')) LIKE ?
    OR LOWER(COALESCE(c.name, '')) LIKE ?
  `)

  const likeFull = `%${normalized}%`

  params.push(
    likeFull,
    likeFull,
    likeFull,
    likeFull
  )

  // Individual important words
  for (const token of tokens.slice(0, 8)) {

    conditions.push(`
      LOWER(f.title) LIKE ?
      OR LOWER(f.description) LIKE ?
      OR LOWER(COALESCE(f.ingredients, '')) LIKE ?
      OR LOWER(COALESCE(c.name, '')) LIKE ?
    `)

    const likeToken = `%${token}%`

    params.push(
      likeToken,
      likeToken,
      likeToken,
      likeToken
    )
  }

  const sql = `
    SELECT
      f.id,
      f.title,
      f.description,
      f.price,
      f.image,
      f.gram,
      f.ingredients,
      c.name AS category_name,

      COALESCE(
        AVG(r.rating),
        0
      ) AS avg_rating,

      COUNT(r.id) AS review_count

    FROM foods f

    LEFT JOIN categories c
      ON c.id = f.category_id

    LEFT JOIN reviews r
      ON r.food_id = f.id

    WHERE
      ${conditions.map(x => `(${x})`).join(" OR ")}

    GROUP BY f.id

    ORDER BY
      avg_rating DESC,
      f.id DESC

    LIMIT 20
  `

  try {

    const [rows] = await db.query(
      sql,
      params
    )

    return rows || []

  } catch (error) {

    console.error(
      "searchFoodsForAI:",
      error.message
    )

    return []
  }
}

// =====================================================
// GET ALL FOODS FOR AI
// =====================================================

async function getAllFoodsForAI() {

  try {

    const [rows] = await db.query(`
      SELECT
        f.id,
        f.title,
        f.description,
        f.price,
        f.image,
        f.gram,
        f.ingredients,
        c.name AS category_name,

        COALESCE(
          AVG(r.rating),
          0
        ) AS avg_rating,

        COUNT(r.id) AS review_count

      FROM foods f

      LEFT JOIN categories c
        ON c.id = f.category_id

      LEFT JOIN reviews r
        ON r.food_id = f.id

      GROUP BY f.id

      ORDER BY f.id DESC

      LIMIT 100
    `)

    return rows || []

  } catch (error) {

    console.error(
      "getAllFoodsForAI:",
      error.message
    )

    return []
  }
}

// =====================================================
// CATEGORY SEARCH
// =====================================================

async function searchCategoriesForAI(text) {

  const tokens = usefulTokens(text)

  if (!tokens.length) return []

  const conditions = []
  const params = []

  for (const token of tokens) {

    conditions.push(
      "LOWER(name) LIKE ?"
    )

    params.push(`%${token}%`)
  }

  try {

    const [rows] = await db.query(
      `
      SELECT *
      FROM categories
      WHERE ${conditions.join(" OR ")}
      ORDER BY id ASC
      LIMIT 20
      `,
      params
    )

    return rows || []

  } catch (error) {

    return []
  }
}

// =====================================================
// RELEVANT MEMORY
// =====================================================

async function getRelevantKnowledge(text) {

  await ensureLearningSchema()

  const normalized =
    normalizeLearningText(text)

  if (!normalized) return []

  const tokens =
    usefulTokens(text)

  const conditions = []
  const params = []

  // Full query
  conditions.push(`
    LOWER(key_text) LIKE ?
    OR LOWER(value_text) LIKE ?
  `)

  params.push(
    `%${normalized}%`,
    `%${normalized}%`
  )

  // Individual tokens
  for (const token of tokens.slice(0, 10)) {

    conditions.push(`
      LOWER(key_text) LIKE ?
      OR LOWER(value_text) LIKE ?
    `)

    params.push(
      `%${token}%`,
      `%${token}%`
    )
  }

  const [rows] = await db.query(
    `
    SELECT *
    FROM ai_memory

    WHERE
      ${conditions.map(x => `(${x})`).join(" OR ")}

    ORDER BY
      confidence DESC,
      id DESC

    LIMIT 30
    `,
    params
  )

  return rows || []
}

// =====================================================
// CORRECTIONS
// =====================================================

async function getCorrectionsFor(text) {

  await ensureLearningSchema()

  const normalized =
    normalizeLearningText(text)

  const tokens =
    usefulTokens(text)

  if (!normalized) return []

  const conditions = []
  const params = []

  conditions.push(`
    LOWER(question) LIKE ?
    OR LOWER(ai_answer) LIKE ?
    OR LOWER(admin_correction) LIKE ?
  `)

  params.push(
    `%${normalized}%`,
    `%${normalized}%`,
    `%${normalized}%`
  )

  for (const token of tokens.slice(0, 8)) {

    conditions.push(`
      LOWER(question) LIKE ?
      OR LOWER(ai_answer) LIKE ?
      OR LOWER(admin_correction) LIKE ?
    `)

    params.push(
      `%${token}%`,
      `%${token}%`,
      `%${token}%`
    )
  }

  const [rows] = await db.query(
    `
    SELECT *
    FROM ai_corrections

    WHERE
      ${conditions.map(x => `(${x})`).join(" OR ")}

    ORDER BY id DESC

    LIMIT 20
    `,
    params
  )

  return rows || []
}

// =====================================================
// FEEDBACK STATS
// =====================================================

async function getFeedbackStats() {

  await ensureLearningSchema()

  const [rows] = await db.query(`
    SELECT
      feedback,
      COUNT(*) AS total

    FROM ai_feedback

    GROUP BY feedback
  `)

  return rows || []
}

// =====================================================
// BUILD AI CONTEXT
// =====================================================

async function buildFoodAIContext(text) {

  const question = String(text || "").trim()

  const [
    foods,
    categories,
    knowledge,
    corrections
  ] = await Promise.all([
    searchFoodsForAI(question),
    searchCategoriesForAI(question),
    getRelevantKnowledge(question),
    getCorrectionsFor(question)
  ])

  // Nếu tìm không thấy từ khóa,
  // đưa danh sách món hiện có cho AI
  let fallbackFoods = []

  if (!foods.length) {
    fallbackFoods = await getAllFoodsForAI()
  }

  return {
    question,

    foods,

    fallbackFoods,

    categories,

    knowledge,

    corrections,

    foodCount:
      foods.length ||
      fallbackFoods.length
  }
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {

  normalizeLearningText,

  buildLearningKey,

  tokenize,

  usefulTokens,

  shouldStoreLearningRecord,

  ensureLearningSchema,

  learnFromConversation,

  learnFromFeedback,

  learnFromCorrection,

  learnFromFood,

  searchFoodsForAI,

  getAllFoodsForAI,

  searchCategoriesForAI,

  getRelevantKnowledge,

  getCorrectionsFor,

  getFeedbackStats,

  buildFoodAIContext
}