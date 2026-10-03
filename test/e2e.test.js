const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-food-e2e-'))
process.env.NODE_ENV = 'test'
process.env.USE_MYSQL = '0'
process.env.SQLITE_PATH = path.join(tempDir, 'e2e.db')
process.env.SESSION_STORE = 'memory'
process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-ci'
process.env.TEST_OTP = '123456'
process.env.HOST = '127.0.0.1'
process.env.AI_EMBEDDING_URL = ''

const bcrypt = require('bcryptjs')
const app = require('../app')
const db = require('../config/db')
const foodModel = require('../models/foodModels')
const { ensureCommerceSchema } = require('../lib/commerceSchema')
const { runMigrations } = require('../lib/migrationRunner')

class Browser {
  constructor(base){ this.base=base; this.cookies=new Map(); this.csrf='' }
  cookieHeader(){ return [...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ') }
  absorb(response){
    const set = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean)
    for(const line of set){const pair=String(line).split(';')[0],idx=pair.indexOf('=');if(idx>0)this.cookies.set(pair.slice(0,idx),pair.slice(idx+1))}
    const token=response.headers.get('x-csrf-token');if(token)this.csrf=token
  }
  async request(url,{method='GET',form,json,headers={},redirect='manual'}={}){
    const h=new Headers(headers);const cookie=this.cookieHeader();if(cookie)h.set('cookie',cookie)
    let body
    if(form){body=new URLSearchParams({...form,_csrf:this.csrf});h.set('content-type','application/x-www-form-urlencoded')}
    if(json!==undefined){body=JSON.stringify(json);h.set('content-type','application/json');if(this.csrf)h.set('x-csrf-token',this.csrf)}
    const response=await fetch(this.base+url,{method,headers:h,body,redirect});this.absorb(response);return response
  }
  async get(url){return this.request(url)}
  async post(url,form){return this.request(url,{method:'POST',form})}
  async refreshCsrf(url='/'){const r=await this.get(url);assert.ok(r.status<500,`GET ${url} returned ${r.status}`);assert.ok(this.csrf,'CSRF token missing');return r}
  async follow(response){const location=response.headers.get('location');assert.ok(location,`Expected redirect, got ${response.status}`);return this.get(new URL(location,this.base).pathname+new URL(location,this.base).search)}
}

async function latest(sql,params=[]){const [rows]=await db.query(sql,params);return rows[0]||null}

let server,base

test.before(async()=>{
  await db.ready();await ensureCommerceSchema();await runMigrations()
  const adminHash=await bcrypt.hash('Admin12345!',12)
  await db.query("INSERT INTO users(username,password,balance,fullname,phone,email,role,locked) VALUES(?,?,0,'Admin','','admin@example.local','super_admin',0)",[ 'admin-e2e',adminHash ])
  const categories=await foodModel.getAllCategories();const categoryId=categories[0]?.id
  await foodModel.createFood({title:'E2E Chicken Rice',description:'Test food',price:45000,category_id:categoryId,image:'',ingredients:'chicken rice',stock:20,low_stock_threshold:3})
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  base=`http://127.0.0.1:${server.address().port}`
})

test.after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve))
  await db.close().catch(()=>{})
  fs.rmSync(tempDir,{recursive:true,force:true})
})

