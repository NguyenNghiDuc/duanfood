const buckets = new Map()

function isProduction() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production'
}

function rateLimit({ windowMs = 60_000, max = 120, keyPrefix = 'global' } = {}) {
  return (req, res, next) => {
    // Local/Codespaces/test: do not block repeated testing.
    if (!isProduction()) return next()

    const now = Date.now()
    // Prefer authenticated user/session so users behind the same proxy/IP do not
    // consume the same bucket. IP is only the final fallback.
    const identity = req.session?.user?.username || req.sessionID || req.ip || req.socket?.remoteAddress || 'anonymous'
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
      res.setHeader('X-RateLimit-Limit', String(max))
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)))

      if (req.xhr || String(req.headers.accept || '').includes('application/json')) {
        return res.status(429).json({ ok: false, error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfter} giây.` })
      }
      return res.status(429).send(`Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfter} giây.`)
    }

    next()
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key)
}, 5 * 60_000).unref?.()

module.exports = { rateLimit }
