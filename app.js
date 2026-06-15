require('dotenv').config();
const express = require("express")
const path = require("path")
const db = require("./config/db")
const session = require("express-session")
const bcrypt = require('bcrypt')
const postModel = require("./controllers/postModel")
const postController = require("./controllers/postController")
const foodModel = require("./controllers/foodModel")
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

function getCart(req) {
    return req.session.cart || []
}

function getCartTotal(cart) {
    return cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
}

function logger(req, res, next) {
    console.log(req.method, req.url)
    next()
}
app.use(logger)

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/login")
    }
    next()
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.redirect("/foods")
    }
    next()
}

app.set("views", path.join(__dirname, "views"))


app.get("/", async (req, res) => {
    try {
        const foods = await foodModel.getFoods({})
        const categories = await foodModel.getAllCategories()
        res.render("home", {
            foods: (foods || []).slice(0, 6),
            categories: categories || []
        })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
});
app.get("/register", (req, res) => {
    res.render("register", { error: null })
})

app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body
        const [users] = await db.query(
            "SELECT * FROM users WHERE username = ?",
            [username]
        )
        if (users.length > 0) {
            return res.render("register", {
                error: "Tên đăng nhập đã tồn tại"
            })
        }
        const hash = await bcrypt.hash(password, 10)
        await db.query(
            "INSERT INTO users(username, password, balance) VALUES (?, ?, 0)",
            [username, hash]
        )
        res.redirect("/login")
    } catch (error) {
        console.log(error)
        res.send("Lỗi đăng ký")
    }
})
app.get("/login", (req, res) => {
    res.render("login", { error: null })
})
app.post("/login", async (req, res) => {
    try {
        const username = req.body.username
        const password = req.body.password
        const [users] = await db.query(
            "SELECT * FROM users WHERE username = ?",
            [username]
        )
        if (users.length === 0) {
            return res.render("login", { error: "Sai username hoặc password" })
        }
        const user = users[0]
        const match = await bcrypt.compare(password, user.password)
        if (!match) return res.render("login", { error: "Sai username hoặc password" })
        const isAdmin = username === 'admin'
        req.session.user = {
            username,
            role: isAdmin ? "admin" : "user",
            balance: Number(user.balance || 0)
        }
        return res.redirect("/news")
    } catch (error) {
        console.error(error)
        return res.render("login", { error: "Lỗi đăng nhập" })
    }
})

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/")
    })
})

