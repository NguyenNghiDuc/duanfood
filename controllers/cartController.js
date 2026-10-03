const db = require('../config/db')
const foodModel = require('../models/foodModels')
const orderModel = require('../models/orderModels')
const userModel = require('../models/userModels')
const addressModel = require('../models/addressModel')
const commerce = require('../lib/commerceService')
const walletLedger = require('../lib/walletLedger')
const { ensureCommerceSchema } = require('../lib/commerceSchema')
const { getCart, getCartTotal } = require('../middleware/cartHelpers')

async function hydrateCart(cart) {
  await ensureCommerceSchema(); const result=[]
  for(const item of cart){const food=await foodModel.getFoodById(item.foodId);if(!food)continue;const sale=await commerce.currentSaleForFood(food.id);result.push({...item,title:food.title,image:food.image,price:sale?Number(sale.sale_price):Number(food.price),stock:Number(food.stock??50),originalPrice:Number(food.price),flashSale:sale||null})}
  return result
}
async function showCart(req,res,next){try{const cart=await hydrateCart(getCart(req));req.session.cart=cart.map(({stock,originalPrice,flashSale,...item})=>item);res.render('cart',{cart,total:getCartTotal(cart)})}catch(e){next(e)}}
async function addToCart(req,res,next){try{const food=await foodModel.getFoodById(req.params.id);if(!food)return res.status(404).send('Không tìm thấy món ăn');const stock=Number(food.stock??50);if(stock<=0)return res.status(409).send('Món này đã hết hàng');const sale=await commerce.currentSaleForFood(food.id),price=sale?Number(sale.sale_price):Number(food.price),cart=getCart(req),existing=cart.find(item=>Number(item.foodId)===Number(food.id));if(existing){if(existing.quantity>=stock)return res.status(409).send('Số lượng vượt tồn kho');existing.quantity+=1;existing.price=price}else cart.push({foodId:food.id,title:food.title,price,quantity:1,image:food.image});req.session.cart=cart;res.redirect('/cart')}catch(e){next(e)}}
async function addToCartApi(req,res,next){try{const food=await foodModel.getFoodById(req.params.id);if(!food)return res.status(404).json({error:'Không tìm thấy món ăn'});const stock=Number(food.stock??50);if(stock<=0)return res.status(409).json({error:'Món đã hết hàng'});const sale=await commerce.currentSaleForFood(food.id),price=sale?Number(sale.sale_price):Number(food.price),cart=getCart(req),existing=cart.find(item=>Number(item.foodId)===Number(food.id));if(existing){if(existing.quantity>=stock)return res.status(409).json({error:'Số lượng vượt tồn kho'});existing.quantity+=1;existing.price=price}else cart.push({foodId:food.id,title:food.title,price,quantity:1,image:food.image});req.session.cart=cart;res.json({ok:true,cart,count:cart.reduce((s,i)=>s+i.quantity,0),total:getCartTotal(cart)})}catch(e){next(e)}}
function getCartSummaryApi(req,res,next){try{const cart=getCart(req);res.json({ok:true,cart,count:cart.reduce((s,i)=>s+i.quantity,0),total:getCartTotal(cart)})}catch(e){next(e)}}
async function updateCart(req,res,next){try{const quantity=Math.max(0,Number(req.body.quantity||0)),food=await foodModel.getFoodById(req.params.id);if(!food)return res.status(404).send('Không tìm thấy món');const stock=Number(food.stock??50);if(quantity>stock)return res.status(409).send(`Chỉ còn ${stock} sản phẩm`);const cart=getCart(req).filter(item=>Number(item.foodId)!==Number(req.params.id));if(quantity>0){const sale=await commerce.currentSaleForFood(food.id);cart.push({foodId:food.id,title:food.title,price:sale?Number(sale.sale_price):Number(food.price),quantity,image:food.image})}req.session.cart=cart;res.redirect('/cart')}catch(e){next(e)}}
function removeFromCart(req,res,next){try{req.session.cart=getCart(req).filter(item=>Number(item.foodId)!==Number(req.params.id));res.redirect('/cart')}catch(e){next(e)}}
function formatAddress(a){return a?`${a.full_name} — ${a.detail_address}, ${a.street}, ${a.ward}, ${a.district}, ${a.city}`:''}
async function showCheckout(req,res,next){try{const cart=await hydrateCart(getCart(req)),deliveryCompanies=await foodModel.getDeliveryCompanies(),addresses=await addressModel.getAddressesByUsername(req.session.user.username),currentUser=await userModel.findByUsername(req.session.user.username);if(currentUser)req.session.user.balance=Number(currentUser.balance||0);res.render('checkout',{cart,total:getCartTotal(cart),error:null,user:req.session.user,isEmptyCart:cart.length===0,deliveryCompanies,addresses,selectedAddressId:addresses.find(a=>a.is_default)?.id||null})}catch(e){next(e)}}

