const express = require('express')
const router = express.Router()
const foodController = require('../controllers/foodController')
const { requireLogin } = require('../middleware/auth')
router.get('/', foodController.showHome)
router.get('/foods', foodController.showFoods)
router.get('/foods/:id', foodController.showFoodDetail)
router.post(
  '/foods/:id/review',
  requireLogin,
  foodController.createReview
)
router.get('/categories', foodController.showCategories)
router.get('/promotion', foodController.showPromotion)
router.get('/about', foodController.showAbout)
router.get('/contact', foodController.showContact)
router.get('/menu', foodController.redirectMenu)

module.exports = router