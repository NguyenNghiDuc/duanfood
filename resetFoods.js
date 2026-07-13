const db = require('./config/db')

async function reset() {
  try {
    await db.query('DELETE FROM foods')
    console.log('Deleted all foods')
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

reset()