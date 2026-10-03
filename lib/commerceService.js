const db = require('../config/db')
const { ensureCommerceSchema } = require('./commerceSchema')

async function audit(actor, action, targetType = '', targetId = '', detail = '', client = db) { await ensureCommerceSchema(); await client.query('INSERT INTO audit_logs(actor,action,target_type,target_id,detail) VALUES(?,?,?,?,?)', [actor || 'system', action, targetType, String(targetId || ''), String(detail || '').slice(0, 1000)]) }
async function notify(username, title, message, link = '', client = db) { await ensureCommerceSchema(); await client.query('INSERT INTO notifications(username,title,message,link) VALUES(?,?,?,?)', [username, title, message, link]) }
async function notifyAll(title, message, link = '') { await ensureCommerceSchema(); const [users] = await db.query('SELECT username FROM users'); for (const user of users) await notify(user.username, title, message, link) }
async function listNotifications(username, limit = 30, offset = 0) { await ensureCommerceSchema(); const n=Math.min(Math.max(Number(limit)||30,1),100),o=Math.max(Number(offset)||0,0); const [rows]=await db.query(`SELECT * FROM notifications WHERE username=? ORDER BY id DESC LIMIT ${n} OFFSET ${o}`,[username]); return rows }
async function markNotificationRead(id, username) { await ensureCommerceSchema(); await db.query('UPDATE notifications SET is_read=1 WHERE id=? AND username=?',[id,username]) }
async function toggleFavorite(username, foodId) { await ensureCommerceSchema(); const [rows]=await db.query('SELECT id FROM favorites WHERE username=? AND food_id=?',[username,foodId]); if(rows.length){await db.query('DELETE FROM favorites WHERE username=? AND food_id=?',[username,foodId]);return false} await db.query('INSERT INTO favorites(username,food_id) VALUES(?,?)',[username,foodId]);return true }
async function listFavorites(username,limit=100,offset=0) { await ensureCommerceSchema();const l=Math.min(Math.max(Number(limit)||100,1),100),o=Math.max(Number(offset)||0,0); const [rows]=await db.query(`SELECT f.*,fav.created_at AS favorited_at FROM favorites fav JOIN foods f ON f.id=fav.food_id WHERE fav.username=? ORDER BY fav.id DESC LIMIT ${l} OFFSET ${o}`,[username]);return rows }

async function validateVoucher(code, username, orderTotal, client = db) {
  await ensureCommerceSchema()
  const normalized=String(code||'').trim().toUpperCase(); if(!normalized)return{valid:false,discount:0,message:'Chưa nhập mã giảm giá'}
  const [rows]=await client.query('SELECT * FROM vouchers WHERE UPPER(code)=? AND active=1',[normalized]);const voucher=rows[0];if(!voucher)return{valid:false,discount:0,message:'Mã giảm giá không tồn tại'}
  const now=Date.now(),start=voucher.starts_at?new Date(String(voucher.starts_at).replace(' ','T')).getTime():null,end=voucher.expires_at?new Date(String(voucher.expires_at).replace(' ','T')).getTime():null
  if(start&&Number.isFinite(start)&&start>now)return{valid:false,discount:0,message:'Mã chưa bắt đầu'}
  if(end&&Number.isFinite(end)&&end<now)return{valid:false,discount:0,message:'Mã đã hết hạn'}
  if(Number(voucher.usage_limit||0)>0&&Number(voucher.used_count||0)>=Number(voucher.usage_limit))return{valid:false,discount:0,message:'Mã đã hết lượt sử dụng'}
  if(Number(orderTotal||0)<Number(voucher.min_order||0))return{valid:false,discount:0,message:`Đơn tối thiểu ${Number(voucher.min_order).toLocaleString('vi-VN')}đ`}
  const [used]=await client.query('SELECT id FROM voucher_usages WHERE voucher_id=? AND username=? LIMIT 1',[voucher.id,username]);if(used.length)return{valid:false,discount:0,message:'Bạn đã sử dụng mã này'}
  let discount=voucher.discount_type==='fixed'?Number(voucher.discount_value||0):Number(orderTotal||0)*Number(voucher.discount_value||0)/100
  if(Number(voucher.max_discount||0)>0)discount=Math.min(discount,Number(voucher.max_discount));discount=Math.max(0,Math.min(discount,Number(orderTotal||0)))
  return{valid:true,discount:Math.round(discount),voucher}
}

