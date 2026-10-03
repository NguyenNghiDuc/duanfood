const session = require('express-session')
const db = require('../config/db')

let schemaPromise = null
async function ensureSchema() {
  if (schemaPromise) return schemaPromise
  schemaPromise = (async () => {
    await db.ready()
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS app_sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at DATETIME NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
    } catch (_) {
      await db.query(`CREATE TABLE IF NOT EXISTS app_sessions (sid VARCHAR(255) PRIMARY KEY, data LONGTEXT NOT NULL, expires_at DATETIME NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`)
    }
  })()
  return schemaPromise
}

class DatabaseSessionStore extends session.Store {
  constructor(options = {}) { super(); this.ttlMs = Number(options.ttlMs || 7 * 24 * 60 * 60 * 1000) }
  async get(sid, cb) {
    try {
      await ensureSchema()
      const [rows] = await db.query('SELECT data, expires_at FROM app_sessions WHERE sid=? LIMIT 1', [sid])
      const row = rows[0]
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
        if (row) await db.query('DELETE FROM app_sessions WHERE sid=?', [sid]).catch(() => {})
        return cb(null, null)
      }
      cb(null, JSON.parse(row.data))
    } catch (e) { cb(e) }
  }
  async set(sid, sess, cb = () => {}) {
    try {
      await ensureSchema()
      const expires = new Date(sess?.cookie?.expires || Date.now() + this.ttlMs)
      const data = JSON.stringify(sess)
      const [rows] = await db.query('SELECT sid FROM app_sessions WHERE sid=? LIMIT 1', [sid])
      if (rows.length) await db.query('UPDATE app_sessions SET data=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE sid=?', [data, expires, sid])
      else await db.query('INSERT INTO app_sessions(sid,data,expires_at) VALUES(?,?,?)', [sid, data, expires])
      cb(null)
    } catch (e) { cb(e) }
  }
  async destroy(sid, cb = () => {}) { try { await ensureSchema(); await db.query('DELETE FROM app_sessions WHERE sid=?', [sid]); cb(null) } catch (e) { cb(e) } }
  async touch(sid, sess, cb = () => {}) { try { await ensureSchema(); const expires = new Date(sess?.cookie?.expires || Date.now() + this.ttlMs); await db.query('UPDATE app_sessions SET expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE sid=?', [expires, sid]); cb(null) } catch (e) { cb(e) } }
  async clear(cb = () => {}) { try { await ensureSchema(); await db.query('DELETE FROM app_sessions'); cb(null) } catch (e) { cb(e) } }
}

module.exports = { DatabaseSessionStore, ensureSchema }
