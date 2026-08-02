const bcrypt = require('bcryptjs')
const db = require('../config/db')
const userModel = require('../models/userModels')
const orderModel = require('../models/orderModels')
const addressModel = require('../models/addressModel')

async function showRegister(req, res) {
  res.render('register', { error: null })
}

async function register(req, res, next) {
  try {
    const { username, password, phone, fullname, address } = req.body

    const existing = await userModel.findByUsername(username)
    if (existing) {
      return res.render('register', {
        error: 'Tên đăng nhập đã tồn tại'
      })
    }

    const hash = await bcrypt.hash(password, 10)

    // if phone provided, send OTP and store pending registration in session
    if (phone && phone.trim()) {
      const otp = String(Math.floor(100000 + Math.random() * 900000))
      const expires = Date.now() + 5 * 60 * 1000 // 5 minutes

      // send SMS via Twilio if configured, else log to console
      try {
        if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM) {
          const accountSid = process.env.TWILIO_SID
          const authToken = process.env.TWILIO_TOKEN
          const from = process.env.TWILIO_FROM
          const to = phone
          const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
          const body = new URLSearchParams({ From: from, To: to, Body: `Mã OTP của bạn là: ${otp}` })
          await fetch(url, { method: 'POST', body, headers: { Authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64') } })
        } else {
          console.log(`SIMULATED SMS -> ${phone}: Mã OTP của bạn là ${otp}`)
        }
      } catch (e) {
        console.error('SMS send error', e)
      }

      req.session.pendingRegister = {
        username,
        passwordHash: hash,
        phone,
        fullname: fullname || '',
        address: address || '',
        otp,
        otpExpires: expires
      }

      return res.render('register-verify', { phone, error: null })
    }

    // no phone -> create directly
    await userModel.createUser({
      username,
      password: hash,
      fullname: fullname || '',
      phone: phone || '',
      address: address || ''
    })

    res.redirect('/login')
  } catch (error) {
    next(error)
  }
}

async function showVerify(req, res) {
  const pending = req.session.pendingRegister || {}
  if (!pending || !pending.username) return res.redirect('/register')
  res.render('register-verify', { phone: pending.phone, error: null })
}

async function verifyRegister(req, res, next) {
  try {
    const { otp } = req.body
    const pending = req.session.pendingRegister
    if (!pending) return res.redirect('/register')

    if (Date.now() > (pending.otpExpires || 0)) {
      req.session.pendingRegister = null
      return res.render('register-verify', { phone: pending.phone, error: 'Mã OTP đã hết hạn. Vui lòng đăng ký lại.' })
    }

    if (String(otp).trim() !== String(pending.otp).trim()) {
      return res.render('register-verify', { phone: pending.phone, error: 'Mã OTP không chính xác' })
    }

    // create user
    await userModel.createUser({
      username: pending.username,
      password: pending.passwordHash,
      fullname: pending.fullname || '',
      phone: pending.phone || '',
      address: pending.address || ''
    })

    req.session.pendingRegister = null
    res.redirect('/login')
  } catch (err) {
    next(err)
  }
}

async function showLogin(req, res) {
  res.render('login', { error: null })
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body

    const user = await userModel.findByUsername(username)

    if (!user) {
      return res.render('login', {
        error: 'Sai username hoặc password'
      })
    }

    const match = await bcrypt.compare(password, user.password)

    if (!match) {
      return res.render('login', {
        error: 'Sai username hoặc password'
      })
    }

    const isAdmin = username === 'admin'

    req.session.user = {
      username,
      role: isAdmin ? 'admin' : 'user',
      balance: Number(user.balance || 0),
      fullname: user.fullname || ''
    }

    res.redirect('/')
  } catch (error) {
    next(error)
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/')
  })
}

async function showBank(req, res) {
  const orderId = req.query.orderId || null
  const topUpAmount = Number(req.query.amount || 0)
  let totalPrice = topUpAmount

  if (orderId && !topUpAmount) {
    const order = await orderModel.getOrderById(orderId)
    if (order) {
      totalPrice = Number(order.total || 0) + Number(order.shipping_fee || 0)
    }
  }

  res.render('bank', {
    orderId,
    totalPrice,
    topUpAmount,
    user: req.session.user
  })
}

async function paymentSuccess(req, res, next) {
  try {
    const orderId = req.body.orderId || null
    const topUpAmount = Number(req.body.amount || 0)

    if (orderId) {
      await orderModel.updateOrderStatusForUser(
        orderId,
        req.session.user.username,
        'Đã thanh toán'
      )

      return res.redirect('/orders')
    }

    if (topUpAmount > 0) {
      await userModel.updateBalance(
        req.session.user.username,
        topUpAmount
      )

      const currentUser = await userModel.findByUsername(
        req.session.user.username
      )

      req.session.user.balance = Number(currentUser.balance || 0)

      return res.redirect('/wallet/top-up')
    }

    res.redirect('/orders')
  } catch (error) {
    next(error)
  }
}

async function showWalletTopUp(req, res) {
  res.render('wallet', {
    error: null,
    success: null,
    user: req.session.user
  })
}

async function showProfile(req, res, next) {
  try {
    const sessionUser = req.session.user || {}
    const currentUser = await userModel.findByUsername(
      sessionUser.username
    )

    if (!currentUser) {
      return res.redirect('/login')
    }

    const addresses = await addressModel.getAddressesByUsername(
      sessionUser.username
    )

    const defaultAddress =
      (addresses || []).find(addr => addr.is_default) || null

    res.render('profile', {
      user: sessionUser,
      fullname: currentUser.fullname || sessionUser.fullname || '',
      defaultAddress,
      addressesCount: (addresses || []).length
    })
  } catch (error) {
    next(error)
  }
}

async function showEditProfile(req, res, next) {
  try {
    const currentUser = await userModel.findByUsername(
      req.session.user.username
    )

    if (!currentUser) {
      return res.status(404).send('Không tìm thấy tài khoản')
    }

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
    const {
      fullname = '',
      password = '',
      confirmPassword = ''
    } = req.body

    if (password && password !== confirmPassword) {
      return res.render('profile-edit', {
        user: req.session.user,
        fullname,
        error: 'Mật khẩu xác nhận không khớp',
        success: null
      })
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : ''

    await userModel.updateProfile(
      req.session.user.username,
      {
        fullname,
        password: hashedPassword
      }
    )

    const currentUser = await userModel.findByUsername(
      req.session.user.username
    )

    req.session.user.fullname =
      currentUser.fullname || fullname || ''

    res.render('profile-edit', {
      user: req.session.user,
      fullname: req.session.user.fullname,
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

    if (!amount || amount <= 0) {
      return res.render('wallet', {
        error: 'Số tiền nạp phải lớn hơn 0',
        success: null,
        user: req.session.user
      })
    }

    await db.query(
      'UPDATE users SET balance = balance + ? WHERE username = ?',
      [amount, req.session.user.username]
    )

    const [rows] = await db.query(
      'SELECT balance FROM users WHERE username = ?',
      [req.session.user.username]
    )

    req.session.user.balance = Number(rows[0].balance || 0)

    res.render('wallet', {
      error: null,
      success: `Nạp thành công ${amount.toLocaleString('vi-VN')} ₫ vào ví.`,
      user: req.session.user
    })
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
  walletTopUp,
  showVerify,
  verifyRegister
}