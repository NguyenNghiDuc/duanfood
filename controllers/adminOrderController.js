const db = require('../config/db')
const orderModel = require('../models/orderModels')
const walletLedger = require('../lib/walletLedger')
const commerce = require('../lib/commerceService')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

const ALLOWED = ['Chờ xác nhận','Chờ xác nhận thanh toán','Đã thanh toán','Đã thanh toán bằng ví','Đang chuẩn bị','Đang giao','Đã giao','Đã hủy']

async function restoreStock(order) {
  await ensureCommerceSchema()
  const [claim] = await db.query('UPDATE orders SET stock_restored=1 WHERE id=? AND COALESCE(stock_restored,0)=0', [order.id])
  if (!claim.affectedRows) return false
  try {
    const items = await orderModel.getOrderItems(order.id)
    for (const item of items) await db.query('UPDATE foods SET stock=COALESCE(stock,0)+? WHERE id=?', [Number(item.quantity||0), item.food_id])
    return true
  } catch (error) {
    await db.query('UPDATE orders SET stock_restored=0 WHERE id=? AND stock_restored=1', [order.id]).catch(()=>{})
    throw error
  }
}

async function restoreVoucher(order) {
  if (!order.voucher_code) return false
  const [usages] = await db.query('SELECT id,voucher_id FROM voucher_usages WHERE order_id=? LIMIT 1', [order.id])
  const usage = usages[0]
  if (!usage) return false
  const [removed] = await db.query('DELETE FROM voucher_usages WHERE id=?', [usage.id])
  if (removed.affectedRows) await db.query('UPDATE vouchers SET used_count=CASE WHEN used_count>0 THEN used_count-1 ELSE 0 END WHERE id=?', [usage.voucher_id])
  return Boolean(removed.affectedRows)
}

async function updateStatus(req,res,next){
  try{
    const status=String(req.body.status||'').trim()
    if(!ALLOWED.includes(status))return res.status(400).send('Trạng thái không hợp lệ')
    const order=await orderModel.getOrderById(req.params.id)
    if(!order)return res.status(404).send('Không tìm thấy đơn hàng')
    if(status==='Đã hủy'&&order.status!=='Đã hủy'){
      await restoreStock(order)
      await walletLedger.refundOrder(order,req.session.user.username)
      await restoreVoucher(order)
    }
    await orderModel.updateOrderStatus(order.id,status)
    await commerce.notify(order.username,'Cập nhật đơn hàng',`Đơn #${order.id}: ${status}.`,`/orders/${order.id}/timeline`).catch(()=>{})
    await commerce.audit(req.session.user.username,'update_order_status','order',order.id,`${order.status} -> ${status}`).catch(()=>{})
    res.redirect('/admin/orders')
  }catch(e){next(e)}
}

module.exports={updateStatus,ALLOWED}
