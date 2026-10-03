const fs = require('fs/promises')
const crypto = require('crypto')

function configured() { return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) }

function sign(params) {
  const source = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + process.env.CLOUDINARY_API_SECRET
  return crypto.createHash('sha1').update(source).digest('hex')
}

async function uploadLocalFile(filePath, folder = 'mini-food') {
  if (!configured()) return null
  const timestamp = Math.floor(Date.now() / 1000)
  const params = { folder, timestamp }
  const bytes = await fs.readFile(filePath)
  const form = new FormData()
  form.append('file', new Blob([bytes]))
  form.append('api_key', process.env.CLOUDINARY_API_KEY)
  form.append('timestamp', String(timestamp))
  form.append('folder', folder)
  form.append('signature', sign(params))
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/auto/upload`
  const response = await fetch(url, { method: 'POST', body: form })
  if (!response.ok) throw new Error(`Cloudinary upload failed ${response.status}: ${await response.text()}`)
  const result = await response.json()
  return { url: result.secure_url, publicId: result.public_id, resourceType: result.resource_type }
}

module.exports = { configured, uploadLocalFile }
