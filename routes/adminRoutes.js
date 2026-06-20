const express = require('express')
const router = express.Router()
const adminController = require('../controllers/adminController')
const { requireLogin } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/admin')

router.get('/orders', requireLogin, requireAdmin, adminController.listOrders)
router.get('/categories', requireLogin, requireAdmin, adminController.showCategories)
router.post('/categories/add', requireLogin, requireAdmin, adminController.addCategory)
router.post('/categories/delete/:id', requireLogin, requireAdmin, adminController.deleteCategory)
router.get('/stats', requireLogin, requireAdmin, adminController.showStats)
router.get('/foods/add', requireLogin, requireAdmin, adminController.showAddFood)
router.post('/foods/add', requireLogin, requireAdmin, adminController.addFood)
router.post('/foods/delete/:id', requireLogin, requireAdmin, adminController.deleteFood)
router.get('/foods/edit/:id', requireLogin, requireAdmin, adminController.showEditFood)
router.post('/foods/edit/:id', requireLogin, requireAdmin, adminController.updateFood)

module.exports = router
