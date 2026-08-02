const express = require('express')
const router = express.Router()
const { chat, train } = require('../controllers/chatController')
const cartController = require('../controllers/cartController')
const aiLearningService = require('../lib/aiLearningService')

router.post('/train-chat', express.json(), train)
router.post('/cart/add/:id', express.json(), cartController.addToCartApi)
router.get('/cart/summary', cartController.getCartSummaryApi)
router.post('/ai/feedback', express.json(), async (req, res) => {
  try {
    const { conversationKey, intent, feedback, reason } = req.body || {}
    await aiLearningService.learnFromFeedback({ conversationKey, intent, feedback, reason })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})
router.post('/ai/correction', express.json(), async (req, res) => {
  try {
    const { question, aiAnswer, adminCorrection, intent } = req.body || {}
    await aiLearningService.learnFromCorrection({ question, aiAnswer, adminCorrection, intent })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

module.exports = router
