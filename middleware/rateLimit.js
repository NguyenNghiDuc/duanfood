const buckets = new Map()

function rateLimit({ windowMs = 60_000, max = 60, keyPrefix = 'global' } = {}) {
  return (req, res, next) => {
    const now = Date.now()
    const identity = req.session?.user?.username || req.ip || req.socket?.remoteAddress || 'anonymous'
    const key = `${keyPrefix}:${identity}`
    const current = buckets.get(key)
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    current.count += 1
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      if (req.xhr || String(req.headers.accept || '').includes('application/json')) {
        return res.status(429).json({ ok: false, error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' })
      }
      return res.status(429).send('Quá nhiều yêu cầu. Vui lòng thử lại sau.')
    }
    next()
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key)
}, 5 * 60_000).unref?.()

module.exports = { rateLimit }
