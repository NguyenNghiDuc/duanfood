const express = require("express")
const path = require("path")
const db = require("./config/db")
const session = require("express-session")
const postModel = require("./controllers/postModel")
const postController = require("./controllers/postController")
const foodModel = require("./controllers/foodModel")
const app = express()
const port = 5000
app.set("view engine", "ejs")

app.use(express.urlencoded({extended:true}))
app.use(express.static(path.join(__dirname, "public")))

app.use(session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: false
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

async function start() {
  try {
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) NOT NULL DEFAULT 0")
    await db.query("INSERT IGNORE INTO users (username, password, balance) VALUES (?, ?, 0)", ["admin", "admin"])
    await foodModel.initFoodSchema()
    console.log("Food schema initialized")
  } catch (error) {
    console.error("Food schema init failed", error)
  }
}
start()

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
        await db.query(
            "INSERT INTO users(username, password, balance) VALUES (?, ?, 0)",
            [username, password]
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
    const username = req.body.username
    const password = req.body.password
    const [users] = await db.query(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username, password]
    )
    if (users.length === 0) {
        return res.render("login", { error: "Sai username hoặc password" })
    }
    const user = users[0]
    const isAdmin = username === "admin" && password === "admin"
    req.session.user = {
        username,
        role: isAdmin ? "admin" : "user",
        balance: Number(user.balance || 0)
    }
    return res.redirect("/news")
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

app.get("/checkout", requireLogin, (req, res) => {
    const cart = getCart(req)
    if (!cart.length) return res.redirect("/cart")
    res.render("checkout", { cart, total: getCartTotal(cart), error: null, user: req.session.user })
})

app.post("/checkout", requireLogin, async (req, res) => {
    try {
        const cart = getCart(req)
        if (!cart.length) return res.redirect("/cart")

        const total = getCartTotal(cart)
        const paymentMethod = req.body.paymentMethod || "COD"
        const [userRows] = await db.query("SELECT * FROM users WHERE username = ?", [req.session.user.username])
        const currentUser = userRows[0]

        if (paymentMethod === "wallet" && Number(currentUser.balance || 0) < total) {
            return res.render("checkout", {
                cart,
                total,
                error: "Số dư ví không đủ để thanh toán. Vui lòng nạp tiền trước.",
                user: req.session.user
            })
        }

        let status = "Chờ xác nhận"
        if (paymentMethod === "wallet") {
            await db.query("UPDATE users SET balance = balance - ? WHERE username = ?", [total, req.session.user.username])
            status = "Đã thanh toán bằng ví"
            req.session.user.balance = Number(currentUser.balance || 0) - total
        }

        const [result] = await db.query(
            "INSERT INTO orders (username, total, payment_method, status) VALUES (?, ?, ?, ?)",
            [req.session.user.username, total, paymentMethod, status]
        )

        const orderId = result.insertId
        await Promise.all(cart.map(item =>
            db.query(
                "INSERT INTO order_items (order_id, food_id, title, price, quantity) VALUES (?, ?, ?, ?, ?)",
                [orderId, item.foodId, item.title, item.price, item.quantity]
            )
        ))

        req.session.cart = []
        res.redirect("/orders")
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
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

app.get("/profile", requireLogin, (req, res) => {
    res.render("profile", { user: req.session.user })
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

app.get("/foods/:id", async (req, res) => {
    try {
        const food = await foodModel.getFoodById(req.params.id)
        if (!food) return res.status(404).send("Không tìm thấy món ăn")
        res.render("food-detail", { food })
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

app.listen(port, "localhost", () => {
  console.log(`Server is running at http://localhost:${port}`)
})
