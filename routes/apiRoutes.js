const express = require('express')
const router = express.Router()
const { chat, train } = require('../controllers/chatController')
const cartController = require('../controllers/cartController')
const aiLearningService = require('../lib/aiLearningService')
const foodAssistant = require('../lib/foodAssistant')
const upload = require('../middleware/upload')
const { requireAdmin } = require('../middleware/admin')
const { requireLogin } = require('../middleware/auth')
const { rateLimit } = require('../middleware/rateLimit')

router.post('/chat', rateLimit({ max: 40, windowMs: 60_000, keyPrefix: 'chat' }), upload.single('image'), foodAssistant.middleware, chat)
router.post('/train-chat', requireAdmin, rateLimit({ max: 10, windowMs: 60_000, keyPrefix: 'train' }), express.json(), train)
router.post('/cart/add/:id', requireLogin, rateLimit({ max: 50, windowMs: 60_000, keyPrefix: 'cart-api' }), express.json(), cartController.addToCartApi)
router.get('/cart/summary', requireLogin, cartController.getCartSummaryApi)

router.post('/ai/feedback', rateLimit({ max: 30, windowMs: 60_000, keyPrefix: 'ai-feedback' }), express.json(), async (req,res)=>{
  try{const {conversationKey,intent,feedback,reason}=req.body||{};await aiLearningService.learnFromFeedback({conversationKey,intent,feedback,reason});res.json({ok:true})}catch(error){res.status(500).json({ok:false,error:'Không thể lưu phản hồi.'})}
})
router.post('/ai/correction',requireAdmin,rateLimit({max:20,windowMs:60_000,keyPrefix:'ai-correction'}),express.json(),async(req,res)=>{
  try{const {question,aiAnswer,adminCorrection,intent}=req.body||{};if(!String(question||'').trim()||!String(adminCorrection||'').trim())return res.status(400).json({ok:false,error:'Thiếu câu hỏi hoặc nội dung sửa.'});await aiLearningService.learnFromCorrection({question,aiAnswer,adminCorrection,intent});res.json({ok:true})}catch(error){res.status(500).json({ok:false,error:'Không thể lưu bản sửa AI.'})}
})
module.exports=router
