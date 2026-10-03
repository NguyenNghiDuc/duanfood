const fs = require('fs')
const path = require('path')
const ejs = require('ejs')

const root = path.join(__dirname, '..', 'views')
let failed = false

for (const name of fs.readdirSync(root)) {
  if (!name.endsWith('.ejs')) continue
  const file = path.join(root, name)
  try {
    ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file })
    console.log('EJS OK', name)
  } catch (error) {
    failed = true
    console.error('EJS FAIL', name, error.message)
  }
}

if (failed) process.exit(1)
