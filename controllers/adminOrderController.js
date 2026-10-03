const orderModel = require('../models/orderModels')
const walletLedger = require('../lib/walletLedger')
const commerce = require('../lib/commerceService')

const ALLOWED = ['Chờ xác nhận','Đang chuẩn bị','Đang giao','Đã giao','Đã hủy','Đã thanh toán','Đã thanh toán bằng ví']

async function updateStatus(req,res,next){
  try{
    const status=String(req.body.status||'').trim();if(!ALLOWED.includes(status))return res.status(400).send('Trạng thái không hợp lệ')
    const order=await orderModel.getOrderById(req.params.id);if(!order)return res.status(404).send('Không tìm thấy đơn hàng')
    if(status==='Đã hủy'&&order.status!=='Đã hủy')await walletLedger.refundOrder(order,req.session.user.username)
    await orderModel.updateOrderStatus(order.id,status)
    await commerce.notify(order.username,'Cập nhật đơn hàng',`Đơn #${order.id}: ${status}.`,`/orders/${order.id}/timeline`)
    await commerce.audit(req.session.user.username,'update_order_status','order',order.id,`${order.status} -> ${status}`)
    res.redirect('/admin/orders')
  }catch(e){next(e)}
}

module.exports={updateStatus,ALLOWED}
