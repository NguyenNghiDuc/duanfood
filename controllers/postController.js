const postModel = require('../models/postModels')

async function index(req, res, next) {
  try {
    const posts = await postModel.getAllPosts()
    res.render('news-list', { posts })
  } catch (error) {
    next(error)
  }
}

async function show(req, res, next) {
  try {
    const post = await postModel.getPostById(req.params.id)
    if (!post) return res.status(404).send('Không tìm thấy bài viết')
    res.render('news-detail', { post })
  } catch (error) {
    next(error)
  }
}

async function search(req, res, next) {
  try {
    const keyword = req.query.keyword || ''
    const posts = await postModel.searchPosts(keyword)
    res.render('news-list', { posts })
  } catch (error) {
    next(error)
  }
}

function create(req, res) {
  res.render('add-post')
}

async function store(req, res, next) {
  try {
    await postModel.createPost({ title: req.body.title, description: req.body.description })
    res.redirect('/news')
  } catch (error) {
    next(error)
  }
}

async function edit(req, res, next) {
  try {
    const post = await postModel.getPostById(req.params.id)
    if (!post) return res.status(404).send('Không tìm thấy bài viết')
    res.render('edit-post', { post })
  } catch (error) {
    next(error)
  }
}

async function update(req, res, next) {
  try {
    await postModel.updatePost({ id: req.params.id, title: req.body.title, description: req.body.description })
    res.redirect('/news')
  } catch (error) {
    next(error)
  }
}

async function remove(req, res, next) {
  try {
    await postModel.deletePost(req.params.id)
    res.redirect('/news')
  } catch (error) {
    next(error)
  }
}

module.exports = {
  index,
  show,
  search,
  create,
  store,
  edit,
  update,
  remove
}
