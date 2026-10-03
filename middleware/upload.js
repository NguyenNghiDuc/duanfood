const fs = require('fs')
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')

const uploadDir = path.join(__dirname, '..', 'public', 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const extensionByMime = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extensionByMime[file.mimetype] || '.bin'
    const id = crypto.randomBytes(12).toString('hex')
    cb(null, `${Date.now()}-${id}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!extensionByMime[file.mimetype]) return cb(new Error('Chỉ hỗ trợ JPG, PNG hoặc WEBP.'))
    cb(null, true)
  }
})

module.exports = upload
