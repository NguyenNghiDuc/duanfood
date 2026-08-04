const {
  askFoodAI,
  findFoods,
  suggestCombos,
  analyzeQuestion,
  fuzzySearch,
  suggestAlternatives,
  analyzeReviews,
  calculateCart
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
  correction,
  search,
  combo,
  parse,
  cartCalc,
  alternatives,
  reviewAnalysis
};

async function cartCalc(req, res) {
  try {
    const items = req.body.items || [];
    const deliveryCompanyId = req.body.deliveryCompanyId || req.query.deliveryCompanyId || null;

    const result = await calculateCart(items, deliveryCompanyId);

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("CART CALC ERROR:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi tính giỏ hàng.", error: error.message });
  }
}

async function alternatives(req, res) {
  try {
    const foodId = req.params.id || req.body.foodId || req.query.foodId;
    if (!foodId) return res.status(400).json({ success: false, message: 'Thiếu foodId.' });

    const list = await suggestAlternatives(foodId);

    return res.json({ success: true, alternatives: list });
  } catch (error) {
    console.error("ALTERNATIVES ERROR:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi lấy món tương tự.", error: error.message });
  }
}

async function reviewAnalysis(req, res) {
  try {
    const foodId = req.params.id || req.body.foodId || req.query.foodId;
    if (!foodId) return res.status(400).json({ success: false, message: 'Thiếu foodId.' });

    const summary = await analyzeReviews(foodId);

    return res.json({ success: true, summary });
  } catch (error) {
    console.error("REVIEW ANALYSIS ERROR:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi phân tích review.", error: error.message });
  }
}

// Additional AI endpoints
async function search(req, res) {
  try {
    const text = req.body.query || req.body.text || req.body.message || "";

    if (!text.trim()) {
      return res.status(400).json({ success: false, message: "Bạn chưa nhập truy vấn tìm kiếm." });
    }

    const result = await findFoods(text);

    return res.json({ success: true, analysis: result.analysis, foods: result.foods, count: result.foods.length });
  } catch (error) {
    console.error("AI SEARCH ERROR:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi tìm món.", error: error.message });
  }
}

async function combo(req, res) {
  try {
    const budget = Number(req.body.budget || req.query.budget || 0) || 0;
    const people = Number(req.body.people || req.query.people || 1) || 1;

    if (!budget || budget <= 0) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp ngân sách hợp lệ." });
    }

    const combos = await suggestCombos(budget, people);

    return res.json({ success: true, budget, people, combos });
  } catch (error) {
    console.error("AI COMBO ERROR:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi tạo gợi ý combo.", error: error.message });
  }
}

async function parse(req, res) {
  try {
    const text = req.body.text || req.body.query || req.body.message || "";

    if (!text.trim()) {
      return res.status(400).json({ success: false, message: "Bạn chưa nhập văn bản để phân tích." });
    }

    const analysis = analyzeQuestion(text);

    return res.json({ success: true, analysis });
  } catch (error) {
    console.error("AI PARSE ERROR:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi phân tích câu hỏi.", error: error.message });
  }
}