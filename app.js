require('dotenv').config();
const express = require("express")
const path = require("path")
const db = require("./config/db")
const session = require("express-session")
const bcrypt = require('bcryptjs')
const app = express()
const port = process.env.PORT || 5000
app.set("view engine", "ejs")

app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({extended:true, limit: '5mb'}))
app.use(express.static(path.join(__dirname, "public")))

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret_only',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}))

app.use((req, res, next) => {
    res.locals.user = req.session.user || null
    if (!req.session.cart) req.session.cart = []
    res.locals.cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0)
    next()
})

// Inject chat widget by wrapping res.render so EJS pages get the widget
app.use((req, res, next) => {
  const oldRender = res.render
  res.render = function (view, options, callback) {
    const done = (err, html) => {
      if (err) {
        if (typeof callback === 'function') return callback(err)
        return next(err)
      }
      console.log('[render-wrapper] view=', view)
      try {
        const appData = {
          user: res.locals.user
            ? { username: res.locals.user.username, balance: res.locals.user.balance }
            : null,
          cartCount: Number(res.locals.cartCount || 0)
        }
        const inject = `\n<script>window.__MINI_FOOD_APP = ${JSON.stringify(appData)};</script>\n<script src="/js/chat-widget.js"></script>\n<link rel="stylesheet" href="/css/chat-widget.css">\n`
        if (typeof html === 'string' && !/\/js\/chat-widget\.js/.test(html)) {
          html = html.replace(/<\/body>/i, inject + '</body>')
        }
      } catch (e) {}

      if (typeof callback === 'function') return callback(null, html)
      res.send(html)
    }

    try {
      if (typeof options === 'function') {
        oldRender.call(res, view, done)
      } else {
        oldRender.call(res, view, options, done)
      }
    } catch (e) {
      next(e)
    }
  }

  next()
})

app.set("views", path.join(__dirname, "views"))


const routes = require('./routes')
// debug: log incoming requests
app.use((req, res, next) => {
  console.log('[incoming]', req.method, req.path)
  next()
})
// provide foods as JSON so client can build local index
app.get('/api/foods', async (req, res) => {
  try {
    const foodModel = require('./models/foodModels')
    const foods = await foodModel.getFoods({})
    res.json(foods)
  } catch (e) {
    res.status(500).json({ error: 'cannot load foods' })
  }
})

// debug ping
app.post('/_ping', express.json(), (req, res) => {
  res.json({ ok: true, path: req.path, method: req.method })
})

// stable JSON chat endpoint bound to controller
try {
  const chatController = require('./controllers/chatController')
  const upload = require('./middleware/upload')
  app.post('/api/chat', upload.single('image'), chatController.chat)
  // debug: list top-level routes after binding
  if (app._router && Array.isArray(app._router.stack)) {
    console.log('[post-bind] routes count=', app._router.stack.length)
    app._router.stack.forEach((layer, idx) => {
      if (layer.route && layer.route.path) console.log('[post-bind]', idx, Object.keys(layer.route.methods).join(','), layer.route.path)
    })
  }
} catch (e) {
  console.error('failed to bind /api/chat', e)
}
const { notFoundHandler, errorHandler } = require('./middleware/errorHandles')

// use routes before notFoundHandler
app.use('/', routes)

function getAppRouterStack() {
  return app._router?.stack || app.router?.stack || []
}

// debug: expose simple route list
app.get('/__routes', (req, res) => {
  try {
    const routes = []
    for (const layer of getAppRouterStack()) {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).join(',')
        routes.push({ path: layer.route.path, methods })
      }
    }
    res.json(routes)
  } catch (e) {
    res.status(500).json({ error: 'cannot list routes' })
  }
})

// debug: print registered routes to console at startup
setTimeout(() => {
  try {
    console.log('--- Registered routes ---')
    const stack = getAppRouterStack()
    if (Array.isArray(stack)) {
      stack.forEach((layer) => {
        if (layer.route && layer.route.path) {
          const methods = Object.keys(layer.route.methods).join(',')
          console.log(methods.padEnd(8), layer.route.path)
        }
      })
    } else {
      console.log('no router stack')
    }
    console.log('-------------------------')
  } catch (e) { console.error('route-dump-failed', e) }
}, 200)

app.use(notFoundHandler)
app.use(errorHandler)

const host = process.env.HOST || 'localhost'

if (require.main === module) {
  const server = app.listen(port, host, () => {
    console.log(`Server is running at http://${host}:${port}`)
  })
  module.exports = { app, server }
} else {
  module.exports = app
}

// Build public chat index for client-side assistant (best-effort)
;(async () => {
  try {
    const chatIndex = require('./lib/chatIndex')
    const items = await chatIndex.buildIndex()
    const fs = require('fs')
    const path = require('path')
    const outDir = path.join(__dirname, 'public', 'data')
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'chat-index.json'), JSON.stringify(items, null, 2), 'utf8')
    console.log('[chat-index] built public/data/chat-index.json items=', items.length)
  } catch (e) {
    console.error('[chat-index] build failed', e && e.message)
  }
})()

// debug: expose simple route list
app.get('/__routes', (req, res) => {
  try {
    const routes = []
    app._router.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).join(',')
        routes.push({ path: layer.route.path, methods })
      }
    })
    res.json(routes)
  } catch (e) {
    res.status(500).json({ error: 'cannot list routes' })
  }
})

let isShuttingDown = false

function gracefulShutdown(signal) {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(`Received ${signal}, shutting down server...`)

  server.close((err) => {
    if (err) {
      console.error('Server close failed:', err.message)
      process.exit(1)
    }

    console.log('Server stopped cleanly')
    process.exit(0)
  })
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
