const test = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const fs = require('node:fs')
const path = require('node:path')

async function startServer() {
  const app = require('../app')
  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address()
  return { server, baseUrl: `http://127.0.0.1:${port}` }
}

function makeMultipart({ url, cookieJar, message, filePath, filename = 'food.png' }) {
  const boundary = `----MiniFood${Date.now()}-${Math.random().toString(16).slice(2)}`
  const fileBuffer = fs.readFileSync(filePath)
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\n${message}\r\n`, 'utf8'),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`, 'utf8'),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  ])

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      ...(cookieJar ? { Cookie: cookieJar } : {})
    },
    body
  })
}

test('admin can list foods at /admin/foods and create flow has preview + confirm', async () => {
  const { server, baseUrl } = await startServer()
  try {
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=27032006',
      redirect: 'manual'
    })

    const cookies = loginRes.headers.get('set-cookie') || ''
    const cookieJar = cookies.split(';')[0]
    assert.ok(cookieJar.includes('connect.sid'))

    const adminFoodsRes = await fetch(`${baseUrl}/admin/foods`, {
      headers: { Cookie: cookieJar }
    })
    assert.equal(adminFoodsRes.status, 200)

    const imagePath = path.join(__dirname, '..', 'public', 'images', 'anh.png')
    const chatRes = await makeMultipart({
      url: `${baseUrl}/api/chat`,
      cookieJar,
      message: 'Thêm món Bánh mì nướng giá 45000',
      filePath: imagePath
    })

    const chatJson = await chatRes.json()
    assert.equal(chatRes.status, 200)
    assert.equal(chatJson.type, 'admin_food_preview')
    assert.ok(/Bánh mì nướng/i.test(chatJson.reply || ''))

    const confirmRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieJar
      },
      body: 'message=Thêm đi'
    })

    const confirmJson = await confirmRes.json()
    assert.equal(confirmRes.status, 200)
    assert.ok(/thành công|đã thêm/i.test(confirmJson.reply || ''))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('non-admin cannot upload an image to create a food draft', async () => {
  const { server, baseUrl } = await startServer()
  try {
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=abc&password=123456',
      redirect: 'manual'
    })

    const cookies = loginRes.headers.get('set-cookie') || ''
    const cookieJar = cookies.split(';')[0]
    const imagePath = path.join(__dirname, '..', 'public', 'images', 'anh.png')

    const res = await makeMultipart({
      url: `${baseUrl}/api/chat`,
      cookieJar,
      message: 'Thêm món này',
      filePath: imagePath
    })

    assert.equal(res.status, 403)
    const json = await res.json()
    assert.match(json.reply || '', /quyền|Admin/i)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('admin can update image of an existing food through the AI flow', async () => {
  const { server, baseUrl } = await startServer()
  try {
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=27032006',
      redirect: 'manual'
    })

    const cookieJar = (loginRes.headers.get('set-cookie') || '').split(';')[0]
    const createRes = await fetch(`${baseUrl}/admin/foods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieJar
      },
      body: 'title=Test%20Image%20Food&description=Test%20food&price=50000&category_id=1&image=/images/anh.png'
    })
    assert.ok(createRes.status === 302 || createRes.status === 200)

    const imagePath = path.join(__dirname, '..', 'public', 'images', 'anh.png')
    const chatRes = await makeMultipart({
      url: `${baseUrl}/api/chat`,
      cookieJar,
      message: 'Đổi ảnh món Test Image Food',
      filePath: imagePath
    })

    const json = await chatRes.json()
    assert.equal(chatRes.status, 200)
    assert.ok(/cập nhật ảnh|đổi ảnh/i.test(json.reply || ''))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('admin can add a food with price phrase giá thành 20k', async () => {
  const { server, baseUrl } = await startServer()
  try {
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=27032006',
      redirect: 'manual'
    })

    const cookieJar = (loginRes.headers.get('set-cookie') || '').split(';')[0]
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieJar
      },
      body: 'message=Thêm món Bánh mì giá thành 20k'
    })

    const json = await res.json()
    assert.equal(res.status, 200)
    assert.ok(/Bánh mì|banh mi/i.test(json.reply || ''))
    assert.ok(/20\.000|20000|20k/i.test(json.reply || ''))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
