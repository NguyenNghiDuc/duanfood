const ROLE_LEVELS = { user: 0, support: 1, kitchen: 1, staff: 2, admin: 3, super_admin: 4 }

function getRole(req) {
  const username = req.session?.user?.username
  if (username === 'admin' && !req.session.user.role) return 'super_admin'
  return req.session?.user?.role || (username === 'admin' ? 'super_admin' : 'user')
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = getRole(req)
    if (roles.includes(role) || role === 'super_admin') return next()
    if (req.xhr || String(req.headers.accept || '').includes('application/json')) return res.status(403).json({ ok: false, error: 'Bạn không có quyền thực hiện thao tác này.' })
    return res.status(403).send('Bạn không có quyền thực hiện thao tác này.')
  }
}

function requireMinRole(role) {
  return (req, res, next) => {
    const current = getRole(req)
    if ((ROLE_LEVELS[current] || 0) >= (ROLE_LEVELS[role] || 0)) return next()
    return res.status(403).send('Bạn không có quyền thực hiện thao tác này.')
  }
}

module.exports = { ROLE_LEVELS, getRole, requireRole, requireMinRole }
