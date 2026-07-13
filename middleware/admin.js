function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/foods')
  }
  next()
}

module.exports = {
  requireAdmin
}
