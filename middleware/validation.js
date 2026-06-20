const { body, validationResult } = require('express-validator')

const registerValidation = [
  body('username').trim().notEmpty().withMessage('Username không được trống'),
  body('password').trim().isLength({ min: 6 }).withMessage('Password phải có ít nhất 6 ký tự')
]

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username không được trống'),
  body('password').trim().notEmpty().withMessage('Password không được trống')
]

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const message = errors.array()[0].msg
    const view = req.path.includes('/login') ? 'login' : 'register'
    return res.status(422).render(view, { error: message })
  }
  next()
}

module.exports = {
  registerValidation,
  loginValidation,
  handleValidationErrors
}
