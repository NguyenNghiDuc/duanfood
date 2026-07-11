require('dotenv').config();
const express = require("express")
const path = require("path")
const db = require("./config/db")
const session = require("express-session")
const bcrypt = require('bcryptjs')
const app = express()
const port = process.env.PORT || 5000
app.set("view engine", "ejs")

app.use(express.urlencoded({extended:true}))
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

app.set("views", path.join(__dirname, "views"))


const routes = require('./routes')
const { notFoundHandler, errorHandler } = require('./middleware/errorHandles')
app.use('/', routes)

app.use(notFoundHandler)
app.use(errorHandler)

const host = process.env.HOST || 'localhost'
const server = app.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`)
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
