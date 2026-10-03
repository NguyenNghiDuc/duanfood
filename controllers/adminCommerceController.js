const db = require('../config/db')
const commerce = require('../lib/commerceService')
const walletLedger = require('../lib/walletLedger')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

function csvEscape(value) { return `"${String(value ?? '').replace(/"/g, '""')}"` }
function sendCsv(res, filename, rows, columns) {
  const header = columns.map(c => csvEscape(c.label)).join(',')
  const body = rows.map(row => columns.map(c => csvEscape(row[c.key])).join(',')).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send('\ufeff' + header + '\n' + body)
}

async function users(req, res, next) {
  try {
    await ensureCommerceSchema()
    const q = `%${String(req.query.q || '').trim()}%`
    const [rows] = await db.query('SELECT id,username,fullname,balance,COALESCE(role,\'user\') AS role,COALESCE(locked,0) AS locked,email,phone FROM users WHERE username LIKE ? OR fullname LIKE ? ORDER BY id DESC LIMIT 200', [q, q])
    res.render('admin-users', { users: rows, q: req.query.q || '' })
  } catch (e) { next(e) }
}

async function updateUser(req, res, next) {
  try {
    await ensureCommerceSchema()
    const role = ['user','support','kitchen','staff','admin','super_admin'].includes(req.body.role) ? req.body.role : 'user'
    const locked = req.body.locked === '1' ? 1 : 0
    await db.query('UPDATE users SET role=?, locked=? WHERE username=?', [role, locked, req.params.username])
    await commerce.audit(req.session.user.username, 'update_user_access', 'user', req.params.username, `role=${role}, locked=${locked}`)
    res.redirect('/admin/users')
  } catch (e) { next(e) }
}

async function adjustBalance(req, res, next) {
  try {
    const amount = Number(req.body.amount || 0)
    if (!Number.isFinite(amount) || amount === 0) return res.status(400).send('Số tiền không hợp lệ')
    await walletLedger.recordTransaction({ username: req.params.username, type: 'admin_adjustment', amount, referenceType: 'admin', referenceId: req.session.user.username, note: req.body.note || 'Admin điều chỉnh' })
    await commerce.audit(req.session.user.username, 'adjust_wallet', 'user', req.params.username, `amount=${amount}`)
    await commerce.notify(req.params.username, 'Ví đã được điều chỉnh', `Số dư ví thay đổi ${amount.toLocaleString('vi-VN')}đ bởi quản trị viên.`, '/wallet/history')
    res.redirect('/admin/users')
  } catch (e) { next(e) }
}

async function vouchers(req, res, next) {
  try { await ensureCommerceSchema(); const [rows] = await db.query('SELECT * FROM vouchers ORDER BY id DESC'); res.render('admin-vouchers', { vouchers: rows }) } catch (e) { next(e) }
}

async function createVoucher(req, res, next) {
  try {
    await ensureCommerceSchema()
    const code = String(req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,40)
    if (!code) return res.status(400).send('Mã voucher không hợp lệ')
    const type = req.body.discount_type === 'fixed' ? 'fixed' : 'percent'
    const value = Math.max(0, Number(req.body.discount_value || 0))
    await db.query('INSERT INTO vouchers(code,discount_type,discount_value,min_order,max_discount,usage_limit,starts_at,expires_at,active) VALUES(?,?,?,?,?,?,?,?,1)', [code,type,value,Number(req.body.min_order||0),Number(req.body.max_discount||0),Number(req.body.usage_limit||0),req.body.starts_at||null,req.body.expires_at||null])
    await commerce.audit(req.session.user.username,'create_voucher','voucher',code,JSON.stringify({type,value}))
    await commerce.notifyAll('Voucher mới', `Mã ${code} vừa được phát hành.`, '/foods')
    res.redirect('/admin/vouchers')
  } catch (e) { next(e) }
}

async function toggleVoucher(req, res, next) {
  try { await db.query('UPDATE vouchers SET active=CASE WHEN active=1 THEN 0 ELSE 1 END WHERE id=?',[req.params.id]); await commerce.audit(req.session.user.username,'toggle_voucher','voucher',req.params.id); res.redirect('/admin/vouchers') } catch(e){ next(e) }
}

