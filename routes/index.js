const express = require('express')
const router = express.Router()

const foodRoutes = require('./foodRoutes')
const userRoutes = require('./userRoutes')
const cartRoutes = require('./cartRoutes')
const orderRoutes = require('./orderRoutes')
const postRoutes = require('./postRoutes')
const adminRoutes = require('./adminRoutes')
const addressRoutes = require('./addressRoutes')

router.use('/', foodRoutes)
router.use('/', userRoutes)
router.use('/', cartRoutes)
router.use('/', orderRoutes)
router.use('/', postRoutes)
router.use('/', addressRoutes)
router.use('/admin', adminRoutes)

module.exports = router
