const db=require('../config/db')
const orderModel=require('../models/orderModels')
const commerce=require('../lib/commerceService')
const vnpay=require('../lib/vnpayService')
const {runMigrations}=require('../lib/migrationRunner')

function payable(order){return Math.max(0,Number(order.total||0)+Number(order.shipping_fee||0)-Number(order.discount_amount||0))}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'127.0.0.1').split(',')[0].trim()}

async function create(req,res,next){
  try{
    if(!vnpay.configured())return res.status(503).send('VNPay chưa được cấu hình trên server')
    const order=await orderModel.getOrderById(req.params.orderId)
    if(!order)return res.status(404).send('Không tìm thấy đơn hàng')
    if(req.session?.user?.role==='user'&&order.username!==req.session.user.username)return res.status(403).send('Không có quyền truy cập đơn hàng này')
    if(String(order.status).toLowerCase().includes('thanh toán'))return res.redirect(`/orders/${order.id}/timeline`)
    res.redirect(vnpay.createPaymentUrl({orderId:order.id,amount:payable(order),ip:clientIp(req),bankCode:req.query.bankCode||''}))
  }catch(e){next(e)}
}

async function finalize(query){
  await runMigrations()
  if(!vnpay.verify(query))return{ok:false,code:'97',message:'Invalid signature'}
  const orderId=Number(query.vnp_TxnRef||0),order=await orderModel.getOrderById(orderId)
  if(!order)return{ok:false,code:'01',message:'Order not found'}
  const expected=Math.round(payable(order)*100),received=Number(query.vnp_Amount||0)
  if(expected!==received)return{ok:false,code:'04',message:'Invalid amount'}
  const eventKey=`${orderId}:${query.vnp_TransactionNo||query.vnp_PayDate||query.vnp_SecureHash}`
  if(!vnpay.success(query)){
    await db.query('INSERT INTO payment_events(provider,event_key,order_id,payload,status) VALUES(?,?,?,?,?)',['vnpay',eventKey,orderId,JSON.stringify(query),'failed']).catch(()=>{})
    return{ok:false,code:'00',message:'Payment failed',orderId}
  }
  await db.transaction(async tx=>{
    const [known]=await tx.query('SELECT id,status FROM payment_events WHERE event_key=? LIMIT 1',[eventKey])
    if(known.length)return
    await tx.query('INSERT INTO payment_events(provider,event_key,order_id,payload,status) VALUES(?,?,?,?,?)',['vnpay',eventKey,orderId,JSON.stringify(query),'confirmed'])
    const fresh=await orderModel.getOrderById(orderId,tx)
    if(!fresh)throw new Error('Order not found')
    if(String(fresh.status).toLowerCase().includes('thanh toán'))return
    const [updated]=await tx.query("UPDATE orders SET status='Đã thanh toán',payment_method='VNPay',status_updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT LIKE '%thanh toán%'",[orderId])
    if(updated.affectedRows){await commerce.audit('vnpay','payment_confirmed','order',orderId,`transaction=${query.vnp_TransactionNo||''}`,tx);await commerce.notify(fresh.username,'Thanh toán thành công',`Đơn #${orderId} đã được VNPay xác nhận.`,`/orders/${orderId}/timeline`,tx)}
  })
  return{ok:true,code:'00',message:'Confirm Success',orderId}
}
async function ipn(req,res){try{const result=await finalize(req.query);return res.json({RspCode:result.code,Message:result.message})}catch(e){return res.json({RspCode:'99',Message:'Unknown error'})}}
async function callback(req,res){try{const result=await finalize(req.query);if(result.ok)return res.redirect(`/orders/${result.orderId}/timeline?payment=success`);return res.redirect(`/orders?payment=${encodeURIComponent(result.message)}`)}catch(e){return res.redirect('/orders?payment=error')}}
module.exports={create,ipn,callback,finalize}