test('register → login → address → voucher/wallet checkout → review → cancel/refund → topup approval → bank pending',async()=>{
  const user=new Browser(base),admin=new Browser(base)
  const username='e2e-user',password='User12345!'

  await user.refreshCsrf('/register')
  let r=await user.post('/register',{username,password,phone:'0900000000',fullname:'E2E User',email:'e2e@example.local'})
  assert.equal(r.status,200)
  assert.match(await r.text(),/OTP|xác minh|xac minh/i)
  r=await user.post('/register/verify',{otp:'123456'})
  assert.equal(r.status,302)
  assert.equal(new URL(r.headers.get('location'),base).pathname,'/login')

  await user.refreshCsrf('/login')
  r=await user.post('/login',{username,password})
  assert.equal(r.status,302)
  await user.refreshCsrf('/')

  r=await user.post('/profile/addresses/add',{label:'Nhà',full_name:'E2E User',phone:'0900000000',city:'HCM',district:'Thủ Đức',ward:'Linh Xuân',street:'Kha Vạn Cân',detail_address:'123',note:'',is_default:'on'})
  assert.equal(r.status,302)
  const address=await latest('SELECT * FROM addresses WHERE username=? ORDER BY id DESC LIMIT 1',[username])
  assert.ok(address?.id)

  await admin.refreshCsrf('/login')
  r=await admin.post('/login',{username:'admin-e2e',password:'Admin12345!'})
  assert.equal(r.status,302)
  await admin.refreshCsrf('/admin')

  r=await admin.post(`/admin/users/${encodeURIComponent(username)}/balance`,{amount:'200000',note:'E2E funding'})
  assert.equal(r.status,302)
  r=await admin.post('/admin/vouchers',{code:'E2E10',discount_type:'percent',discount_value:'10',min_order:'0',max_discount:'10000',usage_limit:'10',starts_at:'',expires_at:''})
  assert.equal(r.status,302)

  const food=await latest("SELECT * FROM foods WHERE title='E2E Chicken Rice'")
  const delivery=await latest('SELECT * FROM delivery_companies ORDER BY fee ASC LIMIT 1')
  assert.ok(food?.id&&delivery?.id)

  r=await user.post(`/cart/add/${food.id}`,{})
  assert.equal(r.status,302)
  await user.refreshCsrf('/checkout')
  r=await user.post('/checkout',{addressId:String(address.id),deliveryCompanyId:String(delivery.id),paymentMethod:'wallet',voucherCode:'E2E10'})
  assert.equal(r.status,302)
  const walletOrder=await latest('SELECT * FROM orders WHERE username=? ORDER BY id DESC LIMIT 1',[username])
  assert.equal(walletOrder.status,'Đã thanh toán bằng ví')
  assert.equal(walletOrder.voucher_code,'E2E10')
  assert.equal(Number(walletOrder.discount_amount),4500)
  const expectedPayable=45000+Number(delivery.fee)-4500
  let userRow=await latest('SELECT balance FROM users WHERE username=?',[username])
  assert.equal(Number(userRow.balance),200000-expectedPayable)
  let foodRow=await latest('SELECT stock FROM foods WHERE id=?',[food.id])
  assert.equal(Number(foodRow.stock),19)
  assert.ok(await latest("SELECT * FROM wallet_transactions WHERE username=? AND type='order_payment' AND reference_id=?",[username,String(walletOrder.id)]))

  await user.refreshCsrf(`/foods/${food.id}`)
  r=await user.post(`/foods/${food.id}/review`,{rating:'5',comment:'E2E review works'})
  assert.equal(r.status,302)
  const review=await latest('SELECT * FROM reviews WHERE username=? AND food_id=?',[username,food.id])
  assert.equal(review.comment,'E2E review works')

  r=await admin.post(`/admin/orders/update/${walletOrder.id}`,{status:'Đã hủy'})
  assert.equal(r.status,302)
  const cancelled=await latest('SELECT * FROM orders WHERE id=?',[walletOrder.id])
  assert.equal(cancelled.status,'Đã hủy')
  assert.equal(Number(cancelled.refunded),1)
  userRow=await latest('SELECT balance FROM users WHERE username=?',[username])
  assert.equal(Number(userRow.balance),200000)
  foodRow=await latest('SELECT stock FROM foods WHERE id=?',[food.id])
  assert.equal(Number(foodRow.stock),20)
  const voucher=await latest("SELECT * FROM vouchers WHERE code='E2E10'")
  assert.equal(Number(voucher.used_count),0)
  assert.equal(await latest('SELECT * FROM voucher_usages WHERE order_id=?',[walletOrder.id]),null)

  await user.refreshCsrf('/wallet/top-up')
  r=await user.post('/wallet/top-up',{amount:'10000'})
  assert.equal(r.status,302)
  const topup=await latest('SELECT * FROM wallet_topups WHERE username=? ORDER BY id DESC LIMIT 1',[username])
  assert.equal(topup.status,'pending')
  r=await admin.post(`/admin/topups/${topup.id}/approve`,{})
  assert.equal(r.status,302)
  userRow=await latest('SELECT balance FROM users WHERE username=?',[username])
  assert.equal(Number(userRow.balance),210000)
  assert.ok(await latest("SELECT * FROM wallet_transactions WHERE username=? AND type='topup' AND reference_id=?",[username,String(topup.id)]))

  await user.refreshCsrf(`/foods/${food.id}`)
  r=await user.post(`/cart/add/${food.id}`,{})
  assert.equal(r.status,302)
  await user.refreshCsrf('/checkout')
  r=await user.post('/checkout',{addressId:String(address.id),deliveryCompanyId:String(delivery.id),paymentMethod:'Banking',voucherCode:''})
  assert.equal(r.status,302)
  const bankOrder=await latest('SELECT * FROM orders WHERE username=? ORDER BY id DESC LIMIT 1',[username])
  assert.equal(bankOrder.status,'Chờ thanh toán')
  assert.equal(bankOrder.payment_method,'Banking')

  const badCsrf=await fetch(base+'/cart/add/'+food.id,{method:'POST',headers:{cookie:user.cookieHeader(),'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({}) ,redirect:'manual'})
  assert.equal(badCsrf.status,403)
})
