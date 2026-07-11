const express = require('express')
const router = express.Router()
const postController = require('../controllers/postController')
const { requireLogin } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/admin')

router.get('/news', postController.index)
router.get('/news/search', postController.search)
router.get('/news/add', requireLogin, requireAdmin, postController.create)
router.post('/news/add', requireLogin, requireAdmin, postController.store)
router.get('/news/:id/edit', requireLogin, requireAdmin, postController.edit)
router.post('/news/:id/edit', requireLogin, requireAdmin, postController.update)
router.post('/news/:id/delete', requireLogin, requireAdmin, postController.remove)
router.get('/news/:id', postController.show)

module.exports = router
