const express = require('express')
const router = express.Router()
const { chat, train } = require('../controllers/chatController')
const cartController = require('../controllers/cartController')
const aiLearningService = require('../lib/aiLearningService')
const foodAssistant = require('../lib/foodAssistant')
const upload = require('../middleware/upload')
const { requireAdmin } = require('../middleware/admin')

router.post('/chat', upload.single('image'), foodAssistant.middleware, chat)
router.post('/train-chat', requireAdmin, express.json(), train)
router.post('/cart/add/:id', express.json(), cartController.addToCartApi)
router.get('/cart/summary', cartController.getCartSummaryApi)

router.post('/ai/feedback', express.json(), async (req, res) => {
  try {
    const { conversationKey, intent, feedback, reason } = req.body || {}
    await aiLearningService.learnFromFeedback({ conversationKey, intent, feedback, reason })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Không thể lưu phản hồi.' })
  }
})

router.post('/ai/correction', requireAdmin, express.json(), async (req, res) => {
  try {
    const { question, aiAnswer, adminCorrection, intent } = req.body || {}
    if (!String(question || '').trim() || !String(adminCorrection || '').trim()) {
      return res.status(400).json({ ok: false, error: 'Thiếu câu hỏi hoặc nội dung sửa.' })
    }
    await aiLearningService.learnFromCorrection({ question, aiAnswer, adminCorrection, intent })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Không thể lưu bản sửa AI.' })
  }
})

module.exports = router
