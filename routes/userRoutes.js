const express = require('express')
const router = express.Router()
const userController = require('../controllers/userController')
const { requireLogin } = require('../middleware/auth')
const { registerValidation, loginValidation, handleValidationErrors } = require('../middleware/validation')

router.get('/register', userController.showRegister)
router.post('/register', registerValidation, handleValidationErrors, userController.register)
router.get('/login', userController.showLogin)
router.post('/login', loginValidation, handleValidationErrors, userController.login)
router.get('/logout', userController.logout)
router.get('/bank', requireLogin, userController.showBank)
router.post('/payment-success', requireLogin, userController.paymentSuccess)
router.get('/wallet', requireLogin, userController.showWalletTopUp)
router.get('/wallet/top-up', requireLogin, userController.showWalletTopUp)
router.post('/wallet/top-up', requireLogin, userController.walletTopUp)

module.exports = router
