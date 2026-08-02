const foodModel = require('../models/foodModels')
const postModel = require('../models/postModels')

async function showHome(req, res, next) {
  try {
    const foods = await foodModel.getFoods({})
    const categories = await foodModel.getAllCategories()
    const posts = await postModel.getAllPosts()

    res.render('home', {
      foods: (foods || []).slice(0, 6),
      categories: categories || [],
      posts: posts || []
    })
  } catch (error) {
    next(error)
  }
}

async function showFoods(req, res, next) {
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

    console.log('[showFoods] keyword=', keyword, 'categoryId=', categoryId, 'sort=', sort)

    const categories = await foodModel.getAllCategories()

    const foods = await foodModel.getFoods({
      keyword,
      categoryId,
      sort
    })

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
  res.render('contact', { user: req.session.user || null })
}

function redirectMenu(req, res) {
  res.redirect('/foods')
}

async function recommendFoods(req, res, next) {
  try {
    const id = Number(req.params.id)
    const baseFood = await foodModel.getFoodById(id)

    if (!baseFood) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn' })
    }

    const foods = await foodModel.getFoods({})

    // simple content-based scoring
    function normalize(text) {
      return String(text || '')
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
    }

    const baseWords = new Set(
      normalize(baseFood.title + ' ' + (baseFood.description || '')).split(/\W+/).filter(Boolean)
    )

    const scored = foods
      .filter((f) => f.id !== id)
      .map((f) => {
        let score = 0
        if (f.category_id && baseFood.category_id && Number(f.category_id) === Number(baseFood.category_id)) {
          score += 5
        }

        const words = new Set(
          normalize(f.title + ' ' + (f.description || '')).split(/\W+/).filter(Boolean)
        )
        let overlap = 0
        for (const w of words) if (baseWords.has(w)) overlap++
        score += overlap

        // small boost for closer price
        try {
          const p1 = Number(baseFood.price || 0)
          const p2 = Number(f.price || 0)
          const diff = Math.abs(p1 - p2)
          if (!isNaN(diff)) score += Math.max(0, 2 - Math.floor(diff / 20000))
        } catch (e) {}

        return { food: f, score }
      })
      .sort((a, b) => b.score - a.score)

    const results = scored.slice(0, 6).map((s) => s.food)

    res.json({ recommendations: results })
  } catch (error) {
    next(error)
  }
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
  ,recommendFoods
}