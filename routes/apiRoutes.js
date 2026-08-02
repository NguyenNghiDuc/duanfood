const express = require('express')
const router = express.Router()
const { chat, train } = require('../controllers/chatController')
const cartController = require('../controllers/cartController')

router.post('/train-chat', express.json(), train)
router.post('/cart/add/:id', express.json(), cartController.addToCartApi)
router.get('/cart/summary', cartController.getCartSummaryApi)

module.exports = router
