const express = require('express')
const router = express.Router()
const postController = require('../controllers/postController')
const { requireLogin } = require('../middleware/auth')

router.get('/news', postController.index)
router.get('/news/search', postController.search)
router.get('/news/add', requireLogin, postController.create)
router.post('/news/add', requireLogin, postController.store)
router.get('/news/:id/edit', requireLogin, postController.edit)
router.post('/news/:id/edit', requireLogin, postController.update)
router.post('/news/:id/delete', requireLogin, postController.remove)
router.get('/news/:id', postController.show)

module.exports = router
