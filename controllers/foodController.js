const foodModel = require('../models/foodModels')

async function showHome(req, res, next) {
  try {
    const foods = await foodModel.getFoods({})
    const categories = await foodModel.getAllCategories()

    res.render('home', {
      foods: (foods || []).slice(0, 6),
      categories: categories || []
    })
  } catch (error) {
    next(error)
  }
}

async function showFoods(req, res, next) {
  try {
    const keyword = req.query.keyword || ''
    const categoryId = req.query.categoryId || ''

    const categories = await foodModel.getAllCategories()

    const foods = await foodModel.getFoods({
      keyword,
      categoryId
    })

    res.render('foods', {
      foods,
      categories,
      keyword,
      categoryId
    })
  } catch (error) {
    next(error)
  }
}

async function showFoodDetail(req, res, next) {
  try {
    const food = await foodModel.getFoodById(req.params.id)

    if (!food) {
      return res.status(404).send('Không tìm thấy món ăn')
    }

    const reviews = await foodModel.getReviewsByFoodId(req.params.id)
    const ratingSummary = await foodModel.getFoodRatingSummary(req.params.id)

    res.render('food-detail', {
      food,
      reviews,
      ratingSummary,
      user: req.session.user
    })
  } catch (error) {
    next(error)
  }
}

async function createReview(req, res, next) {
  try {
    const { rating, comment } = req.body

    await foodModel.addReview(
      req.params.id,
      req.session.user.username,
      Number(rating),
      comment
    )

    res.redirect(`/foods/${req.params.id}`)
  } catch (error) {
    next(error)
  }
}

async function showCategories(req, res, next) {
  try {
    const categories = await foodModel.getAllCategories()

    res.render('categories', {
      categories
    })
  } catch (error) {
    next(error)
  }
}

function showPromotion(req, res) {
  res.render('promotion')
}

function showAbout(req, res) {
  res.render('about')
}

function showContact(req, res) {
  res.render('contact')
}

function redirectMenu(req, res) {
  res.redirect('/foods')
}

module.exports = {
  showHome,
  showFoods,
  showFoodDetail,
  createReview,
  showCategories,
  showPromotion,
  showAbout,
  showContact,
  redirectMenu
}