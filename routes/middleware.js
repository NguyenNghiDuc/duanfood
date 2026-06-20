const db = require('../config/db')

function getCart(req) {
  return req.session.cart || []
}

function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login')
  next()
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/foods')
  next()
}

module.exports = {
  getCart,
  getCartTotal,
  requireLogin,
  requireAdmin,
  db
}
