const db = require('../config/db')

async function getAddressesByUsername(username) {
  const [rows] = await db.query('SELECT * FROM addresses WHERE username = ? ORDER BY is_default DESC, updated_at DESC, id DESC', [username])
  return rows
}

async function getAddressById(id, username) {
  const [rows] = await db.query('SELECT * FROM addresses WHERE id = ? AND username = ?', [id, username])
  return rows[0] || null
}

async function unsetDefaultAddresses(username) {
  await db.query('UPDATE addresses SET is_default = 0 WHERE username = ?', [username])
}

async function createAddress({ userId, username, label, full_name, phone, city, district, ward, street, detail_address, note, is_default }) {
  if (is_default) {
    await unsetDefaultAddresses(username)
  }

  const [result] = await db.query(
    'INSERT INTO addresses (user_id, username, label, full_name, phone, city, district, ward, street, detail_address, note, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId || null, username, label, full_name, phone, city, district, ward, street, detail_address, note || '', is_default ? 1 : 0]
  )

  return result.insertId
}

async function updateAddress(id, username, { label, full_name, phone, city, district, ward, street, detail_address, note, is_default }) {
  if (is_default) {
    await unsetDefaultAddresses(username)
  }

  await db.query(
    'UPDATE addresses SET label = ?, full_name = ?, phone = ?, city = ?, district = ?, ward = ?, street = ?, detail_address = ?, note = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND username = ?',
    [label, full_name, phone, city, district, ward, street, detail_address, note || '', is_default ? 1 : 0, id, username]
  )
}

async function setDefaultAddress(id, username) {
  await unsetDefaultAddresses(username)
  await db.query('UPDATE addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND username = ?', [id, username])
}

async function deleteAddress(id, username) {
  await db.query('DELETE FROM addresses WHERE id = ? AND username = ?', [id, username])
  const [rows] = await db.query('SELECT id FROM addresses WHERE username = ? ORDER BY updated_at DESC LIMIT 1', [username])
  if (rows && rows.length > 0) {
    await setDefaultAddress(rows[0].id, username)
  }
}

module.exports = {
  getAddressesByUsername,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
}
