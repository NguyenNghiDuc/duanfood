const userModel = require('../models/userModels')
const orderModel = require('../models/orderModels')
const topupService = require('../lib/topupService')
const commerce = require('../lib/commerceService')

async function showWallet(req,res,next){try{const currentUser=await userModel.findByUsername(req.session.user.username);if(currentUser)req.session.user.balance=Number(currentUser.balance||0);const topups=await topupService.listForUser(req.session.user.username);res.render('wallet',{error:null,success:req.query.success||null,user:req.session.user,topups})}catch(e){next(e)}}
async function createTopUp(req,res,next){try{const amount=topupService.validAmount(req.body.amount);if(!amount){const topups=await topupService.listForUser(req.session.user.username);return res.status(400).render('wallet',{error:'Số tiền nạp phải từ 1.000đ đến 100.000.000đ.',success:null,user:req.session.user,topups})}const request=await topupService.createRequest(req.session.user.username,amount);return res.redirect(`/bank?topupId=${request.id}`)}catch(e){next(e)}}
async function showBank(req,res,next){
  try{
    const topupId=Number(req.query.topupId||0)
    if(topupId){const request=await topupService.getById(topupId);if(!request||request.username!==req.session.user.username)return res.status(404).send('Không tìm thấy yêu cầu nạp tiền');return res.render('bank',{orderId:null,totalPrice:Number(request.amount),topUpAmount:Number(request.amount),topupRequest:request,user:req.session.user})}
    const orderId=Number(req.query.orderId||0)
    if(orderId){const order=await orderModel.getOrderById(orderId);if(!order||order.username!==req.session.user.username)return res.status(404).send('Không tìm thấy đơn hàng');const totalPrice=Math.max(0,Number(order.total||0)+Number(order.shipping_fee||0)-Number(order.discount_amount||0));return res.render('bank',{orderId,totalPrice,topUpAmount:0,topupRequest:null,user:req.session.user})}
    res.redirect('/wallet/top-up')
  }catch(e){next(e)}
}
async function confirmTransfer(req,res,next){
  try{
    const topupId=Number(req.body.topupId||0)
    if(topupId){const request=await topupService.getById(topupId);if(!request||request.username!==req.session.user.username)return res.status(404).send('Không tìm thấy yêu cầu nạp tiền');return res.redirect('/wallet/top-up?success='+encodeURIComponent('Đã gửi yêu cầu. Tiền chỉ được cộng sau khi shop xác nhận đã nhận chuyển khoản.'))}
    const orderId=Number(req.body.orderId||0)
    if(orderId){const order=await orderModel.getOrderById(orderId);if(!order||order.username!==req.session.user.username)return res.status(404).send('Không tìm thấy đơn hàng');await orderModel.updateOrderStatusForUser(orderId,req.session.user.username,'Chờ xác nhận thanh toán');await commerce.notify(req.session.user.username,'Đã gửi xác nhận chuyển khoản',`Shop sẽ kiểm tra giao dịch cho đơn #${orderId}.`,`/orders/${orderId}/timeline`);return res.redirect('/orders')}
    res.redirect('/wallet/top-up')
  }catch(e){next(e)}
}
module.exports={showWallet,createTopUp,showBank,confirmTransfer}