async function placeOrder(req,res,next){
  try{
    const username=req.session.user.username,cart=await hydrateCart(getCart(req));if(!cart.length)return res.redirect('/cart')
    const subtotal=getCartTotal(cart),paymentMethod=String(req.body.paymentMethod||'COD').trim(),paymentKey=paymentMethod.toLowerCase()
    const deliveryCompanies=await foodModel.getDeliveryCompanies(),delivery=deliveryCompanies.find(x=>String(x.id)===String(req.body.deliveryCompanyId)),shippingFee=delivery?Number(delivery.fee):0
    const addresses=await addressModel.getAddressesByUsername(username),selected=addresses.find(a=>String(a.id)===String(req.body.addressId)),deliveryAddress=formatAddress(selected)
    if(!deliveryAddress)return res.status(400).send('Vui lòng chọn địa chỉ giao hàng')

    const result=await db.transaction(async tx=>{
      let freshSubtotal=0; const freshCart=[]
      for(const item of cart){const [rows]=await tx.query('SELECT id,title,price,image,COALESCE(stock,0) stock FROM foods WHERE id=?',[item.foodId]);const food=rows[0];if(!food)throw new Error(`Món ${item.title} không còn tồn tại`);if(Number(food.stock)<Number(item.quantity))throw new Error(`${food.title} chỉ còn ${food.stock} sản phẩm`);const sale=await commerce.currentSaleForFood(food.id,tx),price=sale?Number(sale.sale_price):Number(food.price);freshSubtotal+=price*Number(item.quantity);freshCart.push({...item,title:food.title,price})}
      const voucherResult=req.body.voucherCode?await commerce.validateVoucher(req.body.voucherCode,username,freshSubtotal,tx):{valid:false,discount:0}
      const discount=voucherResult.valid?Number(voucherResult.discount||0):0,payable=Math.max(0,freshSubtotal+shippingFee-discount)
      if(paymentKey==='wallet'&&await walletLedger.getBalance(username,tx)<payable)throw Object.assign(new Error('Số dư ví không đủ'),{status:400})
      const initialStatus=paymentKey==='wallet'?'Đã thanh toán bằng ví':(['vnpay','banking','momo'].includes(paymentKey)?'Chờ thanh toán':'Chờ xác nhận')
      const orderId=await orderModel.createOrder({username,total:freshSubtotal,paymentMethod:paymentKey==='wallet'?'wallet':paymentMethod,status:initialStatus,deliveryCompany:delivery?delivery.name:'Giao hàng tiêu chuẩn',deliveryAddress,shippingFee,discountAmount:discount,voucherCode:voucherResult.valid?voucherResult.voucher.code:''},tx)
      await orderModel.createOrderItems(orderId,freshCart,tx)
      for(const item of freshCart){const [stock]=await tx.query('UPDATE foods SET stock=stock-? WHERE id=? AND COALESCE(stock,0)>=?',[item.quantity,item.foodId,item.quantity]);if(!stock.affectedRows)throw new Error(`Tồn kho ${item.title} vừa thay đổi`)}
      if(voucherResult.valid)await commerce.useVoucher(voucherResult.voucher,username,orderId,discount,tx)
      if(paymentKey==='wallet')await walletLedger.recordTransaction({username,type:'order_payment',amount:-payable,referenceType:'order',referenceId:orderId,note:`Thanh toán đơn #${orderId}`},tx)
      await commerce.audit(username,'create_order','order',orderId,`payable=${payable}`,tx)
      await commerce.notify(username,'Đặt hàng thành công',`Đơn #${orderId} đã được tạo.`,`/orders/${orderId}/timeline`,tx)
      return {orderId,payable,paymentKey}
    })

    req.session.cart=[]
    const updated=await userModel.findByUsername(username).catch(()=>null);if(updated)req.session.user.balance=Number(updated.balance||0)
    if(result.paymentKey==='vnpay')return res.redirect(`/payments/vnpay/create/${result.orderId}`)
    if(result.paymentKey==='banking'||result.paymentKey==='momo')return res.redirect(`/bank?orderId=${result.orderId}`)
    return res.redirect('/orders')
  }catch(error){return next(error)}
}

async function listOrders(req,res,next){try{const page=Math.max(1,Number(req.query.page)||1),limit=20;res.render('orders',{orders:await orderModel.getOrdersByUsername(req.session.user.username,{limit,offset:(page-1)*limit}),page})}catch(e){next(e)}}
module.exports={showCart,addToCart,addToCartApi,getCartSummaryApi,updateCart,removeFromCart,showCheckout,placeOrder,listOrders}
