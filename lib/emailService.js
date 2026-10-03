const { log } = require('./logger')

async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error('Thiếu email người nhận')
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html: html || undefined, text: text || undefined })
    })
    if (!response.ok) throw new Error(`Email provider error ${response.status}: ${await response.text()}`)
    return response.json()
  }
  if (process.env.EMAIL_WEBHOOK_URL) {
    const response = await fetch(process.env.EMAIL_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: process.env.EMAIL_WEBHOOK_TOKEN ? `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` : '' }, body: JSON.stringify({ to, subject, html, text }) })
    if (!response.ok) throw new Error(`Email webhook error ${response.status}`)
    return { ok: true }
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Chưa cấu hình RESEND_API_KEY/EMAIL_FROM hoặc EMAIL_WEBHOOK_URL')
  log('info', 'dev_email', { to, subject, text })
  return { dev: true }
}

module.exports = { sendEmail }
