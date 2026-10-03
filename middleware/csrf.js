const crypto = require('crypto')

function sameOrigin(req) {
  const origin = req.get('origin') || ''
  const referer = req.get('referer') || ''
  const host = req.get('host') || ''
  if (!host) return false
  if (origin) { try { return new URL(origin).host === host } catch (_) { return false } }
  if (referer) { try { return new URL(referer).host === host } catch (_) { return false } }
  return false
}

function issue(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex')
  return req.session.csrfToken
}

function csrfProtection(req, res, next) {
  if (!req.session) return next(new Error('Session middleware must run before CSRF'))
  const token = issue(req)
  res.locals.csrfToken = token
  res.setHeader('X-CSRF-Token', token)
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next()

  const supplied = String(req.get('x-csrf-token') || req.body?._csrf || req.query?._csrf || '')
  const type = String(req.get('content-type') || '').toLowerCase()
  if (type.includes('multipart/form-data') && !supplied && sameOrigin(req)) return next()
  if (supplied && supplied.length === token.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) return next()
  const err = new Error('CSRF token không hợp lệ hoặc đã hết hạn')
  err.status = 403
  next(err)
}

module.exports = { csrfProtection, issue }
