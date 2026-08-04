const db = require("../config/db");

function normalizeLearningText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildLearningKey(text) {
  return normalizeLearningText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_key TEXT,
      intent TEXT,
      feedback TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT,
      ai_answer TEXT,
      admin_correction TEXT,
      intent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
  `);

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
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      username TEXT,
      last_question TEXT,
      last_intent TEXT,
      last_foods TEXT,
      last_food_id INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function saveConversation(data) {
  await ensureLearningSchema();

  const {
    username,
    sessionKey,
    inputText,
    intent,
    entity,
    responseText,
    confidence = 0.5,
  } = data;

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
      inputText || "",
      intent || "UNKNOWN",
      entity || null,
      responseText || "",
      Number(confidence),
    ]
  );
}

async function saveMemory({
  inputText,
  intent,
  entity,
  valueText,
  source = "conversation",
  confidence = 0.5,
}) {
  await ensureLearningSchema();

  const key = buildLearningKey(inputText);

  if (!key) return;

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
      valueText || inputText || "",
      source,
      Number(confidence),
    ]
  );
}

async function getRelevantKnowledge(text) {
  await ensureLearningSchema();

  const value = normalizeLearningText(text);

  if (!value) return [];

  const words = value
    .split(/\s+/)
    .filter(x => x.length >= 2);

  if (!words.length) return [];

  const conditions = [];
  const params = [];

  for (const word of words) {
    conditions.push(`
      key_text LIKE ?
      OR value_text LIKE ?
    `);

    const like = `%${word}%`;

    params.push(like, like);
  }

  const [rows] = await db.query(
    `
    SELECT *
    FROM ai_memory
    WHERE ${conditions.join(" OR ")}
    ORDER BY confidence DESC, id DESC
    LIMIT 20
    `,
    params
  );

  return rows;
}

async function saveFeedback({
  conversationKey,
  intent,
  feedback,
  reason,
}) {
  await ensureLearningSchema();

  await db.query(
    `
    INSERT INTO ai_feedback
      (conversation_key, intent, feedback, reason)
    VALUES (?, ?, ?, ?)
    `,
    [
      conversationKey || "",
      intent || "UNKNOWN",
      feedback || "neutral",
      reason || null,
    ]
  );

  if (feedback === "positive") {
    await db.query(
      `
      INSERT INTO ai_training_examples
      (input_text, intent, entities, confidence, source)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        conversationKey || "",
        intent || "UNKNOWN",
        JSON.stringify({ feedback: "positive" }),
        0.95,
        "positive_feedback",
      ]
    );
  }
}

async function saveCorrection({
  question,
  aiAnswer,
  adminCorrection,
  intent,
}) {
  await ensureLearningSchema();

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
      question || "",
      aiAnswer || "",
      adminCorrection || "",
      intent || "UNKNOWN",
    ]
  );

  await saveMemory({
    inputText: question,
    intent: intent || "UNKNOWN",
    entity: "correction",
    valueText: adminCorrection,
    source: "admin_correction",
    confidence: 1,
  });
}

async function getCorrectionsFor(text) {
  await ensureLearningSchema();

  const normalized = normalizeLearningText(text);

  const words = normalized
    .split(/\s+/)
    .filter(x => x.length >= 2);

  if (!words.length) return [];

  const conditions = [];
  const params = [];

  for (const word of words) {
    const like = `%${word}%`;

    conditions.push(`
      LOWER(question) LIKE ?
      OR LOWER(ai_answer) LIKE ?
    `);

    params.push(like, like);
  }

  const [rows] = await db.query(
    `
    SELECT *
    FROM ai_corrections
    WHERE ${conditions.join(" OR ")}
    ORDER BY id DESC
    LIMIT 10
    `,
    params
  );

  return rows;
}

async function saveContext({
  sessionKey,
  username,
  question,
  intent,
  foods,
  lastFoodId,
}) {
  await ensureLearningSchema();

  await db.query(
    `
    DELETE FROM ai_context
    WHERE session_key = ?
    `,
    [sessionKey]
  );

  await db.query(
    `
    INSERT INTO ai_context
    (
      session_key,
      username,
      last_question,
      last_intent,
      last_foods,
      last_food_id
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      sessionKey,
      username || null,
      question || "",
      intent || "UNKNOWN",
      JSON.stringify(foods || []),
      lastFoodId || null,
    ]
  );
}

async function getContext(sessionKey) {
  await ensureLearningSchema();

  const [rows] = await db.query(
    `
    SELECT *
    FROM ai_context
    WHERE session_key = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [sessionKey]
  );

  if (!rows[0]) return null;

  return {
    ...rows[0],
    last_foods: (() => {
      try {
        return JSON.parse(rows[0].last_foods || "[]");
      } catch {
        return [];
      }
    })(),
  };
}

async function getFeedbackStats() {
  await ensureLearningSchema();

  const [rows] = await db.query(`
    SELECT
      feedback,
      COUNT(*) AS total
    FROM ai_feedback
    GROUP BY feedback
  `);

  return rows;
}

module.exports = {
  normalizeLearningText,
  buildLearningKey,
  ensureLearningSchema,
  saveConversation,
  saveMemory,
  getRelevantKnowledge,
  saveFeedback,
  saveCorrection,
  getCorrectionsFor,
  saveContext,
  getContext,
  getFeedbackStats,
};