const { log } = require('../lib/logger')

function notFoundHandler(req, res) {
  res.status(404).render('404', { path: req.originalUrl })
}

function errorHandler(err, req, res, next) {
  const status = Number(err.status || err.statusCode || 500)
  log(status >= 500 ? 'error' : 'warn', 'request_error', { requestId: req.id, status, path: req.originalUrl, method: req.method, error: err.message, stack: process.env.NODE_ENV === 'production' ? undefined : err.stack })
  if (res.headersSent) return next(err)
  if (req.xhr || String(req.get('accept') || '').includes('application/json')) return res.status(status).json({ ok: false, error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Lỗi máy chủ nội bộ' : err.message })
  res.status(status).render(status === 404 ? '404' : '500', { error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Lỗi máy chủ nội bộ' : (err.message || 'Lỗi máy chủ nội bộ') })
}

module.exports = { notFoundHandler, errorHandler }
