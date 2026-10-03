const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const db = require('../config/db')
const userModel = require('../models/userModels')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

function codeHash(code) { return crypto.createHash('sha256').update(String(code)).digest('hex') }

async function showForgot(req,res){ res.render('forgot-password',{error:null,success:null}) }

async function requestReset(req,res,next){
  try{
    await ensureCommerceSchema()
    const username=String(req.body.username||'').trim(); const user=await userModel.findByUsername(username)
    if(!user) return res.render('forgot-password',{error:null,success:'Nếu tài khoản tồn tại, mã khôi phục đã được gửi.'})
    const code=String(Math.floor(100000+Math.random()*900000)); const expires=new Date(Date.now()+10*60*1000).toISOString().slice(0,19).replace('T',' ')
    await db.query('UPDATE password_reset_codes SET used=1 WHERE username=? AND used=0',[username])
    await db.query('INSERT INTO password_reset_codes(username,code_hash,expires_at,used) VALUES(?,?,?,0)',[username,codeHash(code),expires])
    if(process.env.RESET_EMAIL_WEBHOOK&&user.email){
      try{await fetch(process.env.RESET_EMAIL_WEBHOOK,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({to:user.email,subject:'Mã khôi phục mật khẩu',code})})}catch(e){console.error('reset webhook failed',e.message)}
    }else{console.log(`[PASSWORD RESET] ${username}: ${code}`)}
    req.session.resetUsername=username
    res.render('forgot-password',{error:null,success:'Mã khôi phục có hiệu lực 10 phút. Nhập mã ở bước tiếp theo.'})
  }catch(e){next(e)}
}

async function showReset(req,res){ if(!req.session.resetUsername)return res.redirect('/forgot-password');res.render('reset-password',{error:null}) }

async function resetPassword(req,res,next){
  try{
    const username=req.session.resetUsername;if(!username)return res.redirect('/forgot-password')
    const code=String(req.body.code||'').trim();const password=String(req.body.password||'');const confirm=String(req.body.confirmPassword||'')
    if(password.length<6||password!==confirm)return res.render('reset-password',{error:'Mật khẩu tối thiểu 6 ký tự và phải khớp xác nhận.'})
    const [rows]=await db.query('SELECT * FROM password_reset_codes WHERE username=? AND used=0 ORDER BY id DESC LIMIT 1',[username]);const item=rows[0]
    if(!item||new Date(item.expires_at).getTime()<Date.now()||item.code_hash!==codeHash(code))return res.render('reset-password',{error:'Mã không đúng hoặc đã hết hạn.'})
    const hash=await bcrypt.hash(password,10);await db.query('UPDATE users SET password=? WHERE username=?',[hash,username]);await db.query('UPDATE password_reset_codes SET used=1 WHERE id=?',[item.id]);req.session.resetUsername=null
    res.redirect('/login')
  }catch(e){next(e)}
}

module.exports={showForgot,requestReset,showReset,resetPassword}
