const db = require('../config/db')

function sqlDate(date){return date.toISOString().slice(0,19).replace('T',' ')}
function startOfDay(){const d=new Date();d.setHours(0,0,0,0);return d}
function startOfWeek(){const d=startOfDay();const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d}
function startOfMonth(){const d=startOfDay();d.setDate(1);return d}

async function revenueSince(date){const [[row]]=await db.query("SELECT COALESCE(SUM(total+shipping_fee-COALESCE(discount_amount,0)),0) value FROM orders WHERE status<>'Đã hủy' AND created_at>=?",[sqlDate(date)]);return Number(row?.value||0)}

async function query(req,res,next){
  try{
    const q=String(req.body.question||'').toLowerCase()
    let answer='Bạn có thể hỏi: doanh thu hôm nay/tuần này/tháng này, món bán chạy, món sắp hết, số đơn hoặc khách hàng.'
    if(/doanh thu/.test(q)){
      let label='hiện tại',value
      if(/hôm nay|hom nay|today/.test(q)){label='hôm nay';value=await revenueSince(startOfDay())}
      else if(/tuần|tuan|week/.test(q)){label='tuần này';value=await revenueSince(startOfWeek())}
      else if(/tháng|thang|month/.test(q)){label='tháng này';value=await revenueSince(startOfMonth())}
      else {const [[r]]=await db.query("SELECT COALESCE(SUM(total+shipping_fee-COALESCE(discount_amount,0)),0) value FROM orders WHERE status<>'Đã hủy'");value=Number(r?.value||0)}
      answer=`Doanh thu ${label} là ${value.toLocaleString('vi-VN')}đ.`
    }else if(/bán chạy|ban chay|top món|top mon/.test(q)){
      const [rows]=await db.query("SELECT oi.title,SUM(oi.quantity) qty FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>'Đã hủy' GROUP BY oi.title ORDER BY qty DESC LIMIT 5")
      answer=rows.length?'Top món bán chạy: '+rows.map(x=>`${x.title} (${x.qty})`).join(', '):'Chưa có dữ liệu bán hàng.'
    }else if(/sắp hết|sap het|tồn kho|ton kho/.test(q)){
      const [rows]=await db.query('SELECT title,stock FROM foods WHERE COALESCE(stock,0)<=COALESCE(low_stock_threshold,5) ORDER BY stock ASC LIMIT 10')
      answer=rows.length?'Món sắp hết: '+rows.map(x=>`${x.title} (${x.stock})`).join(', '):'Không có món nào dưới ngưỡng tồn kho.'
    }else if(/bao nhiêu đơn|bao nhieu don|số đơn|so don/.test(q)){
      const [[r]]=await db.query('SELECT COUNT(*) value FROM orders');answer=`Hiện có ${Number(r?.value||0)} đơn hàng.`
    }else if(/khách|khach|user/.test(q)){
      const [[r]]=await db.query('SELECT COUNT(*) value FROM users');answer=`Hiện có ${Number(r?.value||0)} tài khoản.`
    }
    res.json({ok:true,answer})
  }catch(e){next(e)}
}
module.exports={query}
