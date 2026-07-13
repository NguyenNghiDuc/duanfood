function getCart(req) {
  return req.session.cart || []
}

function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
}

module.exports = {
  getCart,
  getCartTotal
}