async function useVoucher(voucher,username,orderId,discount,client=db){
  if(!voucher)return
  await ensureCommerceSchema()
  const [insert]=await client.query('INSERT INTO voucher_usages(voucher_id,username,order_id,discount_amount) VALUES(?,?,?,?)',[voucher.id,username,orderId,discount])
  try{const [updated]=await client.query('UPDATE vouchers SET used_count=used_count+1 WHERE id=? AND (usage_limit=0 OR used_count<usage_limit)',[voucher.id]);if(!updated.affectedRows)throw new Error('Voucher vừa hết lượt sử dụng')}
  catch(error){await client.query('DELETE FROM voucher_usages WHERE id=?',[insert.insertId]).catch(()=>{});throw error}
}

function parseDbTime(value){if(!value)return null;const t=new Date(String(value).replace(' ','T')).getTime();return Number.isFinite(t)?t:null}
async function currentSaleForFood(foodId,client=db){await ensureCommerceSchema();const [rows]=await client.query('SELECT * FROM flash_sales WHERE food_id=? AND active=1 ORDER BY id DESC LIMIT 20',[foodId]);const now=Date.now();return rows.find(row=>{const start=parseDbTime(row.starts_at),end=parseDbTime(row.ends_at);return(!start||start<=now)&&(!end||end>=now)})||null}

async function createTicket(username,subject,message){await ensureCommerceSchema();return db.transaction(async tx=>{const [result]=await tx.query('INSERT INTO support_tickets(username,subject,message) VALUES(?,?,?)',[username,String(subject).slice(0,200),String(message).slice(0,3000)]);await tx.query('INSERT INTO ticket_messages(ticket_id,sender,sender_role,message) VALUES(?,?,?,?)',[result.insertId,username,'user',String(message).slice(0,3000)]);return result.insertId})}
async function listTicketsForUser(username,limit=50,offset=0){await ensureCommerceSchema();const l=Math.min(Math.max(Number(limit)||50,1),100),o=Math.max(Number(offset)||0,0);const [rows]=await db.query(`SELECT * FROM support_tickets WHERE username=? ORDER BY id DESC LIMIT ${l} OFFSET ${o}`,[username]);return rows}
async function listAllTickets(limit=100,offset=0){await ensureCommerceSchema();const l=Math.min(Math.max(Number(limit)||100,1),200),o=Math.max(Number(offset)||0,0);const [rows]=await db.query(`SELECT * FROM support_tickets ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END,id DESC LIMIT ${l} OFFSET ${o}`);return rows}
async function getTicketMessages(ticketId){await ensureCommerceSchema();const [rows]=await db.query('SELECT * FROM ticket_messages WHERE ticket_id=? ORDER BY id ASC',[ticketId]);return rows}
async function replyTicket(ticketId,sender,role,message){await ensureCommerceSchema();return db.transaction(async tx=>{await tx.query('INSERT INTO ticket_messages(ticket_id,sender,sender_role,message) VALUES(?,?,?,?)',[ticketId,sender,role,String(message).slice(0,3000)]);await tx.query('UPDATE support_tickets SET status=?,assigned_to=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[role==='user'?'open':'waiting',role==='user'?'':sender,ticketId])})}
module.exports={audit,notify,notifyAll,listNotifications,markNotificationRead,toggleFavorite,listFavorites,validateVoucher,useVoucher,currentSaleForFood,createTicket,listTicketsForUser,listAllTickets,getTicketMessages,replyTicket}
