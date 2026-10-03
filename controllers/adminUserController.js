const db = require('../config/db')
const walletLedger = require('../lib/walletLedger')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

async function detail(req,res,next){
  try{
    await ensureCommerceSchema()
    const username=req.params.username
    const [users]=await db.query("SELECT id,username,fullname,balance,COALESCE(role,'user') role,COALESCE(locked,0) locked,email,phone FROM users WHERE username=?",[username])
    const user=users[0]
    if(!user)return res.status(404).send('Không tìm thấy tài khoản')
    const [orders]=await db.query('SELECT * FROM orders WHERE username=? ORDER BY id DESC LIMIT 100',[username])
    const transactions=await walletLedger.listTransactions(username,200)
    res.render('admin-user-detail',{customer:user,orders,transactions})
  }catch(e){next(e)}
}
module.exports={detail}
