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
  await ensureCommerceSchema()
  const result = []
  for (const item of cart) {
    const food = await foodModel.getFoodById(item.foodId)
    if (!food) continue
    const sale = await commerce.currentSaleForFood(food.id)
    result.push({ ...item, title: food.title, image: food.image, price: sale ? Number(sale.sale_price) : Number(food.price), stock: Number(food.stock ?? 50), originalPrice: Number(food.price), flashSale: sale || null })
  }
  return result
}

async function showCart(req, res, next) {
  try {
    const cart = await hydrateCart(getCart(req))
    req.session.cart = cart.map(({stock,originalPrice,flashSale,...item})=>item)
    res.render('cart', { cart, total: getCartTotal(cart) })
  } catch (error) { next(error) }
}

async function addToCart(req, res, next) {
  try {
    const food = await foodModel.getFoodById(req.params.id)
    if (!food) return res.status(404).send('Không tìm thấy món ăn')
    const stock = Number(food.stock ?? 50)
    if (stock <= 0) return res.status(409).send('Món này đã hết hàng')
    const sale = await commerce.currentSaleForFood(food.id)
    const price = sale ? Number(sale.sale_price) : Number(food.price)
    const cart = getCart(req); const existing = cart.find(item => item.foodId === food.id)
    if (existing) { if (existing.quantity >= stock) return res.status(409).send('Số lượng vượt tồn kho'); existing.quantity += 1; existing.price = price }
    else cart.push({ foodId: food.id, title: food.title, price, quantity: 1, image: food.image })
    req.session.cart = cart; res.redirect('/cart')
  } catch (error) { next(error) }
}

async function addToCartApi(req, res, next) {
  try {
    const food = await foodModel.getFoodById(req.params.id)
    if (!food) return res.status(404).json({ error: 'Không tìm thấy món ăn' })
    const stock = Number(food.stock ?? 50); if (stock <= 0) return res.status(409).json({ error: 'Món đã hết hàng' })
    const sale = await commerce.currentSaleForFood(food.id); const price = sale ? Number(sale.sale_price) : Number(food.price)
    const cart = getCart(req); const existing = cart.find(item => item.foodId === food.id)
    if (existing) { if (existing.quantity >= stock) return res.status(409).json({ error: 'Số lượng vượt tồn kho' }); existing.quantity += 1; existing.price = price }
    else cart.push({ foodId: food.id, title: food.title, price, quantity: 1, image: food.image })
    req.session.cart = cart
    res.json({ ok: true, cart, count: cart.reduce((s,i)=>s+i.quantity,0), total: getCartTotal(cart) })
  } catch (error) { next(error) }
}

function getCartSummaryApi(req,res,next){try{const cart=getCart(req);res.json({ok:true,cart,count:cart.reduce((s,i)=>s+i.quantity,0),total:getCartTotal(cart)})}catch(e){next(e)}}

async function updateCart(req,res,next){
  try {
    const quantity=Math.max(0,Number(req.body.quantity||0));const food=await foodModel.getFoodById(req.params.id);if(!food)return res.status(404).send('Không tìm thấy món')
    const stock=Number(food.stock??50);if(quantity>stock)return res.status(409).send(`Chỉ còn ${stock} sản phẩm`)
    const cart=getCart(req).filter(item=>item.foodId!==Number(req.params.id));if(quantity>0){const sale=await commerce.currentSaleForFood(food.id);cart.push({foodId:food.id,title:food.title,price:sale?Number(sale.sale_price):Number(food.price),quantity,image:food.image})}
    req.session.cart=cart;res.redirect('/cart')
  }catch(e){next(e)}
}
function removeFromCart(req,res,next){try{req.session.cart=getCart(req).filter(item=>item.foodId!==Number(req.params.id));res.redirect('/cart')}catch(e){next(e)}}
function formatAddress(a){return a?`${a.full_name} — ${a.detail_address}, ${a.street}, ${a.ward}, ${a.district}, ${a.city}`:''}

async function showCheckout(req,res,next){
  try {
    const cart=await hydrateCart(getCart(req));const deliveryCompanies=await foodModel.getDeliveryCompanies();const addresses=await addressModel.getAddressesByUsername(req.session.user.username)
    const currentUser=await userModel.findByUsername(req.session.user.username);if(currentUser)req.session.user.balance=Number(currentUser.balance||0)
    res.render('checkout',{cart,total:getCartTotal(cart),error:null,user:req.session.user,isEmptyCart:cart.length===0,deliveryCompanies,addresses,selectedAddressId:addresses.find(a=>a.is_default)?.id||null})
  }catch(e){next(e)}
}

