require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const db = require('./config/db')
const { DatabaseSessionStore } = require('./lib/sessionStore')
const { csrfProtection } = require('./middleware/csrf')
const { requestLogger, log } = require('./lib/logger')

const app = express()
const port = Number(process.env.PORT || 5000)
const host = process.env.HOST || 'localhost'
const isProduction = process.env.NODE_ENV === 'production'
if (isProduction && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production')

app.disable('x-powered-by')
if (isProduction) app.set('trust proxy', Number(process.env.TRUST_PROXY || 1))
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; font-src 'self' data: https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'")
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '1d' : 0, immutable: false }))

const sessionTtl = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000)
const sessionOptions = {
  name: 'mini_food_sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-me',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: sessionTtl }
}
if (process.env.SESSION_STORE !== 'memory') sessionOptions.store = new DatabaseSessionStore({ ttlMs: sessionTtl })
app.use(session(sessionOptions))
app.use(requestLogger)
app.use(csrfProtection)

app.use((req, res, next) => {
  res.locals.user = req.session.user || null
  if (!req.session.cart) req.session.cart = []
  res.locals.cartCount = req.session.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  next()
})

app.use((req, res, next) => {
  const originalRender = res.render.bind(res)
  res.render = (view, options = {}, callback) => {
    const merged = { ...res.locals, ...(typeof options === 'object' ? options : {}) }
    const done = (err, html) => {
      if (err) { if (typeof callback === 'function') return callback(err); return next(err) }
      try {
        const seo = merged.seo || {}
        const title = String(seo.title || 'MINI FOOD').replace(/[<>]/g, '')
        const description = String(seo.description || 'MINI FOOD - đặt món, thanh toán ví và theo dõi đơn hàng.').replace(/[<>]/g, '').slice(0, 180)
        const image = String(seo.image || '/images/anhfood.png').replace(/["<>]/g, '')
        const csrf = String(res.locals.csrfToken || '')
        const head = [
          '<link rel="stylesheet" href="/css/theme.css">', '<link rel="manifest" href="/manifest.json">', '<meta name="theme-color" content="#ff6b35">',
          `<meta name="csrf-token" content="${csrf}">`, `<meta name="description" content="${description.replace(/"/g, '&quot;')}">`,
          `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}">`, `<meta property="og:description" content="${description.replace(/"/g, '&quot;')}">`, `<meta property="og:image" content="${image}">`, '<meta property="og:type" content="website">'
        ].join('\n')
        const appData = { user: res.locals.user ? { username: res.locals.user.username, balance: Number(res.locals.user.balance || 0), role: res.locals.user.role || 'user' } : null, cartCount: Number(res.locals.cartCount || 0), csrfToken: csrf }
        const foot = ['<link rel="stylesheet" href="/css/chat-widget.css">', `<script>window.__MINI_FOOD_APP=${JSON.stringify(appData).replace(/</g, '\\u003c')};</script>`, '<script src="/js/app-ui.js" defer></script>', '<script src="/js/chat-widget.js" defer></script>'].join('\n')
        if (typeof html === 'string') {
          if (!html.includes('/manifest.json')) html = html.replace(/<\/head>/i, head + '\n</head>')
          else if (!html.includes('csrf-token')) html = html.replace(/<\/head>/i, `<meta name="csrf-token" content="${csrf}">\n</head>`)
          html = html.replace(/<form\b([^>]*\bmethod=["']?post["']?[^>]*)>/gi, match => /name=["']_csrf["']/.test(match) ? match : `${match}<input type="hidden" name="_csrf" value="${csrf}">`)
          if (!html.includes('/js/app-ui.js')) html = html.replace(/<\/body>/i, foot + '\n</body>')
        }
      } catch (_) {}
      if (typeof callback === 'function') return callback(null, html)
      return res.send(html)
    }
    return originalRender(view, merged, done)
  }
  next()
})

app.get('/healthz', (req, res) => res.json({ ok: true, service: 'mini-food', uptime: Math.round(process.uptime()), time: new Date().toISOString() }))
app.get('/readyz', async (req, res) => { try { await db.query('SELECT 1 AS ok'); res.json({ ok: true, database: db.engine() }) } catch (e) { res.status(503).json({ ok: false, error: 'database_unavailable' }) } })
app.get('/api/foods', async (req, res) => { try { const foodModel = require('./models/foodModels'); res.json(await foodModel.getFoods({})) } catch (_) { res.status(500).json({ error: 'cannot load foods' }) } })
if (!isProduction) app.post('/_ping', (req, res) => res.json({ ok: true }))

app.use('/', require('./routes'))
const { notFoundHandler, errorHandler } = require('./middleware/errorHandles')
app.use(notFoundHandler)
app.use(errorHandler)

let server = null, shuttingDown = false
async function gracefulShutdown(signal) {
  if (shuttingDown) return; shuttingDown = true; log('info', 'shutdown_start', { signal })
  try { if (server) await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); await db.close().catch(() => {}); process.exit(0) }
  catch (error) { log('error', 'shutdown_failed', { error: error.message }); process.exit(1) }
}
if (require.main === module) {
  db.ready().then(() => { server = app.listen(port, host, () => log('info', 'server_started', { host, port, database: db.engine() })) }).catch(error => { log('error', 'database_init_failed', { error: error.message }); process.exit(1) })
  process.on('SIGINT', () => gracefulShutdown('SIGINT')); process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
} else module.exports = app

;(async () => { try { await db.ready(); const { ensureCommerceSchema } = require('./lib/commerceSchema'); await ensureCommerceSchema(); const chatIndex = require('./lib/chatIndex'); const items = await chatIndex.buildIndex(); const fs = require('fs'); const outDir = path.join(__dirname, 'public', 'data'); fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'chat-index.json'), JSON.stringify(items, null, 2), 'utf8') } catch (error) { log('warn', 'optional_startup_failed', { error: error.message }) } })()