async function flashSales(req, res, next) {
  try {
    await ensureCommerceSchema()
    const [sales] = await db.query('SELECT fs.*,f.title,f.price FROM flash_sales fs JOIN foods f ON f.id=fs.food_id ORDER BY fs.id DESC')
    const [foods] = await db.query('SELECT id,title,price FROM foods ORDER BY title')
    res.render('admin-flash-sales',{sales,foods})
  } catch(e){next(e)}
}

async function createFlashSale(req,res,next){
  try {
    await ensureCommerceSchema()
    await db.query('INSERT INTO flash_sales(food_id,sale_price,starts_at,ends_at,active) VALUES(?,?,?,?,1)',[Number(req.body.food_id),Number(req.body.sale_price),req.body.starts_at,req.body.ends_at])
    await commerce.audit(req.session.user.username,'create_flash_sale','food',req.body.food_id,`sale_price=${req.body.sale_price}`)
    await commerce.notifyAll('Flash Sale mới','Một số món vừa được giảm giá trong thời gian giới hạn.','/foods')
    res.redirect('/admin/flash-sales')
  } catch(e){next(e)}
}

async function tickets(req,res,next){
  try { res.render('admin-tickets',{tickets:await commerce.listAllTickets()}) } catch(e){next(e)}
}
async function ticket(req,res,next){
  try {
    const [rows]=await db.query('SELECT * FROM support_tickets WHERE id=?',[req.params.id]); if(!rows[0]) return res.status(404).send('Không tìm thấy ticket')
    res.render('admin-ticket',{ticket:rows[0],messages:await commerce.getTicketMessages(req.params.id)})
  } catch(e){next(e)}
}
async function replyTicket(req,res,next){
  try {
    await commerce.replyTicket(req.params.id,req.session.user.username,req.session.user.role||'staff',req.body.message||'')
    const [rows]=await db.query('SELECT username FROM support_tickets WHERE id=?',[req.params.id]); if(rows[0]) await commerce.notify(rows[0].username,'CSKH đã phản hồi',`Ticket #${req.params.id} có phản hồi mới.`,`/support/${req.params.id}`)
    res.redirect(`/admin/tickets/${req.params.id}`)
  } catch(e){next(e)}
}

async function closeTicket(req,res,next){ try{await db.query("UPDATE support_tickets SET status='closed',updated_at=CURRENT_TIMESTAMP WHERE id=?",[req.params.id]);await commerce.audit(req.session.user.username,'close_ticket','ticket',req.params.id);res.redirect('/admin/tickets')}catch(e){next(e)} }

