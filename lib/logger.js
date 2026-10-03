const crypto = require('crypto')

function log(level, message, meta = {}) {
  const payload = { time: new Date().toISOString(), level, message, ...meta }
  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

function requestLogger(req, res, next) {
  const started = Date.now()
  const id = req.get('x-request-id') || crypto.randomUUID()
  req.id = id
  res.setHeader('X-Request-Id', id)
  res.on('finish', () => log('info', 'http_request', { requestId: id, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Date.now() - started, user: req.session?.user?.username || null }))
  next()
}

module.exports = { log, requestLogger }
