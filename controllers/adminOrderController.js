const db = require('../config/db')
const orderModel = require('../models/orderModels')
const walletLedger = require('../lib/walletLedger')
const commerce = require('../lib/commerceService')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

const ALLOWED = ['Chờ xác nhận','Chờ thanh toán','Chờ xác nhận thanh toán','Đã thanh toán','Đã thanh toán bằng ví','Đang chuẩn bị','Đang giao','Đã giao','Đã hủy']

async function cancelOrder(order, actor) {
  await ensureCommerceSchema()
  return db.transaction(async tx => {
    const fresh = await orderModel.getOrderById(order.id, tx)
    if (!fresh || fresh.status === 'Đã hủy') return false
    const [stockClaim] = await tx.query('UPDATE orders SET stock_restored=1 WHERE id=? AND COALESCE(stock_restored,0)=0', [fresh.id])
    if (stockClaim.affectedRows) {
      const items = await orderModel.getOrderItems(fresh.id, tx)
      for (const item of items) await tx.query('UPDATE foods SET stock=COALESCE(stock,0)+? WHERE id=?', [Number(item.quantity || 0), item.food_id])
    }
    await walletLedger.refundOrder(fresh, actor, tx)
    if (fresh.voucher_code) {
      const [usages] = await tx.query('SELECT id,voucher_id FROM voucher_usages WHERE order_id=? LIMIT 1', [fresh.id])
      const usage = usages[0]
      if (usage) {
        const [removed] = await tx.query('DELETE FROM voucher_usages WHERE id=?', [usage.id])
        if (removed.affectedRows) await tx.query('UPDATE vouchers SET used_count=CASE WHEN used_count>0 THEN used_count-1 ELSE 0 END WHERE id=?', [usage.voucher_id])
      }
    }
    await orderModel.updateOrderStatus(fresh.id, 'Đã hủy', tx)
    await commerce.audit(actor, 'update_order_status', 'order', fresh.id, `${fresh.status} -> Đã hủy`, tx)
    return true
  })
}

async function updateStatus(req,res,next){
  try{
    const status=String(req.body.status||'').trim()
    if(!ALLOWED.includes(status))return res.status(400).send('Trạng thái không hợp lệ')
    const order=await orderModel.getOrderById(req.params.id)
    if(!order)return res.status(404).send('Không tìm thấy đơn hàng')
    if(status==='Đã hủy'&&order.status!=='Đã hủy') await cancelOrder(order,req.session.user.username)
    else if(status!=='Đã hủy') {
      await db.transaction(async tx=>{await orderModel.updateOrderStatus(order.id,status,tx);await commerce.audit(req.session.user.username,'update_order_status','order',order.id,`${order.status} -> ${status}`,tx)})
    }
    await commerce.notify(order.username,'Cập nhật đơn hàng',`Đơn #${order.id}: ${status}.`,`/orders/${order.id}/timeline`).catch(()=>{})
    res.redirect('/admin/orders')
  }catch(e){next(e)}
}

module.exports={updateStatus,ALLOWED,cancelOrder}