async function placeOrder(req,res,next){
  let orderId=null; const decremented=[]
  try {
    const cart=await hydrateCart(getCart(req));if(!cart.length)return res.redirect('/cart')
    for(const item of cart)if(item.quantity>item.stock)return res.status(409).send(`${item.title} chỉ còn ${item.stock} sản phẩm`)
    const subtotal=getCartTotal(cart);const paymentMethod=String(req.body.paymentMethod||'COD').trim();const paymentKey=paymentMethod.toLowerCase()
    const deliveryCompanies=await foodModel.getDeliveryCompanies();const delivery=deliveryCompanies.find(x=>String(x.id)===String(req.body.deliveryCompanyId));const shippingFee=delivery?Number(delivery.fee):0
    const addresses=await addressModel.getAddressesByUsername(req.session.user.username);const selected=addresses.find(a=>String(a.id)===String(req.body.addressId));const deliveryAddress=formatAddress(selected)
    if(!deliveryAddress)return res.status(400).send('Vui lòng chọn địa chỉ giao hàng')
    const voucherResult=req.body.voucherCode?await commerce.validateVoucher(req.body.voucherCode,req.session.user.username,subtotal):{valid:false,discount:0}
    const discount=voucherResult.valid?Number(voucherResult.discount||0):0;const payable=Math.max(0,subtotal+shippingFee-discount)
    if(paymentKey==='wallet'&&await walletLedger.getBalance(req.session.user.username)<payable)return res.status(400).send('Số dư ví không đủ')
    orderId=await orderModel.createOrder({username:req.session.user.username,total:subtotal,paymentMethod:paymentKey==='wallet'?'wallet':paymentMethod,status:paymentKey==='wallet'?'Đã thanh toán bằng ví':'Chờ xác nhận',deliveryCompany:delivery?delivery.name:'Giao hàng tiêu chuẩn',deliveryAddress,shippingFee,discountAmount:discount,voucherCode:voucherResult.valid?voucherResult.voucher.code:''})
    await orderModel.createOrderItems(orderId,cart)
    for(const item of cart){const [result]=await db.query('UPDATE foods SET stock=stock-? WHERE id=? AND COALESCE(stock,0)>=?',[item.quantity,item.foodId,item.quantity]);if(!result.affectedRows)throw new Error(`Tồn kho ${item.title} vừa thay đổi`);decremented.push(item)}
    if(paymentKey==='wallet')await walletLedger.recordTransaction({username:req.session.user.username,type:'order_payment',amount:-payable,referenceType:'order',referenceId:orderId,note:`Thanh toán đơn #${orderId}`})
    if(voucherResult.valid)await commerce.useVoucher(voucherResult.voucher,req.session.user.username,orderId,discount)
    await commerce.notify(req.session.user.username,'Đặt hàng thành công',`Đơn #${orderId} đã được tạo.`, `/orders/${orderId}/timeline`)
    await commerce.audit(req.session.user.username,'create_order','order',orderId,`payable=${payable}`)
    req.session.cart=[]
    const updated=await userModel.findByUsername(req.session.user.username);if(updated)req.session.user.balance=Number(updated.balance||0)
    if(paymentMethod==='Banking'||paymentMethod==='Momo')return res.redirect(`/bank?orderId=${orderId}`)
    res.redirect('/orders')
  }catch(error){
    for(const item of decremented)await db.query('UPDATE foods SET stock=stock+? WHERE id=?',[item.quantity,item.foodId]).catch(()=>{})
    if(orderId)await db.query("UPDATE orders SET status='Lỗi xử lý - cần kiểm tra' WHERE id=?",[orderId]).catch(()=>{})
    next(error)
  }
}

async function listOrders(req,res,next){try{res.render('orders',{orders:await orderModel.getOrdersByUsername(req.session.user.username)})}catch(e){next(e)}}
module.exports={showCart,addToCart,addToCartApi,getCartSummaryApi,updateCart,removeFromCart,showCheckout,placeOrder,listOrders}
