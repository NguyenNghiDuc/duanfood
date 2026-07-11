const express = require('express')
const router = express.Router()
const foodController = require('../controllers/foodController')
const promotionController = require('../controllers/promotionController')
const { requireLogin } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/admin')
router.get('/', foodController.showHome)
router.get('/foods', foodController.showFoods)
router.get('/foods/:id', foodController.showFoodDetail)
router.post(
  '/foods/:id/review',
  requireLogin,
  foodController.createReview
)
router.get('/categories', foodController.showCategories)
router.get('/promotion', promotionController.showPromotion)
router.post('/promotion/add', requireLogin, requireAdmin, promotionController.store)
router.post('/promotion/:id/delete', requireLogin, requireAdmin, promotionController.remove)
router.get('/about', foodController.showAbout)
router.get('/contact', foodController.showContact)
router.get('/menu', foodController.redirectMenu)

module.exports = router