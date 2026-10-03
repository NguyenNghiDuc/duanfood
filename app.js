require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const db = require('./config/db')
const app = express()
const port = Number(process.env.PORT || 5000)
const host = process.env.HOST || 'localhost'
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production')
}

app.disable('x-powered-by')
if (isProduction) app.set('trust proxy', 1)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '1d' : 0 }))

app.use(session({
  name: 'mini_food_sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}))

app.use((req, res, next) => {
  res.locals.user = req.session.user || null
  if (!req.session.cart) req.session.cart = []
  res.locals.cartCount = req.session.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  next()
})

// Attach the common visual theme and chat widget to every rendered EJS page.
app.use((req, res, next) => {
  const originalRender = res.render.bind(res)
  res.render = (view, options = {}, callback) => {
    const done = (err, html) => {
      if (err) {
        if (typeof callback === 'function') return callback(err)
        return next(err)
      }
      try {
        const appData = {
          user: res.locals.user ? { username: res.locals.user.username, balance: Number(res.locals.user.balance || 0) } : null,
          cartCount: Number(res.locals.cartCount || 0)
        }
        const assets = [
          '<link rel="stylesheet" href="/css/theme.css">',
          '<link rel="stylesheet" href="/css/chat-widget.css">',
          `<script>window.__MINI_FOOD_APP=${JSON.stringify(appData).replace(/</g, '\\u003c')};</script>`,
          '<script src="/js/chat-widget.js" defer></script>'
        ].join('\n')
        if (typeof html === 'string') {
          if (!html.includes('/css/theme.css')) html = html.replace(/<\/head>/i, '<link rel="stylesheet" href="/css/theme.css">\n</head>')
          if (!html.includes('/js/chat-widget.js')) html = html.replace(/<\/body>/i, assets.replace('<link rel="stylesheet" href="/css/theme.css">', '') + '\n</body>')
        }
      } catch (_) {}
      if (typeof callback === 'function') return callback(null, html)
      return res.send(html)
    }
    return originalRender(view, { ...res.locals, ...(typeof options === 'object' ? options : {}) }, done)
  }
  next()
})

app.get('/api/foods', async (req, res) => {
  try {
    const foodModel = require('./models/foodModels')
    const foods = await foodModel.getFoods({})
    res.json(foods)
  } catch (_) {
    res.status(500).json({ error: 'cannot load foods' })
  }
})

if (!isProduction) {
  app.post('/_ping', (req, res) => res.json({ ok: true }))
}

app.use('/', require('./routes'))

const { notFoundHandler, errorHandler } = require('./middleware/errorHandles')
app.use(notFoundHandler)
app.use(errorHandler)

let server = null
let shuttingDown = false

async function gracefulShutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Received ${signal}, shutting down...`)
  try {
    if (server) await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
    await db.close().catch(() => {})
    process.exit(0)
  } catch (error) {
    console.error('Shutdown failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  db.ready().then(() => {
    server = app.listen(port, host, () => console.log(`Server is running at http://${host}:${port}`))
  }).catch(error => {
    console.error('Database initialization failed:', error)
    process.exit(1)
  })
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
} else {
  module.exports = app
}

// Refresh the public read-only search index on startup (best effort).
;(async () => {
  try {
    await db.ready()
    const chatIndex = require('./lib/chatIndex')
    const items = await chatIndex.buildIndex()
    const fs = require('fs')
    const outDir = path.join(__dirname, 'public', 'data')
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'chat-index.json'), JSON.stringify(items, null, 2), 'utf8')
  } catch (error) {
    console.error('[chat-index] build failed:', error.message)
  }
})()
