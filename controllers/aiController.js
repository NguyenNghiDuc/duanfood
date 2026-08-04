const {
  askFoodAI
} = require("../services/aiFoodService");

const {
  learnFromConversation,
  learnFromFeedback,
  learnFromCorrection
} = require("../services/aiLearning");

/* =================================
   CHAT AI
================================= */

async function chat(req, res) {
  try {
    const message =
      req.body.message ||
      req.body.question ||
      req.body.text ||
      "";

    if (!message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bạn chưa nhập câu hỏi."
      });
    }

    const username =
      req.user?.username ||
      req.session?.user?.username ||
      null;

    const sessionKey =
      req.body.sessionKey ||
      req.sessionID ||
      null;

    const result = await askFoodAI(message);

    await learnFromConversation({
      username,
      sessionKey,
      inputText: message,
      intent: result.analysis.intent,
      entity: JSON.stringify({
        category: result.analysis.category,
        ingredient: result.analysis.ingredient,
        minPrice: result.analysis.minPrice,
        maxPrice: result.analysis.maxPrice,
        sort: result.analysis.sort
      }),
      responseText: result.answer,
      confidence: result.foods.length ? 0.95 : 0.5
    });

    return res.json({
      success: true,

      answer: result.answer,

      message: result.answer,

      intent: result.analysis.intent,

      analysis: result.analysis,

      foods: result.foods,

      count: result.foods.length
    });

  } catch (error) {
    console.error("AI CHAT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "AI đang gặp lỗi khi xử lý câu hỏi.",
      error: error.message
    });
  }
}

/* =================================
   FEEDBACK
================================= */

async function feedback(req, res) {
  try {
    await learnFromFeedback({
      conversationKey:
        req.body.conversationKey ||
        req.body.question ||
        "",
      intent:
        req.body.intent ||
        "UNKNOWN",
      feedback:
        req.body.feedback ||
        "neutral",
      reason:
        req.body.reason ||
        null
    });

    return res.json({
      success: true,
      message: "Đã lưu feedback."
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không lưu được feedback."
    });
  }
}

/* =================================
   ADMIN CORRECTION
================================= */

async function correction(req, res) {
  try {
    await learnFromCorrection({
      question: req.body.question,
      aiAnswer: req.body.aiAnswer,
      adminCorrection: req.body.adminCorrection,
      intent: req.body.intent
    });

    return res.json({
      success: true,
      message: "Đã lưu câu trả lời sửa."
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Không lưu được correction."
    });
  }
}

module.exports = {
  chat,
  feedback,
  correction
};