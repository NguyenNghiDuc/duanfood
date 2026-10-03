const db = require('../config/db')
const commerce = require('../lib/commerceService')
const walletLedger = require('../lib/walletLedger')
const orderModel = require('../models/orderModels')

async function showFavorites(req, res, next) {
  try { res.render('favorites', { foods: await commerce.listFavorites(req.session.user.username) }) } catch (e) { next(e) }
}

async function toggleFavorite(req, res, next) {
  try {
    const active = await commerce.toggleFavorite(req.session.user.username, Number(req.params.id))
    if (String(req.headers.accept || '').includes('application/json')) return res.json({ ok: true, active })
    res.redirect(req.get('referer') || '/favorites')
  } catch (e) { next(e) }
}

async function notifications(req, res, next) {
  try {
    const items = await commerce.listNotifications(req.session.user.username)
    if (String(req.headers.accept || '').includes('application/json')) return res.json({ ok: true, items, unread: items.filter(x => !Number(x.is_read)).length })
    res.render('notifications', { items })
  } catch (e) { next(e) }
}

async function readNotification(req, res, next) {
  try { await commerce.markNotificationRead(req.params.id, req.session.user.username); res.json({ ok: true }) } catch (e) { next(e) }
}

async function walletHistory(req, res, next) {
  try { res.render('wallet-history', { transactions: await walletLedger.listTransactions(req.session.user.username, 200), user: req.session.user }) } catch (e) { next(e) }
}

async function voucherPreview(req, res, next) {
  try {
    const total = Number(req.body.total || 0)
    const result = await commerce.validateVoucher(req.body.code, req.session.user.username, total)
    res.json({ ok: result.valid, discount: result.discount || 0, message: result.message || 'Áp dụng mã thành công' })
  } catch (e) { next(e) }
}

async function reorder(req, res, next) {
  try {
    const [items] = await db.query('SELECT oi.*, f.image, COALESCE(f.stock, 50) AS stock FROM order_items oi JOIN foods f ON f.id=oi.food_id JOIN orders o ON o.id=oi.order_id WHERE oi.order_id=? AND o.username=?', [req.params.id, req.session.user.username])
    const cart = []
    for (const item of items) {
      const quantity = Math.min(Number(item.quantity || 1), Math.max(0, Number(item.stock || 0)))
      if (quantity > 0) cart.push({ foodId: item.food_id, title: item.title, price: Number(item.price), quantity, image: item.image || '' })
    }
    req.session.cart = cart
    res.redirect('/cart')
  } catch (e) { next(e) }
}

async function showTickets(req, res, next) {
  try { res.render('tickets', { tickets: await commerce.listTicketsForUser(req.session.user.username), messages: [], activeTicket: null }) } catch (e) { next(e) }
}

async function showTicket(req, res, next) {
  try {
    const tickets = await commerce.listTicketsForUser(req.session.user.username)
    const activeTicket = tickets.find(t => Number(t.id) === Number(req.params.id))
    if (!activeTicket) return res.status(404).send('Không tìm thấy yêu cầu hỗ trợ')
    res.render('tickets', { tickets, activeTicket, messages: await commerce.getTicketMessages(activeTicket.id) })
  } catch (e) { next(e) }
}

async function createTicket(req, res, next) {
  try {
    const subject = String(req.body.subject || '').trim()
    const message = String(req.body.message || '').trim()
    if (!subject || !message) return res.status(400).send('Vui lòng nhập tiêu đề và nội dung')
    const id = await commerce.createTicket(req.session.user.username, subject, message)
    await commerce.notify(req.session.user.username, 'Đã tạo yêu cầu hỗ trợ', `Ticket #${id} đã được gửi tới CSKH.`, `/support/${id}`)
    res.redirect(`/support/${id}`)
  } catch (e) { next(e) }
}

async function replyTicket(req, res, next) {
  try {
    const tickets = await commerce.listTicketsForUser(req.session.user.username)
    if (!tickets.some(t => Number(t.id) === Number(req.params.id))) return res.status(404).send('Không tìm thấy ticket')
    await commerce.replyTicket(req.params.id, req.session.user.username, 'user', req.body.message || '')
    res.redirect(`/support/${req.params.id}`)
  } catch (e) { next(e) }
}

async function orderTimeline(req, res, next) {
  try {
    const order = await orderModel.getOrderById(req.params.id)
    if (!order || order.username !== req.session.user.username) return res.status(404).send('Không tìm thấy đơn hàng')
    const statuses = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã giao']
    const current = statuses.indexOf(order.status)
    res.render('order-timeline', { order, statuses, current })
  } catch (e) { next(e) }
}

module.exports = { showFavorites, toggleFavorite, notifications, readNotification, walletHistory, voucherPreview, reorder, showTickets, showTicket, createTicket, replyTicket, orderTimeline }
