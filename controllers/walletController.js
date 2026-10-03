const userModel = require('../models/userModels')
const topupService = require('../lib/topupService')

async function showWallet(req, res, next) {
  try {
    const currentUser = await userModel.findByUsername(req.session.user.username)
    if (currentUser) req.session.user.balance = Number(currentUser.balance || 0)
    const topups = await topupService.listForUser(req.session.user.username)
    res.render('wallet', { error: null, success: req.query.success || null, user: req.session.user, topups })
  } catch (error) { next(error) }
}

async function createTopUp(req, res, next) {
  try {
    const amount = topupService.validAmount(req.body.amount)
    if (!amount) {
      const topups = await topupService.listForUser(req.session.user.username)
      return res.status(400).render('wallet', { error: 'Số tiền nạp phải từ 1.000đ đến 100.000.000đ.', success: null, user: req.session.user, topups })
    }
    const request = await topupService.createRequest(req.session.user.username, amount)
    return res.redirect(`/bank?topupId=${request.id}`)
  } catch (error) { next(error) }
}

async function showBank(req, res, next) {
  try {
    const topupId = Number(req.query.topupId || 0)
    if (topupId) {
      const request = await topupService.getById(topupId)
      if (!request || request.username !== req.session.user.username) return res.status(404).send('Không tìm thấy yêu cầu nạp tiền')
      return res.render('bank', { orderId: null, totalPrice: Number(request.amount), topUpAmount: Number(request.amount), topupRequest: request, user: req.session.user })
    }
    return res.redirect('/wallet/top-up')
  } catch (error) { next(error) }
}

async function confirmTransfer(req, res, next) {
  try {
    const id = Number(req.body.topupId || 0)
    const request = await topupService.getById(id)
    if (!request || request.username !== req.session.user.username) return res.status(404).send('Không tìm thấy yêu cầu nạp tiền')
    return res.redirect('/wallet/top-up?success=Đã gửi yêu cầu. Tiền chỉ được cộng sau khi shop xác nhận đã nhận chuyển khoản.')
  } catch (error) { next(error) }
}

module.exports = { showWallet, createTopUp, showBank, confirmTransfer }
