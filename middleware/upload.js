const fs = require('fs')
const multer = require('multer')
const path = require('path')

const uploadDir = path.join(__dirname, '..', 'public', 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

function safeFileName(originalName) {
  const base = path.basename(String(originalName || '').replace(/\\/g, '/'))
  const sanitized = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .trim()
  return sanitized || `upload-${Date.now()}.png`
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(safeFileName(file.originalname)) || '.png'
    const baseName = path.basename(safeFileName(file.originalname), ext)
    const safeName = `${Date.now()}-${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`
    cb(null, safeName)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Chỉ hỗ trợ JPG, JPEG, PNG, WEBP.'))
    }
    cb(null, true)
  }
})

module.exports = upload
