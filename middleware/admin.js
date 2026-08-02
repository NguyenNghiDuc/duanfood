function requireAdmin(req, res, next) {
  const isAdmin = req.session && req.session.user && req.session.user.role === 'admin'

  if (!isAdmin) {
    if (req.method === 'POST' || req.xhr || (req.headers && req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({ error: 'Forbidden', message: 'Bạn không có quyền truy cập chức năng quản trị.' })
    }
    return res.redirect('/foods')
  }

  next()
}

module.exports = {
  requireAdmin
}
