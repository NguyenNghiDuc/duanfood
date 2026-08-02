const foodModel = require('../models/foodModels')
const orderModel = require('../models/orderModels')
const chatIndex = require('../lib/chatIndex')

function normalizePrice(price) {
  const value = Number(String(price || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(value) ? value : 0
}

function sanitizeImage(image) {
  if (typeof image !== 'string') return ''
  const trimmed = image.trim()
  if (!trimmed) return ''
  const safe = trimmed.replace(/\\/g, '/').trim()
  return safe.length > 500 ? safe.slice(0, 500) : safe
}

function buildFoodDescription({ description, ingredients }) {
  const parts = []
  const explicitDescription = String(description || '').trim()
  if (explicitDescription) parts.push(explicitDescription)
  const ingredientText = String(ingredients || '').trim()
  if (ingredientText) parts.push(`Nguyên liệu: ${ingredientText}`)
  return parts.join('\n')
}

function getFoodFormData(body = {}) {
  const title = String(body.title || '').trim()
  const description = String(body.description || '').trim()
  const ingredients = String(body.ingredients || '').trim()
  const priceValue = Number(String(body.price || '').replace(/[^0-9.-]/g, ''))
  const quantityValue = body.quantity === '' || body.quantity === undefined || body.quantity === null
    ? 0
    : Number(body.quantity)
  const categoryId = body.category_id || body.categoryId || ''
  const image = sanitizeImage(body.image)

  return {
    title,
    description,
    ingredients,
    priceValue,
    quantityValue,
    categoryId,
    image
  }
}

function validateFoodPayload(body = {}) {
  const errors = {}
  const data = getFoodFormData(body)

  if (!data.title) {
    errors.title = 'Tên món không được rỗng.'
  } else if (data.title.length > 200) {
    errors.title = 'Tên món không được quá 200 ký tự.'
  }

  if (Number.isNaN(data.priceValue) || !Number.isFinite(data.priceValue)) {
    errors.price = 'Giá phải là số.'
  } else if (data.priceValue <= 0) {
    errors.price = 'Giá phải lớn hơn 0.'
  }

  if (data.categoryId === '' || Number(data.categoryId) <= 0) {
    errors.category_id = 'Danh mục không hợp lệ.'
  }

  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== '' && Number.isNaN(Number(body.quantity))) {
    errors.quantity = 'Số lượng không hợp lệ.'
  }

  if (data.quantityValue < 0) {
    errors.quantity = 'Số lượng phải >= 0.'
  }

  if (data.description.length > 2000) {
    errors.description = 'Mô tả quá dài.'
  }

  return {
    errors,
    data
  }
}

async function refreshChatIndex() {
  try {
    await chatIndex.buildIndex()
  } catch (error) {
    console.error('[admin-food] refresh chat index failed:', error.message)
  }
}

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

async function listFoods(req, res, next) {
  try {
    const keyword = (req.query.keyword || '').trim()
    const categoryId = (req.query.categoryId || '').trim()
    const sort = (req.query.sort || 'new').trim()
    const successKey = String(req.query.success || '')
    const successMessage = {
      created: 'Thêm món thành công.',
      updated: 'Cập nhật món thành công.',
      deleted: 'Xóa món thành công.'
    }[successKey] || null

    const categories = await foodModel.getAllCategories()
    const foods = await foodModel.getFoods({ keyword, categoryId, sort })

    res.render('foods', {
      foods,
      categories,
      keyword,
      categoryId,
      sort,
      success: successMessage,
      user: req.session.user || null
    })
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

async function showCreateFood(req, res, next) {
  try {
    const categories = await foodModel.getAllCategories()
    res.render('add-food', {
      categories,
      formData: {},
      error: null,
      success: null,
      user: req.session.user || null
    })
  } catch (error) {
    next(error)
  }
}

async function showAddFood(req, res, next) {
  return showCreateFood(req, res, next)
}

async function createFood(req, res, next) {
  try {
    const { errors, data } = validateFoodPayload(req.body || {})
    const categories = await foodModel.getAllCategories()

    if (Object.keys(errors).length > 0 || !categories.some((category) => Number(category.id) === Number(data.categoryId))) {
      const finalErrors = { ...errors }
      if (!categories.some((category) => Number(category.id) === Number(data.categoryId))) {
        finalErrors.category_id = 'Danh mục không hợp lệ.'
      }

      return res.status(400).render('add-food', {
        categories,
        formData: req.body,
        error: finalErrors.category_id || finalErrors.title || finalErrors.price || finalErrors.quantity || 'Thêm món thất bại. Vui lòng thử lại.',
        success: null,
        user: req.session.user || null
      })
    }

    const finalDescription = buildFoodDescription({
      description: data.description,
      ingredients: data.ingredients
    })

    await foodModel.createFood({
      title: data.title,
      description: finalDescription || null,
      price: data.priceValue,
      category_id: Number(data.categoryId),
      image: data.image,
      gram: Math.max(0, Number(data.quantityValue || 0))
    })

    await refreshChatIndex()
    return res.redirect('/foods?success=created')
  } catch (error) {
    console.error('[admin-food] create failed:', error)
    const categories = await foodModel.getAllCategories().catch(() => [])
    return res.status(500).render('add-food', {
      categories,
      formData: req.body || {},
      error: 'Thêm món thất bại. Vui lòng thử lại.',
      success: null,
      user: req.session.user || null
    })
  }
}

async function addFood(req, res, next) {
  return createFood(req, res, next)
}

async function deleteFood(req, res, next) {
  try {
    await foodModel.deleteFood(req.params.id)
    await refreshChatIndex()
    res.redirect('/foods?success=deleted')
  } catch (error) {
    next(error)
  }
}

async function showEditFood(req, res, next) {
  try {
    const food = await foodModel.getFoodById(req.params.id)
    const categories = await foodModel.getAllCategories()
    if (!food) return res.status(404).send('Không tìm thấy món ăn')

    const formData = {
      title: food.title || '',
      description: food.description || '',
      ingredients: String(food.description || '').includes('Nguyên liệu:')
        ? String(food.description || '').split('Nguyên liệu:')[1]?.trim() || ''
        : '',
      price: Number(food.price || 0),
      category_id: food.category_id,
      image: food.image || '',
      quantity: Number(food.gram || 0)
    }

    res.render('edit-food', { food, categories, formData, error: null, user: req.session.user || null })
  } catch (error) {
    next(error)
  }
}

async function updateFood(req, res, next) {
  try {
    const { errors, data } = validateFoodPayload(req.body || {})
    const categories = await foodModel.getAllCategories()
    const id = req.params.id

    if (Object.keys(errors).length > 0 || !categories.some((category) => Number(category.id) === Number(data.categoryId))) {
      const finalErrors = { ...errors }
      if (!categories.some((category) => Number(category.id) === Number(data.categoryId))) {
        finalErrors.category_id = 'Danh mục không hợp lệ.'
      }

      const existingFood = await foodModel.getFoodById(id)
      return res.status(400).render('edit-food', {
        food: existingFood,
        categories,
        formData: req.body,
        error: finalErrors.category_id || finalErrors.title || finalErrors.price || finalErrors.quantity || 'Cập nhật thất bại. Vui lòng thử lại.',
        user: req.session.user || null
      })
    }

    const description = buildFoodDescription({
      description: data.description,
      ingredients: data.ingredients
    })

    await foodModel.updateFood({
      id,
      title: data.title,
      description: description || null,
      price: data.priceValue,
      category_id: Number(data.categoryId),
      image: data.image,
      gram: Math.max(0, Number(data.quantityValue || 0))
    })

    await refreshChatIndex()
    return res.redirect('/foods?success=updated')
  } catch (error) {
    console.error('[admin-food] update failed:', error)
    const categories = await foodModel.getAllCategories().catch(() => [])
    const existingFood = await foodModel.getFoodById(req.params.id).catch(() => null)
    return res.status(500).render('edit-food', {
      food: existingFood,
      categories,
      formData: req.body || {},
      error: 'Cập nhật món thất bại. Vui lòng thử lại.',
      user: req.session.user || null
    })
  }
}

module.exports = {
  addCategory,
  deleteCategory,
  showCategories,
  listFoods,
  listOrders,
  updateOrderStatus,
  showStats,
  showCreateFood,
  createFood,
  showAddFood,
  addFood,
  deleteFood,
  showEditFood,
  updateFood
}
