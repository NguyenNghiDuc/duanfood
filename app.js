require('dotenv').config();
const express = require("express")
const path = require("path")
const db = require("./config/db")
const session = require("express-session")
const bcrypt = require('bcrypt')
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
app.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`)
})
