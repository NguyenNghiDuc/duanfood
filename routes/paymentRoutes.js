const express=require('express')
const router=express.Router()
const payment=require('../controllers/paymentController')
const {requireLogin}=require('../middleware/auth')
router.get('/payments/vnpay/create/:orderId',requireLogin,payment.create)
router.get('/payments/vnpay/return',payment.callback)
router.get('/payments/vnpay/ipn',payment.ipn)
module.exports=router
