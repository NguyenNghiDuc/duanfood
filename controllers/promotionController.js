const promotionModel = require('../models/promotionModels')

async function showPromotion(req, res, next) {
  try {
    const adminPromotions = await promotionModel.getAllPromotions()
    res.render('promotion', {
      adminPromotions,
      user: req.session.user || null
    })
  } catch (error) {
    next(error)
  }
}

async function store(req, res, next) {
  try {
    const { title, description } = req.body
    if (!title || !description) {
      return res.redirect('/promotion')
    }

    await promotionModel.createPromotion(title.trim(), description.trim())
    res.redirect('/promotion')
  } catch (error) {
    next(error)
  }
}

async function remove(req, res, next) {
  try {
    await promotionModel.deletePromotion(req.params.id)
    res.redirect('/promotion')
  } catch (error) {
    next(error)
  }
}

module.exports = {
  showPromotion,
  store,
  remove
}
