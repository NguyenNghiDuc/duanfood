const db = require("../config/db");

function normalizeLearningText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .trim();
}

function buildLearningKey(text) {
  return normalizeLearningText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function shouldStoreLearningRecord(text) {
  const value = normalizeLearningText(text);

  if (!value) return false;

  const sensitive = [
    "password",
    "mat khau",
    "api key",
    "apikey",
    "token",
    "secret",
    "otp",
    "credit card",
    "so tai khoan",
    "stk"
  ];

  return !sensitive.some((x) => value.includes(x));
}

async function ensureLearningSchema() {
  await db.ready();

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_memory (
      id INTEGER PRIMARY KEY,
      key_text TEXT NOT NULL UNIQUE,
      intent TEXT,
      entity TEXT,
      value_text TEXT,
      source TEXT DEFAULT 'conversation',
      confidence REAL DEFAULT 0.5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id INTEGER PRIMARY KEY,
      conversation_key TEXT,
      intent TEXT,
      feedback TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_corrections (
      id INTEGER PRIMARY KEY,
      question TEXT,
      ai_answer TEXT,
      admin_correction TEXT,
      intent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY,
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
  `).catch(() => {});
}

async function learnFromConversation({
  username,
  sessionKey,
  inputText,
  intent,
  entity,
  responseText,
  confidence = 0.7
}) {
  if (!shouldStoreLearningRecord(inputText)) {
    return null;
  }

  await ensureLearningSchema();

  const key = buildLearningKey(inputText);

  if (!key) return null;

  await db.query(`
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
  `, [
    key,
    intent || "UNKNOWN",
    entity || null,
    String(responseText || ""),
    "conversation",
    confidence
  ]).catch(async () => {
    // MySQL fallback
    await db.query(`
      INSERT IGNORE INTO ai_memory
      (
        key_text,
        intent,
        entity,
        value_text,
        source,
        confidence
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      key,
      intent || "UNKNOWN",
      entity || null,
      String(responseText || ""),
      "conversation",
      confidence
    ]);
  });

  await db.query(`
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
  `, [
    username || null,
    sessionKey || null,
    String(inputText || ""),
    intent || "UNKNOWN",
    entity || null,
    String(responseText || ""),
    confidence
  ]);

  return {
    key
  };
}

async function learnFromFeedback({
  conversationKey,
  intent,
  feedback,
  reason
}) {
  await ensureLearningSchema();

  await db.query(`
    INSERT INTO ai_feedback
    (
      conversation_key,
      intent,
      feedback,
      reason
    )
    VALUES (?, ?, ?, ?)
  `, [
    conversationKey,
    intent || "UNKNOWN",
    feedback || "neutral",
    reason || null
  ]);

  return true;
}

async function learnFromCorrection({
  question,
  aiAnswer,
  adminCorrection,
  intent
}) {
  if (
    !shouldStoreLearningRecord(question) ||
    !shouldStoreLearningRecord(adminCorrection)
  ) {
    return null;
  }

  await ensureLearningSchema();

  await db.query(`
    INSERT INTO ai_corrections
    (
      question,
      ai_answer,
      admin_correction,
      intent
    )
    VALUES (?, ?, ?, ?)
  `, [
    question,
    aiAnswer,
    adminCorrection,
    intent || "UNKNOWN"
  ]);

  return true;
}

async function getRelevantKnowledge(text) {
  await ensureLearningSchema();

  const normalized = normalizeLearningText(text);

  if (!normalized) return [];

  const like = `%${normalized}%`;

  const [rows] = await db.query(`
    SELECT *
    FROM ai_memory
    WHERE
      LOWER(key_text) LIKE ?
      OR LOWER(value_text) LIKE ?
    ORDER BY confidence DESC, id DESC
    LIMIT 10
  `, [
    like,
    like
  ]);

  return rows;
}

module.exports = {
  normalizeLearningText,
  buildLearningKey,
  shouldStoreLearningRecord,
  ensureLearningSchema,
  learnFromConversation,
  learnFromFeedback,
  learnFromCorrection,
  getRelevantKnowledge
};