const bcrypt = require('bcryptjs')
const userModel = require('../models/userModels')
const addressModel = require('../models/addressModel')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

async function showRegister(req,res){res.render('register',{error:null})}

async function register(req,res,next){
  try{
    const {username,password,phone,fullname,email}=req.body
    if(await userModel.findByUsername(username))return res.render('register',{error:'Tên đăng nhập đã tồn tại'})
    const hash=await bcrypt.hash(password,10)
    if(phone&&phone.trim()){
      const otp=String(Math.floor(100000+Math.random()*900000));const expires=Date.now()+5*60*1000
      try{
        if(process.env.TWILIO_SID&&process.env.TWILIO_TOKEN&&process.env.TWILIO_FROM){
          const url=`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages.json`
          const body=new URLSearchParams({From:process.env.TWILIO_FROM,To:phone,Body:`Mã OTP của bạn là: ${otp}`})
          await fetch(url,{method:'POST',body,headers:{Authorization:'Basic '+Buffer.from(process.env.TWILIO_SID+':'+process.env.TWILIO_TOKEN).toString('base64')}})
        }else console.log(`[REGISTER OTP] ${phone}: ${otp}`)
      }catch(e){console.error('SMS send error',e.message)}
      req.session.pendingRegister={username,passwordHash:hash,phone,fullname:fullname||'',email:email||'',otp,otpExpires:expires}
      return res.render('register-verify',{phone,error:null})
    }
    await userModel.createUser({username,password:hash,fullname:fullname||'',phone:phone||'',email:email||''})
    res.redirect('/login')
  }catch(e){next(e)}
}

async function showVerify(req,res){const p=req.session.pendingRegister;if(!p?.username)return res.redirect('/register');res.render('register-verify',{phone:p.phone,error:null})}
async function verifyRegister(req,res,next){
  try{
    const p=req.session.pendingRegister;if(!p)return res.redirect('/register')
    if(Date.now()>(p.otpExpires||0)){req.session.pendingRegister=null;return res.render('register-verify',{phone:p.phone,error:'Mã OTP đã hết hạn. Vui lòng đăng ký lại.'})}
    if(String(req.body.otp||'').trim()!==String(p.otp).trim())return res.render('register-verify',{phone:p.phone,error:'Mã OTP không chính xác'})
    await userModel.createUser({username:p.username,password:p.passwordHash,fullname:p.fullname,phone:p.phone,email:p.email});req.session.pendingRegister=null;res.redirect('/login')
  }catch(e){next(e)}
}

async function showLogin(req,res){res.render('login',{error:null})}
async function login(req,res,next){
  try{
    await ensureCommerceSchema()
    const username=String(req.body.username||'').trim();const user=await userModel.findByUsername(username)
    if(!user||!(await bcrypt.compare(req.body.password,user.password)))return res.render('login',{error:'Sai username hoặc password'})
    if(Number(user.locked||0)===1)return res.render('login',{error:'Tài khoản đang bị khóa. Vui lòng liên hệ CSKH.'})
    let role=user.role||'user';if(username==='admin'&&role==='user')role='super_admin'
    req.session.regenerate(err=>{
      if(err)return next(err)
      req.session.user={username,role,balance:Number(user.balance||0),fullname:user.fullname||''}
      res.redirect(role==='user'?'/':'/admin')
    })
  }catch(e){next(e)}
}

function logout(req,res){req.session.destroy(()=>res.redirect('/'))}

async function showProfile(req,res,next){
  try{
    const current=await userModel.findByUsername(req.session.user.username);if(!current)return res.redirect('/login')
    const addresses=await addressModel.getAddressesByUsername(req.session.user.username);const defaultAddress=addresses.find(a=>a.is_default)||null
    res.render('profile',{user:req.session.user,fullname:current.fullname||'',defaultAddress,addressesCount:addresses.length})
  }catch(e){next(e)}
}
async function showEditProfile(req,res,next){try{const current=await userModel.findByUsername(req.session.user.username);if(!current)return res.status(404).send('Không tìm thấy tài khoản');res.render('profile-edit',{user:req.session.user,fullname:current.fullname||'',error:null,success:null})}catch(e){next(e)}}
async function updateProfile(req,res,next){
  try{
    const fullname=String(req.body.fullname||'').trim(),password=String(req.body.password||''),confirm=String(req.body.confirmPassword||'')
    if(password&&password!==confirm)return res.render('profile-edit',{user:req.session.user,fullname,error:'Mật khẩu xác nhận không khớp',success:null})
    const hashed=password?await bcrypt.hash(password,10):''
    await userModel.updateProfile(req.session.user.username,{fullname,password:hashed,phone:req.body.phone,email:req.body.email})
    req.session.user.fullname=fullname
    res.render('profile-edit',{user:req.session.user,fullname,error:null,success:'Cập nhật hồ sơ thành công'})
  }catch(e){next(e)}
}

module.exports={showRegister,register,showVerify,verifyRegister,showLogin,login,logout,showProfile,showEditProfile,updateProfile}
