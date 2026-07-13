const express = require('express')
const router = express.Router()
const cartController = require('../controllers/cartController')
const { requireLogin } = require('../middleware/auth')

router.get('/checkout', requireLogin, cartController.showCheckout)
router.post('/checkout', requireLogin, cartController.placeOrder)
router.get('/orders', requireLogin, cartController.listOrders)

module.exports = router