const foodModel = require('../models/foodModels')
const orderModel = require('../models/orderModels')

async function addCategory(req, res, next) {
  try {
    const { name } = req.body
    if (!name) return res.redirect('/admin/categories')
    await foodModel.addCategory(name)
    res.redirect('/admin/categories')
  } catch (error) {
    next(error)
  }
}

async function deleteCategory(req, res, next) {
  try {
    await foodModel.deleteCategory(req.params.id)
    res.redirect('/admin/categories')
  } catch (error) {
    next(error)
  }
}

async function showCategories(req, res, next) {
  try {
    const categories = await foodModel.getAllCategories()
    res.render('categories-manage', { categories, user: req.session.user })
  } catch (error) {
    next(error)
  }
}

async function listOrders(req, res, next) {
  try {
    const orders = await orderModel.getAllOrders()
    res.render('order-manage', { orders, user: req.session.user })
  } catch (error) {
    next(error)
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body
    await orderModel.updateOrderStatus(req.params.id, status)
    res.redirect('/admin/orders')
  } catch (error) {
    next(error)
  }
}

async function showStats(req, res, next) {
  try {
    const stats = await orderModel.getStats()
    res.render('admin-stats', { totalRevenue: stats.totalRevenue, totalOrders: stats.totalOrders, recentOrders: stats.recentOrders, user: req.session.user })
  } catch (error) {
    next(error)
  }
}

async function showAddFood(req, res, next) {
  try {
    const categories = await foodModel.getAllCategories()
    res.render('add-food', { categories })
  } catch (error) {
    next(error)
  }
}

async function addFood(req, res, next) {
  try {
    const { title, description, price, category_id, image } = req.body
    await foodModel.createFood({ title, description, price, category_id, image })
    res.redirect('/foods')
  } catch (error) {
    next(error)
  }
}

async function deleteFood(req, res, next) {
  try {
    await foodModel.deleteFood(req.params.id)
    res.redirect('/foods')
  } catch (error) {
    next(error)
  }
}

async function showEditFood(req, res, next) {
  try {
    const food = await foodModel.getFoodById(req.params.id)
    const categories = await foodModel.getAllCategories()
    if (!food) return res.status(404).send('Không tìm thấy món ăn')
    res.render('edit-food', { food, categories })
  } catch (error) {
    next(error)
  }
}

async function updateFood(req, res, next) {
  try {
    const { title, description, price, category_id, image } = req.body
    await foodModel.updateFood({ id: req.params.id, title, description, price, category_id, image })
    res.redirect('/foods')
  } catch (error) {
    next(error)
  }
}

module.exports = {
  addCategory,
  deleteCategory,
  showCategories,
  listOrders,
  updateOrderStatus,
  showStats,
  showAddFood,
  addFood,
  deleteFood,
  showEditFood,
  updateFood
}
