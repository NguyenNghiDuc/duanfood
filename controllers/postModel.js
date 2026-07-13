const db = require("../config/db")

async function getAllPosts() {
    const [posts] = await db.query(
        "SELECT * FROM posts ORDER BY id DESC"
    )
    return posts
}

async function createPost(title, description) {
    await db.query(
        "INSERT INTO posts(title, description) VALUES (?, ?)",
        [title, description]
    )
}

module.exports = {
    getAllPosts,
    createPost
}