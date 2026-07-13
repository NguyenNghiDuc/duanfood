const foodModel = require('../models/foodModels')
const orderModel = require('../models/orderModels')
const userModel = require('../models/userModels')
const addressModel = require('../models/addressModel')
const { getCart, getCartTotal } = require('../middleware/cartHelpers')

async function showCart(req, res, next) {
  try {
    const cart = getCart(req)
    res.render('cart', { cart, total: getCartTotal(cart) })
  } catch (error) {
    next(error)
  }
}

async function addToCart(req, res, next) {
  try {
    const food = await foodModel.getFoodById(req.params.id)
    if (!food) return res.status(404).send('Không tìm thấy món ăn')
    const cart = getCart(req)
    const existing = cart.find(item => item.foodId === food.id)
    if (existing) existing.quantity += 1
    else cart.push({ foodId: food.id, title: food.title, price: food.price, quantity: 1, image: food.image })
    req.session.cart = cart
    res.redirect('/cart')
  } catch (error) {
    next(error)
  }
}

function updateCart(req, res, next) {
  try {
    const quantity = Number(req.body.quantity || 0)
    const cart = getCart(req).filter(item => item.foodId !== Number(req.params.id))
    if (quantity > 0) {
      cart.push({ foodId: Number(req.params.id), title: req.body.title, price: Number(req.body.price), quantity, image: req.body.image })
    }
    req.session.cart = cart
    res.redirect('/cart')
  } catch (error) {
    next(error)
  }
}

function removeFromCart(req, res, next) {
  try {
    req.session.cart = getCart(req).filter(item => item.foodId !== Number(req.params.id))
    res.redirect('/cart')
  } catch (error) {
    next(error)
  }
}

function formatAddress(address) {
  if (!address) return ''
  return `${address.full_name} — ${address.detail_address}, ${address.street}, ${address.ward}, ${address.district}, ${address.city}`
}

async function showCheckout(req, res, next) {
  try {
    const cart = getCart(req)
    const deliveryCompanies = await foodModel.getDeliveryCompanies()
    const addresses = await addressModel.getAddressesByUsername(req.session.user.username)
    res.render('checkout', {
      cart,
      total: getCartTotal(cart),
      error: null,
      user: req.session.user,
      isEmptyCart: cart.length === 0,
      deliveryCompanies,
      addresses,
      selectedAddressId: addresses.find(addr => addr.is_default)?.id || null
    })
  } catch (error) {
    next(error)
  }
}

async function placeOrder(req, res, next) {
  try {
    const cart = getCart(req)
    if (!cart.length) return res.redirect('/cart')
    const total = getCartTotal(cart)
    const paymentMethod = req.body.paymentMethod || 'COD'
    const deliveryCompanyId = req.body.deliveryCompanyId || null
    const addressId = req.body.addressId || null
    const currentUser = await userModel.findByUsername(req.session.user.username)
    const deliveryCompanies = await foodModel.getDeliveryCompanies()
    const deliveryWarehouse = deliveryCompanies.find(dc => String(dc.id) === String(deliveryCompanyId))
    const deliveryCompany = deliveryWarehouse ? deliveryWarehouse.name : 'Giao hàng tiêu chuẩn'
    const shippingFee = deliveryWarehouse ? Number(deliveryWarehouse.fee) : 0
    const addresses = await addressModel.getAddressesByUsername(req.session.user.username)
    const selectedAddress = addresses.find(addr => String(addr.id) === String(addressId))
    const deliveryAddress = selectedAddress ? formatAddress(selectedAddress) : ''

    if (!deliveryAddress) {
      return res.render('checkout', {
        cart,
        total,
        error: 'Vui lòng chọn địa chỉ giao hàng.',
        user: req.session.user,
        isEmptyCart: cart.length === 0,
        deliveryCompanies,
        addresses,
        selectedAddressId: addressId
      })
    }

    if (paymentMethod === 'wallet' && Number(currentUser.balance || 0) < total + shippingFee) {
      return res.render('checkout', {
        cart,
        total,
        error: 'Số dư ví không đủ để thanh toán. Vui lòng nạp tiền trước.',
        user: req.session.user,
        isEmptyCart: cart.length === 0,
        deliveryCompanies,
        addresses,
        selectedAddressId: addressId
      })
    }

    let status = 'Chờ xác nhận'
    if (paymentMethod === 'wallet') {
      await userModel.updateBalance(req.session.user.username, -(total + shippingFee))
      status = 'Đã thanh toán bằng ví'
      req.session.user.balance = Number(currentUser.balance || 0) - total - shippingFee
    }

    const orderId = await orderModel.createOrder({
      username: req.session.user.username,
      total,
      paymentMethod,
      status,
      deliveryCompany,
      deliveryAddress,
      shippingFee
    })
    await orderModel.createOrderItems(orderId, cart)
    req.session.cart = []
    if (paymentMethod === 'Banking' || paymentMethod === 'Momo') return res.redirect(`/bank?orderId=${orderId}`)
    res.redirect('/orders')
  } catch (error) {
    next(error)
  }
}

async function listOrders(req, res, next) {
  try {
    const orders = await orderModel.getOrdersByUsername(req.session.user.username)
    res.render('orders', { orders })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  showCart,
  addToCart,
  updateCart,
  removeFromCart,
  showCheckout,
  placeOrder,
  listOrders
}
