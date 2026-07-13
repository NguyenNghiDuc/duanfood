const express = require('express')
const router = express.Router()
const cartController = require('../controllers/cartController')
const { requireLogin } = require('../middleware/auth')

router.get('/cart', requireLogin, cartController.showCart)
router.post('/cart/add/:id', requireLogin, cartController.addToCart)
router.post('/cart/update/:id', requireLogin, cartController.updateCart)
router.post('/cart/remove/:id', requireLogin, cartController.removeFromCart)

module.exports = router
