const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const db = require('../config/db')
const userModel = require('../models/userModels')
const { ensureCommerceSchema } = require('../lib/commerceSchema')
const { sendEmail } = require('../lib/emailService')

function codeHash(code){return crypto.createHash('sha256').update(String(code)).digest('hex')}
async function showForgot(req,res){res.render('forgot-password',{error:null,success:null})}

async function requestReset(req,res,next){
  try{
    await ensureCommerceSchema();const username=String(req.body.username||'').trim(),user=await userModel.findByUsername(username)
    if(!user)return res.render('forgot-password',{error:null,success:'Nếu tài khoản tồn tại, mã khôi phục đã được gửi.'})
    const code=String(crypto.randomInt(100000,1000000)),expires=new Date(Date.now()+10*60*1000).toISOString().slice(0,19).replace('T',' ')
    await db.transaction(async tx=>{await tx.query('UPDATE password_reset_codes SET used=1 WHERE username=? AND used=0',[username]);await tx.query('INSERT INTO password_reset_codes(username,code_hash,expires_at,used) VALUES(?,?,?,0)',[username,codeHash(code),expires])})
    if(user.email){await sendEmail({to:user.email,subject:'MINI FOOD - Mã khôi phục mật khẩu',text:`Mã khôi phục của bạn là ${code}. Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.`,html:`<p>Mã khôi phục MINI FOOD của bạn:</p><h2>${code}</h2><p>Mã có hiệu lực trong 10 phút.</p>`})}
    req.session.resetUsername=username
    res.render('forgot-password',{error:null,success:'Nếu tài khoản có email hợp lệ, mã khôi phục đã được gửi và có hiệu lực 10 phút.'})
  }catch(e){next(e)}
}
async function showReset(req,res){if(!req.session.resetUsername)return res.redirect('/forgot-password');res.render('reset-password',{error:null})}
async function resetPassword(req,res,next){
  try{
    const username=req.session.resetUsername;if(!username)return res.redirect('/forgot-password')
    const code=String(req.body.code||'').trim(),password=String(req.body.password||''),confirm=String(req.body.confirmPassword||'')
    if(password.length<8||password!==confirm)return res.render('reset-password',{error:'Mật khẩu tối thiểu 8 ký tự và phải khớp xác nhận.'})
    const hash=await bcrypt.hash(password,12)
    await db.transaction(async tx=>{const [rows]=await tx.query('SELECT * FROM password_reset_codes WHERE username=? AND used=0 ORDER BY id DESC LIMIT 1',[username]);const item=rows[0];if(!item||new Date(String(item.expires_at).replace(' ','T')).getTime()<Date.now()||item.code_hash!==codeHash(code))throw Object.assign(new Error('Mã không đúng hoặc đã hết hạn.'),{status:400,public:true});await tx.query('UPDATE users SET password=? WHERE username=?',[hash,username]);await tx.query('UPDATE password_reset_codes SET used=1 WHERE id=?',[item.id])})
    req.session.resetUsername=null;req.session.regenerate(()=>res.redirect('/login'))
  }catch(e){if(e.public)return res.status(400).render('reset-password',{error:e.message});next(e)}
}
module.exports={showForgot,requestReset,showReset,resetPassword}
