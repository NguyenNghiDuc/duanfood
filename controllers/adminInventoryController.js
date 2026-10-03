const db = require('../config/db')
const commerce = require('../lib/commerceService')
const { ensureCommerceSchema } = require('../lib/commerceSchema')

async function list(req,res,next){
  try{await ensureCommerceSchema();const [foods]=await db.query('SELECT f.id,f.title,f.price,COALESCE(f.stock,0) stock,COALESCE(f.low_stock_threshold,5) low_stock_threshold,c.name category_name FROM foods f LEFT JOIN categories c ON c.id=f.category_id ORDER BY stock ASC,f.title');res.render('admin-inventory',{foods})}catch(e){next(e)}
}

async function update(req,res,next){
  try{
    await ensureCommerceSchema();const stock=Math.max(0,Math.floor(Number(req.body.stock||0))),threshold=Math.max(0,Math.floor(Number(req.body.low_stock_threshold||5)))
    await db.query('UPDATE foods SET stock=?,low_stock_threshold=? WHERE id=?',[stock,threshold,req.params.id])
    await commerce.audit(req.session.user.username,'update_inventory','food',req.params.id,`stock=${stock}; threshold=${threshold}`)
    res.redirect('/admin/inventory')
  }catch(e){next(e)}
}

module.exports={list,update}
