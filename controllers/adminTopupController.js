const topupService = require('../lib/topupService')

async function list(req, res, next) {
  try {
    const topups = await topupService.listAll()
    res.render('admin-topups', { topups, user: req.session.user, success: req.query.success || null, error: req.query.error || null })
  } catch (error) { next(error) }
}

async function approve(req, res) {
  try {
    await topupService.approve(Number(req.params.id), req.session.user.username)
    res.redirect('/admin/topups?success=Đã xác nhận tiền vào tài khoản shop và cộng ví cho khách.')
  } catch (error) {
    res.redirect('/admin/topups?error=' + encodeURIComponent(error.message))
  }
}

async function reject(req, res) {
  try {
    await topupService.reject(Number(req.params.id), req.session.user.username, req.body.note || '')
    res.redirect('/admin/topups?success=Đã từ chối yêu cầu nạp tiền.')
  } catch (error) {
    res.redirect('/admin/topups?error=' + encodeURIComponent(error.message))
  }
}

module.exports = { list, approve, reject }