app.get("/categories", async (req, res) => {
    try {
        const categories = await foodModel.getAllCategories()
        res.render("categories", { categories })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.get("/promotion", (req, res) => {
    res.render("promotion")
})

app.get("/about", (req, res) => {
    res.render("about")
})

app.get("/contact", (req, res) => {
    res.render("contact")
})

app.get("/menu", (req, res) => {
    res.redirect("/foods")
})

app.get("/cart", requireLogin, (req, res) => {
    const cart = getCart(req)
    res.render("cart", { cart, total: getCartTotal(cart) })
})

app.post("/cart/add/:id", requireLogin, async (req, res) => {
    try {
        const food = await foodModel.getFoodById(req.params.id)
        if (!food) return res.status(404).send("Không tìm thấy món ăn")

        const cart = getCart(req)
        const existing = cart.find(item => item.foodId === food.id)
        if (existing) existing.quantity += 1
        else cart.push({ foodId: food.id, title: food.title, price: food.price, quantity: 1, image: food.image })
        req.session.cart = cart

        res.redirect("/cart")
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.post("/cart/update/:id", requireLogin, (req, res) => {
    const quantity = Number(req.body.quantity || 0)
    const cart = getCart(req).filter(item => item.foodId !== Number(req.params.id))
    if (quantity > 0) {
        const food = cart.find(item => item.foodId === Number(req.params.id))
        if (!food) {
            return res.redirect("/cart")
        }
    }
    if (quantity > 0) {
        cart.push({ foodId: Number(req.params.id), title: req.body.title, price: Number(req.body.price), quantity, image: req.body.image })
    }
    req.session.cart = cart
    res.redirect("/cart")
})

app.post("/cart/remove/:id", requireLogin, (req, res) => {
    req.session.cart = getCart(req).filter(item => item.foodId !== Number(req.params.id))
    res.redirect("/cart")
})

app.get("/checkout", requireLogin, async (req, res) => {
    const cart = getCart(req)
    const deliveryCompanies = await foodModel.getDeliveryCompanies()
    const [addresses] = await db.query("SELECT * FROM addresses WHERE username = ? ORDER BY id DESC", [req.session.user.username])
    res.render("checkout", {
        cart,
        total: getCartTotal(cart),
        error: null,
        user: req.session.user,
        isEmptyCart: cart.length === 0,
        deliveryCompanies,
        addresses
    })
})

app.post("/checkout", requireLogin, async (req, res) => {
    try {
        const cart = getCart(req)
        if (!cart.length) return res.redirect("/cart")

        const total = getCartTotal(cart)
        const paymentMethod = req.body.paymentMethod || "COD"
        const deliveryCompanyId = req.body.deliveryCompanyId || null
        const addressId = req.body.addressId || null

        const [userRows] = await db.query("SELECT * FROM users WHERE username = ?", [req.session.user.username])
        const currentUser = userRows[0]

        const [deliveryRows] = await db.query("SELECT name, fee FROM delivery_companies WHERE id = ?", [deliveryCompanyId])
        const deliveryCompany = deliveryRows.length ? deliveryRows[0].name : "Giao hàng tiêu chuẩn"
        const shippingFee = deliveryRows.length ? Number(deliveryRows[0].fee) : 0

        const [addressRows] = await db.query("SELECT address FROM addresses WHERE id = ? AND username = ?", [addressId, req.session.user.username])
        const deliveryAddress = addressRows.length ? addressRows[0].address : req.body.deliveryAddress || ""

        if (paymentMethod === "wallet" && Number(currentUser.balance || 0) < total + shippingFee) {
            return res.render("checkout", {
                cart,
                total,
                error: "Số dư ví không đủ để thanh toán. Vui lòng nạp tiền trước.",
                user: req.session.user,
                isEmptyCart: cart.length === 0,
                deliveryCompanies: await foodModel.getDeliveryCompanies(),
                addresses: await db.query("SELECT * FROM addresses WHERE username = ? ORDER BY id DESC", [req.session.user.username])[0]
            })
        }

        let status = "Chờ xác nhận"
        if (paymentMethod === "wallet") {
            await db.query("UPDATE users SET balance = balance - ? WHERE username = ?", [total + shippingFee, req.session.user.username])
            status = "Đã thanh toán bằng ví"
            req.session.user.balance = Number(currentUser.balance || 0) - total - shippingFee
        }

        const [result] = await db.query(
            "INSERT INTO orders (username, total, payment_method, status, delivery_company, delivery_address, shipping_fee) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [req.session.user.username, total, paymentMethod, status, deliveryCompany, deliveryAddress, shippingFee]
        )

        const orderId = result.insertId
        await Promise.all(cart.map(item =>
            db.query(
                "INSERT INTO order_items (order_id, food_id, title, price, quantity) VALUES (?, ?, ?, ?, ?)",
                [orderId, item.foodId, item.title, item.price, item.quantity]
            )
        ))

        req.session.cart = []
        if (paymentMethod === "Banking" || paymentMethod === "Momo") {
            return res.redirect(`/bank?orderId=${orderId}`)
        }

        res.redirect("/orders")
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})



app.get("/bank", requireLogin, (req, res) => {
    const orderId = req.query.orderId || null
    const topUpAmount = Number(req.query.amount || 0)
    res.render("bank", {
        orderId,
        totalPrice: topUpAmount,
        topUpAmount,
        user: req.session.user
    })
})

app.post("/payment-success", requireLogin, (req, res) => {
    const orderId = req.body.orderId || null
    const topUpAmount = Number(req.body.amount || 0)
    if (orderId) {
        db.query("UPDATE orders SET status = 'Đã thanh toán' WHERE id = ? AND username = ?", [orderId, req.session.user.username])
            .then(() => res.redirect("/orders"))
            .catch(error => {
                console.error(error)
                res.status(500).send(error.message)
            })
        return
    }

    if (topUpAmount > 0) {
        db.query(
            "UPDATE users SET balance = balance + ? WHERE username = ?",
            [topUpAmount, req.session.user.username]
        )
            .then(async () => {
                const [rows] = await db.query(
                    "SELECT balance FROM users WHERE username = ?",
                    [req.session.user.username]
                )
                req.session.user.balance = Number(rows[0].balance || 0)
                res.redirect("/wallet/top-up")
            })
            .catch(error => {
                console.error(error)
                res.status(500).send(error.message)
            })
        return
    }

    res.redirect("/orders")
})

app.get("/wallet", requireLogin, (req, res) => {
    res.redirect("/wallet/top-up")
})

app.get("/wallet/top-up", requireLogin, (req, res) => {
    res.render("wallet", { error: null, success: null, user: req.session.user })
})

app.post("/wallet/top-up", requireLogin, async (req, res) => {
    try {
        const amount = Number(req.body.amount || 0)
        if (!amount || amount <= 0) {
            return res.render("wallet", { error: "Số tiền nạp phải lớn hơn 0", success: null, user: req.session.user })
        }
        await db.query("UPDATE users SET balance = balance + ? WHERE username = ?", [amount, req.session.user.username])
        const [rows] = await db.query("SELECT balance FROM users WHERE username = ?", [req.session.user.username])
        req.session.user.balance = Number(rows[0].balance || 0)
        res.render("wallet", { error: null, success: `Nạp thành công ${amount.toLocaleString('vi-VN')} ₫ vào ví.`, user: req.session.user })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.get("/orders", requireLogin, async (req, res) => {
    try {
        const [orders] = await db.query(
            "SELECT * FROM orders WHERE username = ? ORDER BY id DESC",
            [req.session.user.username]
        )
        res.render("orders", { orders })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})



app.post("/admin/categories/add", requireLogin, requireAdmin, async (req, res) => {
    const { name } = req.body
    if (!name) return res.redirect("/admin/categories")
    await db.query("INSERT INTO categories(name) VALUES (?)", [name])
    res.redirect("/admin/categories")
})

app.post("/admin/categories/delete/:id", requireLogin, requireAdmin, async (req, res) => {
    await db.query("DELETE FROM categories WHERE id = ?", [req.params.id])
    res.redirect("/admin/categories")
})

app.get("/admin/orders", requireLogin, requireAdmin, async (req, res) => {
    const [orders] = await db.query("SELECT * FROM orders ORDER BY id DESC")
    res.render("order-manage", { orders, user: req.session.user })
})

app.post("/admin/orders/update/:id", requireLogin, requireAdmin, async (req, res) => {
    const { status } = req.body
    await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id])
    res.redirect("/admin/orders")
})

app.get("/admin/stats", requireLogin, requireAdmin, async (req, res) => {
    const [[{ totalRevenue }]] = await db.query("SELECT SUM(total + shipping_fee) AS totalRevenue FROM orders")
    const [[{ totalOrders }]] = await db.query("SELECT COUNT(*) AS totalOrders FROM orders")
    const [recentOrders] = await db.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5")
    res.render("admin-stats", { totalRevenue: totalRevenue || 0, totalOrders, recentOrders, user: req.session.user })
})

app.get("/news", async (req, res) => {
    try {
        const posts = await postModel.getAllPosts()
        res.render("news-list", { posts })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.get("/foods", async (req, res) => {
    try {
        const keyword = req.query.keyword || ""
        const categoryId = req.query.categoryId || ""
        const foods = await foodModel.getFoods({ keyword, categoryId })
        const categories = await foodModel.getAllCategories()
        res.render("foods", { foods, categories, keyword, categoryId })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.get("/admin/foods/add", requireLogin, requireAdmin, async (req, res) => {
    try {
        const categories = await foodModel.getAllCategories()
        res.render("add-food", { categories })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.post("/admin/foods/add", requireLogin, requireAdmin, async (req, res) => {
    try {
        const { title, description, price, category_id, image } = req.body
        await foodModel.createFood({ title, description, price, category_id, image })
        res.redirect("/foods")
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.all("/admin/foods/delete/:id", requireLogin, requireAdmin, async (req, res) => {
    if (req.method === "GET") {
        return res.redirect("/foods")
    }
    try {
        await db.query("DELETE FROM foods WHERE id = ?", [req.params.id])
        res.redirect("/foods")
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})


app.get("/admin/foods/edit/:id", requireLogin, requireAdmin, async (req, res) => {

    try {

        const food = await foodModel.getFoodById(req.params.id)

        const categories = await foodModel.getAllCategories()

        if (!food) {
            return res.status(404).send("Không tìm thấy món ăn")
        }

        res.render("edit-food", {
            food,
            categories
        })

    } catch (error) {

        console.error(error)
        res.status(500).send(error.message)

    }

})
app.get("/admin/categories/add", requireLogin, requireAdmin, async (req, res) => {
    try {
        const categories = await foodModel.getAllCategories()

        console.log(categories)

        res.render("categories-manage", {
            categories,
            user: req.session.user
        })

    } catch (err) {
        console.log(err)
        res.send(err.message)
    }
})


app.get("/foods/:id", async (req, res) => {
    try {
        const food = await foodModel.getFoodById(req.params.id)
        if (!food) return res.status(404).send("Không tìm thấy món ăn")
        const reviews = await foodModel.getReviewsByFoodId(req.params.id)
        const ratingSummary = await foodModel.getFoodRatingSummary(req.params.id)
        res.render("food-detail", { food, reviews, ratingSummary, user: req.session.user })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.post("/foods/:id/review", requireLogin, async (req, res) => {
    try {
        const { rating, comment } = req.body
        await foodModel.addReview(req.params.id, req.session.user.username, Number(rating), comment)
        res.redirect(`/foods/${req.params.id}`)
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.get("/news/search", async (req, res) => {
    try {
        const keyword = req.query.keyword || ""
        const [posts] = await db.query(
            "SELECT * FROM posts WHERE title LIKE ? OR description LIKE ? ORDER BY id DESC",
            [`%${keyword}%`, `%${keyword}%`]
        )
        res.render("news-list", { posts })
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.get("/news/add", requireLogin, postController.create)

app.post("/news/add", requireLogin, postController.store)

app.get("/news/:id/edit", requireLogin, async (req, res) => {
    try {
        const id = req.params.id
        const [rows] = await db.query(
            "SELECT * FROM posts WHERE id = ?",
            [id]
        )
        if (rows.length === 0) {
            return res.status(404).send("Không tìm thấy bài viết")
        }
        res.render("edit-post", { post: rows[0] })
    } catch (error) {
        console.log(error)
        res.send("Lỗi khi mở form sửa")
    }
})

app.post("/news/:id/edit", requireLogin, async (req, res) => {
    try {
        const id = req.params.id
        const title = req.body.title
        const description = req.body.description
        await db.query(
            "UPDATE posts SET title = ?, description = ? WHERE id = ?",
            [title, description, id]
        )
        res.redirect("/news")
    } catch (error) {
        console.log(error)
        res.send("Lỗi khi cập nhật bài viết")
    }
})

app.post("/news/:id/delete", requireLogin, async (req, res) => {
    try {
        const id = req.params.id
        await db.query(
            "DELETE FROM posts WHERE id = ?",
            [id]
        )
        res.redirect("/news")
    } catch (error) {
        console.log(error)
        res.send("Lỗi khi xóa bài viết")
    }
})

app.get("/news/:id", async (req, res) => {
    try {
        const id = req.params.id
        const [rows] = await db.query(
            "SELECT * FROM posts WHERE id = ?",
            [id]
        )
        if (rows.length === 0) {
            return res.status(404).send("Không tìm thấy bài viết")
        }
        res.render("news-detail", { post: rows[0] })
    } catch (error) {
        console.log(error)
        res.send("Lỗi khi xem chi tiết bài viết")
    }
})

const host = process.env.HOST || "localhost"
app.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`)
})