async function auditLogs(req,res,next){ try{await ensureCommerceSchema();const [rows]=await db.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500');res.render('admin-audit',{logs:rows})}catch(e){next(e)} }

async function insights(req,res,next){
  try {
    await ensureCommerceSchema()
    const [[orders]]=await db.query("SELECT COUNT(*) total,COALESCE(SUM(total+shipping_fee-discount_amount),0) revenue,COALESCE(AVG(total+shipping_fee-discount_amount),0) aov,SUM(CASE WHEN status='Đã hủy' THEN 1 ELSE 0 END) cancelled FROM orders")
    const [topFoods]=await db.query('SELECT oi.food_id,oi.title,SUM(oi.quantity) qty,SUM(oi.price*oi.quantity) revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>\'Đã hủy\' GROUP BY oi.food_id,oi.title ORDER BY qty DESC LIMIT 10')
    const [topUsers]=await db.query('SELECT username,COUNT(*) orders,COALESCE(SUM(total+shipping_fee-discount_amount),0) spent FROM orders WHERE status<>\'Đã hủy\' GROUP BY username ORDER BY spent DESC LIMIT 10')
    const [lowStock]=await db.query('SELECT id,title,stock,low_stock_threshold FROM foods WHERE COALESCE(stock,0)<=COALESCE(low_stock_threshold,5) ORDER BY stock ASC LIMIT 30')
    const [[newUsers]]=await db.query("SELECT COUNT(*) total FROM users WHERE id > (SELECT COALESCE(MAX(id)-50,0) FROM users)")
    res.render('admin-insights',{stats:{...orders,newUsers:Number(newUsers.total||0)},topFoods,topUsers,lowStock})
  } catch(e){next(e)}
}

async function exportData(req,res,next){
  try {
    await ensureCommerceSchema()
    const type=req.params.type
    if(type==='orders'){const [rows]=await db.query('SELECT * FROM orders ORDER BY id DESC');return sendCsv(res,'orders.csv',rows,[{key:'id',label:'ID'},{key:'username',label:'Khách hàng'},{key:'total',label:'Tiền hàng'},{key:'shipping_fee',label:'Phí ship'},{key:'discount_amount',label:'Giảm giá'},{key:'status',label:'Trạng thái'},{key:'created_at',label:'Ngày tạo'}])}
    if(type==='users'){const [rows]=await db.query('SELECT username,fullname,balance,role,locked,email,phone FROM users ORDER BY id DESC');return sendCsv(res,'users.csv',rows,[{key:'username',label:'Username'},{key:'fullname',label:'Họ tên'},{key:'balance',label:'Số dư'},{key:'role',label:'Role'},{key:'locked',label:'Khóa'},{key:'email',label:'Email'},{key:'phone',label:'SĐT'}])}
    if(type==='wallet'){const [rows]=await db.query('SELECT * FROM wallet_transactions ORDER BY id DESC');return sendCsv(res,'wallet.csv',rows,[{key:'id',label:'ID'},{key:'username',label:'User'},{key:'type',label:'Loại'},{key:'amount',label:'Số tiền'},{key:'balance_before',label:'Trước'},{key:'balance_after',label:'Sau'},{key:'created_at',label:'Ngày'}])}
    res.status(404).send('Loại export không tồn tại')
  } catch(e){next(e)}
}

async function adminAi(req,res,next){
  try {
    const q=String(req.body.question||'').toLowerCase()
    let answer='Bạn có thể hỏi: doanh thu, món bán chạy, món sắp hết, số đơn hoặc khách hàng.'
    if(/doanh thu/.test(q)){const [[r]]=await db.query("SELECT COALESCE(SUM(total+shipping_fee-discount_amount),0) value FROM orders WHERE status<>'Đã hủy'");answer=`Doanh thu ghi nhận hiện tại là ${Number(r.value||0).toLocaleString('vi-VN')}đ.`}
    else if(/bán chạy|ban chay|top món|top mon/.test(q)){const [r]=await db.query('SELECT oi.title,SUM(oi.quantity) qty FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>\'Đã hủy\' GROUP BY oi.title ORDER BY qty DESC LIMIT 5');answer=r.length?'Top món: '+r.map(x=>`${x.title} (${x.qty})`).join(', '):'Chưa có dữ liệu bán hàng.'}
    else if(/sắp hết|sap het|tồn kho|ton kho/.test(q)){const [r]=await db.query('SELECT title,stock FROM foods WHERE COALESCE(stock,0)<=COALESCE(low_stock_threshold,5) ORDER BY stock ASC LIMIT 10');answer=r.length?'Sắp hết: '+r.map(x=>`${x.title} (${x.stock})`).join(', '):'Không có món nào dưới ngưỡng tồn kho.'}
    else if(/bao nhiêu đơn|bao nhieu don|số đơn|so don/.test(q)){const [[r]]=await db.query('SELECT COUNT(*) value FROM orders');answer=`Hiện có ${r.value} đơn hàng.`}
    else if(/khách|khach|user/.test(q)){const [[r]]=await db.query('SELECT COUNT(*) value FROM users');answer=`Hiện có ${r.value} tài khoản khách hàng/quản trị.`}
    res.json({ok:true,answer})
  } catch(e){next(e)}
}

module.exports={users,updateUser,adjustBalance,vouchers,createVoucher,toggleVoucher,flashSales,createFlashSale,tickets,ticket,replyTicket,closeTicket,auditLogs,insights,exportData,adminAi}
