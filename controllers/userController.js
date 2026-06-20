const bcrypt = require('bcrypt')
const db = require('../config/db')
const userModel = require('../models/userModels')
const orderModel = require('../models/orderModels')

async function showRegister(req, res) {
  res.render('register', { error: null })
}

async function register(req, res, next) {
  try {
    const { username, password } = req.body
    const existing = await userModel.findByUsername(username)
    if (existing) return res.render('register', { error: 'Tên đăng nhập đã tồn tại' })
    const hash = await bcrypt.hash(password, 10)
    await userModel.createUser({ username, password: hash })
    res.redirect('/login')
  } catch (error) {
    next(error)
  }
}

async function showLogin(req, res) {
  res.render('login', { error: null })
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body
    const user = await userModel.findByUsername(username)
    if (!user) return res.render('login', { error: 'Sai username hoặc password' })
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.render('login', { error: 'Sai username hoặc password' })
    const isAdmin = username === 'admin'
    req.session.user = { username, role: isAdmin ? 'admin' : 'user', balance: Number(user.balance || 0) }
    res.redirect('/')
  } catch (error) {
    next(error)
  }
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/'))
}

async function showBank(req, res) {
  const orderId = req.query.orderId || null
  const topUpAmount = Number(req.query.amount || 0)
  res.render('bank', { orderId, totalPrice: topUpAmount, topUpAmount, user: req.session.user })
}

async function paymentSuccess(req, res, next) {
  try {
    const orderId = req.body.orderId || null
    const topUpAmount = Number(req.body.amount || 0)
    if (orderId) {
      await orderModel.updateOrderStatusForUser(orderId, req.session.user.username, 'Đã thanh toán')
      return res.redirect('/orders')
    }
    if (topUpAmount > 0) {
      await userModel.updateBalance(req.session.user.username, topUpAmount)
      const currentUser = await userModel.findByUsername(req.session.user.username)
      req.session.user.balance = Number(currentUser.balance || 0)
      return res.redirect('/wallet/top-up')
    }
    res.redirect('/orders')
  } catch (error) {
    next(error)
  }
}

async function showWalletTopUp(req, res) {
  res.render('wallet', { error: null, success: null, user: req.session.user })
}

async function showProfile(req, res, next) {
  try {
    const currentUser = await userModel.findByUsername(req.session.user.username)
    if (!currentUser) return res.status(404).send('Không tìm thấy tài khoản')
    res.render('profile', { user: req.session.user, fullname: currentUser.fullname || '' })
  } catch (error) {
    next(error)
  }
}

async function showEditProfile(req, res, next) {
  try {
    const currentUser = await userModel.findByUsername(req.session.user.username)
    if (!currentUser) return res.status(404).send('Không tìm thấy tài khoản')
    res.render('profile-edit', {
      user: req.session.user,
      fullname: currentUser.fullname || '',
      error: null,
      success: null
    })
  } catch (error) {
    next(error)
  }
}

async function updateProfile(req, res, next) {
  try {
    const { fullname = '', password = '', confirmPassword = '' } = req.body
    if (password && password !== confirmPassword) {
      return res.render('profile-edit', {
        user: req.session.user,
        fullname,
        error: 'Mật khẩu xác nhận không khớp',
        success: null
      })
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : ''
    await userModel.updateProfile(req.session.user.username, { fullname, password: hashedPassword })

    const currentUser = await userModel.findByUsername(req.session.user.username)
    req.session.user.fullname = currentUser.fullname || fullname || ''

    res.render('profile-edit', {
      user: req.session.user,
      fullname: req.session.user.fullname || '',
      error: null,
      success: 'Cập nhật hồ sơ thành công'
    })
  } catch (error) {
    next(error)
  }
}

async function walletTopUp(req, res, next) {
  try {
    const amount = Number(req.body.amount || 0)
    if (!amount || amount <= 0) return res.render('wallet', { error: 'Số tiền nạp phải lớn hơn 0', success: null, user: req.session.user })
    await db.query('UPDATE users SET balance = balance + ? WHERE username = ?', [amount, req.session.user.username])
    const [rows] = await db.query('SELECT balance FROM users WHERE username = ?', [req.session.user.username])
    req.session.user.balance = Number(rows[0].balance || 0)
    res.render('wallet', { error: null, success: `Nạp thành công ${amount.toLocaleString('vi-VN')} ₫ vào ví.`, user: req.session.user })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  showRegister,
  register,
  showLogin,
  login,
  logout,
  showBank,
  paymentSuccess,
  showWalletTopUp,
  showProfile,
  showEditProfile,
  updateProfile,
  walletTopUp
}
