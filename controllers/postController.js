const db = require("../config/db")
const postModel = require("./postModel")

async function index(req, res) {
  try {
    const posts = await postModel.getAllPosts()
    res.render("news-list", { posts })
  } catch (error) {
    console.error(error)
    res.status(500).send(error.message)
  }
}

async function show(req, res) {
  try {
    const id = req.params.id
    const [rows] = await db.query("SELECT * FROM posts WHERE id = ?", [id])
    if (rows.length === 0) {
      return res.status(404).send("Không tìm thấy bài viết")
    }
    res.render("news-detail", { post: rows[0] })
  } catch (error) {
    console.log(error)
    res.send("Lỗi khi xem chi tiết bài viết")
  }
}

async function search(req, res) {
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
}

function create(req, res) {
  res.render("add-post")
}

async function store(req, res) {
  try {
    const title = req.body.title
    const description = req.body.description
    await postModel.createPost(title, description)
    res.redirect("/news")
  } catch (error) {
    console.log(error)
    res.send("Lỗi khi thêm bài viết")
  }
}

module.exports = {
  index,
  show,
  search,
  create,
  store
}
